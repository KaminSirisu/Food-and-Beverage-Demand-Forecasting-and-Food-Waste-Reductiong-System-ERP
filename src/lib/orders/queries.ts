// Factory order inputs for one branch (SM3, SM4). Server only: reads Neon via Prisma.
// Forecast rule (agreed with Mew): active ModelVersion only, latest runAt per SKU.
import "server-only";
import { db } from "@/lib/db";
import { startOfToday, todayDate, tomorrowDate } from "@/lib/time";
import type { OrderInputs } from "./formula";

export type OrderData = {
    lines: OrderInputs[]; // only SKUs that have a tomorrow forecast
    wasteRiskThreshold: number; // BranchThreshold.wasteRiskPct (branch default)
    confirmedAt: Date | null; // last time tomorrow's order was confirmed
};

export async function getOrderInputs(storeNo: number, now = new Date()): Promise<OrderData> {
    const today = todayDate(now);
    const tomorrow = tomorrowDate(now);

    // 5 independent queries → one round trip to Neon
    const [skus, forecasts, snapshots, saved, threshold] = await Promise.all([
        db.sku.findMany({
            where: { inScope: true },
            select: { itemNo: true, nameTh: true, price: true, shelfLifeDays: true },
            orderBy: { itemNo: "asc" },
        }),
        db.forecast.findMany({
            where: {
                storeNo,
                modelVersion: { isActive: true },
                OR: [
                    { targetDate: today, modelVersion: { kind: "REST_OF_DAY" } },
                    { targetDate: tomorrow, modelVersion: { kind: "TOMORROW" } },
                ],
            },
            select: { itemNo: true, predictedQty: true, modelVersion: { select: { kind: true } } },
            orderBy: { runAt: "desc" }, // newest first → first row per SKU wins
        }),
        db.stockSnapshot.findMany({
            where: { storeNo, takenAt: { gte: startOfToday(now) } },
            select: { itemNo: true, qty: true, source: true },
            orderBy: { takenAt: "desc" },
        }),
        db.orderLine.findMany({
            where: { storeNo, deliveryDate: tomorrow },
            select: { itemNo: true, orderedQty: true, confirmedAt: true },
        }),
        db.branchThreshold.findFirst({ where: { storeNo, categoryCode: null }, select: { wasteRiskPct: true } }),
    ]);

    // Group in JS (no N+1). Rows are newest-first, so keep only the first one per key.
    const restOfDay = new Map<string, number>();
    const tomorrowQty = new Map<string, number>();
    for (const f of forecasts) {
        const target = f.modelVersion.kind === "REST_OF_DAY" ? restOfDay : tomorrowQty;
        if (!target.has(f.itemNo)) target.set(f.itemNo, Number(f.predictedQty));
    }

    // SM4: the manager's COUNT beats a system ESTIMATED, even if the estimate is newer
    const counted = new Map<string, number>();
    const estimated = new Map<string, number>();
    for (const s of snapshots) {
        const target = s.source === "COUNT" ? counted : estimated;
        if (!target.has(s.itemNo)) target.set(s.itemNo, s.qty);
    }

    const savedBySku = new Map(saved.map((o) => [o.itemNo, o.orderedQty]));
    const confirmedAt = saved.reduce<Date | null>(
        (latest, o) => (o.confirmedAt && (!latest || o.confirmedAt > latest) ? o.confirmedAt : latest),
        null,
    );

    const lines: OrderInputs[] = skus
        .filter((s) => tomorrowQty.has(s.itemNo)) // no forecast → we can't suggest; don't show a fake 0
        .map((s) => ({
            itemNo: s.itemNo,
            nameTh: s.nameTh,
            price: Number(s.price),
            shelfLifeDays: s.shelfLifeDays,
            restOfDay: restOfDay.get(s.itemNo) ?? 0,
            tomorrow: tomorrowQty.get(s.itemNo)!,
            leftNow: counted.get(s.itemNo) ?? estimated.get(s.itemNo) ?? 0,
            savedOrdered: savedBySku.get(s.itemNo) ?? null,
        }));

    return { lines, wasteRiskThreshold: Number(threshold?.wasteRiskPct ?? 10), confirmedAt };
}