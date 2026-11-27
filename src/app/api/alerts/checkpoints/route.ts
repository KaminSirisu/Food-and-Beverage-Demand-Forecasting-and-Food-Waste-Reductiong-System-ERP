// POST /api/alerts/checkpoints — run the Opportunity / Cheer checkpoints that are due now (SM5, SM6), and from store
// opening (STORE_OPEN_AT) until 13:30 save tomorrow's provisional forecast if there is none yet (S3).
// Called every minute by the server timer (src/instrumentation.ts); safe to call more often: each checkpoint runs
// once a day, at the times set on Branch Thresholds & Checkpoints.
//   Headers: x-api-key: <INGEST_API_KEY>
//   200 { ran: [{ kind, at, atRisk, created }], provisional: { saved, rows } }  ·  401 bad key
import { NextRequest, NextResponse } from "next/server";
import { runDueCheckpoints } from "@/lib/alerts/engine";
import { STORE_NO } from "@/lib/config";
import { isProvisionalDue } from "@/lib/orders/forecast-pick";
import { ensureProvisionalForecast } from "@/lib/orders/provisional";
import { bangkokHHmm } from "@/lib/time";

export const runtime = "nodejs"; // Prisma needs Node
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
    // No session cookie here (proxy.ts skips /api): same shared key as /api/ingest
    if (req.headers.get("x-api-key") !== process.env.INGEST_API_KEY) {
        return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }
    const now = new Date();
    // Forecast first, so a checkpoint due in the same minute already has tomorrow's numbers
    const provisional = isProvisionalDue(bangkokHHmm(now)) ? await ensureProvisionalForecast(STORE_NO, now) : { saved: false, rows: 0 };
    return NextResponse.json({ ran: await runDueCheckpoints(STORE_NO, now), provisional });
}
