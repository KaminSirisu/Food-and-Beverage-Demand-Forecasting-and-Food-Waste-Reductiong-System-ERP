// A5 end-to-end check without the DB: sample daily_sales → features → ONNX → makeForecast() == Python predictions.
// Run: npx tsx src/lib/forecast/forecast.check.ts [ml/feature_samples.json] [models/onnx_test_cases.json]
// Compares every SKU of the sample dates that fall in the test months (Apr – Aug 2023) with the LightGBM numbers
// in onnx_test_cases.json (rest_of_day: date = D; tomorrow: date = D+1). Limit 0.001 (NFR7).
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { buildFeatureRows, type DailyInput, type FeatureRow } from "./features";
import { makeForecast } from "./forecast";

type Samples = {
    trainEnd: string;
    skus: string[];
    encoders: { sku: Record<string, number>; category: Record<string, number> };
    openDays: string[];
    holidays: string[];
    daily: Record<string, DailyInput[]>;
    samples: { sku: string; date: string }[];
};
type Case = { sku: string; date: string; predicted_units: number };
type Cases = { tolerance: number; rest_of_day: { cases: Case[] }; tomorrow: { cases: Case[] } };

const SHELF_LIFE: Record<string, number> = { SB078: 2, SB062: 2, ST068: 1, ST058: 1, SC220: 1, SC076: 3, SCP1993: 5, SB094: 2 };
const CATEGORY: Record<string, string> = { SB078: "SB", SB062: "SB", ST068: "ST", ST058: "ST", SC220: "SC", SC076: "SC", SCP1993: "SCP", SB094: "SB" };

const data = JSON.parse(readFileSync(process.argv[2] ?? "ml/feature_samples.json", "utf8")) as Samples;
const cases = JSON.parse(readFileSync(process.argv[3] ?? "models/onnx_test_cases.json", "utf8")) as Cases;
const nextDay = (d: string) => new Date(Date.parse(`${d}T00:00:00Z`) + 86_400_000).toISOString().slice(0, 10);
const index = (cs: Case[]) => new Map(cs.map((c) => [`${c.sku}|${c.date}`, c.predicted_units]));
const pyRest = index(cases.rest_of_day.cases);
const pyTom = index(cases.tomorrow.cases);

async function main() {
    const rows: FeatureRow[] = data.skus.flatMap((itemNo) =>
        buildFeatureRows(
            { itemNo, skuId: data.encoders.sku[itemNo], categoryId: data.encoders.category[CATEGORY[itemNo]], shelfLifeDays: SHELF_LIFE[itemNo] },
            data.daily[itemNo] ?? [],
            { openDays: data.openDays, holidays: data.holidays, trainEnd: data.trainEnd },
        ),
    );
    const dates = [...new Set(data.samples.map((s) => s.date))].filter((d) => d > data.trainEnd).sort();
    let compared = 0, maxDiff = 0;
    console.log("decision day  sku      D+1 units (TS | Python)   rest of day (TS | Python)");
    for (const day of dates) {
        for (const r of await makeForecast(rows, day)) {
            const t = pyTom.get(`${r.itemNo}|${nextDay(day)}`);
            const d = pyRest.get(`${r.itemNo}|${day}`);
            // a prediction exists exactly when Python has a test row for it
            assert.equal(r.predictedQty !== null, t !== undefined, `${r.itemNo} ${day}: tomorrow coverage differs from Python`);
            assert.equal(r.restOfDay !== null, d !== undefined, `${r.itemNo} ${day}: rest_of_day coverage differs from Python`);
            if (r.predictedQty !== null && t !== undefined) { maxDiff = Math.max(maxDiff, Math.abs(r.predictedQty - t)); compared++; }
            if (r.restOfDay !== null && d !== undefined) { maxDiff = Math.max(maxDiff, Math.abs(r.restOfDay - d)); compared++; }
            console.log(`${day}    ${r.itemNo.padEnd(8)} ${String(r.predictedQty).padStart(7)} | ${String(t ?? "-").padEnd(8)}      ${String(r.restOfDay).padStart(7)} | ${d ?? "-"}`);
        }
    }
    assert.ok(compared > 0, "no sample date falls in the test months");
    console.log(`\n${dates.length} days, ${compared} predictions compared, largest difference ${maxDiff.toExponential(1)} (limit ${cases.tolerance}; values rounded to 3 decimals)`);
    assert.ok(maxDiff <= cases.tolerance, "forecast differs from Python");
    console.log("forecast checks passed");
}
main();