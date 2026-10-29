// Validate → filter → insert → rebuild DailySales → close the batch.
// Used by the API route (daily files) and scripts/backfill.ts (monthly history).
import { Readable } from "node:stream";
import { Prisma } from "@prisma/client";
import { db } from "../db";
import { SalesEntryRow, type SalesLineInput } from "./columns";
import { HeaderError, readSalesEntry } from "./parse";
import { runForecastAfterLoad, type TriggerResult } from "../forecast/trigger";

const BATCH_SIZE = 1000;
const MAX_STORED_ERRORS = 500; // keep the error table small; the count is always exact
const CUTOFF = "13:30:00"; // Model 1 feature: sold before this time

export interface LoadResult {
  processingId: string;
  status: "LOADED" | "LOADED_WITH_ERRORS" | "FAILED";
  rows: { total: number; loaded: number; skipped: number; rejected: number };
  period: { from: string | null; to: string | null };
  errors: { row: number; column: string | null; message: string }[];
  message?: string;
  forecast?: TriggerResult | { error: string };
}

export async function loadSalesEntry(batchId: string, input: string | Readable , opts: { forecast?: boolean } = {}): Promise<LoadResult> {
  await db.importBatch.update({ where: { id: batchId }, data: { status: "PROCESSING" } });

  const active = new Set(
    (await db.branch.findMany({ where: { isActive: true }, select: { storeNo: true } })).map((b) => b.storeNo),
  );

  let total = 0, loaded = 0, skipped = 0, rejected = 0;
  let minDate: string | null = null, maxDate: string | null = null;
  const errors: LoadResult["errors"] = [];
  const touched = new Set<string>(); // "store|YYYY-MM-DD" → DailySales to rebuild
  let buffer: SalesLineInput[] = [];

  const flush = async () => {
    if (buffer.length === 0) return;
    const res = await db.salesLine.createMany({
      data: buffer.map((r) => ({ ...r, batchId })),
      skipDuplicates: true, // natural key → reloading the same lines is a no-op
    });
    loaded += res.count;
    skipped += buffer.length - res.count;
    buffer = [];
  };

  try {
    for await (const { rowNumber, raw } of readSalesEntry(input)) {
      total++;
      const parsed = SalesEntryRow.safeParse(raw);
      if (!parsed.success) {
        rejected++;
        if (errors.length < MAX_STORED_ERRORS) {
          const issue = parsed.error.issues[0];
          errors.push({ row: rowNumber, column: issue.path.join(".") || null, message: issue.message });
        }
        continue;
      }
      const r = parsed.data;
      if (!active.has(r.storeNo)) {
        skipped++; // the export holds every branch; we keep only active ones
        continue;
      }
      const day = r.saleDate.toISOString().slice(0, 10);
      if (!minDate || day < minDate) minDate = day;
      if (!maxDate || day > maxDate) maxDate = day;
      touched.add(`${r.storeNo}|${day}`);
      buffer.push(r);
      if (buffer.length >= BATCH_SIZE) await flush();
    }
    await flush();
    await rebuildDailySales(touched);
  } catch (e) {
    const message = e instanceof HeaderError ? e.message : `Load failed: ${(e as Error).message}`;
    await db.importBatch.update({
      where: { id: batchId },
      data: { status: "FAILED", message, rowsTotal: total, finishedAt: new Date() },
    });
    await audit(batchId, { status: "FAILED", message });
    return { processingId: batchId, status: "FAILED", rows: { total, loaded, skipped, rejected }, period: { from: minDate, to: maxDate }, errors, message };
  }

  const status = rejected > 0 ? "LOADED_WITH_ERRORS" : "LOADED";
  await db.$transaction([
    db.importError.createMany({
      data: errors.map((e) => ({ batchId, rowNumber: e.row, column: e.column, message: e.message })),
    }),
    db.importBatch.update({
      where: { id: batchId },
      data: {
        status,
        rowsTotal: total,
        rowsLoaded: loaded,
        rowsSkipped: skipped,
        rowsRejected: rejected,
        periodFrom: minDate ? new Date(`${minDate}T00:00:00Z`) : null,
        periodTo: maxDate ? new Date(`${maxDate}T00:00:00Z`) : null,
        finishedAt: new Date(),
      },
    }),
  ]);
  await audit(batchId, { status, total, loaded, skipped, rejected });

    // L7: a daily file (not backfill) triggers tomorrow's forecast. A forecast failure never fails the load.
  let forecast: LoadResult["forecast"];
  if (opts.forecast && maxDate) {
    forecast = await runForecastAfterLoad(maxDate).catch((e) => ({ error: (e as Error).message }));
  }
  return { processingId: batchId, status, rows: { total, loaded, skipped, rejected }, period: { from: minDate, to: maxDate }, errors: errors.slice(0, 20), forecast };
}

/** Recompute DailySales for each (store, day) the file touched — from all lines, so re-sent files stay correct. */
async function rebuildDailySales(touched: Set<string>) {
  for (const key of touched) {
    const [store, day] = key.split("|");
    await db.$executeRaw`
      INSERT INTO daily_sales (store_no, item_no, sale_date, qty_sold, qty_returned, qty_before_cutoff, sales_value, last_sale_time, updated_at)
      SELECT store_no, item_no, sale_date,
             COALESCE(SUM(-quantity) FILTER (WHERE quantity < 0), 0),
             COALESCE(SUM(quantity)  FILTER (WHERE quantity > 0), 0),
             COALESCE(SUM(-quantity) FILTER (WHERE quantity < 0 AND sale_time < ${CUTOFF}::time), 0),
             -SUM(total_amount),
             MAX(sale_time) FILTER (WHERE quantity < 0),
             now()
      FROM sales_line
      WHERE store_no = ${Number(store)} AND sale_date = ${day}::date
      GROUP BY store_no, item_no, sale_date
      ON CONFLICT (store_no, item_no, sale_date) DO UPDATE SET
        qty_sold = EXCLUDED.qty_sold,
        qty_returned = EXCLUDED.qty_returned,
        qty_before_cutoff = EXCLUDED.qty_before_cutoff,
        sales_value = EXCLUDED.sales_value,
        last_sale_time = EXCLUDED.last_sale_time,
        updated_at = now()`;
  }
}

async function audit(batchId: string, detail: Prisma.InputJsonValue) {
  await db.auditLog.create({ data: { actor: "system", action: "INGEST", entity: "import_batch", entityId: batchId, detail } });
}
