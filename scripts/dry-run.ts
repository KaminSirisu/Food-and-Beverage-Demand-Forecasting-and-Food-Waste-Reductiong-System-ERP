// Check a file without touching the database: header, every row's validation, and per-branch counts.
//   npx tsx scripts/dry-run.ts data/Sales_Entry_2022_11.xlsx [storeNo]
import { SalesEntryRow } from "../src/lib/ingest/columns";
import { readSalesEntry } from "../src/lib/ingest/parse";

async function main() {
  const [path, store] = process.argv.slice(2);
  const only = store ? Number(store) : null;
  const t = Date.now();
  let total = 0, bad = 0, kept = 0;
  const errors = new Map<string, number>();
  const days = new Set<string>();
  let sample: unknown = null;
  for await (const { raw } of readSalesEntry(path)) {
    total++;
    const r = SalesEntryRow.safeParse(raw);
    if (!r.success) {
      bad++;
      const k = `${r.error.issues[0].path.join(".")}: ${r.error.issues[0].message}`;
      errors.set(k, (errors.get(k) ?? 0) + 1);
      continue;
    }
    if (only !== null && r.data.storeNo !== only) continue;
    kept++;
    days.add(r.data.saleDate.toISOString().slice(0, 10));
    if (!sample) sample = r.data;
  }
  console.log({ total, rejected: bad, kept, days: days.size, seconds: Math.round((Date.now() - t) / 1000) });
  console.log("first valid row:", sample);
  console.log("rejection reasons:", Object.fromEntries(errors));
}
main();
