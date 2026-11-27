// Unit tests for the daily waste target (SM7, S6): 5% of that day's total sales.
import { describe, expect, it } from "vitest";
import { expectedDaySales, isOverTarget, wasteTarget } from "./target";

describe("wasteTarget", () => {
    it("is 5% of the day's sales", () => {
        expect(wasteTarget(24_069)).toBeCloseTo(1203.45); // 5 May 2023, branch 801
        expect(wasteTarget(16_029)).toBeCloseTo(801.45); // 2 May: a slower day gets a lower target
    });
    it("is 0 with no sales", () => {
        expect(wasteTarget(0)).toBe(0);
        expect(wasteTarget(-50)).toBe(0);
    });
});

describe("expectedDaySales", () => {
    it("uses the same-weekday average early in the day", () => {
        expect(expectedDaySales(3_321, [22_000, 21_000, 23_000, 22_000])).toBe(22_000);
    });
    it("uses the sales so far once they are higher", () => {
        expect(expectedDaySales(25_000, [22_000, 21_000, 23_000, 22_000])).toBe(25_000);
    });
    it("skips weeks with no sales loaded", () => {
        expect(expectedDaySales(0, [20_000, 0, 0, 24_000])).toBe(22_000);
    });
});

describe("isOverTarget", () => {
    it("is over only above the day's own target", () => {
        expect(isOverTarget({ value: 900, target: 750 })).toBe(true);
        expect(isOverTarget({ value: 750, target: 750 })).toBe(false);
    });
});
