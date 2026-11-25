// Unit tests for the Waste & Auto-Promotion rules (S7, SM9, SM10) with numbers from the demo seed / mockup.
import { describe, expect, it } from "vitest";
import { computeRow, type OrderInputs } from "@/lib/orders/formula";
import { riskSkus } from "@/lib/dashboard/risk";
import {
    buildPromotionRows, canPush, isAtRisk, promoPrice, promotionKpis, wasteRisk,
    type BuildInput, type CategoryRule, type SavedPromotion,
} from "./rules";

const line = (o: Partial<OrderInputs> & Pick<OrderInputs, "itemNo">): OrderInputs => ({
    nameTh: o.itemNo, categoryCode: "SB", price: 10, shelfLifeDays: 2, restOfDay: 0, tomorrow: 0, leftNow: 0, savedOrdered: null, ...o,
});

// Demo seed rows (prisma/seed-demo.ts)
const ST068 = line({ itemNo: "ST068", categoryCode: "ST", price: 13, shelfLifeDays: 1, leftNow: 22, restOfDay: 4, tomorrow: 8.6 });
const ST058 = line({ itemNo: "ST058", categoryCode: "ST", price: 35, shelfLifeDays: 1, leftNow: 15, restOfDay: 5, tomorrow: 9.8 });
const SB078 = line({ itemNo: "SB078", categoryCode: "SB", price: 13, shelfLifeDays: 2, leftNow: 34, restOfDay: 15, tomorrow: 33.6 });
const SC220 = line({ itemNo: "SC220", categoryCode: "SC", price: 15, shelfLifeDays: 1, leftNow: 5, restOfDay: 8, tomorrow: 14.5 });
// Over-stock: 40 on the shelf, 10 sold today → 30 tonight, tomorrow needs 12 → 18 can't be sold
const SB062 = line({ itemNo: "SB062", categoryCode: "SB", price: 17, shelfLifeDays: 2, leftNow: 40, restOfDay: 10, tomorrow: 11.2 });

const RULES: Record<string, CategoryRule> = {
    SB: { wasteRiskPct: 10, discountPct: 20 },
    ST: { wasteRiskPct: 10, discountPct: 15 },
    SC: { wasteRiskPct: 10, discountPct: 15 },
};
const input = (o: Partial<BuildInput> = {}): BuildInput => ({
    lines: [SB078, ST068, ST058, SC220, SB062],
    categoryNames: { SB: "Bread", ST: "Thai dessert", SC: "Cake slice" },
    ruleFor: (code) => RULES[code],
    saved: [],
    engineOn: true,
    ...o,
});
const saved = (o: Partial<SavedPromotion> & Pick<SavedPromotion, "itemNo">): SavedPromotion => ({
    discountPct: 15, mode: "AUTO", posStatus: "LIVE", pushedAt: new Date("2026-11-18T06:05:00Z"), ...o,
});
const byItem = (rows: ReturnType<typeof buildPromotionRows>, itemNo: string) => rows.find((r) => r.itemNo === itemNo)!;

describe("wasteRisk", () => {
    it("last day: everything left at close expires (ST068: 18 of 22 = 82%)", () => {
        expect(wasteRisk(computeRow(ST068))).toEqual({ units: 18, pct: 82, reason: "EXPIRY" });
    });
    it("multi-day: only what tomorrow can't sell is over-stock (SB062: 30 − 12 = 18 of 40 = 45%)", () => {
        expect(wasteRisk(computeRow(SB062))).toEqual({ units: 18, pct: 45, reason: "OVERSTOCK" });
    });
    it("multi-day with tomorrow's demand above the leftover → no risk (SB078)", () => {
        expect(wasteRisk(computeRow(SB078))).toEqual({ units: 0, pct: 0, reason: null });
    });
    it("a shortage leaves nothing to waste (SC220)", () => {
        expect(wasteRisk(computeRow(SC220)).units).toBe(0);
    });
    it("empty shelf → no risk, no divide by zero", () => {
        expect(wasteRisk(computeRow(line({ itemNo: "X", shelfLifeDays: 1, leftNow: 0 })))).toEqual({ units: 0, pct: 0, reason: null });
    });
});

describe("isAtRisk", () => {
    it("counts the threshold itself as at risk", () => {
        expect(isAtRisk({ units: 1, pct: 10, reason: "EXPIRY" }, 10)).toBe(true);
        expect(isAtRisk({ units: 1, pct: 9, reason: "EXPIRY" }, 10)).toBe(false);
    });
    it("needs at least one unit", () => {
        expect(isAtRisk({ units: 0, pct: 0, reason: null }, 0)).toBe(false);
    });
});

describe("promoPrice", () => {
    it("rounds to whole baht like the mockup", () => {
        expect(promoPrice(13, 20)).toBe(10);
        expect(promoPrice(13, 15)).toBe(11);
        expect(promoPrice(35, 15)).toBe(30);
        expect(promoPrice(25, 10)).toBe(23);
        expect(promoPrice(90, 10)).toBe(81);
        expect(promoPrice(290, 0)).toBe(290);
    });
});

