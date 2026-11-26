// Waste per day for the dashboard and analytics (SM7, S2). Server only.
// A day with a stored WasteRecord (D365 daily report or manual entry) uses it; a closed day without one
// uses the estimate from deliveries and sales (orders/estimate.ts). Today is still open, so it has no estimate.
import "server-only";
import { db } from "@/lib/db";
import { estimateWaste } from "@/lib/orders/estimate";
import { addDays } from "@/lib/time";

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
