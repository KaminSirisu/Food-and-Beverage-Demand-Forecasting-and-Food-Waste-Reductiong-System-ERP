// Demo data until forecast (Mew) and ingestion (Auto) land. Run after `npm run db:seed`.
// Idempotent: deletes only rows it created (tagged below), then inserts them again for *today*.
// Numbers are taken from the dashboard mockup so the screen can be checked against it.
import { ModelKind } from "@prisma/client";
import { db } from "../src/lib/db";
import { STORE_NO } from "../src/lib/config";
import { addDays, todayDate, tomorrowDate } from "../src/lib/time";

const DEMO_VERSION = "demo-stub";

// leftNow = stock on shelf now · restOfDay = Model 1 (sold after now) · tomorrow = Model 2
const DEMO = [
    { itemNo: "SB078", leftNow: 34, restOfDay: 15, tomorrow: 33.6 },
    { itemNo: "SB062", leftNow: 22, restOfDay: 14, tomorrow: 13.7 },
    { itemNo: "ST068", leftNow: 22, restOfDay: 4, tomorrow: 8.6 },
    { itemNo: "ST058", leftNow: 15, restOfDay: 5, tomorrow: 9.8 },
    { itemNo: "SC220", leftNow: 5, restOfDay: 8, tomorrow: 14.5 }, // short ~3 today
    { itemNo: "SC076", leftNow: 14, restOfDay: 8, tomorrow: 11.4 },
    { itemNo: "SCP1993", leftNow: 16, restOfDay: 6, tomorrow: 13.9 },
    { itemNo: "SB094", leftNow: 12, restOfDay: 9, tomorrow: 10.6 }, // not in mockup
];

// ฿ waste per day, oldest → today (Daily Waste vs Target chart)
const WASTE_7_DAYS = [1256, 1221, 1041, 1063, 1113, 955, 1425];

async function main() {
    const inScope = await db.sku.count({ where: { inScope: true }});
    if (inScope < 8) throw new Error("Run `npm run db:seed` first (needs the 8 in-scope SKUs).");

    const now = new Date();
    const today = todayDate(now);
    const tomorrow = tomorrowDate(now);

    // 1. Remove previous demo rows (forecasts first: they reference model_version)
    await db.$transaction([
        db.forecast.deleteMany({ where: { modelVersion: { version: DEMO_VERSION }}}),
        db.modelVersion.deleteMany({ where: { version: DEMO_VERSION }}),
        db.stockSnapshot.deleteMany({ where: { storeNo: STORE_NO, source: "ESTIMATED" } }),
        db.wasteRecord.deleteMany({ where: { storeNo: STORE_NO, source: "SIMULATED" } }),
        db.importBatch.deleteMany({ where: { source: "simulate" } }),
    ])
    // 2. Demo models — active only if no real model of that kind is active (never override Mew's)
    const models: Record<ModelKind, string> = { REST_OF_DAY: "", TOMORROW: "" };
    for (const kind of [ModelKind.REST_OF_DAY, ModelKind.TOMORROW]) {
        const realActive = await db.modelVersion.count({ where: { kind, isActive: true } });
        const mv = await db.modelVersion.create({
            data: {
                kind, version: DEMO_VERSION, onnxPath: "demo", trainedAt: now,
                dataFrom: addDays(today, -90), dataTo: addDays(today, -1),
                metrics: { note: "demo data, not a trained model" },
                isActive: realActive === 0,
            },
        });
        models[kind] = mv.id;
    }
    // 3. Forecasts (S3): rest of today + tomorrow, one row per SKU
    await db.forecast.createMany({
        data: DEMO.flatMap((d) => [
            { modelVersionId: models.REST_OF_DAY, storeNo: STORE_NO, itemNo: d.itemNo, targetDate: today, runAt: now, predictedQty: d.restOfDay },
            { modelVersionId: models.TOMORROW, storeNo: STORE_NO, itemNo: d.itemNo, targetDate: tomorrow, runAt: now, predictedQty: d.tomorrow },
        ]),
    });
    // 4. Stock on shelf now (SM4 "Left now" default; the manager's COUNT overrides it)
    await db.stockSnapshot.createMany({
        data: DEMO.map((d) => ({ storeNo: STORE_NO, itemNo: d.itemNo, takenAt: now, qty: d.leftNow, source: "ESTIMATED" })),
    });
    // 5. Branch-level waste for the last 7 days (itemNo null = whole branch)
    await db.wasteRecord.createMany({
        data: WASTE_7_DAYS.map((value, i) => ({
            storeNo: STORE_NO, itemNo: null, wasteDate: addDays(today, i - 6), value, source: "SIMULATED",
        })),
    });
    // 6. A finished import 2 h ago → header "D365 Data Sync: Active" (S1)
    const twoHoursAgo = new Date(now.getTime() - 2 * 3_600_000);
    await db.importBatch.create({
        data: {
            fileName: "demo.xlsx", fileHash: DEMO_VERSION, fileKind: "SALES_ENTRY", source: "simulate",
            status: "LOADED", periodFrom: today, periodTo: today, receivedAt: twoHoursAgo, finishedAt: twoHoursAgo,
        },
    });

    console.log(`demo seeded for ${today.toISOString().slice(0, 10)}: 16 forecasts, 8 snapshots, 7 waste days, 1 import`);

}
main().finally(() => db.$disconnect());