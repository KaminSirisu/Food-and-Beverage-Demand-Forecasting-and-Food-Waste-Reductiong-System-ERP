import { STORE_NO } from "@/lib/config";
import { db } from "@/lib/db";
import { saveForecast } from "./save";

// source "model" = the ONNX model (src/lib/forecast/forecast.ts), "baseline" = same-weekday mean of the last 4 weeks
export interface TriggerResult { targetDate: string; source: "model" | "baseline"; modelVersion: string; rows: number }
type Row = { itemNo: string; predictedQty: number };

const BASELINE_VERSION = "baseline-4w";

async function baseline(storeNo: number, targetDate: string): Promise<Row[]> {
  const rows = await db.$queryRaw<{ item_no: string; qty: number }[]>`
    SELECT s.item_no, COALESCE(AVG(d.qty_sold), 0)::float AS qty
    FROM sku s
    LEFT JOIN daily_sales d ON d.item_no = s.item_no AND d.store_no = ${storeNo}
      AND d.sale_date IN (SELECT (${targetDate}::date - 7 * k) FROM generate_series(1, 4) k)
    WHERE s.in_scope
    GROUP BY s.item_no`;
  return rows.map((r) => ({ itemNo: r.item_no, predictedQty: r.qty }));
}

async function baselineModel(dataDay: Date) {
  const anyActive = await db.modelVersion.findFirst({ where: { kind: "TOMORROW", isActive: true } });
  return db.modelVersion.upsert({
    where: { kind_version: { kind: "TOMORROW", version: BASELINE_VERSION } },
    update: { dataTo: dataDay },
    create: {
      kind: "TOMORROW",
      version: BASELINE_VERSION,
      onnxPath: "-",
      trainedAt: new Date(),
      dataFrom: dataDay,
      dataTo: dataDay,
      metrics: { note: "same-weekday mean of the last 4 weeks; fallback when the model covers no SKU for the day" },
      isActive: !anyActive,
    },
  });
}

/**
 * dataDay = last sale date in the file just loaded; the forecast is for the day after.
 * 1. The real model runs in-process and saves TOMORROW rows (target day) and REST_OF_DAY rows (data day) with its model version (A7).
 *    If no model is active yet, the first run makes it the active one.
 * 2. If the model covers no SKU for that day (not enough history, not on sale) or fails, the 4-week baseline is saved instead.
 */
export async function runForecastAfterLoad(dataDay: string, storeNo = STORE_NO): Promise<TriggerResult> {
  const day = new Date(`${dataDay}T00:00:00Z`);
  const target = new Date(day);
  target.setUTCDate(target.getUTCDate() + 1);
  const targetDate = target.toISOString().slice(0, 10);

  let modelError: string | undefined;
  try {
    const noneActive = (await db.modelVersion.count({ where: { isActive: true } })) === 0;
    const saved = await saveForecast(storeNo, targetDate, { activate: noneActive });
    if (saved && saved.rows.length > 0) {
      return { targetDate, source: "model", modelVersion: saved.modelVersion, rows: saved.rows.length };
    }
  } catch (e) {
    modelError = (e as Error).message;
    console.error("forecast model failed, using the baseline:", modelError);
  }

  const model = await baselineModel(day);
  const rows = await baseline(storeNo, targetDate);
  const runAt = new Date();
  await db.forecast.createMany({
    data: rows.map((r) => ({
      modelVersionId: model.id,
      storeNo,
      itemNo: r.itemNo,
      targetDate: target,
      runAt,
      predictedQty: r.predictedQty.toFixed(3),
    })),
    skipDuplicates: true,
  });
  await db.auditLog.create({
    data: { actor: "system", action: "FORECAST_RUN", entity: "forecast", entityId: `${storeNo}:${targetDate}`, detail: { source: "baseline", model: model.version, rows: rows.length, dataDay, modelError: modelError ?? null } },
  });
  return { targetDate, source: "baseline", modelVersion: model.version, rows: rows.length };
}
