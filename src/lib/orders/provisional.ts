// S3 / SM3: provisional forecast at store opening, so the factory order is ready before the first sale.
// The LightGBM model decides tomorrow at 13:30 from today's morning sales (Mew's trigger); before any sale it has
// nothing to work from. Until then the order uses the 4-week same-weekday average (history only), the same
// baseline the trigger already falls back to (version "baseline-4w"). The model's rows always win once they exist.
//   TOMORROW    = mean units sold on the last 4 same weekdays as tomorrow
//   REST_OF_DAY = mean units sold after 13:30 on the last 4 same weekdays as today (same meaning as Model 1)
// Saved under its own inactive ModelVersion, so model accuracy (NFR6) never mixes with the baseline.
import "server-only";
import { ModelKind } from "@prisma/client";
import { db } from "@/lib/db";
import { addDays, todayDate } from "@/lib/time";
import { BASELINE_VERSION } from "./forecast-pick";

const ymd = (d: Date) => d.toISOString().slice(0, 10);

async function baselineVersion(kind: ModelKind, dataDay: Date) {
    return db.modelVersion.upsert({
        where: { kind_version: { kind, version: BASELINE_VERSION } },
        update: {}, // never touch isActive: the real model stays the active one
        create: {
            kind,
            version: BASELINE_VERSION,
            onnxPath: "-",
            trainedAt: new Date(),
            dataFrom: dataDay,
            dataTo: dataDay,
            metrics: { note: "same-weekday mean of the last 4 weeks; provisional until the model runs at 13:30" },
            isActive: false,
        },
    });
}

/** Mean of `qty` over the 4 same weekdays before `day`, per in-scope SKU (days with no row are skipped). */
async function sameWeekdayMean(storeNo: number, day: Date, afterCutoffOnly: boolean): Promise<{ itemNo: string; qty: number }[]> {
    const rows = await db.$queryRaw<{ item_no: string; qty: number }[]>`
        SELECT s.item_no,
               COALESCE(AVG(CASE WHEN ${afterCutoffOnly} THEN d.qty_sold - d.qty_before_cutoff ELSE d.qty_sold END), 0)::float AS qty
        FROM sku s
        LEFT JOIN daily_sales d ON d.item_no = s.item_no AND d.store_no = ${storeNo}
          AND d.sale_date IN (SELECT (${ymd(day)}::date - 7 * k) FROM generate_series(1, 4) k)
        WHERE s.in_scope
        GROUP BY s.item_no`;
    return rows.map((r) => ({ itemNo: r.item_no, qty: Math.max(0, r.qty) }));
}

export type ProvisionalResult = { saved: boolean; rows: number };

/**
 * Saves tomorrow's provisional forecast (and today's rest-of-day) unless tomorrow already has a forecast from any
 * version. Safe to call every minute: it writes once a day. Audit: FORECAST_RUN with source "provisional" (NFR5).
 */
export async function ensureProvisionalForecast(storeNo: number, now = new Date()): Promise<ProvisionalResult> {
    const today = todayDate(now);
    const tomorrow = addDays(today, 1);
    const exists = await db.forecast.count({ where: { storeNo, targetDate: tomorrow, modelVersion: { kind: ModelKind.TOMORROW } } });
    if (exists > 0) return { saved: false, rows: 0 };

    const [tomorrowRows, restRows, hasRest] = await Promise.all([
        sameWeekdayMean(storeNo, tomorrow, false),
        sameWeekdayMean(storeNo, today, true),
        db.forecast.count({ where: { storeNo, targetDate: today, modelVersion: { kind: ModelKind.REST_OF_DAY } } }),
    ]);
    const dataDay = addDays(today, -1); // history up to yesterday
    const [tv, rv] = await Promise.all([baselineVersion(ModelKind.TOMORROW, dataDay), baselineVersion(ModelKind.REST_OF_DAY, dataDay)]);
    const runAt = new Date();
    await db.forecast.createMany({
        data: [
            ...tomorrowRows.map((r) => ({ modelVersionId: tv.id, storeNo, itemNo: r.itemNo, targetDate: tomorrow, runAt, predictedQty: r.qty.toFixed(3) })),
            ...(hasRest > 0 ? [] : restRows.map((r) => ({ modelVersionId: rv.id, storeNo, itemNo: r.itemNo, targetDate: today, runAt, predictedQty: r.qty.toFixed(3) }))),
        ],
        skipDuplicates: true,
    });
    await db.auditLog.create({
        data: {
            actor: "system", action: "FORECAST_RUN", entity: "forecast", entityId: `${storeNo}:${ymd(tomorrow)}`,
            detail: { source: "provisional", model: BASELINE_VERSION, tomorrow: tomorrowRows.length, restOfDay: hasRest > 0 ? 0 : restRows.length },
        },
    });
    return { saved: true, rows: tomorrowRows.length };
}
