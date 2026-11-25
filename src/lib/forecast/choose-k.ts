// A7 command line: choose the production multiplier k per SKU from the last 56 days and write models/k_plan.json.
// Run on the 1st of the month (or on demand): the window ends on the last loaded day.
//   npx tsx --env-file=.env src/lib/forecast/choose-k.ts
//   npx tsx src/lib/forecast/choose-k.ts --asof 2023-04-30      window ends on another day
//   --no-write   only print the result      --store 801   branch (default 801)
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { STORE_NO } from "@/lib/config";
import { db } from "@/lib/db";
import { buildFeaturesFromDb, holidays, loadDailyInputs } from "./daily";
import { modelInfo } from "./info";
import { BUFFER, STOCKOUT_TARGET, WASTE_AIM, WASTE_TARGET, WINDOW_DAYS, chooseK, type SimDay } from "./k";
import { predict } from "./model";

const args = process.argv.slice(2);
const flag = (name: string) => args.includes(name);
const value = (name: string) => (args.includes(name) ? args[args.indexOf(name) + 1] : undefined);
const ymd = (d: Date) => d.toISOString().slice(0, 10);
const addDay = (d: string, k: number) => ymd(new Date(Date.parse(`${d}T00:00:00Z`) + k * 86_400_000));
const isDay = (s?: string): s is string => !!s && /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(Date.parse(`${s}T00:00:00Z`)) && addDay(s, 0) === s;
const PLAN_FILE = path.join(process.cwd(), "models", "k_plan.json");

async function main() {
    // Writes to the shared Neon database are never needed here, but reading it is the same code path: say which one it is
    const store = Number(value("--store") ?? STORE_NO);
    let asOf = value("--asof");
    if (asOf !== undefined && !isDay(asOf)) throw new Error("use --asof YYYY-MM-DD");
    if (!asOf) {
        const last = await db.dailySales.aggregate({ where: { storeNo: store, qtySold: { gt: 0 } }, _max: { saleDate: true } });
        if (!last._max.saleDate) throw new Error("no sales loaded");
        asOf = ymd(last._max.saleDate);
    }
    const start = addDay(asOf, -(WINDOW_DAYS - 1));
    const asOfDate = new Date(`${asOf}T00:00:00Z`);

    const skus = await db.sku.findMany({ where: { inScope: true }, select: { itemNo: true, shelfLifeDays: true, price: true }, orderBy: { itemNo: "asc" } });
    const [rows, { daily }] = await Promise.all([buildFeaturesFromDb(store, asOfDate), loadDailyInputs(store, skus.map((s) => s.itemNo), asOfDate)]);

    // the window plus the day before it (that day decides the first order)
    const inWindow = rows.filter((r) => r.date >= addDay(start, -1) && r.date <= asOf);
    const preds = await predict(inWindow);
    const pred = new Map(inWindow.map((r, i) => [`${r.itemNo}|${r.date}`, preds[i]]));
    const holiday = new Set(holidays());

    const series: Record<string, { days: Map<string, SimDay>; life: number }> = {};
    for (const s of skus) {
        const byDate = new Map(daily[s.itemNo].map((d) => [d.date, d]));
        const days = new Map<string, SimDay>();
        for (const r of inWindow.filter((x) => x.itemNo === s.itemNo)) {
            const d = byDate.get(r.date);
            const p = pred.get(`${r.itemNo}|${r.date}`)!;
            const f = r.tomorrow.features; // m2_* = calendar of D+1
            days.set(r.date, {
                onSale: r.onSale,
                soldToT: d?.qtyBeforeCutoff ?? 0,
                soldAfterT: d ? d.qtySold - d.qtyBeforeCutoff : 0,
                price: Number.isNaN(f.price) ? Number(s.price) : f.price,
                fRest: p.restOfDay ?? 0,
                fTom: p.tomorrow ?? 0,
                weekendM2: f.m2_is_weekend === 1,
                paydayM2: f.m2_is_payday === 1,
                holidayM2: f.m2_is_holiday === 1,
                beforeHolidayM2: holiday.has(addDay(r.date, 2)),
            });
        }
        if (!days.has(addDay(start, -1)) || !days.has(asOf)) throw new Error(`${s.itemNo}: no feature rows for the window ${start} … ${asOf}`);
        series[s.itemNo] = { days, life: s.shelfLifeDays };
    }

    const choice = chooseK(series, start, asOf);
    const round = (x: number) => Math.round(x * 100) / 100;
    console.log(`window ${start} … ${asOf} (${WINDOW_DAYS} days), model ${modelInfo().version}`);
    console.log(`waste ${round(choice.wastePct)}% (aim < ${WASTE_AIM}, target < ${WASTE_TARGET}) | stockout ${round(choice.stockoutPct)}% (target < ${STOCKOUT_TARGET})`);
    console.log("k per SKU:", choice.k);

    if (flag("--no-write")) return;
    const previous = existsSync(PLAN_FILE) ? JSON.parse(readFileSync(PLAN_FILE, "utf8")) : null;
    const history = [...(previous ? [{ asOf: previous.asOf, k: previous.k }, ...(previous.history ?? [])] : [])].slice(0, 12);
    const plan = {
        generatedAt: new Date().toISOString(),
        store,
        modelVersion: modelInfo().version,
        asOf,
        window: { days: WINDOW_DAYS, from: start, to: asOf },
        buffer: BUFFER,
        targets: { wasteAim: WASTE_AIM, waste: WASTE_TARGET, stockout: STOCKOUT_TARGET },
        windowResult: { wastePct: round(choice.wastePct), stockoutPct: round(choice.stockoutPct) },
        k: choice.k,
        history,
    };
    writeFileSync(PLAN_FILE, `${JSON.stringify(plan, null, 2)}\n`);
    console.log(`wrote ${path.relative(process.cwd(), PLAN_FILE)}`);
}

main().catch((e) => { console.error(e instanceof Error ? e.message : e); process.exitCode = 1; }).finally(() => db.$disconnect());
