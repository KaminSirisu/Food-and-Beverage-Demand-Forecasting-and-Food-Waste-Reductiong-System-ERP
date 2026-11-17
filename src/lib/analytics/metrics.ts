// Forecast vs. Actual analytics: accuracy and waste maths. Pure (no DB), like orders/formula.ts,
// so Vitest can check it with the mockup numbers. S8: show forecast accuracy · NFR6: MAPE / RMSE.

export type Accuracy = "GOOD" | "FAIR" | "REVIEW";

// MAPE bands from the mockup: 8.9% Good · 10.3% / 13.8% Fair · 18% / 19.4% Review
export const GOOD_MAPE = 10;
export const FAIR_MAPE = 15;
// Variance this far off (either way) is shown in red
export const VARIANCE_ALERT_PCT = 20;

/** One SKU on one day. forecast null = the model made no prediction for that day. */
export type DayPair = { date: string; forecast: number | null; actual: number };

/** (actual − forecast) / forecast, in %. Mockup: forecast 14, actual 15 → +7. null when forecast is 0. */
export function variancePct(forecast: number, actual: number): number | null {
    if (forecast === 0) return null;
    return ((actual - forecast) / forecast) * 100;
}

/** Mean absolute % error over days with a forecast and actual > 0 (a 0-sale day would divide by 0). */
export function mape(pairs: DayPair[]): number | null {
    const used = pairs.filter((p): p is DayPair & { forecast: number } => p.forecast !== null && p.actual > 0);
    if (used.length === 0) return null;
    const total = used.reduce((sum, p) => sum + Math.abs(p.actual - p.forecast) / p.actual, 0);
    return (total / used.length) * 100;
}

/** Root mean squared error in units, over days that have a forecast. */
export function rmse(pairs: DayPair[]): number | null {
    const used = pairs.filter((p): p is DayPair & { forecast: number } => p.forecast !== null);
    if (used.length === 0) return null;
    const total = used.reduce((sum, p) => sum + (p.actual - p.forecast) ** 2, 0);
    return Math.sqrt(total / used.length);
}

/** No MAPE yet (no forecasts in the window) → REVIEW, so a missing model is never shown as "Good". */
export function accuracyLabel(mapePct: number | null): Accuracy {
    if (mapePct === null) return "REVIEW";
    if (mapePct < GOOD_MAPE) return "GOOD";
    if (mapePct < FAIR_MAPE) return "FAIR";
    return "REVIEW";
}

/** "YYYY-MM-DD" for every day from `from` (UTC midnight) for `days` days. */
export function dayKeys(from: Date, days: number): string[] {
    return Array.from({ length: days }, (_, i) => new Date(from.getTime() + i * 86_400_000).toISOString().slice(0, 10));
}

/** Put values on a fixed list of days; days with no value get `empty` (so charts always have N points). */
export function fillDays<T>(keys: string[], values: Map<string, T>, empty: T): { date: string; value: T }[] {
    return keys.map((date) => ({ date, value: values.get(date) ?? empty }));
}

export type SkuAccuracy = {
    itemNo: string;
    forecast: number | null; // latest day in the window
    actual: number; // latest day in the window
    variancePct: number | null;
    mape: number | null; // whole window
    rmse: number | null; // whole window
    accuracy: Accuracy;
};

/** One table row. `pairs` must be oldest → newest; the last one is "today" in the table. */
export function skuAccuracy(itemNo: string, pairs: DayPair[]): SkuAccuracy {
    const last = pairs.at(-1);
    const forecast = last?.forecast ?? null;
    const actual = last?.actual ?? 0;
    const m = mape(pairs);
    return {
        itemNo,
        forecast,
        actual,
        variancePct: forecast === null ? null : variancePct(forecast, actual),
        mape: m,
        rmse: rmse(pairs),
        accuracy: accuracyLabel(m),
    };
}

export type WasteTotals = {
    last7: number;
    last30: number;
    avg7: number; // ฿ per day over the last 7
    daysOver30: number; // days in the last 30 above the daily target
};

/** `days` = ฿ waste per day, oldest → newest, up to 30 entries. */
export function wasteTotals(days: number[], target: number): WasteTotals {
    const last30 = days.slice(-30);
    const last7 = days.slice(-7);
    const sum = (xs: number[]) => xs.reduce((s, x) => s + x, 0);
    return {
        last7: sum(last7),
        last30: sum(last30),
        avg7: last7.length ? sum(last7) / last7.length : 0,
        daysOver30: last30.filter((v) => v > target).length,
    };
}
