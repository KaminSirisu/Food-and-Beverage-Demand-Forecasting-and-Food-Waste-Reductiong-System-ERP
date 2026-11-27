// Dashboard & Pre-Rush Alerts data for one branch. Server only: reads Neon via Prisma.
// Reuses the factory order inputs, so the KPIs and the order card always agree.
import "server-only";
import { db } from "@/lib/db";
import { getOrderInputs, type OrderData } from "@/lib/orders/queries";
import { getPromotions } from "@/lib/promotions/queries";
import { addDays, todayDate } from "@/lib/time";
import { projectedWasteTonight, riskSkus, sumValue, type RiskSku } from "./risk";
import { getWaste, getWasteDays, type WasteByCategory } from "@/lib/waste/queries";
import type { WasteDay } from "@/lib/waste/target";

export type { WasteDay };
export type PromoCandidate = RiskSku & {
    discountPct: number;
    status: string; // Promotion.posStatus (PENDING | LIVE | NONE), or SUGGESTED when no row exists yet
};

export type DashboardData = {
    order: OrderData; // passed straight to FactoryOrderCard
    wasteToday: number; // ฿ already recorded today (D365 report / manual)
    wasteProjected: number; // ฿ of last-day stock expected to be left unsold at close tonight
    lostSalesRisk: number;
    wasteLast7Days: WasteDay[]; // always 7 entries, oldest -> today, each with its 5%-of-sales target
    wasteByCategory: WasteByCategory[]; // last 7 days, biggest first (estimated part)
    topRisk: RiskSku[];
    promos: PromoCandidate[];
}

export async function getDashboard(storeNo: number, now = new Date()): Promise<DashboardData> {
    const today = todayDate(now);
    const weekStart = addDays(today, -6);

    const [order, waste] = await Promise.all([
        getOrderInputs(storeNo, now),
        getWaste(storeNo, weekStart, today),
    ]);
    // Same rows as the Waste & Auto-Promotion page (S7, SM9) — reuses the order inputs loaded above
    const promotions = await getPromotions(storeNo, now, order);

    // Days with no waste still get a point (value 0), so the chart always has 7
    const wasteLast7Days = await getWasteDays(storeNo, weekStart, today, waste.byDay);

    // S7: per-category waste-risk %, same lookup the promotion rows used
    const wasteRiskByCategory = new Map(promotions.triggers.map((t) => [t.code, t.wasteRiskPct]));
    const risks = riskSkus(order.lines, (code) => wasteRiskByCategory.get(code) ?? order.wasteRiskThreshold);

    // SM9: SKUs with a discount today. A row not saved yet is still a suggestion.
    const promos = promotions.rows
        .filter((r) => r.discountPct > 0 && r.status !== "NONE")
        .map((r) => ({
            itemNo: r.itemNo,
            nameTh: r.nameTh,
            kind: "WASTE" as const,
            units: r.risk.units,
            pct: r.risk.pct,
            value: r.risk.units * r.price,
            discountPct: r.discountPct,
            status: r.saved ? r.status : "SUGGESTED",
        }));
    return {
        order,
        wasteToday: wasteLast7Days.at(-1)?.value ?? 0,
        wasteProjected: projectedWasteTonight(order.lines),
        lostSalesRisk: sumValue(risks, "SHORTAGE"),
        wasteLast7Days,
        wasteByCategory: waste.byCategory,
        topRisk: risks.slice(0, 5),
        promos,
    };
}

export type SyncStatus = {
    serverNow: number; // the header clock starts here
    lastSync: { at: number; source: string } | null; // null = nothing loaded yet
};

/** S1: newest finished D365 import. Any branch, because one file holds all 36. */
export async function getSyncStatus(now = new Date()): Promise<SyncStatus> {
    const batch = await db.importBatch.findFirst({
        where: { status: { in: ["LOADED", "LOADED_WITH_ERRORS"] }, finishedAt: { not: null } },
        orderBy: { finishedAt: "desc" },
        select: { finishedAt: true, source: true },
    });
    return {
        serverNow: now.getTime(),
        lastSync: batch?.finishedAt ? { at: batch.finishedAt.getTime(), source: batch.source } : null,
    };
}
