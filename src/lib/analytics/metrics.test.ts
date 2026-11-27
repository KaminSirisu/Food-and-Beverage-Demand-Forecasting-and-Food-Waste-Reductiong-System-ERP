// Unit tests for metrics.ts with numbers from the Forecast vs. Actual mockup (S8, NFR6).
import { describe, expect, it } from "vitest";
import {
    accuracyLabel, dayKeys, fillDays, mape, rmse, skuAccuracy, variancePct, wasteTotals, type DayPair,
} from "./metrics";

const pair = (forecast: number | null, actual: number, date = "2026-11-01"): DayPair => ({ date, forecast, actual });

describe("variancePct", () => {
    it("matches the mockup rows", () => {
        expect(Math.round(variancePct(14, 15)!)).toBe(7); // Chocolate pound: +7%
        expect(Math.round(variancePct(9, 11)!)).toBe(22); // ข้าวต้มมัด: +22%
        expect(Math.round(variancePct(10, 8)!)).toBe(-20); // ตะโก้เผือก: -20%
    });
    it("is null when the forecast is 0 (no divide by zero)", () => {
        expect(variancePct(0, 5)).toBeNull();
    });
});

describe("mape", () => {
    it("averages |a − f| / a in %", () => {
        // |10-8|/10 = 20%, |20-22|/20 = 10% → 15%
        expect(mape([pair(8, 10), pair(22, 20)])).toBeCloseTo(15);
    });
    it("skips days with 0 sales or no forecast", () => {
        expect(mape([pair(5, 0), pair(null, 10), pair(9, 10)])).toBeCloseTo(10);
    });
    it("is null with nothing to measure", () => {
        expect(mape([])).toBeNull();
        expect(mape([pair(null, 4)])).toBeNull();
    });
});

describe("rmse", () => {
    it("is the root of the mean squared error", () => {
        // errors 1 and 3 → sqrt((1 + 9) / 2) = sqrt(5)
        expect(rmse([pair(10, 11), pair(10, 7)])).toBeCloseTo(Math.sqrt(5));
    });
    it("counts 0-sale days (unlike MAPE) but not missing forecasts", () => {
        expect(rmse([pair(2, 0), pair(null, 100)])).toBeCloseTo(2);
    });
    it("is null without forecasts", () => {
        expect(rmse([pair(null, 3)])).toBeNull();
    });
});

describe("accuracyLabel", () => {
    it("uses the mockup bands", () => {
        expect(accuracyLabel(8.9)).toBe("GOOD");
        expect(accuracyLabel(10.3)).toBe("FAIR");
        expect(accuracyLabel(13.8)).toBe("FAIR");
        expect(accuracyLabel(18)).toBe("REVIEW");
        expect(accuracyLabel(19.4)).toBe("REVIEW");
    });
    it("puts the band edges in the worse band", () => {
        expect(accuracyLabel(10)).toBe("FAIR");
        expect(accuracyLabel(15)).toBe("REVIEW");
    });
    it("never calls a missing model Good", () => {
        expect(accuracyLabel(null)).toBe("REVIEW");
    });
});

describe("dayKeys / fillDays", () => {
    it("lists consecutive days and fills gaps", () => {
        const keys = dayKeys(new Date("2026-09-30T00:00:00Z"), 3);
        expect(keys).toEqual(["2026-09-30", "2026-10-01", "2026-10-02"]);
        const filled = fillDays(keys, new Map([["2026-10-01", 5]]), 0);
        expect(filled.map((d) => d.value)).toEqual([0, 5, 0]);
    });
});

describe("skuAccuracy", () => {
    it("shows the latest day and scores the whole window", () => {
        const row = skuAccuracy("SC210", [pair(10, 10, "2026-10-01"), pair(10, 12, "2026-10-02"), pair(14, 15, "2026-10-03")]);
        expect(row).toMatchObject({ itemNo: "SC210", forecast: 14, actual: 15 });
        expect(Math.round(row.variancePct!)).toBe(7);
        expect(row.mape).toBeCloseTo(((0 + 2 / 12 + 1 / 15) / 3) * 100);
        expect(row.accuracy).toBe("GOOD");
    });
    it("handles a day with no forecast", () => {
        const row = skuAccuracy("SB078", [pair(null, 4)]);
        expect(row).toMatchObject({ forecast: null, variancePct: null, mape: null, rmse: null, accuracy: "REVIEW" });
    });
});

describe("wasteTotals", () => {
    // Demo seed's last 7 days (dashboard mockup)
    const last7 = [1256, 1221, 1041, 1063, 1113, 955, 1425];

    it("sums 7 and 30 days and counts days over their own target", () => {
        const days = [...Array(23).fill(1000), ...last7].map((value) => ({ value, target: 1200 }));
        const t = wasteTotals(days);
        expect(t.last7).toBe(8074); // = mockup "Last 7 days ฿8,074"
        expect(t.last30).toBe(23_000 + 8074);
        expect(t.avg7).toBeCloseTo(8074 / 7); // ≈ ฿1,153 like the mockup
        expect(t.daysOver30).toBe(3); // 1256, 1221, 1425
        expect(t.targetAvg7).toBe(1200);
    });
    it("uses each day's target, not one flat line", () => {
        // ฿900 waste is over 5% of a ฿15,000 day (฿750) but within 5% of a ฿24,000 day (฿1,200)
        const t = wasteTotals([{ value: 900, target: 750 }, { value: 900, target: 1200 }]);
        expect(t.daysOver30).toBe(1);
        expect(t.targetAvg7).toBe(975);
    });
    it("is all zeros with no data", () => {
        expect(wasteTotals([])).toEqual({ last7: 0, last30: 0, avg7: 0, daysOver30: 0, targetAvg7: 0 });
    });
});
