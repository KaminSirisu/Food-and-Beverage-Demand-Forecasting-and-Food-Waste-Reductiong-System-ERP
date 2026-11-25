// NFR7 check: onnxruntime-node gives the same numbers as Python (LightGBM) on every test row.
// Run: npx tsx src/lib/forecast/predict.check.ts [models/onnx_test_cases.json]
// The JSON comes from ml/export_onnx.py; null = NaN (missing). Tolerance is stored in the file (0.001).
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { predictRatios, type ModelName } from "./model";

type Case = { sku: string; date: string; inputs: (number | null)[]; level: number; expected_output: number; predicted_units: number };
type Cases = { tolerance: number } & Record<ModelName, { feature_order: string[]; cases: Case[] }>;

const file = process.argv[2] ?? "models/onnx_test_cases.json";
const data = JSON.parse(readFileSync(file, "utf8")) as Cases;

async function main() {
    let failed = false;
    for (const name of ["rest_of_day", "tomorrow"] as const) {
        const { feature_order, cases } = data[name];
        const vectors = cases.map((c) => {
            assert.equal(c.inputs.length, feature_order.length, `${name} ${c.sku} ${c.date}: wrong number of inputs`);
            return Float32Array.from(c.inputs, (v) => v ?? NaN);
        });
        const ratios = await predictRatios(name, vectors);
        let maxRatio = 0, maxUnits = 0;
        cases.forEach((c, i) => {
            maxRatio = Math.max(maxRatio, Math.abs(ratios[i] - c.expected_output));
            maxUnits = Math.max(maxUnits, Math.abs(ratios[i] * c.level - c.predicted_units));
        });
        const ok = maxRatio <= data.tolerance && maxUnits <= data.tolerance;
        failed ||= !ok;
        console.log(`${name.padEnd(12)} rows ${String(cases.length).padStart(5)} | max diff ${maxRatio.toExponential(1)} (ratio) ${maxUnits.toExponential(1)} (units) -> ${ok ? "PASS" : "FAIL"}`);
    }
    if (failed) {
        console.error(`predict check FAILED (limit ${data.tolerance})`);
        process.exit(1);
    }
    console.log(`predict checks passed (limit ${data.tolerance})`);
}
main();
