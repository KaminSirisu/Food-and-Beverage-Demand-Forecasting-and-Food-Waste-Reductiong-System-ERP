// Unit tests for the provisional forecast helpers (S3): when it is due, and the model's rows beating the baseline.
import { describe, expect, it } from "vitest";
import { isProvisionalDue, pickForecast } from "./forecast-pick";

const row = (itemNo: string, qty: number, isActive: boolean) => ({ itemNo, predictedQty: qty.toFixed(3), modelVersion: { isActive } });

describe("isProvisionalDue", () => {
    it("is due from store opening until the 13:30 model decision", () => {
        expect(isProvisionalDue("08:59", "09:00")).toBe(false);
        expect(isProvisionalDue("09:00", "09:00")).toBe(true);
        expect(isProvisionalDue("13:29", "09:00")).toBe(true);
        expect(isProvisionalDue("13:30", "09:00")).toBe(false);
    });
});

describe("pickForecast", () => {
    it("uses the baseline when the model has no row yet", () => {
        const picked = pickForecast([row("SB078", 6.4, false)], (r) => r.itemNo);
        expect(picked.get("SB078")).toEqual({ qty: 6.4, fromModel: false });
    });
    it("lets the model's row win over a newer baseline row", () => {
        // newest first: a baseline row saved after the model run must not replace it
        const picked = pickForecast([row("SB078", 6.4, false), row("SB078", 8.1, true)], (r) => r.itemNo);
        expect(picked.get("SB078")).toEqual({ qty: 8.1, fromModel: true });
    });
    it("keeps the model's newest row", () => {
        const picked = pickForecast([row("SB078", 9, true), row("SB078", 7, true), row("SB078", 5, false)], (r) => r.itemNo);
        expect(picked.get("SB078")?.qty).toBe(9);
    });
    it("keeps keys apart", () => {
        const picked = pickForecast([row("SB078", 9, true), row("ST068", 3, false)], (r) => r.itemNo);
        expect([...picked.keys()]).toEqual(["SB078", "ST068"]);
    });
});
