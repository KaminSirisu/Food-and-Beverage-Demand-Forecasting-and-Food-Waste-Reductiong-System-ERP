// POST /api/ingest — called by Power Automate (L3) with the raw .xlsx as the request body.
//
//   Headers:  x-api-key: <INGEST_API_KEY>
//             x-file-name: Sales_Entry_2026-11-03.xlsx
//   Body:     file content (binary)
//
//   200 { processingId, status: LOADED | LOADED_WITH_ERRORS, rows, period, errors[≤20] }
//   200 { processingId, status: DUPLICATE }         same file already received → nothing loaded
//   400 bad name / empty body · 401 bad key · 413 too large · 422 header mismatch or load failure
import { NextRequest, NextResponse } from "next/server";
import { Readable } from "node:stream";
import { MAX_UPLOAD_BYTES, SALES_FILE_NAME, openBatch, sha256 } from "@/lib/ingest/batch";
import { loadSalesEntry } from "@/lib/ingest/load";

export const runtime = "nodejs"; // ExcelJS + Prisma need Node, not the Edge runtime
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  if (req.headers.get("x-api-key") !== process.env.INGEST_API_KEY) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const fileName = req.headers.get("x-file-name") ?? "";
  if (!SALES_FILE_NAME.test(fileName)) {
    return NextResponse.json({ error: "bad_file_name", expected: "Sales_Entry_YYYY-MM-DD[_HHmm].xlsx" }, { status: 400 });
  }

  const size = Number(req.headers.get("content-length") ?? 0);
  if (size > MAX_UPLOAD_BYTES) {
    return NextResponse.json({ error: "too_large", hint: "use scripts/backfill.ts for monthly files" }, { status: 413 });
  }

  const body = Buffer.from(await req.arrayBuffer());
  if (body.length === 0) return NextResponse.json({ error: "empty_body" }, { status: 400 });

  const { batch, duplicate } = await openBatch(fileName, sha256(body), "power-automate");
  if (duplicate) {
    return NextResponse.json({ processingId: batch.id, status: "DUPLICATE", originalStatus: batch.status });
  }

  // TODO(Member B): also save the original file (SharePoint /archive already keeps it — confirm with L3).
  const result = await loadSalesEntry(batch.id, Readable.from(body),{ forecast: true });
  return NextResponse.json(result, { status: result.status === "FAILED" ? 422 : 200 });
}
