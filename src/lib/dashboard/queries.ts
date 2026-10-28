// Dashboard & Pre-Rush Alerts data for one branch. Server only: reads Neon via Prisma.
// Reuses the factory order inputs, so the KPIs and the order card always agree.
import "server-only";
import { db } from "@/lib/db";
import { getOrderInputs, type OrderData } from "@/lib/orders/queries";
import { addDays, todayDate } from "@/lib/time";
import { riskSkus, sumValue, type RiskSku } from "./risk";

export type WasteDay = { date: string, value: number }; // date = "YYYY-MM-DD" (Bangkok day)
export type PromoCandidate = RiskSku & {
    discountPct: number;
    status: string; // Promotion.posStatus (PENDING | LIVE | NONE), or SUGGESTED when no row exists yet
};

export type DashboardData = {
    order: OrderData; // passed straight to FactoryOrderCard
    wasteToday: number;
    lostSalesRisk: number;
    wasteLast7Days: WasteDay[]; // always 7 entries, oldest -> today
    topRisk: RiskSku[];
    promos: PromoCandidate[];
}

export async function getDashboard(storeNo: number, now = new Date()): Promise<DashboardData> {
    const today = todayDate(now);
    const weekStart = addDays(today, -6);

    const [order, waste, promotions, threshold] = await Promise.all([
        getOrderInputs(storeNo, now),
        db.wasteRecord.groupBy({
            by: ["wasteDate"],
            where: { storeNo, wasteDate: { gte: weekStart, lte: today } },
            _sum: { value: true },
        }),
        db.promotion.findMany({
            where: { storeNo, promoDate: today },
            select: { itemNo: true, discountPct: true, posStatus: true },
        }),
        db.branchThreshold.findFirst({
            where: { storeNo, categoryCode: null },
            select: { discountPct: true },
        })
    ])
    // Days with no WasteRecord still get a bar (value 0), so the chart always has 7
    const byDay = new Map(waste.map((w) => [w.wasteDate.getTime(), Number(w._sum.value ?? 0)]));
    const wasteLast7Days = Array.from({ length: 7 }, (_, i) => {
        const day = addDays(weekStart, i);
        return { date: day.toISOString().slice(0, 10), value: byDay.get(day.getTime()) ?? 0};
    })

    const risks = riskSkus(order.lines, order.wasteRiskThreshold);

    // A promo already created today keeps its own discount and POS status
    const promoByItem = new Map(promotions.map((p) => [p.itemNo, p]));
    const defaultDiscount = Number(threshold?.discountPct ?? 20);
    const promos = risks
        .filter((r) => r.kind === "WASTE")
        .map((r) => {
            const saved = promoByItem.get(r.itemNo);
            return {
                ...r,
                discountPct: saved ? Number(saved.discountPct) : defaultDiscount,
                status: saved?.posStatus ?? "SUGGESTED",
            }
        })
    return {
        order,
        wasteToday: wasteLast7Days.at(-1)?.value ?? 0,
        lostSalesRisk: sumValue(risks, "SHORTAGE"),
        wasteLast7Days,
        topRisk: risks.slice(0, 5),
        promos,
    };
}

/** S1: newest finished D365 import. Any branch, because one file holds all 36. null = nothing loaded yet. */
export async function getLastSync(): Promise<Date | null> {
    const batch = await db.importBatch.findFirst({
        where: { status: { in: ["LOADED", "LOADED_WITH_ERRORS"] }, finishedAt: { not: null } },
        orderBy: { finishedAt: "desc" },
        select: { finishedAt: true },
    });
    return batch?.finishedAt ?? null;
}
