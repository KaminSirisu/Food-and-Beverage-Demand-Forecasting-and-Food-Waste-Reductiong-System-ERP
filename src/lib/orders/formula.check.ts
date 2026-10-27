// Self-check for formula.ts using the mockup rows. Run: npx tsx src/lib/orders/formula.check.ts
import assert from "node:assert/strict";
import { computeRow, needsApproval, type OrderInputs } from "./formula";

const base = { nameTh: "", price: 10, savedOrdered: null };
const SB078: OrderInputs = { ...base, itemNo: "SB078", shelfLifeDays: 2, leftNow: 34, restOfDay: 15, tomorrow: 33.6 };
const ST068: OrderInputs = { ...base, itemNo: "ST068", shelfLifeDays: 1, leftNow: 22, restOfDay: 4, tomorrow: 8.6 };
const SC220: OrderInputs = { ...base, itemNo: "SC220", shelfLifeDays: 1, leftNow: 5, restOfDay: 8, tomorrow: 14.5 };
// Need rounds UP: 10.2 forecast → order for 11 (Math.round would give 10 and risk a lost sale)
const lowDecimal: OrderInputs = { ...base, itemNo: "SB094", shelfLifeDays: 2, leftNow: 0, restOfDay: 0, tomorrow: 10.2 };
assert.equal(computeRow(lowDecimal).need, 11);

// Mockup row: 34 / 19 / 19 / 34 / 15
assert.partialDeepStrictEqual(computeRow(SB078), { tonight: 19, usable: 19, need: 34, suggested: 15, ordered: 15, lastDay: false });

// Last day: leftover can't be sold tomorrow → Usable 0, high waste risk
assert.partialDeepStrictEqual(computeRow(ST068), { tonight: 18, usable: 0, need: 9, suggested: 9, lastDay: true, wasteRiskPct: 82 });

// Runs out before close: Short ~3
assert.partialDeepStrictEqual(computeRow(SC220), { tonight: 0, shortage: 3, need: 15, suggested: 15 });

// SM4: manager recounts SB078 at 40 → more usable → Suggested drops
assert.equal(computeRow(SB078, 40).suggested, 9);

// S5: exactly +20% is fine, above it needs AM approval
assert.equal(needsApproval(15, 18), false);
assert.equal(needsApproval(15, 19), true);
assert.equal(computeRow(SB078, 34, 19).needsApproval, true);
// Suggested 0: any order needs approval
assert.equal(needsApproval(0, 0), false);
assert.equal(needsApproval(0, 1), true);

console.log("formula checks passed");