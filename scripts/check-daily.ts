// L5 check: is daily_sales complete and correct?
//   npx tsx scripts/check-daily.ts [storeNo]
import { STORE_NO } from "../src/lib/config";
import { db } from "../src/lib/db";
import { dataFreshness } from "../src/lib/ingest/batch";

type DayCheck = { day: Date; soldInLines: number; soldInDaily: number | null; dailyRows: number };

async function main() {
  const storeNo = Number(process.argv[2] ?? STORE_NO);

  // Step 1: per day, total sold from sales_line (raw POS lines) vs daily_sales (our summary).
  // Sold = -quantity where quantity < 0 (D365 sign: negative = sale).
  const days = await db.$queryRaw<DayCheck[]>`
    WITH from_lines AS (
      SELECT sale_date, COALESCE(SUM(-quantity) FILTER (WHERE quantity < 0), 0)::int AS sold
      FROM sales_line WHERE store_no = ${storeNo} GROUP BY sale_date),
    from_daily AS (
      SELECT sale_date, SUM(qty_sold)::int AS sold, COUNT(*)::int AS rows
      FROM daily_sales WHERE store_no = ${storeNo} GROUP BY sale_date)
    SELECT l.sale_date AS day, l.sold AS "soldInLines", d.sold AS "soldInDaily", COALESCE(d.rows, 0)::int AS "dailyRows"
    FROM from_lines l LEFT JOIN from_daily d USING (sale_date)
    ORDER BY 1`;

  // Step 2: a day is wrong if daily_sales has no rows for it, or the totals are different.
  const wrongDays = days.filter((d) => d.dailyRows === 0 || d.soldInDaily !== d.soldInLines);

  // Step 3: print the result.
  console.log(`store ${storeNo}: ${days.length} days with sales lines, ${wrongDays.length} mismatched`);
  for (const d of wrongDays) {
    console.log(`  ${d.day.toISOString().slice(0, 10)}  lines=${d.soldInLines}  daily=${d.soldInDaily ?? "missing"}`);
  }
  console.log("freshness:", await dataFreshness(90));

  if (wrongDays.length > 0) process.exitCode = 1;
}
main().finally(() => db.$disconnect());
// For every day that has sales lines, daily_sales must have rows and the same "sold" total.
// Also prints if the data is stale (last load > 90 minutes ago). Exit code 1 = something is wrong.