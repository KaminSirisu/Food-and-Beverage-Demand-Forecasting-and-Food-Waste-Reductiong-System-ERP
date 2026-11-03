// One day's forecast for GET /api/forecast (A5). Owner: Mew.
// Feature rows (daily_sales, 13:30 on day D) → ONNX → predicted units of D+1 per SKU.
// Contract with the forecast trigger (src/lib/forecast/trigger.ts): rows[] with itemNo and predictedQty.
import { db } from "@/lib/db";
import { addDays } from "@/lib/time";
import { buildFeaturesFromDb } from "./daily";
import type { FeatureRow } from "./features";
import { modelInfo } from "./info";
import { predict } from "./model";

const round3 = (x: number) => Math.round(x * 1000) / 1000;
const ymd = (d: Date) => d.toISOString().slice(0, 10);

export type ForecastRow = {
    itemNo: string;
    nameEn: string | null;
    onSale: boolean;
    predictedQty: number | null; // units on D+1 (model "tomorrow"); null = the model does not cover this SKU-day
    restOfDay: number | null; // units on D from 13:30 to closing (model "rest_of_day"); null = not covered
};

/** Predictions for every SKU row of the decision day D (no DB: the caller passes the feature rows). */
export async function makeForecast(rows: FeatureRow[], decisionDate: string, names: Record<string, string | null> = {}): Promise<ForecastRow[]> {
    const day = rows.filter((r) => r.date === decisionDate);
    const preds = await predict(day);
    return day.map((r, i) => ({
        itemNo: r.itemNo,
        nameEn: names[r.itemNo] ?? null,
        onSale: r.onSale,
        predictedQty: preds[i].tomorrow === null ? null : round3(preds[i].tomorrow),
        restOfDay: preds[i].restOfDay === null ? null : round3(preds[i].restOfDay),
    }));
}

/**
 * Forecast of `targetDate` ("YYYY-MM-DD") for the 8 SKUs, decided at 13:30 of the day before.
 * Returns null when no sales are loaded for that day (nothing to forecast from).
 */
export async function forecastForDay(storeNo: number, targetDate: string) {
    const decision = addDays(new Date(`${targetDate}T00:00:00Z`), -1);
    const loaded = await db.dailySales.count({ where: { storeNo, saleDate: decision, qtySold: { gt: 0 } } });
    if (loaded === 0) return null;

    const [features, skus] = await Promise.all([
        buildFeaturesFromDb(storeNo, decision),
        db.sku.findMany({ where: { inScope: true }, select: { itemNo: true, nameEn: true }, orderBy: { itemNo: "asc" } }),
    ]);
    const all = await makeForecast(features, ymd(decision), Object.fromEntries(skus.map((s) => [s.itemNo, s.nameEn])));
    const info = modelInfo();
    return {
        store: storeNo,
        date: targetDate,
        decisionDate: ymd(decision),
        decisionTime: info.decisionTime,
        modelVersion: info.version,
        rows: all.flatMap((r) => (r.predictedQty === null ? [] : [{ ...r, predictedQty: r.predictedQty }])),
        notCovered: all.filter((r) => r.predictedQty === null).map((r) => r.itemNo), // not on sale or no history
    };
}