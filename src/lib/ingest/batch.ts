// File-level checks done before any row is read: name, size, duplicate.
import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";
import { db } from "../db";

/**
 * Accepted names (Power Automate renames to these):
 *   Sales_Entry_2026-11-03.xlsx        one day, all branches (daily feed)
 *   Sales_Entry_2026-11-03_1300.xlsx   intraday snapshot at 13:00 (if IT can export one)
 *   Sales_Entry_2022_11.xlsx           one month (history backfill)
 * TODO(Member B): agree the final pattern with the Power Automate flow (L3) and update report §3.4.
 */
export const SALES_FILE_NAME = /^Sales_Entry_(\d{4}-\d{2}-\d{2}(_\d{4})?|\d{4}_\d{2})\.xlsx$/;

export const MAX_UPLOAD_BYTES = 25 * 1024 * 1024; // a day of all branches ≈ 2–3 MB; months go through scripts/backfill.ts

export const sha256 = (buf: Buffer) => createHash("sha256").update(buf).digest("hex");

export const sha256File = (path: string) =>
  new Promise<string>((resolve, reject) => {
    const h = createHash("sha256");
    createReadStream(path).on("data", (c) => h.update(c)).on("end", () => resolve(h.digest("hex"))).on("error", reject);
  });

/** Returns the existing batch if this exact file was already received, else creates a new RECEIVED batch. */
export async function openBatch(fileName: string, fileHash: string, source: string) {
  const existing = await db.importBatch.findUnique({ where: { fileHash } });
  if (existing?.status === "FAILED") {
    // A failed file may be sent again (e.g. after a fix on our side): reuse its processing ID.
    // Lines it already inserted are skipped by the natural key, so a retry never double-counts.
    const batch = await db.importBatch.update({
      where: { id: existing.id },
      data: { status: "RECEIVED", message: null, source, finishedAt: null },
    });
    await db.importError.deleteMany({ where: { batchId: existing.id } });
    return { batch, duplicate: false as const };
  }
  if (existing) return { batch: existing, duplicate: true as const };
  const batch = await db.importBatch.create({ data: { fileName, fileHash, fileKind: "SALES_ENTRY", source } });
  return { batch, duplicate: false as const };
}

/** S9 / NFR3: when did data last load, and is it stale? */
export async function dataFreshness(staleAfterMinutes = 90) {
  const last = await db.importBatch.findFirst({
    where: { status: { in: ["LOADED", "LOADED_WITH_ERRORS"] } },
    orderBy: { finishedAt: "desc" },
    select: { finishedAt: true, fileName: true },
  });
  const ageMin = last?.finishedAt ? (Date.now() - last.finishedAt.getTime()) / 60000 : Infinity;
  return { lastSyncAt: last?.finishedAt ?? null, fileName: last?.fileName ?? null, stale: ageMin > staleAfterMinutes };
}
