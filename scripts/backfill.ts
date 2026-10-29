// Load history files from disk (L6). Same validation and loading as the API, no size limit.
//   npx tsx scripts/backfill.ts data/Sales_Entry_2022_08.xlsx data/Sales_Entry_2022_09.xlsx …
import { basename, join } from "node:path";
import { createReadStream, readdirSync, statSync } from "node:fs";
import { SALES_FILE_NAME, openBatch, sha256File } from "../src/lib/ingest/batch";
import { loadSalesEntry } from "../src/lib/ingest/load";
import { db } from "../src/lib/db";

// D365 names the file "Sales Entry_2022.08.xlsx"; the API expects "Sales_Entry_2022_08.xlsx".
function normalizeName(name: string) {
  const m = /^Sales[ _]Entry_(\d{4})[._-](\d{2})\.xlsx$/i.exec(name);
  return m ? `Sales_Entry_${m[1]}_${m[2]}.xlsx` : name;
}

// A folder → every .xlsx inside it (skip Excel "~$" lock files), sorted so older months load first.
function listFiles(args: string[]) {
  const files = args.flatMap((p) =>
    statSync(p).isDirectory()
      ? readdirSync(p).filter((f) => f.endsWith(".xlsx") && !f.startsWith("~$")).map((f) => join(p, f))
      : [p],
  );
  return files.sort((a, b) => normalizeName(basename(a)).localeCompare(normalizeName(basename(b))));
}

async function main() {
  const files = listFiles(process.argv.slice(2));
  if (files.length === 0) throw new Error("usage: tsx scripts/backfill.ts <file.xlsx> …");
  for (const path of files) {
    const name = normalizeName(basename(path));
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
  
  // evidence for Notion: month · lines loaded for the demo branch · rows rejected
  const batches = await db.importBatch.findMany({ where: { source: "backfill" }, orderBy: { fileName: "asc" } });
  console.log("\n| Month | Status | Lines loaded (demo branch) | Rows rejected |\n|---|---|---:|---:|");
  for (const b of batches) console.log(`| ${b.fileName} | ${b.status} | ${b.rowsLoaded} | ${b.rowsRejected} |`);
}

main().finally(() => db.$disconnect());
