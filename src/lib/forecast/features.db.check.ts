// A4 check from the DB: features built from daily_sales == Python features for the 20 sample branch-SKU-days.
// Run after the history is loaded (L6): npx tsx --env-file=.env src/lib/forecast/features.db.check.ts
// Compares the float32 values the ONNX model receives; also reports the largest float64 difference
// (baht sums stored as DECIMAL can differ from Python's float sums in the 15th digit).
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { db } from "@/lib/db";
import { buildFeaturesFromDb } from "./daily";
import { FEATURES_REST, FEATURES_TOM, type FeatureRow } from "./features";

type Sample = {
    sku: string;
    date: string;
    restOfDay: { features: Record<string, number | null>; level: number | null };
    tomorrow: { features: Record<string, number | null>; level: number | null };
};
const { samples } = JSON.parse(readFileSync(process.argv[2] ?? "ml/feature_samples.json", "utf8")) as { samples: Sample[] };

const same32 = (ts: number, py: number | null) => (py === null ? Number.isNaN(ts) : Math.fround(ts) === Math.fround(py));
const diff64 = (ts: number, py: number | null) => (py === null || Number.isNaN(ts) ? 0 : Math.abs(ts - py));

async function main() {
    const rows = new Map<string, FeatureRow>((await buildFeaturesFromDb(801)).map((r) => [`${r.itemNo}|${r.date}`, r]));
    let checked = 0, mismatches = 0, maxDiff = 0;
    console.log("sku      date        model        values  float32  level");
    for (const s of samples) {
        const r = rows.get(`${s.sku}|${s.date}`);
        assert.ok(r, `no row from daily_sales for ${s.sku} ${s.date}: is the history loaded?`);
        for (const [name, py, ts, order] of [
            ["rest_of_day", s.restOfDay, r.restOfDay, FEATURES_REST],
            ["tomorrow", s.tomorrow, r.tomorrow, FEATURES_TOM],
        ] as const) {
            const bad = order.filter((f, i) => !same32(ts.vector[i], py.features[f]));
            const levelOk = same32(ts.level, py.level);
            for (const f of bad) console.log(`   ✗ ${s.sku} ${s.date} ${name}.${f}: DB ${ts.features[f]} vs Python ${py.features[f]}`);
            order.forEach((f) => (maxDiff = Math.max(maxDiff, diff64(ts.features[f], py.features[f]))));
            mismatches += bad.length + (levelOk ? 0 : 1);
            checked += order.length;
            console.log(`${s.sku.padEnd(8)} ${s.date}  ${name.padEnd(11)}  ${String(order.length).padStart(6)}  ${bad.length ? "✗" : "✓"}        ${levelOk ? "✓" : "✗"}`);
        }
    }
    console.log(`\n${samples.length} branch-SKU-days from daily_sales, ${checked} feature values compared, ${mismatches} mismatches (largest float64 difference ${maxDiff.toExponential(1)})`);
    assert.equal(mismatches, 0, "features from daily_sales differ from Python");
    console.log("daily_sales feature checks passed");
}

main().finally(() => db.$disconnect());
