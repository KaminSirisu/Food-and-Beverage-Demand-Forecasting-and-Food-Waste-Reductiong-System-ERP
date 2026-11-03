import { STORE_NO } from "@/lib/config";
import { db } from "@/lib/db";

export interface TriggerResult { targetDate: string; source: "api" | "baseline"; modelVersion: string; rows: number }
type Row = { itemNo: string; predictedQty: number };

const BASELINE_VERSION = "baseline-4w";

async function fromApi(storeNo: number, targetDate: string): Promise<Row[] | null> {
  const base = process.env.APP_URL;
  if (!base) return null;
  try {
    const res = await fetch(`${base}/api/forecast?store=${storeNo}&date=${targetDate}`, { signal: AbortSignal.timeout(20_000) });
    if (!res.ok) return null;
    const body = await res.json();
    const rows = Array.isArray(body) ? body : body?.rows;
    if (!Array.isArray(rows) || rows.length === 0) return null;
    return rows
      .filter((r) => typeof r?.itemNo === "string" && Number.isFinite(Number(r.predictedQty)))
      .map((r) => ({ itemNo: r.itemNo, predictedQty: Number(r.predictedQty) }));
  } catch {
    return null;
  }
}

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
      metrics: { note: "same-weekday mean of the last 4 weeks; fallback until /api/forecast is live" },
      isActive: !anyActive,
    },
  });
}

/** dataDay = last sale date in the file just loaded; the forecast is for the day after. */
export async function runForecastAfterLoad(dataDay: string, storeNo = STORE_NO): Promise<TriggerResult> {
  const day = new Date(`${dataDay}T00:00:00Z`);
  const target = new Date(day);
  target.setUTCDate(target.getUTCDate() + 1);
  const targetDate = target.toISOString().slice(0, 10);

  const api = await fromApi(storeNo, targetDate);
  const model = api
    ? await db.modelVersion.findFirst({ where: { kind: "TOMORROW", isActive: true } })
    : await baselineModel(day);
  if (!model) throw new Error("no active TOMORROW ModelVersion for the /api/forecast rows");
  const rows = api ?? (await baseline(storeNo, targetDate));

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
  const source = api ? "api" : "baseline";
  await db.auditLog.create({
    data: { actor: "system", action: "FORECAST_RUN", entity: "forecast", entityId: `${storeNo}:${targetDate}`, detail: { source, model: model.version, rows: rows.length, dataDay } },
  });
  return { targetDate, source, modelVersion: model.version, rows: rows.length };
}