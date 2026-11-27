// Waste per day for the dashboard and analytics (SM7, S2). Server only.
// A day with a stored WasteRecord (D365 daily report or manual entry) uses it; a closed day without one
// uses the estimate from deliveries and sales (orders/estimate.ts). Today is still open, so it has no estimate.
import "server-only";
import { db } from "@/lib/db";
import { estimateWaste } from "@/lib/orders/estimate";
import { addDays } from "@/lib/time";
import { expectedDaySales, wasteTarget, type WasteDay } from "./target";

export type WasteByCategory = { code: string; name: string; value: number; qty: number };

const dayKey = (d: Date) => d.toISOString().slice(0, 10);

/** ฿ waste per "YYYY-MM-DD" from `from` to `today`, plus a by-category split of the estimated part. */
export async function getWaste(storeNo: number, from: Date, today: Date) {
    const [stored, estimated, skus] = await Promise.all([
        db.wasteRecord.groupBy({
            by: ["wasteDate"],
            where: { storeNo, wasteDate: { gte: from, lte: today } },
            _sum: { value: true },
        }),
        estimateWaste(storeNo, from, addDays(today, -1)),
        db.sku.findMany({ where: { inScope: true }, select: { categoryCode: true, categoryName: true } }),
    ]);

    const byDay = new Map(stored.map((w) => [dayKey(w.wasteDate), Number(w._sum.value ?? 0)]));
    const used = estimated.filter((e) => !byDay.has(e.date)); // stored data wins for its day
    for (const e of used) byDay.set(e.date, (byDay.get(e.date) ?? 0) + e.value);

    const names = new Map(skus.map((s) => [s.categoryCode, s.categoryName ?? s.categoryCode]));
    const cats = new Map<string, WasteByCategory>();
    for (const e of used) {
        const c = cats.get(e.categoryCode) ?? { code: e.categoryCode, name: names.get(e.categoryCode) ?? e.categoryCode, value: 0, qty: 0 };
        c.value += e.value;
        c.qty += e.qty;
        cats.set(e.categoryCode, c);
    }
    return { byDay, byCategory: [...cats.values()].sort((a, b) => b.value - a.value), estimated: used.length > 0 };
}

const SAME_WEEKDAYS = 4;

/**
 * One WasteDay per day from `from` to `today` (oldest first): waste ฿ plus that day's target, 5% of its total
 * sales (daily_sales, every item of the branch). Today uses the expected total (waste/target.ts).
 */
export async function getWasteDays(storeNo: number, from: Date, today: Date, wasteByDay: Map<string, number>): Promise<WasteDay[]> {
    const historyFrom = addDays(today, -7 * SAME_WEEKDAYS);
    const salesRows = await db.dailySales.groupBy({
        by: ["saleDate"],
        where: { storeNo, saleDate: { gte: historyFrom < from ? historyFrom : from, lte: today } },
        _sum: { salesValue: true },
    });
    const sales = new Map(salesRows.map((r) => [dayKey(r.saleDate), Number(r._sum.salesValue ?? 0)]));
    const todayKey = dayKey(today);
    const days: WasteDay[] = [];
    for (let d = from; d <= today; d = addDays(d, 1)) {
        const date = dayKey(d);
        const value = wasteByDay.get(date) ?? 0;
        if (date !== todayKey) {
            const s = sales.get(date) ?? 0;
            days.push({ date, value, sales: s, target: wasteTarget(s) });
            continue;
        }
        const weekdays = Array.from({ length: SAME_WEEKDAYS }, (_, i) => sales.get(dayKey(addDays(today, -7 * (i + 1)))) ?? 0);
        const expected = expectedDaySales(sales.get(date) ?? 0, weekdays);
        days.push({ date, value, sales: expected, target: wasteTarget(expected), expected: true });
    }
    return days;
}
