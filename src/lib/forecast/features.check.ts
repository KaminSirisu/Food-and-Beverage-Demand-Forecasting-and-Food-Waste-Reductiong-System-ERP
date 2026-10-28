// A4 check: TypeScript features == Python features for 20 sample branch-SKU-days.
// Run: npx tsx src/lib/forecast/features.check.ts [ml/feature_samples.json]
// The JSON comes from: python ml/export_feature_samples.py (same data, same feature code as training).
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { buildFeatureRows, FEATURES_REST, FEATURES_TOM, type DailyInput, type FeatureRow } from "./features";

type Sample = {
    sku: string;
    date: string;
    restOfDay: { features: Record<string, number | null>; level: number | null };
    tomorrow: { features: Record<string, number | null>; level: number | null };
};
type Samples = {
    trainEnd: string;
    skus: string[];
    encoders: { sku: Record<string, number>; category: Record<string, number> };
    featureOrder: { rest_of_day: string[]; tomorrow: string[] };
    openDays: string[];
    holidays: string[];
    daily: Record<string, DailyInput[]>;
    samples: Sample[];
};

const SHELF_LIFE: Record<string, number> = { SB078: 2, SB062: 2, ST068: 1, ST058: 1, SC220: 1, SC076: 3, SCP1993: 5, SB094: 2 };
const CATEGORY: Record<string, string> = { SB078: "SB", SB062: "SB", ST068: "ST", ST058: "ST", SC220: "SC", SC076: "SC", SCP1993: "SCP", SB094: "SB" };

const file = process.argv[2] ?? "ml/feature_samples.json";
const data = JSON.parse(readFileSync(file, "utf8")) as Samples;

// 1. Same input order as the models
assert.deepEqual([...FEATURES_REST], data.featureOrder.rest_of_day, "rest_of_day feature order differs from Python");
assert.deepEqual([...FEATURES_TOM], data.featureOrder.tomorrow, "tomorrow feature order differs from Python");

// 2. Build every SKU's rows once
const rows = new Map<string, FeatureRow>();
for (const itemNo of data.skus) {
    const built = buildFeatureRows(
        { itemNo, skuId: data.encoders.sku[itemNo], categoryId: data.encoders.category[CATEGORY[itemNo]], shelfLifeDays: SHELF_LIFE[itemNo] },
        data.daily[itemNo] ?? [],
        { openDays: data.openDays, holidays: data.holidays, trainEnd: data.trainEnd },
    );
    for (const r of built) rows.set(`${itemNo}|${r.date}`, r);
}

// 3. Compare each value exactly (NaN == null); also the float32 ONNX input
const same = (ts: number, py: number | null) => (py === null ? Number.isNaN(ts) : ts === py);
const same32 = (ts: number, py: number | null) => (py === null ? Number.isNaN(ts) : Math.fround(ts) === Math.fround(py));
let checked = 0, mismatches = 0;
console.log("sku      date        model        values  exact  float32  level  eligible");
for (const s of data.samples) {
    const r = rows.get(`${s.sku}|${s.date}`);
    assert.ok(r, `no TypeScript row for ${s.sku} ${s.date}`);
    for (const [name, py, ts, order] of [
        ["rest_of_day", s.restOfDay, r.restOfDay, FEATURES_REST],
        ["tomorrow", s.tomorrow, r.tomorrow, FEATURES_TOM],
    ] as const) {
        const bad = order.filter((f) => !same(ts.features[f], py.features[f]));
        const bad32 = order.filter((f, i) => !same32(ts.vector[i], py.features[f]));
        const levelOk = same(ts.level, py.level);
        for (const f of bad) console.log(`   ✗ ${s.sku} ${s.date} ${name}.${f}: TS ${ts.features[f]} vs Python ${py.features[f]}`);
        if (!levelOk) console.log(`   ✗ ${s.sku} ${s.date} ${name}.level: TS ${ts.level} vs Python ${py.level}`);
        mismatches += bad.length + bad32.length + (levelOk ? 0 : 1) + (ts.eligible ? 0 : 1);
        checked += order.length;
        console.log(`${s.sku.padEnd(8)} ${s.date}  ${name.padEnd(11)}  ${String(order.length).padStart(6)}  ${bad.length ? "✗" : "✓"}      ${bad32.length ? "✗" : "✓"}        ${levelOk ? "✓" : "✗"}      ${ts.eligible ? "✓" : "✗"}`);
    }
}
console.log(`\n${data.samples.length} branch-SKU-days, ${checked} feature values compared, ${mismatches} mismatches`);
assert.equal(mismatches, 0, "TypeScript features differ from Python");
console.log("feature checks passed");
