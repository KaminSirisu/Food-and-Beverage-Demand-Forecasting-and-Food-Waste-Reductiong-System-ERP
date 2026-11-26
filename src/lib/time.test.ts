// Unit tests for the demo date (T1): fixed demo day and auto-advance from an anchor day.
import { afterEach, describe, expect, it, vi } from "vitest";

// time.ts reads the env once at import, so each case re-imports it with fresh env values
async function load(env: Record<string, string | undefined>) {
    vi.resetModules();
    for (const [k, v] of Object.entries(env)) vi.stubEnv(k, v as string);
    return import("./time");
}
const ymd = (d: Date) => d.toISOString().slice(0, 10);
const at = (bangkok: string) => new Date(`${bangkok}+07:00`);

afterEach(() => vi.unstubAllEnvs());

describe("todayDate", () => {
    it("uses the real Bangkok day without a demo date", async () => {
        const { todayDate } = await load({ NEXT_PUBLIC_DEMO_TODAY: "", NEXT_PUBLIC_DEMO_ANCHOR: "" });
        expect(ymd(todayDate(at("2026-11-26T23:30:00")))).toBe("2026-11-26"); // 23:30 Bangkok is still the 26th
    });

    it("stays on the demo day when no anchor is set", async () => {
        const { todayDate } = await load({ NEXT_PUBLIC_DEMO_TODAY: "2023-05-05", NEXT_PUBLIC_DEMO_ANCHOR: "" });
        expect(ymd(todayDate(at("2026-11-26T10:00:00")))).toBe("2023-05-05");
        expect(ymd(todayDate(at("2026-12-03T10:00:00")))).toBe("2023-05-05");
    });

    it("moves one demo day per real day from the anchor", async () => {
        const { todayDate, tomorrowDate } = await load({ NEXT_PUBLIC_DEMO_TODAY: "2023-05-05", NEXT_PUBLIC_DEMO_ANCHOR: "2026-11-26" });
        expect(ymd(todayDate(at("2026-11-26T09:00:00")))).toBe("2023-05-05");
        expect(ymd(todayDate(at("2026-11-27T00:05:00")))).toBe("2023-05-06"); // just after Bangkok midnight
        expect(ymd(todayDate(at("2026-12-26T12:00:00")))).toBe("2023-06-04"); // 30 days later
        expect(ymd(tomorrowDate(at("2026-11-27T12:00:00")))).toBe("2023-05-07");
    });

    it("ignores a malformed anchor", async () => {
        const { todayDate } = await load({ NEXT_PUBLIC_DEMO_TODAY: "2023-05-05", NEXT_PUBLIC_DEMO_ANCHOR: "26/11/2026" });
        expect(ymd(todayDate(at("2026-11-30T10:00:00")))).toBe("2023-05-05");
    });
});
