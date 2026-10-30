// Self-check for units.ts + resolve.ts. Run: npx tsx src/lib/thresholds/thresholds.check.ts
import assert from "node:assert/strict";
import { DEFAULT_THRESHOLDS, resolve, type ThresholdRow } from "./resolve";
import { toPct, toUnits } from "./units";

// Mockup: "≤ 3 units ≈ 5% of Bread (60), 19% of Cake Pound (16)"
assert.equal(toPct({ value: 3, unit: "UNITS" }, 60), 5);
assert.equal(toPct({ value: 3, unit: "UNITS" }, 16), 19);
// Mockup: "≥ 10% ≈ 6 units of Bread (60), 2 of Cake Pound (16)"
assert.equal(toUnits({ value: 10, unit: "PCT" }, 60), 6);
assert.equal(toUnits({ value: 10, unit: "PCT" }, 16), 2);
// Same unit in and out → unchanged
assert.equal(toUnits({ value: 7, unit: "UNITS" }, 60), 7);

const empty: ThresholdRow = {
    opportunityCheckAt: null, opportunityValue: null, opportunityUnit: null,
    cheerCheckAt: null, cheerValue: null, cheerUnit: null,
    wasteRiskPct: null, discountPct: null,
};

// No row, or a row of NULLs → everything inherited
assert.deepEqual(resolve(DEFAULT_THRESHOLDS, null), DEFAULT_THRESHOLDS);
assert.deepEqual(resolve(DEFAULT_THRESHOLDS, empty), DEFAULT_THRESHOLDS);

// Override one field, inherit the rest
const bread = resolve(DEFAULT_THRESHOLDS, { ...empty, wasteRiskPct: 30, discountPct: 0 });
assert.equal(bread.wasteRiskPct, 30);
assert.equal(bread.discountPct, 0); // 0 is a real value, not "inherit"
assert.deepEqual(bread.opportunity, DEFAULT_THRESHOLDS.opportunity);

// Value without unit → inherit both (never mix a category's value with the default's unit)
const half = resolve(DEFAULT_THRESHOLDS, { ...empty, cheerValue: 25 });
assert.deepEqual(half.cheer, DEFAULT_THRESHOLDS.cheer);

// Two layers: code defaults ← branch row ← category row
const branch = resolve(DEFAULT_THRESHOLDS, { ...empty, opportunityValue: 5, opportunityUnit: "UNITS" });
assert.deepEqual(resolve(branch, empty).opportunity, { value: 5, unit: "UNITS" });

console.log("thresholds.check: all passed");