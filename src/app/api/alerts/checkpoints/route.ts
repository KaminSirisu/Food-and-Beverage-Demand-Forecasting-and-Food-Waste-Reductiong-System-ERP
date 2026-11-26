// POST /api/alerts/checkpoints — run the Opportunity / Cheer checkpoints that are due now (SM5, SM6).
// Called every minute by the server timer (src/instrumentation.ts); safe to call more often: each checkpoint runs
// once a day, at the times set on Branch Thresholds & Checkpoints.
//   Headers: x-api-key: <INGEST_API_KEY>
//   200 { ran: [{ kind, at, atRisk, created }] }  ·  401 bad key
import { NextRequest, NextResponse } from "next/server";
import { runDueCheckpoints } from "@/lib/alerts/engine";
import { STORE_NO } from "@/lib/config";

export const runtime = "nodejs"; // Prisma needs Node
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
    // No session cookie here (proxy.ts skips /api): same shared key as /api/ingest
    if (req.headers.get("x-api-key") !== process.env.INGEST_API_KEY) {
        return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }
    return NextResponse.json({ ran: await runDueCheckpoints(STORE_NO) });
}
