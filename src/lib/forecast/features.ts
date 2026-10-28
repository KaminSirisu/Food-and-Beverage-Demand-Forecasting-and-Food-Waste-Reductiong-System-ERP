// Feature builder for the two forecast models (rest_of_day, tomorrow). Owner: Mew.
// Must give exactly the same numbers as ml/train_models.py build_features() (NFR7).
// Pure: no DB. The caller loads daily_sales rows (see DailyInput) and passes them in.
//
// One row per (branch, SKU, day D), decided at 13:30 (CUTOFF) of day D:
//   rest_of_day predicts units sold on D from 13:30 to closing (26 inputs)
//   tomorrow    predicts units sold on D+1, whole day          (19 inputs)
// Each model returns a ratio; predicted units = ratio × level.

/** Input order of each ONNX model. Must equal models/features.json. */
export const FEATURES_REST = [
    "sku_id", "category_id", "branch_id", "branch_tier_id", "shelf_life_days", "price", "discount_pct",
    "sold_to_T", "ratio_to_T", "mean_full_7d",
    "lag_after_T_1", "lag_after_T_2", "lag_after_T_3", "lag_after_T_4",
    "lag_full_1", "lag_full_2", "lag_full_3", "lag_full_4",
    "mean_after_T_7d", "share_after_T_28d", "dow", "is_weekend", "is_payday", "is_holiday",
    "day_of_month", "minutes_to_close",
] as const;
export const FEATURES_TOM = [
    "sku_id", "category_id", "branch_id", "branch_tier_id", "shelf_life_days", "price", "discount_pct",
    "sold_to_T", "ratio_to_T", "mean_full_7d",
    "m2_lag_full_1", "m2_lag_full_2", "m2_lag_full_3", "m2_lag_full_4",
    "m2_dow", "m2_is_weekend", "m2_is_payday", "m2_is_holiday", "m2_day_of_month",
] as const;

/** One SKU-day from daily_sales (only days with at least one sale need a row). */
export type DailyInput = {
    date: string; // "YYYY-MM-DD"
    qtySold: number; // units sold the whole day (daily_sales.qty_sold)
    qtyBeforeCutoff: number; // units sold before 13:30 (daily_sales.qty_before_cutoff)
    priceBeforeCutoff: number | null; // price of the last sale before 13:30, null if none
    discountBeforeCutoff: number; // Σ |discount| of sales before 13:30
    grossBeforeCutoff: number; // Σ price × units of sales before 13:30
};

/** Fixed facts about one SKU and the branch (from encoders.json and the sku table). */
export type SkuContext = {
    itemNo: string;
    skuId: number; // encoders.json "sku"
    categoryId: number; // encoders.json "category" of sku.category_code
    shelfLifeDays: number;
    branchId?: number; // encoders.json "branch" (801 → 0)
    branchTierId?: number; // mall = 0
    minutesToClose?: number; // 21:00 − 13:30 = 450
};

export type ModelRow = {
    features: Record<string, number>; // NaN = missing
    vector: Float32Array; // ONNX input in model order
    level: number; // predicted units = model output × level
    eligible: boolean; // false = the model was not trained on such rows (SKU not on sale, no history)
};
export type FeatureRow = { itemNo: string; date: string; onSale: boolean; restOfDay: ModelRow; tomorrow: ModelRow };

export type BuildOptions = {
    openDays: Iterable<string>; // days the branch sold anything (any item)
    holidays: Iterable<string>; // Thai public holidays, "YYYY-MM-DD"
    trainEnd: string; // last training day; sets the not-on-sale rule per SKU (model_info.json)
    from?: string; // first day of the series (default: first open day)
    to?: string; // last day of the series (default: last open day)
};

const DAY_MS = 86_400_000;
const toMs = (d: string) => Date.parse(`${d}T00:00:00Z`);
const toYmd = (ms: number) => new Date(ms).toISOString().slice(0, 10);