describe("buildPromotionRows", () => {
    it("gives at-risk SKUs their category rate, the rest 0%", () => {
        const rows = buildPromotionRows(input());
        expect(byItem(rows, "ST068")).toMatchObject({ atRisk: true, autoPct: 15, discountPct: 15, promoPrice: 11, status: "PENDING", mode: "AUTO", saved: false });
        expect(byItem(rows, "SB062")).toMatchObject({ atRisk: true, autoPct: 20, promoPrice: 14, status: "PENDING" });
        expect(byItem(rows, "SB078")).toMatchObject({ atRisk: false, discountPct: 0, promoPrice: 13, status: "NONE" });
        expect(byItem(rows, "SC220")).toMatchObject({ atRisk: false, discountPct: 0, status: "NONE" });
    });
    it("uses the category's own waste-risk threshold", () => {
        const strict: Record<string, CategoryRule> = { ...RULES, ST: { wasteRiskPct: 90, discountPct: 15 } };
        const rows = buildPromotionRows(input({ ruleFor: (c) => strict[c] }));
        expect(byItem(rows, "ST068").atRisk).toBe(false); // 82% < 90%
        expect(byItem(rows, "SB062").atRisk).toBe(true);
    });
    it("engine off → auto rate 0, but SKUs are still flagged at risk", () => {
        const row = byItem(buildPromotionRows(input({ engineOn: false })), "ST068");
        expect(row).toMatchObject({ atRisk: true, autoPct: 0, discountPct: 0, status: "NONE" });
    });
    it("a manual override wins over the rule, even with the engine off", () => {
        const rows = buildPromotionRows(input({
            engineOn: false,
            saved: [saved({ itemNo: "SB078", discountPct: 25, mode: "MANUAL", posStatus: "PENDING", pushedAt: null })],
        }));
        expect(byItem(rows, "SB078")).toMatchObject({ discountPct: 25, autoPct: 0, mode: "MANUAL", promoPrice: 10, status: "PENDING", saved: true });
    });
    it("a pushed rate stays LIVE with the rate it was pushed at", () => {
        const rows = buildPromotionRows(input({ saved: [saved({ itemNo: "ST058", discountPct: 15 })] }));
        expect(byItem(rows, "ST058")).toMatchObject({ discountPct: 15, status: "LIVE", promoPrice: 30 });
    });
    it("manual 0% means no promotion today", () => {
        const rows = buildPromotionRows(input({ saved: [saved({ itemNo: "ST068", discountPct: 0, mode: "MANUAL", posStatus: "NONE" })] }));
        expect(byItem(rows, "ST068")).toMatchObject({ discountPct: 0, status: "NONE", atRisk: true });
    });
    it("sorts by shelf life, then item number", () => {
        expect(buildPromotionRows(input()).map((r) => r.itemNo)).toEqual(["SC220", "ST058", "ST068", "SB062", "SB078"]);
    });
});

describe("promotionKpis", () => {
    it("counts risk, live and pending, and the ฿ that could be saved", () => {
        const rows = buildPromotionRows(input({ saved: [saved({ itemNo: "ST058", discountPct: 15 })] }));
        const kpis = promotionKpis(rows);
        expect(kpis.atRisk).toBe(3); // ST068, ST058, SB062
        expect(kpis.expireToday).toBe(2); // ST068, ST058
        expect(kpis.live).toEqual([{ itemNo: "ST058", discountPct: 15 }]);
        expect(kpis.pending).toEqual(["ST068", "SB062"]);
        // ST058 10 × ฿35 + ST068 18 × ฿13 + SB062 18 × ฿17 = 350 + 234 + 306
        expect(kpis.wasteAvoided).toBe(890);
    });
    it("is all zero with no rows", () => {
        expect(promotionKpis([])).toEqual({ atRisk: 0, expireToday: 0, live: [], pending: [], wasteAvoided: 0 });
    });
});

describe("canPush", () => {
    it("only a pending discount above 0%", () => {
        expect(canPush({ discountPct: 15, status: "PENDING" })).toBe(true);
        expect(canPush({ discountPct: 15, status: "LIVE" })).toBe(false);
        expect(canPush({ discountPct: 0, status: "PENDING" })).toBe(false);
        expect(canPush({ discountPct: 0, status: "NONE" })).toBe(false);
    });
});

describe("dashboard riskSkus uses the same rule", () => {
    it("flags over-stock and expiry with per-category thresholds", () => {
        const risks = riskSkus([SB078, ST068, SC220, SB062], (code) => RULES[code].wasteRiskPct);
        expect(risks.map((r) => [r.itemNo, r.kind, r.units])).toEqual([
            ["SB062", "WASTE", 18], // ฿306
            ["ST068", "WASTE", 18], // ฿234
            ["SC220", "SHORTAGE", 3], // ฿45
        ]);
    });
});
