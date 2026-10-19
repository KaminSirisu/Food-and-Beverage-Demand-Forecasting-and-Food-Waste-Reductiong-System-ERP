// Load history files from disk (L6). Same validation and loading as the API, no size limit.
//   npx tsx scripts/backfill.ts data/Sales_Entry_2022_08.xlsx data/Sales_Entry_2022_09.xlsx …
import { basename } from "node:path";
import { createReadStream } from "node:fs";
import { SALES_FILE_NAME, openBatch, sha256File } from "../src/lib/ingest/batch";
import { loadSalesEntry } from "../src/lib/ingest/load";
import { db } from "../src/lib/db";

async function main() {
  const files = process.argv.slice(2);
  if (files.length === 0) throw new Error("usage: tsx scripts/backfill.ts <file.xlsx> …");
  for (const path of files) {
    const name = basename(path);
    if (!SALES_FILE_NAME.test(name)) {
      console.warn(`skip ${name}: name does not match Sales_Entry_…`);
      continue;
    }
    const t = Date.now();
    const { batch, duplicate } = await openBatch(name, await sha256File(path), "backfill");
    if (duplicate) {
      console.log(`${name}: already loaded (${batch.status})`);
      continue;
    }
    const r = await loadSalesEntry(batch.id, createReadStream(path));
    console.log(`${name}: ${r.status} — ${JSON.stringify(r.rows)} in ${Math.round((Date.now() - t) / 1000)}s`);
    if (r.errors.length) console.log("  first errors:", r.errors.slice(0, 5));
  }
}

main().finally(() => db.$disconnect());