/** Mean or sum of the non-missing values on days i-back … i-1 (like pandas shift(1).rolling(back)); NaN if fewer than minCount. */
function windowStat(x: number[], i: number, back: number, minCount: number, kind: "mean" | "sum"): number {
    let sum = 0, n = 0;
    for (let j = i - back; j <= i - 1; j++) {
        if (j < 0) continue;
        const v = x[j];
        if (!Number.isNaN(v)) { sum += v; n++; }
    }
    if (n < minCount) return NaN;
    return kind === "mean" ? sum / n : sum;
}
const at = (x: number[], j: number) => (j >= 0 && j < x.length ? x[j] : NaN);

function calendar(ms: number, holidays: Set<string>) {
    const d = new Date(ms);
    const dow = (d.getUTCDay() + 6) % 7; // Python: Monday = 0 … Sunday = 6
    const day = d.getUTCDate();
    return {
        dow,
        isWeekend: dow >= 4 ? 1 : 0, // Fri – Sun
        isPayday: day >= 25 || day <= 2 || day === 15 || day === 16 ? 1 : 0,
        isHoliday: holidays.has(toYmd(ms)) ? 1 : 0,
        dayOfMonth: day,
    };
}

/**
 * Build the feature rows of one SKU for every day of the series.
 * Rules match train_models.py: closed days are missing; a run of zero-sale open days
 * (3+ days, or 21+ for SKUs under 2 units/day in training) means "not on sale" and is missing too.
 */
