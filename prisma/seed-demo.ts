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

// ฿ waste per day, oldest → today. The last 7 match the dashboard mockup (Daily Waste vs Target chart);
// the 23 before them only feed the 30-day tiles on /analytics.
const WASTE_7_DAYS = [1256, 1221, 1041, 1063, 1113, 955, 1425];
const WASTE_OLDER_23 = [
    980, 1340, 1105, 1190, 1460, 870, 1015, 1280, 1230, 940, 1120, 1510,
    1060, 990, 1305, 1175, 1090, 1420, 1010, 1150, 1265, 925, 1080,
];
const WASTE_30_DAYS = [...WASTE_OLDER_23, ...WASTE_7_DAYS];

// Forecast vs. Actual history (S8): how far each SKU's actual sales wander from the forecast.
// Different per SKU so the accuracy table shows Good, Fair and Review rows.
const HISTORY_DAYS = 30;
const NOISE: Record<string, number> = {
    SB078: 0.08, SB094: 0.09, SB062: 0.14, SC076: 0.15, SC220: 0.17, SCP1993: 0.18, ST058: 0.26, ST068: 0.3,
};

// Playwright logs in as this user (no password: e2e/global-setup.ts signs the session cookie). Same email there.
const E2E_EMAIL = "e2e-manager@freshwaste.test";

// Deterministic PRNG (mulberry32) so every run seeds the same numbers and tests stay stable
function rng(seed: number) {
    return () => {
        seed = (seed + 0x6d2b79f5) | 0;
        let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

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
    // 5. Branch-level waste for the last 30 days (itemNo null = whole branch)
    await db.wasteRecord.createMany({
        data: WASTE_30_DAYS.map((value, i) => ({
            storeNo: STORE_NO, itemNo: null, wasteDate: addDays(today, i - 29), value, source: "SIMULATED",
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

    // 7. Forecast vs. Actual history for the last 30 days (yesterday back), for /analytics
    const historyRows = await seedHistory(models.TOMORROW, today);

    // 8. The Playwright test user (G2: STORE_MANAGER of branch 801 only)
    const e2e = await db.user.upsert({
        where: { email: E2E_EMAIL },
        update: {},
        create: { email: E2E_EMAIL, name: "E2E Manager", role: "STORE_MANAGER" },
    });
    await db.userBranch.upsert({
        where: { userId_storeNo: { userId: e2e.id, storeNo: STORE_NO } },
        update: {},
        create: { userId: e2e.id, storeNo: STORE_NO },
    });

    console.log(
        `demo seeded for ${today.toISOString().slice(0, 10)}: 16 forecasts, 8 snapshots, 30 waste days, 1 import, ` +
        `${historyRows.forecasts} past forecasts, ${historyRows.sales} daily_sales rows (${historyRows.realDays} real days kept), e2e user`,
    );

}
/**
 * Past TOMORROW-model forecasts + daily_sales for the last HISTORY_DAYS days.
 * daily_sales has no "source" column, so a day counts as demo only if branch 801 has no sales_line rows that day:
 * real ingested days are never deleted or overwritten.
 */
async function seedHistory(tomorrowModelId: string, today: Date) {
    const from = addDays(today, -HISTORY_DAYS);
    const to = addDays(today, -1);
    const skus = await db.sku.findMany({ where: { inScope: true }, select: { itemNo: true, price: true } });
    const price = new Map(skus.map((s) => [s.itemNo, Number(s.price)]));

    const real = await db.salesLine.groupBy({ by: ["saleDate"], where: { storeNo: STORE_NO, saleDate: { gte: from, lte: to } } });
    const realDays = new Set(real.map((r) => r.saleDate.getTime()));
    const demoDays = Array.from({ length: HISTORY_DAYS }, (_, i) => addDays(from, i)).filter((d) => !realDays.has(d.getTime()));

    await db.dailySales.deleteMany({ where: { storeNo: STORE_NO, saleDate: { in: demoDays } } });

    const random = rng(801);
    const forecasts = [];
    const sales = [];
    for (let i = 0; i < HISTORY_DAYS; i++) {
        const day = addDays(from, i);
        const weekend = [0, 6].includes(day.getUTCDay()) ? 1.15 : 1; // a little busier on weekends
        for (const d of DEMO) {
            const noise = NOISE[d.itemNo] ?? 0.1;
            const forecast = d.tomorrow * weekend * (1 + (random() - 0.5) * 0.1);
            const actual = Math.max(0, Math.round(forecast * (1 + (random() * 2 - 1) * noise)));
            // Run the evening before, after the 14:00 cutoff (07:00 UTC = 14:00 Bangkok)
            forecasts.push({
                modelVersionId: tomorrowModelId, storeNo: STORE_NO, itemNo: d.itemNo, targetDate: day,
                runAt: new Date(addDays(day, -1).getTime() + 7 * 3_600_000), predictedQty: Math.round(forecast * 1000) / 1000,
            });
            if (realDays.has(day.getTime())) continue;
            sales.push({
                storeNo: STORE_NO, itemNo: d.itemNo, saleDate: day, qtySold: actual, qtyReturned: 0,
                qtyBeforeCutoff: Math.round(actual * 0.6), salesValue: actual * (price.get(d.itemNo) ?? 0),
            });
        }
    }
    await db.forecast.createMany({ data: forecasts });
    await db.dailySales.createMany({ data: sales });
    return { forecasts: forecasts.length, sales: sales.length, realDays: realDays.size };
}

main().finally(() => db.$disconnect());