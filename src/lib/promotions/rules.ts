// Waste & Auto-Promotion rules (S7, SM9, SM10). Pure: no DB, no "server-only" —
// the dashboard card, the /promotions page and its server actions all call these, so they always agree.
import { computeRow, type OrderInputs, type OrderRow } from "@/lib/orders/formula";

export type RiskReason = "EXPIRY" | "OVERSTOCK";

export type WasteRisk = {
    units: number; // units expected to be thrown away
    pct: number; // units ÷ Left now, whole %
    reason: RiskReason | null; // null = nothing to waste
};

/**
 * S7: how much of today's stock is expected to be wasted.
 * - Last day (EXPIRY): everything left at close is thrown away tonight.
 * - Multi-day (OVERSTOCK): what is left at close beyond tomorrow's forecast — tomorrow can't sell it,
 *   so it reaches its last day unsold.
 */
export function wasteRisk(row: OrderRow): WasteRisk {
    if (row.leftNow <= 0) return { units: 0, pct: 0, reason: null };
    if (row.lastDay) {
        return row.tonight > 0 ? { units: row.tonight, pct: row.wasteRiskPct, reason: "EXPIRY" } : { units: 0, pct: 0, reason: null };
    }
    const units = Math.max(0, row.tonight - row.need);
    return units > 0
        ? { units, pct: Math.round((units / row.leftNow) * 100), reason: "OVERSTOCK" }
        : { units: 0, pct: 0, reason: null };
}

/** S7: at risk when there is something to waste and it reaches the category's waste-risk %. */
export function isAtRisk(risk: WasteRisk, wasteRiskPct: number): boolean {
    return risk.units > 0 && risk.pct >= wasteRiskPct;
}

/** SM9: price on the POS after the discount, whole baht (mockup: ฿13 − 20% = ฿10, ฿25 − 10% = ฿23). */
export function promoPrice(price: number, discountPct: number): number {
    return Math.round(price * (1 - discountPct / 100));
}

// ─────────────────────────────── Page rows ───────────────────────────────

export type PosStatus = "PENDING" | "LIVE" | "NONE";
export type PromoMode = "AUTO" | "MANUAL";

/** Today's promotion row from the DB, Decimals already turned into numbers. */
export type SavedPromotion = {
    itemNo: string;
    discountPct: number;
    mode: PromoMode;
    posStatus: PosStatus;
    pushedAt: Date | null;
};

/** The two category settings the engine needs (resolved: category override → branch default). */
export type CategoryRule = { wasteRiskPct: number; discountPct: number };

export type PromotionRow = {
    itemNo: string;
    nameTh: string;
    categoryCode: string;
    categoryName: string;
    shelfLifeDays: number;
    lastDay: boolean;
    price: number;
    stock: number; // Left now
    risk: WasteRisk;
    atRisk: boolean;
    autoPct: number; // what the rule gives: category discount when at risk and the engine is on, else 0
    discountPct: number; // what applies today: the saved MANUAL rate, else the saved pushed rate, else autoPct
    mode: PromoMode;
    promoPrice: number;
    status: PosStatus; // LIVE = pushed · PENDING = discount waiting for push · NONE = no promotion
    saved: boolean; // a promotion row exists for today
};

export type BuildInput = {
    lines: OrderInputs[];
    categoryNames: Record<string, string>;
    ruleFor: (categoryCode: string) => CategoryRule;
    saved: SavedPromotion[];
    engineOn: boolean;
};

/** SM9 / SM10: one row per SKU. Shortest shelf life first (closest to expiry), then item number. */
export function buildPromotionRows({ lines, categoryNames, ruleFor, saved, engineOn }: BuildInput): PromotionRow[] {
    const savedByItem = new Map(saved.map((s) => [s.itemNo, s]));

    return lines
        .map((line) => {
            const row = computeRow(line);
            const rule = ruleFor(line.categoryCode);
            const risk = wasteRisk(row);
            const atRisk = isAtRisk(risk, rule.wasteRiskPct);
            const autoPct = engineOn && atRisk ? rule.discountPct : 0;
            const s = savedByItem.get(line.itemNo);

            // A saved row wins: MANUAL is the manager's choice for today, a pushed AUTO rate is already on the POS
            const discountPct = s ? s.discountPct : autoPct;
            const status: PosStatus = s ? s.posStatus : autoPct > 0 ? "PENDING" : "NONE";

            return {
                itemNo: line.itemNo,
                nameTh: line.nameTh,
                categoryCode: line.categoryCode,
                categoryName: categoryNames[line.categoryCode] ?? line.categoryCode,
                shelfLifeDays: line.shelfLifeDays,
                lastDay: row.lastDay,
                price: line.price,
                stock: row.leftNow,
                risk,
                atRisk,
                autoPct,
                discountPct,
                mode: s?.mode ?? "AUTO",
                promoPrice: promoPrice(line.price, discountPct),
                status,
                saved: s != null,
            };
        })
        .sort((a, b) => a.shelfLifeDays - b.shelfLifeDays || a.itemNo.localeCompare(b.itemNo));
}

// ─────────────────────────────── KPI cards ───────────────────────────────

export type PromotionKpis = {
    atRisk: number;
    expireToday: number; // at risk and on their last day
    live: { itemNo: string; discountPct: number }[];
    pending: string[]; // itemNos with a discount waiting for push
    wasteAvoided: number; // ฿ at sale price if every discounted at-risk unit sells
};

export function promotionKpis(rows: PromotionRow[]): PromotionKpis {
    return {
        atRisk: rows.filter((r) => r.atRisk).length,
        expireToday: rows.filter((r) => r.atRisk && r.lastDay).length,
        live: rows.filter((r) => r.status === "LIVE").map((r) => ({ itemNo: r.itemNo, discountPct: r.discountPct })),
        pending: rows.filter((r) => r.status === "PENDING").map((r) => r.itemNo),
        wasteAvoided: rows
            .filter((r) => r.discountPct > 0 && r.status !== "NONE")
            .reduce((sum, r) => sum + r.risk.units * r.price, 0),
    };
}

/** Push is possible when there is a discount and it isn't on the POS yet. */
export function canPush(row: Pick<PromotionRow, "discountPct" | "status">): boolean {
    return row.discountPct > 0 && row.status === "PENDING";
}
