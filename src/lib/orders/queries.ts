// Factory order inputs for one branch (SM3, SM4). Server only: reads Neon via Prisma.
// Forecast rule (agreed with Mew): active ModelVersion, latest runAt per SKU. Before the model's 13:30 run the
// provisional 4-week baseline saved at store opening fills in (orders/provisional.ts); model rows always win.
import "server-only";
import { db } from "@/lib/db";
import { addDays, startOfToday, todayDate, tomorrowDate } from "@/lib/time";
import { estimateStockToday } from "./estimate";
import { forecastVersionFilter, pickForecast } from "./forecast-pick";
import type { OrderInputs } from "./formula";

export type OrderData = {
    lines: OrderInputs[]; // only SKUs that have a tomorrow forecast
    notOnSale: { itemNo: string; nameTh: string }[]; // in-scope SKUs with no forecast: the model saw no recent sales
    wasteRiskThreshold: number; // BranchThreshold.wasteRiskPct (branch default)
    confirmedAt: Date | null; // last time tomorrow's order was confirmed
    provisional: boolean; // tomorrow's numbers are the opening baseline, not the model yet (it runs at 13:30)
    serverNow: number; // the instant used for today/tomorrow — the client cutoff clock starts here
};

export async function getOrderInputs(storeNo: number, now = new Date()): Promise<OrderData> {
    const today = todayDate(now);
    const tomorrow = tomorrowDate(now);

    // 5 independent queries → one round trip to Neon
    const [skus, forecasts, snapshots, saved, threshold] = await Promise.all([
        db.sku.findMany({
            where: { inScope: true },
            select: { itemNo: true, nameTh: true, categoryCode: true, price: true, shelfLifeDays: true },
            orderBy: { itemNo: "asc" },
        }),
        db.forecast.findMany({
            where: {
                storeNo,
                modelVersion: forecastVersionFilter,
                OR: [
                    { targetDate: today, modelVersion: { kind: "REST_OF_DAY" } },
                    { targetDate: tomorrow, modelVersion: { kind: "TOMORROW" } },
                ],
            },
            select: { itemNo: true, predictedQty: true, modelVersion: { select: { kind: true, isActive: true } } },
            orderBy: { runAt: "desc" }, // newest first → first row per SKU wins
        }),
        db.stockSnapshot.findMany({
            // today only: the upper bound matters in demo mode, where real timestamps are later than the demo day
            where: { storeNo, takenAt: { gte: startOfToday(now), lt: addDays(startOfToday(now), 1) } },
            select: { itemNo: true, qty: true, source: true },
            orderBy: { takenAt: "desc" },
        }),
        db.orderLine.findMany({
            where: { storeNo, deliveryDate: tomorrow },
            select: { itemNo: true, orderedQty: true, confirmedAt: true },
        }),
        db.branchThreshold.findFirst({ where: { storeNo, categoryCode: null }, select: { wasteRiskPct: true } }),
    ]);

    // Group in JS (no N+1). Rows are newest-first; the model's newest row beats the provisional baseline.
    const restPicked = pickForecast(forecasts.filter((f) => f.modelVersion.kind === "REST_OF_DAY"), (f) => f.itemNo);
    const tomorrowPicked = pickForecast(forecasts.filter((f) => f.modelVersion.kind === "TOMORROW"), (f) => f.itemNo);
    const restOfDay = new Map([...restPicked].map(([k, v]) => [k, v.qty]));
    const tomorrowQty = new Map([...tomorrowPicked].map(([k, v]) => [k, v.qty]));
    const provisional = tomorrowPicked.size > 0 && [...tomorrowPicked.values()].every((v) => !v.fromModel);

    // SM4: the manager's COUNT beats a system ESTIMATED, even if the estimate is newer
    const counted = new Map<string, number>();
    const estimated = new Map<string, number>();
    for (const s of snapshots) {
        const target = s.source === "COUNT" ? counted : estimated;
        if (!target.has(s.itemNo)) target.set(s.itemNo, s.qty);
    }

    // S2: no snapshot today → estimate from deliveries and today's sales so far
    const stockEstimate = await estimateStockToday(storeNo, skus, today);

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
            categoryCode: s.categoryCode,
            price: Number(s.price),
            shelfLifeDays: s.shelfLifeDays,
            restOfDay: restOfDay.get(s.itemNo) ?? 0,
            tomorrow: tomorrowQty.get(s.itemNo)!,
            leftNow: counted.get(s.itemNo) ?? estimated.get(s.itemNo) ?? stockEstimate.get(s.itemNo) ?? 0,
            savedOrdered: savedBySku.get(s.itemNo) ?? null,
        }));

    // The model leaves a SKU out when it was not on sale recently (a run of zero-sale days) or has no history
    const notOnSale = skus.filter((s) => !tomorrowQty.has(s.itemNo)).map((s) => ({ itemNo: s.itemNo, nameTh: s.nameTh }));

    return { lines, notOnSale, wasteRiskThreshold: Number(threshold?.wasteRiskPct ?? 10), confirmedAt, provisional, serverNow: now.getTime() };
}