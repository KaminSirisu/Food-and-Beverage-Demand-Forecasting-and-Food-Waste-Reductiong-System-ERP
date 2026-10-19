// GET /api/model-info — which model is live: version, training period, features, accuracy.
// Owner: Mew. Read from models/ metadata (NFR8).
import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function GET() {
  // TODO(Mew): return the metadata saved next to the ONNX file in models/.
  return NextResponse.json({ error: "not implemented yet" }, { status: 501 });
}
