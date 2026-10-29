// T1: one full run against a running app, no manual step.
//   APP_URL=http://localhost:3000 INGEST_API_KEY=… npx tsx scripts/e2e.ts [fixtures/Sales_Entry_2022-11-06.xlsx]
// POST file → GET /api/ingest/:id → GET /api/ingest/freshness → forecast rows written (L7). Exits 1 on any failed step.
import { readFileSync } from "node:fs";
import { basename } from "node:path";

const base = process.env.APP_URL ?? "http://localhost:3000";
const file = process.argv[2] ?? "fixtures/Sales_Entry_2022-11-06.xlsx";

function check(ok: unknown, step: string, detail: unknown) {
  console.log(`${ok ? "PASS" : "FAIL"}  ${step}`, JSON.stringify(detail));
  if (!ok) process.exitCode = 1;
}

async function main() {
  const up = await fetch(`${base}/api/ingest`, {
    method: "POST",
    headers: { "x-api-key": process.env.INGEST_API_KEY ?? "", "x-file-name": basename(file) },
    body: readFileSync(file),
  });
  const r = await up.json();
  check(up.ok && ["LOADED", "LOADED_WITH_ERRORS", "DUPLICATE"].includes(r.status), "POST /api/ingest", { status: r.status, rows: r.rows, forecast: r.forecast });

  const log = await (await fetch(`${base}/api/ingest/${r.processingId}`)).json();
  check(log.rows && Array.isArray(log.errors), "GET /api/ingest/:id", { status: log.status, rows: log.rows, errors: log.errors?.length });

  const f = await (await fetch(`${base}/api/ingest/freshness`)).json();
  check("stale" in f, "GET /api/ingest/freshness", f);

  check(r.status === "DUPLICATE" || (r.forecast && !("error" in r.forecast) && r.forecast.rows > 0), "forecast after load (L7)", r.forecast ?? "duplicate file: no new run");
}

main();