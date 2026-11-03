// GET /api/forecast?store=801&date=YYYY-MM-DD — demand forecast per SKU for branch 801.
// Owner: Mew. Inference runs in-process with onnxruntime-node (NFR8); must match Python within 0.001 (NFR7).
//   date  = the day to forecast (default: tomorrow, Bangkok). It is decided at 13:30 of the day before.
//   200 { store, date, decisionDate, decisionTime, modelVersion, rows[{ itemNo, nameEn, onSale, predictedQty, restOfDay }], notCovered[] }
//   400 bad store or date · 404 no sales loaded for the day before · 500 error
// The trigger (src/lib/forecast/trigger.ts) saves the rows to the forecast table; this route only computes.
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { STORE_NO } from "@/lib/config";
import { forecastForDay } from "@/lib/forecast/forecast";
import { tomorrowDate } from "@/lib/time";

export const runtime = "nodejs"; // onnxruntime-node needs Node, not the Edge runtime
export const dynamic = "force-dynamic";

const isRealDay = (s: string) => {
  const d = new Date(`${s}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s;
};
const Query = z.object({
  store: z.coerce.number().int().default(STORE_NO),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(isRealDay, "not a real date").optional(),
});

export async function GET(req: NextRequest) {
  const q = Query.safeParse(Object.fromEntries(req.nextUrl.searchParams));
  if (!q.success) return NextResponse.json({ error: "bad_request", issues: q.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`) }, { status: 400 });
  if (q.data.store !== STORE_NO) return NextResponse.json({ error: "unsupported_store", supported: STORE_NO }, { status: 400 });

  const date = q.data.date ?? tomorrowDate().toISOString().slice(0, 10);
  try {
    const result = await forecastForDay(q.data.store, date);
    if (!result) return NextResponse.json({ error: "no_data", message: `no sales loaded for the day before ${date}` }, { status: 404 });
    return NextResponse.json(result);
  } catch (e) {
    console.error("forecast:", e);
    return NextResponse.json({ error: "forecast_failed" }, { status: 500 });
  }
}