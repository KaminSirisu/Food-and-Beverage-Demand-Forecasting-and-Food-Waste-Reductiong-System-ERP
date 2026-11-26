// Checkpoint alerts (SM5, SM6, S7): run once a day at the times set on Branch Thresholds & Checkpoints.
//   Opportunity Sale (default 2:00 PM): stock at/below the limit and the forecast still expects more sales
//     → produce more AT THE BRANCH. The count includes the back store, not only the shelf, so the amount is
//       a simple rule agreed with the Leader: 20% of this morning's stock (at least 1).
//   Cheer Sale (default 6:00 PM): last-day stock at/above the limit → cheer the sale / push the discount.
// Pure: the engine (engine.ts) loads the inputs and saves the drafts. Same Limit maths as the Thresholds page.
import { DISPLAY_CAPACITY } from "@/lib/config";
import { computeRow, type OrderInputs } from "@/lib/orders/formula";
import type { Thresholds } from "@/lib/thresholds/resolve";
import { toUnits } from "@/lib/thresholds/units";
import type { AlertDraft } from "./rules";
import { CHEER_TITLE, OPPORTUNITY_TITLE } from "./meta";

export type CheckpointKind = "OPPORTUNITY" | "CHEER";

export const PRODUCE_MORE_PCT = 20; // % of this morning's stock

/** Units to produce at the branch: 20% of the opening stock, or what the forecast is short by if the opening is unknown. */
export function produceMoreQty(openingStock: number, restOfDay: number, stockNow: number): number {
    if (openingStock > 0) return Math.max(1, Math.ceil((openingStock * PRODUCE_MORE_PCT) / 100));
    return Math.max(1, Math.ceil(restOfDay - stockNow));
}

/** Limit in whole units for a category. A % limit needs the display capacity; unknown capacity → no limit. */
function limitUnits(limit: Thresholds["opportunity"], categoryCode: string): number | null {
    if (limit.unit === "UNITS") return limit.value;
    const capacity = DISPLAY_CAPACITY[categoryCode] ?? 0;
    return capacity > 0 ? toUnits(limit, capacity) : null;
}

export function opportunityDrafts(
    lines: OrderInputs[],
    opening: Map<string, number>,
    rulesFor: (categoryCode: string) => Thresholds,
    clock: string, // "14:00", shown in the message
): AlertDraft[] {
    const drafts: AlertDraft[] = [];
    for (const line of lines) {
        const stock = computeRow(line).leftNow;
        const limit = limitUnits(rulesFor(line.categoryCode).opportunity, line.categoryCode);
        const expected = Math.round(line.restOfDay);
        if (limit === null || stock > limit || expected <= stock) continue; // enough stock, or no more demand today
        const produce = produceMoreQty(opening.get(line.itemNo) ?? 0, line.restOfDay, stock);
        const base = opening.get(line.itemNo);
        drafts.push({
            type: "SHORTAGE_RISK",
            itemNo: line.itemNo,
            title: `${OPPORTUNITY_TITLE} · ${line.itemNo} ${line.nameTh}`,
            body:
                `Only ${stock} left at ${clock} and the forecast sells ~${expected} more today. ` +
                `Produce ${produce} more at the branch` +
                (base ? ` (${PRODUCE_MORE_PCT}% of this morning's ${base}).` : "."),
            actionUrl: "/notifications", // no button is shown for it (meta.ts ctaFor)
            dedupeByTitle: true,
        });
    }
    return drafts;
}

export function cheerDrafts(
    lines: OrderInputs[],
    rulesFor: (categoryCode: string) => Thresholds,
    clock: string,
): AlertDraft[] {
    const drafts: AlertDraft[] = [];
    for (const line of lines) {
        const row = computeRow(line);
        if (!row.lastDay || row.leftNow <= 0) continue; // only items that expire today
        const rules = rulesFor(line.categoryCode);
        const limit = limitUnits(rules.cheer, line.categoryCode);
        if (limit === null || row.leftNow < limit) continue;
        drafts.push({
            type: "WASTE_RISK",
            itemNo: line.itemNo,
            title: `${CHEER_TITLE} · ${line.itemNo} ${line.nameTh}`,
            body: `${row.leftNow} still left at ${clock} and it expires today. Cheer the sale or push the ${rules.discountPct}% discount.`,
            actionUrl: `/promotions?sku=${encodeURIComponent(line.itemNo)}`,
            dedupeByTitle: true,
        });
    }
    return drafts;
}
