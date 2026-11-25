// A7: register the real model versions and save a day's forecast to the forecast table. Owner: Mew.
// The pages read only the ACTIVE ModelVersion (newest runAt per SKU): the order screen uses
// REST_OF_DAY rows for today and TOMORROW rows for tomorrow, so a run writes both kinds (FA7).
import { ModelKind } from "@prisma/client";
import { db } from "@/lib/db";
import { forecastForDay } from "./forecast";
import { modelInfo } from "./info";

const KINDS = [ModelKind.REST_OF_DAY, ModelKind.TOMORROW] as const;
const day = (s: string) => new Date(`${s}T00:00:00Z`);

/** Make sure both ModelVersion rows of the ONNX model in models/ exist. `activate` makes them the active ones (and turns the others off). */
export async function registerModels(opts: { activate?: boolean } = {}): Promise<Record<ModelKind, string>> {
    const info = modelInfo();
    const find = (prefix: string) => info.testAccuracy.find((a) => a.name.startsWith(prefix));
    const pack = (a?: { wapePct: number; mae: number; biasPct: number; rows: number }) => (a ? { wape: a.wapePct, mae: a.mae, bias: a.biasPct, rows: a.rows } : null);
    const spec = {
        [ModelKind.REST_OF_DAY]: { model: info.models.restOfDay, accuracy: pack(find("Model 1")), baseline: pack(find("Baseline 1")) },
        [ModelKind.TOMORROW]: { model: info.models.tomorrow, accuracy: pack(find("Model 2")), baseline: pack(find("Baseline 2")) },
    };
    const ids = {} as Record<ModelKind, string>;
    for (const kind of KINDS) {
        const { model, accuracy, baseline } = spec[kind];
        const mv = await db.modelVersion.upsert({
            where: { kind_version: { kind, version: info.version } },
            update: {}, // never change a registered version (and never its isActive) by accident
            create: {
                kind,
                version: info.version,
                onnxPath: `models/${model.file}`,
                trainedAt: new Date(info.trainedAt),
                dataFrom: day(info.dataRange.from),
                dataTo: day(info.dataRange.to),
                metrics: { ...accuracy, baseline, testPeriod: info.testPeriod, level: model.level },
                isActive: false,
            },
        });
        ids[kind] = mv.id;
        if (opts.activate) {
            await db.$transaction([
                db.modelVersion.updateMany({ where: { kind, isActive: true, NOT: { id: mv.id } }, data: { isActive: false } }),
                db.modelVersion.update({ where: { id: mv.id }, data: { isActive: true } }),
            ]);
        }
    }
    return ids;
}

/**
 * Forecast `targetDate` (decided at 13:30 of the day before) and save it:
 * TOMORROW rows for targetDate and REST_OF_DAY rows for the decision day, both with the model version.
 * Same `runAt` twice = no duplicates. Returns null when there is no data for the decision day.
 */
export async function saveForecast(storeNo: number, targetDate: string, opts: { activate?: boolean; runAt?: Date } = {}) {
    const result = await forecastForDay(storeNo, targetDate);
    if (!result) return null;
    const models = await registerModels({ activate: opts.activate });
    const runAt = opts.runAt ?? new Date();
    const data = [
        ...result.rows.map((r) => ({
            modelVersionId: models.TOMORROW, storeNo, itemNo: r.itemNo, targetDate: day(result.date), runAt, predictedQty: r.predictedQty.toFixed(3),
        })),
        ...result.restOfDayRows.map((r) => ({
            modelVersionId: models.REST_OF_DAY, storeNo, itemNo: r.itemNo, targetDate: day(result.decisionDate), runAt, predictedQty: r.restOfDay.toFixed(3),
        })),
    ];
    const { count } = await db.forecast.createMany({ data, skipDuplicates: true });
    await db.auditLog.create({
        data: {
            actor: "system", action: "FORECAST_RUN", entity: "forecast", entityId: `${storeNo}:${targetDate}`,
            detail: {
                source: "model", model: result.modelVersion, decisionDate: result.decisionDate,
                tomorrow: result.rows.length, restOfDay: result.restOfDayRows.length, saved: count, notCovered: result.notCovered,
            },
        },
    });
    return { ...result, saved: count };
}