export function buildFeatureRows(sku: SkuContext, daily: DailyInput[], opts: BuildOptions): FeatureRow[] {
    const open = new Set(opts.openDays);
    const holidays = new Set(opts.holidays);
    const openSorted = [...open].sort();
    const start = toMs(opts.from ?? openSorted[0]);
    const end = toMs(opts.to ?? openSorted[openSorted.length - 1]);
    const n = Math.round((end - start) / DAY_MS) + 1;
    const dates = Array.from({ length: n }, (_, i) => start + i * DAY_MS);
    const byDate = new Map(daily.map((r) => [r.date, r]));

    // 1. Daily series: closed day = NaN, open day without a row = 0
    const isOpen = dates.map((ms) => open.has(toYmd(ms)));
    const full = dates.map((ms, i) => (isOpen[i] ? byDate.get(toYmd(ms))?.qtySold ?? 0 : NaN));
    const toT0 = dates.map((ms, i) => (isOpen[i] ? byDate.get(toYmd(ms))?.qtyBeforeCutoff ?? 0 : NaN));

    // 2. Not-on-sale rule (needs the zero run length, so it looks at the whole series)
    const trainEndMs = toMs(opts.trainEnd);
    const trainVals = full.filter((v, i) => dates[i] <= trainEndMs && !Number.isNaN(v));
    const avgDay = trainVals.length ? trainVals.reduce((s, v) => s + v, 0) / trainVals.length : NaN;
    const minRun = avgDay >= 2 ? 3 : 21;
    const onSale = new Array<boolean>(n);
    for (let i = 0; i < n; ) {
        if (full[i] === 0) {
            let j = i;
            while (j < n && full[j] === 0) j++;
            const off = j - i >= minRun;
            for (let k = i; k < j; k++) onSale[k] = !off;
            i = j;
        } else { onSale[i] = isOpen[i]; i++; }
    }
    const fullS = full.map((v, i) => (onSale[i] ? v : NaN));
    const toT = toT0.map((v, i) => (onSale[i] ? v : NaN));
    const aft = fullS.map((v, i) => v - toT[i]);

    // 3. Price (last before 13:30, carried forward then backward) and discount share before 13:30
    const price = dates.map((ms) => byDate.get(toYmd(ms))?.priceBeforeCutoff ?? NaN);
    for (let i = 1; i < n; i++) if (Number.isNaN(price[i])) price[i] = price[i - 1];
    for (let i = n - 2; i >= 0; i--) if (Number.isNaN(price[i])) price[i] = price[i + 1];
    const discountPct = dates.map((ms) => {
        const r = byDate.get(toYmd(ms));
        if (!r || r.grossBeforeCutoff === 0) return 0;
        return Math.min(1, Math.max(0, r.discountBeforeCutoff / r.grossBeforeCutoff));
    });

    const branchId = sku.branchId ?? 0, tierId = sku.branchTierId ?? 0, minutesToClose = sku.minutesToClose ?? 450;
    const rows: FeatureRow[] = [];
    for (let i = 0; i < n; i++) {
        // shared
        const sameDow = [1, 2, 3, 4].map((k) => at(toT, i - 7 * k)).filter((v) => !Number.isNaN(v));
        const usualToT = sameDow.length ? sameDow.reduce((s, v) => s + v, 0) / sameDow.length : NaN;
        const ratioToT = usualToT === 0 || Number.isNaN(usualToT) ? NaN : toT[i] / usualToT;
        const mean7 = windowStat(fullS, i, 7, 3, "mean");
        const sumAft28 = windowStat(aft, i, 28, 7, "sum");
        const sumFull28 = windowStat(fullS, i, 28, 7, "sum");
        const share28 = sumFull28 === 0 || Number.isNaN(sumFull28) ? NaN : sumAft28 / sumFull28;
        const active28 = windowStat(fullS, i, 28, 1, "sum") > 0; // NaN > 0 is false
        const common: Record<string, number> = {
            sku_id: sku.skuId, category_id: sku.categoryId, branch_id: branchId, branch_tier_id: tierId,
            shelf_life_days: sku.shelfLifeDays, price: price[i], discount_pct: discountPct[i],
            sold_to_T: toT[i], ratio_to_T: ratioToT, mean_full_7d: mean7,
        };

        // Model 1: today (D)
        const c1 = calendar(dates[i], holidays);
        const rest: Record<string, number> = { ...common };
        for (const k of [1, 2, 3, 4]) rest[`lag_after_T_${k}`] = at(aft, i - 7 * k);
        for (const k of [1, 2, 3, 4]) rest[`lag_full_${k}`] = at(fullS, i - 7 * k);
        Object.assign(rest, {
            mean_after_T_7d: windowStat(aft, i, 7, 3, "mean"), share_after_T_28d: share28,
            dow: c1.dow, is_weekend: c1.isWeekend, is_payday: c1.isPayday, is_holiday: c1.isHoliday,
            day_of_month: c1.dayOfMonth, minutes_to_close: minutesToClose,
        });

        // Model 2: tomorrow (D+1); lags = same weekday as tomorrow, 1-4 weeks back
        const c2 = calendar(dates[i] + DAY_MS, holidays);
        const tom: Record<string, number> = { ...common };
        for (const k of [1, 2, 3, 4]) tom[`m2_lag_full_${k}`] = at(fullS, i - (7 * k - 1));
        Object.assign(tom, {
            m2_dow: c2.dow, m2_is_weekend: c2.isWeekend, m2_is_payday: c2.isPayday,
            m2_is_holiday: c2.isHoliday, m2_day_of_month: c2.dayOfMonth,
        });

        const base = onSale[i] && active28 && !Number.isNaN(mean7);
        const tomorrowOnSale = i + 1 < n ? onSale[i + 1] : false;
        const shareOr = Number.isNaN(share28) ? 0.5 : share28;
        rows.push({
            itemNo: sku.itemNo, date: toYmd(dates[i]), onSale: onSale[i],
            restOfDay: {
                features: rest, vector: Float32Array.from(FEATURES_REST.map((f) => rest[f])),
                level: Math.max(0.5, mean7 * shareOr), eligible: base,
            },
            tomorrow: {
                features: tom, vector: Float32Array.from(FEATURES_TOM.map((f) => tom[f])),
                level: Math.max(1, mean7), eligible: base && tomorrowOnSale,
            },
        });
    }
    return rows;
}
