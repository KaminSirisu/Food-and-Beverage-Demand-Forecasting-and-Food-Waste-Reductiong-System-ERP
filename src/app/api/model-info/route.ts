// GET /api/model-info — which model is live: version, training date, data range, features, accuracy.
// Owner: Mew. Read from the metadata saved next to the ONNX files in models/ (NFR8).
import { NextResponse } from "next/server";
import { modelInfo } from "@/lib/forecast/info";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    return NextResponse.json(modelInfo());
  } catch (e) {
    console.error("model-info:", e);
    return NextResponse.json({ error: "model metadata not available" }, { status: 500 });
  }
}
