// Unit tests: dashboard risks → alert drafts, and the de-dupe window (S7, SM5, SM6)
import { describe, expect, it } from "vitest";
import type { RiskSku } from "@/lib/dashboard/risk";
import { alertsFromRisks, dedupeSince } from "./rules";

const SC220: RiskSku = { itemNo: "SC220", nameTh: "ชิฟฟ่อนมะพร้าวอ่อน", kind: "SHORTAGE", units: 3, pct: 0, value: 39 };
const ST068: RiskSku = { itemNo: "ST068", nameTh: "ข้าวต้มมัด", kind: "WASTE", units: 18, pct: 82, value: 234 };

describe("alertsFromRisks", () => {
    it("no risks → no alerts", () => {
        expect(alertsFromRisks([])).toEqual([]);
    });
    it("shortage → SHORTAGE_RISK with units and lost sales, linked to the order card", () => {
        expect(alertsFromRisks([SC220])).toEqual([{
            type: "SHORTAGE_RISK",
            itemNo: "SC220",
            title: "Shortage risk · SC220 ชิฟฟ่อนมะพร้าวอ่อน",
            body: "Forecast needs 3 more units than you have before close (฿39 lost sales).",
            actionUrl: "/",
        }]);
    });
    it("waste → WASTE_RISK with surplus units and %, linked to promotions", () => {
        expect(alertsFromRisks([ST068])[0]).toMatchObject({
            type: "WASTE_RISK",
            title: "Waste risk · ST068 ข้าวต้มมัด",
            body: "Projected surplus 18 units (82% of stock) at close.",
            actionUrl: "/promotions",
        });
    });
    it("keeps the input order (riskSkus already sorts by ฿ at risk)", () => {
        expect(alertsFromRisks([ST068, SC220]).map((d) => d.itemNo)).toEqual(["ST068", "SC220"]);
    });
});

describe("dedupeSince", () => {
    const now = new Date("2026-11-19T06:42:00Z"); // 13:42 Bangkok
    it("STALE_DATA: one per hour", () => {
        expect(dedupeSince("STALE_DATA", now)).toEqual(new Date("2026-11-19T05:42:00Z"));
    });
    it("SKU alerts: once per Bangkok day (midnight Bangkok = 17:00 UTC the day before)", () => {
        expect(dedupeSince("SHORTAGE_RISK", now)).toEqual(new Date("2026-11-18T17:00:00Z"));
        expect(dedupeSince("WASTE_RISK", now)).toEqual(new Date("2026-11-18T17:00:00Z"));
    });
    it("just after Bangkok midnight already counts as the new day", () => {
        expect(dedupeSince("PROMOTION", new Date("2026-11-18T17:05:00Z"))).toEqual(new Date("2026-11-18T17:00:00Z"));
    });
});