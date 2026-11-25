// A7: production multiplier k per SKU, re-chosen from the last 56 days. Owner: Mew.
// A TypeScript port of Cell 7 of the training notebook (ERP_Forecast.ipynb): simulate the order rule day by day
//   Order(D+1) = max(0, k x F_tomorrow x (1 + Buffer%) - Carry), decided at 13:30 of day D
// with shelf-life stock, then pick the k set with the lowest stockout that keeps waste under WASTE_AIM.
// Pure: no DB. The forecast models are not retrained; only the production multiplier is adjusted.

export type Buffer = { normal: number; weekend: number; payday: number; holiday: number };
// Buffer % chosen on the validation month (Mar 2023): normal 5, weekend 8, payday 12, holiday or day before a holiday 12.5
export const BUFFER: Buffer = { normal: 5, weekend: 8, payday: 12, holiday: 12.5 };
export const WASTE_TARGET = 5; // %, by selling-price value
export const STOCKOUT_TARGET = 25; // %
export const WASTE_AIM = 3.0; // aim a little below the 5% target, because a new month often turns out worse
export const WINDOW_DAYS = 56;
export const K_LIST = Array.from({ length: 21 }, (_, i) => Math.round((0.5 + i * 0.1) * 10) / 10); // 0.5 … 2.5

/** One SKU-day, everything the simulation needs (all known by the end of day D). */
export type SimDay = {
    onSale: boolean; // store open and product on sale
    soldToT: number; // units sold before 13:30
    soldAfterT: number; // units sold after 13:30
    price: number;
    fRest: number; // model 1 forecast for the rest of D (0 when the model does not cover the day)
    fTom: number; // model 2 forecast for D+1 (0 when not covered)
    weekendM2: boolean; // calendar of D+1
    paydayM2: boolean;
    holidayM2: boolean;
    beforeHolidayM2: boolean; // D+2 is a holiday
};
export type SimRow = { waste: number; lost: number; demand: number; price: number };

// Python round() rounds halves to the nearest even number (JS Math.round rounds them up)
function roundHalfEven(x: number): number {
    const f = Math.floor(x), d = x - f;
    if (d < 0.5) return f;
    if (d > 0.5) return f + 1;
    return f % 2 === 0 ? f : f + 1;
}

const bufferPct = (r: SimDay, b: Buffer) => {
    let pct = b.normal;
    if (r.weekendM2) pct = Math.max(pct, b.weekend);
    if (r.paydayM2) pct = Math.max(pct, b.payday);
    if (r.holidayM2 || r.beforeHolidayM2) pct = Math.max(pct, b.holiday);
    return pct;
};

const addDay = (d: string, k: number) => new Date(Date.parse(`${d}T00:00:00Z`) + k * 86_400_000).toISOString().slice(0, 10);

/**
 * Simulate one SKU day by day from `start` to `end` ("YYYY-MM-DD") with one multiplier k.
 * `days` must hold start-1 … end (the day before the window decides the first order).
 */
export function simulate(days: Map<string, SimDay>, life: number, start: string, end: string, b: Buffer, k: number): SimRow[] {
    const stock: [number, number][] = []; // [age in days, qty], oldest first
    const out: SimRow[] = [];
    let orderNext = 0;
    for (let D = addDay(start, -1); D <= end; D = addDay(D, 1)) {
        const r = days.get(D);
        if (!r) throw new Error(`simulate: missing day ${D}`);
        const tomorrow = addDay(D, 1);
        const isEval = D >= start;
        if (isEval) stock.push([0, orderNext]); // this morning's production arrives
        const selling = r.onSale;
        const demToT = selling ? r.soldToT : 0, demAft = selling ? r.soldAfterT : 0;
        let sold = 0, need = demToT; // morning sales until T, oldest stock first
        for (const bt of stock) { const take = Math.min(bt[1], need); bt[1] -= take; need -= take; sold += take; }
        // at time T: decide tomorrow's production
        const expTonight = stock.reduce((s, [a, q]) => (a + 1 >= life ? s + q : s), 0);
        const keepTom = stock.reduce((s, [a, q]) => (a + 1 < life ? s + q : s), 0);
        const carry = Math.max(0, keepTom - Math.max(0, r.fRest - expTonight));
        const bpct = bufferPct(r, b);
        orderNext = Math.max(0, roundHalfEven(k * r.fTom * (1 + bpct / 100) - carry));
        const tm = days.get(tomorrow);
        if (tm && !tm.onSale) orderNext = 0; // product not on sale tomorrow: nothing is made
        // afternoon sales after T
        need = demAft;
        for (const bt of stock) { const take = Math.min(bt[1], need); bt[1] -= take; need -= take; sold += take; }
        let waste = 0;
        const keep: [number, number][] = [];
        for (const [a, q] of stock) { // closing: stock that reached its shelf life is waste
            if (q <= 0) continue;
            if (a + 1 >= life) waste += q; else keep.push([a + 1, q]);
        }
        stock.length = 0; stock.push(...keep);
        if (isEval && (selling || waste > 0)) {
            const demand = demToT + demAft;
            out.push({ waste, lost: demand - sold, demand, price: r.price });
        }
    }
    return out;
}

export type KChoice = { wastePct: number; stockoutPct: number; k: Record<string, number> };

/**
 * Try every k for every SKU on [start, end]; pick the set with the lowest total stockout that keeps
 * total waste below WASTE_AIM (or the best balance against the targets if that is impossible).
 */
export function chooseK(series: Record<string, { days: Map<string, SimDay>; life: number }>, start: string, end: string, b: Buffer = BUFFER): KChoice {
    const skus = Object.keys(series);
    type G = { sku: string; k: number; waste: number; lost: number };
    const grid: G[] = [];
    let rev = 0;
    for (const sku of skus) {
        let skuRev = 0;
        for (const k of K_LIST) {
            const rows = simulate(series[sku].days, series[sku].life, start, end, b, k);
            grid.push({
                sku, k,
                waste: rows.reduce((s, r) => s + r.waste * r.price, 0),
                lost: rows.reduce((s, r) => s + r.lost * r.price, 0),
            });
            skuRev = rows.reduce((s, r) => s + r.demand * r.price, 0); // same for every k
        }
        rev += skuRev;
    }
    // lam = how much worse 1% waste is than 1% stockout (same sweep as the notebook)
    const lams = [...Array.from({ length: 100 }, (_, i) => i * 0.02), ...Array.from({ length: 116 }, (_, i) => 2 + i * 0.5)];
    const options: KChoice[] = lams.map((lam) => {
        const k: Record<string, number> = {};
        let w = 0, l = 0;
        for (const sku of skus) {
            let best: G | undefined, bestScore = Infinity;
            for (const g of grid) {
                if (g.sku !== sku) continue;
                const score = g.lost + lam * g.waste;
                if (score < bestScore) { bestScore = score; best = g; } // first minimum wins (lowest k)
            }
            k[sku] = best!.k; w += best!.waste; l += best!.lost;
        }
        return { wastePct: (100 * w) / rev, stockoutPct: (100 * l) / rev, k };
    });
    const good = options.filter((o) => o.wastePct < WASTE_AIM && o.stockoutPct < STOCKOUT_TARGET);
    const pick = (list: KChoice[], score: (o: KChoice) => number) => list.reduce((a, o) => (score(o) < score(a) ? o : a));
    return good.length
        ? pick(good, (o) => o.stockoutPct)
        : pick(options, (o) => Math.max(o.wastePct / WASTE_TARGET, o.stockoutPct / STOCKOUT_TARGET));
}
