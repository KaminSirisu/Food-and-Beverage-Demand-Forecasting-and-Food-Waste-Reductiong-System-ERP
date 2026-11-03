// GET /api/ingest/freshness
// Tells the app if our sales data is fresh or stale.
// data is "stale" when the last successful load is more than 90 minutes old.
import { NextResponse } from "next/server";
import { STORE_NO } from "@/lib/config";
import { db } from "@/lib/db";
import { dataFreshness } from "@/lib/ingest/batch";

export const runtime = "nodejs";
export const dynamic = "force-dynamic"; // never cache: the answer changes every minute

const STALE_AFTER_MINUTES = 90;
const ONE_HOUR_MS = 60 * 60 * 1000;

export async function GET() {
  // Step 1: find the last file that loaded OK, and check if it is older than 90 minutes.
  const freshness = await dataFreshness(STALE_AFTER_MINUTES);

  // Step 2: turn the age into minutes so people can read it.
  let ageMinutes: number | null = null;
  if (freshness.lastSyncAt) {
    ageMinutes = Math.round((Date.now() - freshness.lastSyncAt.getTime()) / 60000);
  }

  // Step 3: if data is stale, create a STALE_DATA alert for the store manager.
  // Only one alert per hour, otherwise every page refresh would add a new alert.
  if (freshness.stale) {
    const alertInLastHour = await db.alert.findFirst({
      where: { type: "STALE_DATA", createdAt: { gt: new Date(Date.now() - ONE_HOUR_MS) } },
    });
    if (!alertInLastHour) {
      await db.alert.create({
        data: {
          storeNo: STORE_NO,
          type: "STALE_DATA",
          message: `Sales data is ${ageMinutes ?? "∞"} min old (last file: ${freshness.fileName ?? "none"})`,
          actionUrl: "/notifications",
        },
      });
    }
  }

  // Step 4: send the result back as JSON.
  return NextResponse.json({ ...freshness, ageMinutes, staleAfterMinutes: STALE_AFTER_MINUTES });
}