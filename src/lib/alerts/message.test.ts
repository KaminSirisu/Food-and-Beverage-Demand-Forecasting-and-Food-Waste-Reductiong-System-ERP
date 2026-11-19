// Unit tests: title + body packed into alert.message (S10)
import { describe, expect, it } from "vitest";
import { joinMessage, splitMessage } from "./message";

describe("joinMessage / splitMessage", () => {
    it("round-trips a title and a body", () => {
        expect(splitMessage(joinMessage("Waste risk · ST068", "Surplus 11 units."), "x")).toEqual({ title: "Waste risk · ST068", body: "Surplus 11 units." });
    });
    it("trims both parts", () => {
        expect(joinMessage("  Title ", " Body  ")).toBe("Title\nBody");
    });
    it("a title-only alert still splits back (empty body)", () => {
        expect(splitMessage(joinMessage("Only a title", ""), "x")).toEqual({ title: "Only a title", body: "" });
    });
    it("legacy one-line message → fallback title, whole text as body", () => {
        expect(splitMessage("Sales data is 95 min old", "Stale data")).toEqual({ title: "Stale data", body: "Sales data is 95 min old" });
    });
    it("only the first newline separates: the body may contain more lines", () => {
        expect(splitMessage("T\nline 1\nline 2", "x")).toEqual({ title: "T", body: "line 1\nline 2" });
    });
});