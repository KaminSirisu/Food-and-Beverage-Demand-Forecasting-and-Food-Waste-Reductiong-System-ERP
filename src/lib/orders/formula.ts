// Factory order formulas (SM3, SM4, S4, S5). Pure: no DB, no "server-only" —
// the client card uses it for live updates, the server action re-runs it on confirm.
// Open decision: report S4 formula below; if Slide 6 wins, change suggestedQty() only.
import { AM_APPROVAL_PCT } from "@/lib/config";

/** One SKU's inputs, as loaded from the DB (Lesson 3). Plain numbers only — safe to pass to the client. */
export type OrderInputs = {
    itemNo: string;
    nameTh: string;
    price: number;
    shelfLifeDays: number;
    restOfDay: number; // Model 1: units still sold today after now (may be a decimal)
    tomorrow: number; // Model 2: full-day units tomorrow (may be a decimal)
    leftNow: number; // latest stock snapshot today (SM4 default)
    savedOrdered: number | null; // orderedQty already confirmed for tomorrow, if any
};
export type OrderRow = {
    leftNow: number;
    tonight: number; // expected left at close
    usable: number; // still sellable tomorrow; 0 on its last day
    need: number; // tomorrow's forecast, whole units
    suggested: number;
    ordered: number;
    lastDay: boolean;
    shortage: number; // units we expect to run out of before close ("Short ~N")
    wasteRiskPct: number; // share of Left now expected to be thrown away tonight
    needsApproval: boolean; // S5
};
// S4: Suggested = Need − Usable, never negative
export function suggestedQty(need: number, usable: number): number {
    return Math.max(0, need - usable);
}
// S5: more than AM_APPROVAL_PCT above Suggested → "Needs AM approval".
// Integer maths (×100) avoids float surprises such as 15 * 1.2 !== 18 in some cases.
export function needsApproval(suggested: number, ordered: number): boolean {
    if (suggested === 0) return ordered > 0;
    return ordered * 100 > suggested * (100 + AM_APPROVAL_PCT);
}
export function computeRow(input: OrderInputs, leftNow = input.leftNow, ordered?: number): OrderRow {
    const soldRestOfDay = Math.round(input.restOfDay);
    const tonight = Math.max(0, leftNow - soldRestOfDay);
    const lastDay = input.shelfLifeDays <= 1; // no batch age yet → 1-day items are always on their last day
    const usable = lastDay ? 0 : tonight;
    const need = Math.ceil(input.tomorrow); // round up: one bun short is a lost sale
    const suggested = suggestedQty(need, usable);
    const finalOrdered = ordered ?? suggested;

    return {
        leftNow,
        tonight,
        usable,
        need,
        suggested,
        ordered: finalOrdered,
        lastDay,
        shortage: Math.max(0, soldRestOfDay - leftNow),
        wasteRiskPct: lastDay && leftNow > 0 ? Math.round((tonight / leftNow) * 100) : 0,
        needsApproval: needsApproval(suggested, finalOrdered),
    };
}