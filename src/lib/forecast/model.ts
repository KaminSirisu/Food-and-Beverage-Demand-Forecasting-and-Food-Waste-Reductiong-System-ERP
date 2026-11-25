// ONNX inference for the two forecast models (A5). Owner: Mew.
// Runs in-process with onnxruntime-node (NFR8). Must match Python within 0.001 (NFR7, see predict.check.ts).
// No "server-only" import, so the tsx checks can run it.
import path from "node:path";
import * as ort from "onnxruntime-node";
import type { FeatureRow } from "./features";

export type ModelName = "rest_of_day" | "tomorrow";

const MODELS_DIR = path.join(process.cwd(), "models");

// One session per model, created on first use and reused (loading the file is the slow part).
const sessions = new Map<ModelName, Promise<ort.InferenceSession>>();
function session(name: ModelName): Promise<ort.InferenceSession> {
    let s = sessions.get(name);
    if (!s) {
        s = ort.InferenceSession.create(path.join(MODELS_DIR, `${name}.onnx`));
        sessions.set(name, s);
    }
    return s;
}

/** Raw model output (a ratio to the recent sales level) for each feature vector, in the same order. */
export async function predictRatios(name: ModelName, vectors: Float32Array[]): Promise<number[]> {
    if (vectors.length === 0) return [];
    const width = vectors[0].length;
    const data = new Float32Array(vectors.length * width); // one [n, width] tensor, rows back to back
    vectors.forEach((v, i) => data.set(v, i * width));
    const s = await session(name);
    const out = await s.run({ [s.inputNames[0]]: new ort.Tensor("float32", data, [vectors.length, width]) });
    return Array.from(out[s.outputNames[0]].data as Float32Array);
}

export type Prediction = {
    itemNo: string;
    date: string; // decision day D
    restOfDay: number | null; // units D from 13:30 to closing; null = the model does not cover this row
    tomorrow: number | null; // units on D+1
};

/** Predicted units = model output × level. Only rows the model was trained on (eligible) are run. */
export async function predict(rows: FeatureRow[]): Promise<Prediction[]> {
    const result: Prediction[] = rows.map((r) => ({ itemNo: r.itemNo, date: r.date, restOfDay: null, tomorrow: null }));
    for (const name of ["rest_of_day", "tomorrow"] as const) {
        const key = name === "rest_of_day" ? "restOfDay" : "tomorrow";
        const idx = rows.flatMap((r, i) => (r[key].eligible ? [i] : []));
        const ratios = await predictRatios(name, idx.map((i) => rows[i][key].vector));
        idx.forEach((rowIndex, k) => {
            result[rowIndex][key] = ratios[k] * rows[rowIndex][key].level;
        });
    }
    return result;
}
