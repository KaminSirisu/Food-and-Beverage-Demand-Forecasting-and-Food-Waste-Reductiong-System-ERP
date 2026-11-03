// Metadata of the live model for GET /api/model-info (A5, NFR8). Owner: Mew.
// Reads models/model_info.json (written by ml/export_onnx.py). Kept apart from model.ts
// so the model-info route does not load onnxruntime-node.
import path from "node:path";
import { readFileSync } from "node:fs";

type RawModel = { file: string; trees: number; inputs: number; feature_order: string[]; level: string };
type RawInfo = {
    version: string;
    created: string;
    store: number;
    decision_time: string;
    train_period: [string, string];
    validation_period: [string, string];
    test_period: [string, string];
    libraries: Record<string, string | number>;
    models: { rest_of_day: RawModel; tomorrow: RawModel };
    test_accuracy: Record<string, { WAPE_pct: number; MAE: number; Bias_pct: number; rows: number }>;
};

const range = ([from, to]: [string, string]) => ({ from, to });
const modelOf = (m: RawModel) => ({ file: m.file, trees: m.trees, inputs: m.inputs, features: m.feature_order, level: m.level });

/** Version, training date, data range, features and test accuracy of the model in models/. */
export function modelInfo() {
    const raw: RawInfo = JSON.parse(readFileSync(path.join(process.cwd(), "models", "model_info.json"), "utf8"));
    return {
        version: raw.version,
        trainedAt: raw.created,
        store: raw.store,
        decisionTime: raw.decision_time,
        dataRange: range(raw.train_period), // data the final model was trained on
        validation: range(raw.validation_period),
        testPeriod: range(raw.test_period),
        models: { restOfDay: modelOf(raw.models.rest_of_day), tomorrow: modelOf(raw.models.tomorrow) },
        testAccuracy: Object.entries(raw.test_accuracy).map(([name, a]) => ({ name, wapePct: a.WAPE_pct, mae: a.MAE, biasPct: a.Bias_pct, rows: a.rows })),
        libraries: raw.libraries,
    };
}