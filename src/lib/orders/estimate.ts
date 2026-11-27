// S2: stock and waste estimated from data we already receive, until a real stock feed exists (open decision).
//   Delivered(day) = the confirmed factory order for that day, else the forecast the system suggested (whole units).
//   Stock now      = Delivered(today) + usable carry from yesterday − sold today so far.
//   Waste(day)     = 1-day items left unsold at close × price (they can't be sold the next day).
// A manager COUNT always beats the estimate (SM4). Server only.
import "server-only";
import { db } from "@/lib/db";
import { addDays } from "@/lib/time";
import { forecastVersionFilter, pickForecast } from "./forecast-pick";

const dayKey = (d: Date) => d.toISOString().slice(0, 10);
const k = (itemNo: string, d: Date) => `${itemNo}|${dayKey(d)}`;

/** Units delivered per "itemNo|YYYY-MM-DD" between from and to (inclusive). Missing key = unknown. */
export async function deliveredByDay(storeNo: number, from: Date, to: Date): Promise<Map<string, number>> {
    const [orders, forecasts] = await Promise.all([
        db.orderLine.findMany({
            where: { storeNo, deliveryDate: { gte: from, lte: to } },
            select: { itemNo: true, deliveryDate: true, orderedQty: true },
        }),
        db.forecast.findMany({
            where: { storeNo, targetDate: { gte: from, lte: to }, modelVersion: { kind: "TOMORROW", ...forecastVersionFilter } },
            select: { itemNo: true, targetDate: true, predictedQty: true, modelVersion: { select: { isActive: true } } },
            orderBy: { runAt: "desc" }, // newest first → first row per SKU/day wins
        }),
    ]);
    // the model's newest row wins; the provisional baseline only fills a day the model never forecast
    const out = new Map([...pickForecast(forecasts, (f) => k(f.itemNo, f.targetDate))].map(([key, v]) => [key, Math.ceil(v.qty)]));
    for (const o of orders) {
        if (o.orderedQty !== null) out.set(k(o.itemNo, o.deliveryDate), o.orderedQty); // a confirmed order beats the suggestion
    }
    return out;
}

/** Net units sold per "itemNo|YYYY-MM-DD" (sales − returns), from daily_sales. */
async function soldByDay(storeNo: number, from: Date, to: Date): Promise<Map<string, number>> {
    const rows = await db.dailySales.findMany({
        where: { storeNo, saleDate: { gte: from, lte: to } },
        select: { itemNo: true, saleDate: true, qtySold: true, qtyReturned: true },
    });
    return new Map(rows.map((r) => [k(r.itemNo, r.saleDate), r.qtySold - r.qtyReturned]));
}

type SkuShelf = { itemNo: string; shelfLifeDays: number };

/** Per SKU: opening stock (delivered today + usable carry) and stock now (opening − sold so far). */
async function stockToday(storeNo: number, skus: SkuShelf[], today: Date): Promise<Map<string, { opening: number; now: number }>> {
    const yesterday = addDays(today, -1);
    const [delivered, sold] = await Promise.all([
        deliveredByDay(storeNo, yesterday, today),
        soldByDay(storeNo, yesterday, today),
    ]);
    const out = new Map<string, { opening: number; now: number }>();
    for (const s of skus) {
        const inToday = delivered.get(k(s.itemNo, today));
        if (inToday === undefined) continue; // no delivery info → unknown
        // Multi-day items keep yesterday's leftover; 1-day items expired last night
        const carry = s.shelfLifeDays > 1
            ? Math.max(0, (delivered.get(k(s.itemNo, yesterday)) ?? 0) - (sold.get(k(s.itemNo, yesterday)) ?? 0))
            : 0;
        const opening = inToday + carry;
        out.set(s.itemNo, { opening, now: Math.max(0, opening - (sold.get(k(s.itemNo, today)) ?? 0)) });
    }
    return out;
}

/** Estimated stock on the shelf right now, per SKU. SKUs with no delivery info are left out (shown as 0 / counted). */
export async function estimateStockToday(storeNo: number, skus: SkuShelf[], today: Date): Promise<Map<string, number>> {
    const parts = await stockToday(storeNo, skus, today);
    return new Map([...parts].map(([itemNo, p]) => [itemNo, p.now]));
}

/** Stock at opening this morning (delivered + carry), per SKU — the base for "produce 20% more" (SM5). */
export async function openingStockToday(storeNo: number, skus: SkuShelf[], today: Date): Promise<Map<string, number>> {
    const parts = await stockToday(storeNo, skus, today);
    return new Map([...parts].map(([itemNo, p]) => [itemNo, p.opening]));
}

export type WasteEstimate = { date: string; itemNo: string; categoryCode: string; qty: number; value: number };

/** Estimated waste of closed days (from..to): 1-day items delivered but not sold. Only days with sales loaded. */
export async function estimateWaste(storeNo: number, from: Date, to: Date): Promise<WasteEstimate[]> {
    if (to < from) return [];
    const [skus, delivered, sold, openDays] = await Promise.all([
        db.sku.findMany({ where: { inScope: true, shelfLifeDays: { lte: 1 } }, select: { itemNo: true, categoryCode: true, price: true } }),
        deliveredByDay(storeNo, from, to),
        soldByDay(storeNo, from, to),
        db.dailySales.groupBy({ by: ["saleDate"], where: { storeNo, saleDate: { gte: from, lte: to } } }),
    ]);
    const out: WasteEstimate[] = [];
    for (const { saleDate } of openDays) {
        for (const s of skus) {
            const inDay = delivered.get(k(s.itemNo, saleDate));
            if (inDay === undefined) continue; // no order or forecast that day → no estimate
            const qty = Math.max(0, inDay - (sold.get(k(s.itemNo, saleDate)) ?? 0));
            if (qty > 0) out.push({ date: dayKey(saleDate), itemNo: s.itemNo, categoryCode: s.categoryCode, qty, value: qty * Number(s.price) });
        }
    }
    return out;
}
