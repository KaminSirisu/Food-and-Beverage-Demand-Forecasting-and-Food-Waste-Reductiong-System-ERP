// POST /api/alerts/evaluate — run the alert engine for branch 801 (SM5 / SM6 checkpoints, S7).
// Called by a Power Automate schedule at the checkpoint times, or by hand while testing.
//   Headers: x-api-key: <INGEST_API_KEY>
//   200 { atRisk, created }  ·  401 bad key
import { NextRequest, NextResponse } from "next/server";
import { evaluateAlerts } from "@/lib/alerts/engine";
import { STORE_NO } from "@/lib/config";

export const runtime = "nodejs"; // Prisma needs Node
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
    // No session cookie here (proxy.ts skips /api): same shared key as /api/ingest
    if (req.headers.get("x-api-key") !== process.env.INGEST_API_KEY) {
        return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }
    return NextResponse.json(await evaluateAlerts(STORE_NO));
}