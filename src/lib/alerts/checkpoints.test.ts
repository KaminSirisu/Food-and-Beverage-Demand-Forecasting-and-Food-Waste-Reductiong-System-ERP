// Unit tests for the checkpoint alerts (SM5 Opportunity Sale, SM6 Cheer Sale).
import { describe, expect, it } from "vitest";
import type { OrderInputs } from "@/lib/orders/formula";
import { DEFAULT_THRESHOLDS, type Thresholds } from "@/lib/thresholds/resolve";
import { cheerDrafts, opportunityDrafts, produceMoreQty } from "./checkpoints";

const line = (o: Partial<OrderInputs> & Pick<OrderInputs, "itemNo">): OrderInputs => ({
    nameTh: o.itemNo, categoryCode: "SB", price: 10, shelfLifeDays: 2, restOfDay: 0, tomorrow: 0, leftNow: 0, savedOrdered: null, ...o,
});
// Defaults: opportunity ≤ 3 units, cheer ≥ 10% of display capacity (SB 60 → 6, ST 30 → 3), discount 20%
const rules = (): Thresholds => DEFAULT_THRESHOLDS;

describe("produceMoreQty", () => {
    it("is 20% of this morning's stock, rounded up", () => {
        expect(produceMoreQty(24, 8, 2)).toBe(5); // 4.8 → 5
        expect(produceMoreQty(10, 8, 2)).toBe(2);
    });
    it("is at least 1", () => {
        expect(produceMoreQty(3, 2, 1)).toBe(1);
    });
    it("falls back to the forecast gap when the opening stock is unknown", () => {
        expect(produceMoreQty(0, 7.2, 2)).toBe(6);
    });
});

describe("opportunityDrafts", () => {
    it("tells the branch to produce 20% more when stock is at the limit and demand continues", () => {
        const drafts = opportunityDrafts([line({ itemNo: "SB078", leftNow: 3, restOfDay: 8 })], new Map([["SB078", 24]]), rules, "14:00");
        expect(drafts).toHaveLength(1);
        expect(drafts[0].type).toBe("SHORTAGE_RISK");
        expect(drafts[0].title).toBe("Opportunity sale · SB078 SB078");
        expect(drafts[0].body).toContain("Only 3 left at 14:00");
        expect(drafts[0].body).toContain("Produce 5 more at the branch (20% of this morning's 24)");
    });
    it("stays quiet above the limit", () => {
        expect(opportunityDrafts([line({ itemNo: "SB078", leftNow: 4, restOfDay: 8 })], new Map(), rules, "14:00")).toEqual([]);
    });
    it("stays quiet when the forecast expects no more sales than the stock left", () => {
        expect(opportunityDrafts([line({ itemNo: "SB078", leftNow: 2, restOfDay: 1.6 })], new Map(), rules, "14:00")).toEqual([]);
    });
    it("uses a category override in % of display capacity", () => {
        const bread: Thresholds = { ...DEFAULT_THRESHOLDS, opportunity: { value: 10, unit: "PCT" } }; // 10% of 60 = 6
        const drafts = opportunityDrafts([line({ itemNo: "SB094", leftNow: 6, restOfDay: 9 })], new Map([["SB094", 30]]), () => bread, "14:00");
        expect(drafts[0].body).toContain("Produce 6 more");
    });
});

describe("cheerDrafts", () => {
    it("asks to cheer last-day stock at/above the limit", () => {
        const drafts = cheerDrafts([line({ itemNo: "ST068", categoryCode: "ST", shelfLifeDays: 1, leftNow: 5, restOfDay: 1 })], rules, "18:00");
        expect(drafts).toHaveLength(1);
        expect(drafts[0].type).toBe("WASTE_RISK");
        expect(drafts[0].body).toBe("5 still left at 18:00 and it expires today. Cheer the sale or push the 20% discount.");
    });
    it("ignores multi-day items and low stock", () => {
        expect(cheerDrafts([line({ itemNo: "SB062", shelfLifeDays: 2, leftNow: 20 })], rules, "18:00")).toEqual([]);
        expect(cheerDrafts([line({ itemNo: "ST058", categoryCode: "ST", shelfLifeDays: 1, leftNow: 2 })], rules, "18:00")).toEqual([]);
    });
});
