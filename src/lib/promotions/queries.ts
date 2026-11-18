// Waste & Auto-Promotion page data for one branch (S7, SM9, SM10). Server only: reads Neon via Prisma.
// Reuses the factory order inputs, so stock and forecasts match the dashboard.
import "server-only";
import { db } from "@/lib/db";
import { getOrderInputs, type OrderData } from "@/lib/orders/queries";
import { getBranchRules } from "@/lib/thresholds/queries";
import { todayDate } from "@/lib/time";
import {
    buildPromotionRows, promotionKpis, type PosStatus, type PromoMode, type PromotionKpis, type PromotionRow,
} from "./rules";

export type CategoryTrigger = { code: string; name: string; discountPct: number; wasteRiskPct: number };

export type PromotionsData = {
    rows: PromotionRow[];
    kpis: PromotionKpis;
    engineOn: boolean;
    checkpoints: [string, string]; // HH:mm — the opportunity and cheer checks from Branch Thresholds
    triggers: CategoryTrigger[]; // banner: discount per category
    lastPushAt: Date | null; // newest push today
};

/** `order` can be passed in when the caller already loaded it (the dashboard does). */
export async function getPromotions(storeNo: number, now = new Date(), order?: OrderData): Promise<PromotionsData> {
    const today = todayDate(now);

    // Independent queries → one round trip to Neon
    const [orderData, rules, categories, saved] = await Promise.all([
        order ?? getOrderInputs(storeNo, now),
        getBranchRules(storeNo),
        db.sku.findMany({
            where: { inScope: true },
            distinct: ["categoryCode"],
            select: { categoryCode: true, categoryName: true },
            orderBy: { categoryCode: "asc" },
        }),
        db.promotion.findMany({
            where: { storeNo, promoDate: today },
            select: { itemNo: true, discountPct: true, mode: true, posStatus: true, pushedAt: true },
        }),
    ]);

    const categoryNames = Object.fromEntries(categories.map((c) => [c.categoryCode, c.categoryName ?? c.categoryCode]));
    const rows = buildPromotionRows({
        lines: orderData.lines,
        categoryNames,
        ruleFor: rules.forCategory,
        engineOn: rules.engineOn,
        // Decimal → number and free strings → the known values (anything odd counts as AUTO / PENDING)
        saved: saved.map((s) => ({
            itemNo: s.itemNo,
            discountPct: Number(s.discountPct),
            mode: (s.mode === "MANUAL" ? "MANUAL" : "AUTO") as PromoMode,
            posStatus: (["LIVE", "NONE"].includes(s.posStatus) ? s.posStatus : "PENDING") as PosStatus,
            pushedAt: s.pushedAt,
        })),
    });

    const lastPushAt = saved.reduce<Date | null>(
        (latest, s) => (s.pushedAt && (!latest || s.pushedAt > latest) ? s.pushedAt : latest),
        null,
    );

    return {
        rows,
        kpis: promotionKpis(rows),
        engineOn: rules.engineOn,
        checkpoints: [rules.branch.opportunityCheckAt, rules.branch.cheerCheckAt],
        triggers: categories.map((c) => {
            const t = rules.forCategory(c.categoryCode);
            return { code: c.categoryCode, name: categoryNames[c.categoryCode], discountPct: t.discountPct, wasteRiskPct: t.wasteRiskPct };
        }),
        lastPushAt,
    };
}
