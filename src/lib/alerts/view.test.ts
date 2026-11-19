// Unit tests: what the browser gets and the list operations (S10)
import { describe, expect, it } from "vitest";
import {
    applyReadOverrides, filterNotifications, formatAlertTime, MAX_KEPT, mergeIncoming, toDto,
    type AlertRow, type NotificationDto,
} from "./view";

const row = (o: Partial<AlertRow> = {}): AlertRow => ({
    id: BigInt(1), type: "WASTE_RISK", itemNo: "ST068", message: "Waste risk · ST068\nSurplus 11 units.",
    actionUrl: "/promotions", createdAt: new Date("2026-11-19T06:38:00Z"), readAt: null, ...o,
});
const dto = (id: number, o: Partial<NotificationDto> = {}): NotificationDto => ({
    id: String(id), type: "SHORTAGE_RISK", itemNo: "SC220", title: "t", body: "b", actionUrl: "/", createdAt: id, read: false, ...o,
});
const ids = (list: NotificationDto[]) => list.map((n) => n.id);

describe("toDto", () => {
    it("turns the BigInt id into a string and the date into epoch ms (JSON-safe)", () => {
        const n = toDto(row({ id: BigInt(42) }));
        expect(n.id).toBe("42");
        expect(n.createdAt).toBe(Date.parse("2026-11-19T06:38:00Z"));
        expect(() => JSON.stringify(n)).not.toThrow();
    });
    it("splits title and body", () => {
        expect(toDto(row())).toMatchObject({ title: "Waste risk · ST068", body: "Surplus 11 units." });
    });
    it("legacy one-line message → the type label is the title", () => {
        expect(toDto(row({ type: "STALE_DATA", message: "Sales data is 95 min old" }))).toMatchObject({ title: "Stale data", body: "Sales data is 95 min old" });
    });
    it("no action_url → the type's default follow-up (S10)", () => {
        expect(toDto(row({ type: "SYSTEM", actionUrl: null })).actionUrl).toBe("/thresholds");
    });
    it("read = readAt is set", () => {
        expect(toDto(row()).read).toBe(false);
        expect(toDto(row({ readAt: new Date() })).read).toBe(true);
    });
});

describe("filterNotifications", () => {
    const list = [dto(1, { type: "SHORTAGE_RISK" }), dto(2, { type: "WASTE_RISK", read: true }), dto(3, { type: "PROMOTION" })];
    it("no types selected = all types", () => {
        expect(ids(filterNotifications(list, { types: [], unreadOnly: false }))).toEqual(["1", "2", "3"]);
    });
    it("several chips at once = any of them", () => {
        expect(ids(filterNotifications(list, { types: ["WASTE_RISK", "PROMOTION"], unreadOnly: false }))).toEqual(["2", "3"]);
    });
    it("Unread only hides read alerts", () => {
        expect(ids(filterNotifications(list, { types: [], unreadOnly: true }))).toEqual(["1", "3"]);
    });
    it("both filters together", () => {
        expect(filterNotifications(list, { types: ["WASTE_RISK"], unreadOnly: true })).toEqual([]);
    });
});

describe("mergeIncoming", () => {
    it("adds new alerts, newest (highest id) first", () => {
        expect(ids(mergeIncoming([dto(1), dto(2)], [dto(3)]))).toEqual(["3", "2", "1"]);
    });
    it("an alert sent twice (reconnect) appears once, and the newer copy wins", () => {
        const merged = mergeIncoming([dto(2, { read: false })], [dto(2, { read: true })]);
        expect(merged).toHaveLength(1);
        expect(merged[0].read).toBe(true);
    });
    it("sorts ids as numbers, not strings (\"10\" after \"9\")", () => {
        expect(ids(mergeIncoming([dto(9)], [dto(10)]))).toEqual(["10", "9"]);
    });
    it(`keeps at most ${MAX_KEPT}, dropping the oldest`, () => {
        const many = Array.from({ length: MAX_KEPT + 5 }, (_, i) => dto(i + 1));
        const merged = mergeIncoming([], many);
        expect(merged).toHaveLength(MAX_KEPT);
        expect(merged.at(-1)?.id).toBe("6");
    });
    it("does not change the list it was given", () => {
        const list = [dto(1)];
        mergeIncoming(list, [dto(2)]);
        expect(ids(list)).toEqual(["1"]);
    });
});

describe("applyReadOverrides", () => {
    const list = [dto(10), dto(9), dto(2, { read: true })];
    it("no overrides → unchanged", () => {
        expect(applyReadOverrides(list, { ids: new Set(), allUpTo: null })).toEqual(list);
    });
    it("marks single ids read in this tab", () => {
        const out = applyReadOverrides(list, { ids: new Set(["9"]), allUpTo: null });
        expect(out.map((n) => n.read)).toEqual([false, true, true]);
    });
    it("Mark all as read covers ids ≤ allUpTo, compared as numbers", () => {
        const out = applyReadOverrides(list, { ids: new Set(), allUpTo: "9" });
        expect(out.map((n) => n.read)).toEqual([false, true, true]); // "10" > "9" stays unread
    });
    it("never turns a read alert back to unread, and doesn't mutate the input", () => {
        applyReadOverrides(list, { ids: new Set(["10"]), allUpTo: null });
        expect(list[0].read).toBe(false);
        expect(list[2].read).toBe(true);
    });
});

describe("formatAlertTime (Bangkok time)", () => {
    const now = Date.parse("2026-11-19T06:42:00Z"); // 13:42 in Bangkok
    it("today → time only", () => {
        expect(formatAlertTime(Date.parse("2026-11-19T06:40:00Z"), now)).toBe("13:40");
    });
    it("an earlier day → date and time", () => {
        expect(formatAlertTime(Date.parse("2026-11-18T06:40:00Z"), now)).toBe("18 Nov · 13:40");
    });
    it("uses the Bangkok day, not UTC: 00:30 Bangkok is today even though it's still the 18th in UTC", () => {
        expect(formatAlertTime(Date.parse("2026-11-18T17:30:00Z"), now)).toBe("00:30");
        expect(formatAlertTime(Date.parse("2026-11-18T16:59:00Z"), now)).toBe("18 Nov · 23:59");
    });
});