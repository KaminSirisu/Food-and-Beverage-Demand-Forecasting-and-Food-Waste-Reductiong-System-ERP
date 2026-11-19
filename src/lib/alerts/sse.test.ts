// Unit tests: Server-Sent Events wire format and resume cursor (S10)
import { describe, expect, it } from "vitest";
import { formatSseEvent, parseCursor, sseComment, sseRetry } from "./sse";

describe("formatSseEvent", () => {
    it("writes event, id and JSON data, ended by a blank line", () => {
        expect(formatSseEvent({ event: "alert", id: "43", data: { id: "43", type: "WASTE_RISK" } }))
            .toBe('event: alert\nid: 43\ndata: {"id":"43","type":"WASTE_RISK"}\n\n');
    });
    it("leaves out event and id when not given", () => {
        expect(formatSseEvent({ data: { count: 5 } })).toBe('data: {"count":5}\n\n');
    });
    it("a multi-line string gets one data: line per line (or the frame would break)", () => {
        expect(formatSseEvent({ event: "note", data: "line 1\nline 2" })).toBe("event: note\ndata: line 1\ndata: line 2\n\n");
    });
    it("JSON with a newline inside a value stays on one line (JSON escapes it)", () => {
        expect(formatSseEvent({ data: { body: "a\nb" } })).toBe('data: {"body":"a\\nb"}\n\n');
    });
});

describe("sseComment / sseRetry", () => {
    it("comment line starts with a colon (the browser ignores it)", () => {
        expect(sseComment("ping")).toBe(": ping\n\n");
    });
    it("retry tells the browser the reconnect delay in ms", () => {
        expect(sseRetry(5000)).toBe("retry: 5000\n\n");
    });
});

describe("parseCursor", () => {
    it("Last-Event-ID (reconnect) wins over ?after= (first connect)", () => {
        expect(parseCursor("43", "10")).toBe(BigInt(43));
    });
    it("falls back to ?after= when there's no header", () => {
        expect(parseCursor(null, "10")).toBe(BigInt(10));
    });
    it("a junk header is ignored, then ?after= is used", () => {
        expect(parseCursor("abc", "10")).toBe(BigInt(10));
    });
    it("nothing usable → 0", () => {
        expect(parseCursor(null, null)).toBe(BigInt(0));
        expect(parseCursor("-1", "1e3")).toBe(BigInt(0));
        expect(parseCursor("", "")).toBe(BigInt(0));
    });
    it("rejects ids longer than 18 digits", () => {
        expect(parseCursor("1".repeat(19), null)).toBe(BigInt(0));
    });
});