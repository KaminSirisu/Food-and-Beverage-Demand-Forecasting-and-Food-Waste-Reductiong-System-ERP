// GET /api/ingest/:id — status of one upload (Power Automate can poll this; the "data import log" screen reads it).
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export const runtime = "nodejs";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const batch = await db.importBatch.findUnique({
    where: { id },
    include: { errors: { take: 50, orderBy: { rowNumber: "asc" } } },
  });
  if (!batch) return NextResponse.json({ error: "not_found" }, { status: 404 });
  return NextResponse.json({
    processingId: batch.id,
    fileName: batch.fileName,
    status: batch.status,
    rows: { total: batch.rowsTotal, loaded: batch.rowsLoaded, skipped: batch.rowsSkipped, rejected: batch.rowsRejected },
    period: { from: batch.periodFrom, to: batch.periodTo },
    receivedAt: batch.receivedAt,
    finishedAt: batch.finishedAt,
    message: batch.message,
    errors: batch.errors.map((e) => ({ row: e.rowNumber, column: e.column, message: e.message })),
  });
}
