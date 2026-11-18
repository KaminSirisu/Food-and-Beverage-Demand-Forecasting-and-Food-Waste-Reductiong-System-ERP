// GET /api/ingest/freshness
// Tells the app if our sales data is fresh or stale.
// data is "stale" when the last successful load is more than 90 minutes old.
import { NextResponse } from "next/server";
import { STORE_NO } from "@/lib/config";
import { dataFreshness } from "@/lib/ingest/batch";
import { createAlert } from "@/lib/alerts/create";

export const runtime = "nodejs";
export const dynamic = "force-dynamic"; // never cache: the answer changes every minute

const STALE_AFTER_MINUTES = 90;

export async function GET() {
  // Step 1: find the last file that loaded OK, and check if it is older than 90 minutes.
  const freshness = await dataFreshness(STALE_AFTER_MINUTES);

  // Step 2: turn the age into minutes so people can read it.
  let ageMinutes: number | null = null;
  if (freshness.lastSyncAt) {
    ageMinutes = Math.round((Date.now() - freshness.lastSyncAt.getTime()) / 60000);
  }

  // Step 3: if data is stale, create a STALE_DATA alert for the store manager.
  // createAlert() keeps it to one per hour (dedupeSince) and pushes it live to open tabs (S10).
  if (freshness.stale) {
    await createAlert(STORE_NO, {
      type: "STALE_DATA",
      itemNo: null,
      title: "Sales data delayed",
      body: `No D365 data for ${ageMinutes ?? "∞"} min (last file: ${freshness.fileName ?? "none"}). Alerts are using older data.`,
      actionUrl: "/",
    });
  }

  // Step 4: send the result back as JSON.
  return NextResponse.json({ ...freshness, ageMinutes, staleAfterMinutes: STALE_AFTER_MINUTES });
}