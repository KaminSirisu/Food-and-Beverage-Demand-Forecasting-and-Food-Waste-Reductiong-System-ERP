// GET /api/forecast — tomorrow's demand per SKU for branch 801.
// Owner: Mew. Inference runs in-process with onnxruntime-node (NFR8); must match Python within 0.001 (NFR7).
import { NextResponse } from "next/server";

export const runtime = "nodejs"; // onnxruntime-node needs Node, not the Edge runtime

export async function GET() {
  // TODO(Mew): read the Forecast table (or run src/lib/forecast) and return one row per in-scope SKU.
  return NextResponse.json({ error: "not implemented yet" }, { status: 501 });
}
