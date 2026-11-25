// A7 command line: register the model and save forecasts to the forecast table (on demand).
//   npx tsx --env-file=.env src/lib/forecast/run-forecast.ts --date 2026-11-26          one day (runAt = now)
//   npx tsx src/lib/forecast/run-forecast.ts --from 2023-04-02 --to 2023-04-30        one run per day, runAt = 13:30 the day before
//   --register   only register the model versions        --activate   make the real model the active one
//   --store 801  branch (default 801)                     --neon       confirm that DATABASE_URL really is Neon
import { STORE_NO } from "@/lib/config";
import { db } from "@/lib/db";
import { tomorrowDate } from "@/lib/time";
import { registerModels, saveForecast } from "./save";

const args = process.argv.slice(2);
const flag = (name: string) => args.includes(name);
const value = (name: string) => (args.includes(name) ? args[args.indexOf(name) + 1] : undefined);
const next = (d: string) => new Date(Date.parse(`${d}T00:00:00Z`) + 86_400_000).toISOString().slice(0, 10);
const isDay = (s?: string): s is string => {
    if (!s || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
    const t = new Date(`${s}T00:00:00Z`).getTime();
    return !Number.isNaN(t) && new Date(t).toISOString().slice(0, 10) === s;
};

async function main() {
    // Writes to the shared Neon database need the Leader's OK, so make that a conscious choice
    if (/neon/i.test(process.env.DATABASE_URL ?? "") && !flag("--neon")) {
        throw new Error("DATABASE_URL points to Neon. Add --neon only if the Leader agreed to this write.");
    }
    const store = Number(value("--store") ?? STORE_NO);
    const activate = flag("--activate");

    if (flag("--register")) {
        console.log("registered", await registerModels({ activate }), activate ? "(active)" : "(not active)");
        return;
    }
    const from = value("--from"), to = value("--to");
    const dates: string[] = [];
    if (from || to) {
        if (!isDay(from) || !isDay(to) || from > to) throw new Error("use --from YYYY-MM-DD --to YYYY-MM-DD (from <= to)");
        for (let d = from; d <= to; d = next(d)) dates.push(d);
    } else {
        const one = value("--date") ?? tomorrowDate().toISOString().slice(0, 10);
        if (!isDay(one)) throw new Error("use --date YYYY-MM-DD");
        dates.push(one);
    }
    const backtest = dates.length > 1 || flag("--from");
    let saved = 0, skipped = 0;
    for (const d of dates) {
        // backtest: pretend the run happened at 13:30 Bangkok (06:30 UTC) of the decision day, so reruns are idempotent
        const runAt = backtest ? new Date(`${new Date(Date.parse(`${d}T00:00:00Z`) - 86_400_000).toISOString().slice(0, 10)}T06:30:00Z`) : undefined;
        const r = await saveForecast(store, d, { activate, runAt });
        if (!r) { skipped++; console.log(`${d}: no data for the day before, skipped`); continue; }
        saved += r.saved;
        console.log(`${d}: ${r.saved} rows saved (model ${r.modelVersion}, tomorrow ${r.rows.length}, rest of day ${r.restOfDayRows.length}${r.notCovered.length ? `, not covered ${r.notCovered.join(",")}` : ""})`);
    }
    console.log(`done: ${dates.length - skipped} days, ${saved} rows saved, ${skipped} skipped`);
}

main().catch((e) => { console.error(e instanceof Error ? e.message : e); process.exitCode = 1; }).finally(() => db.$disconnect());