// S7 / SM5 / SM6: dashboard risks → alert drafts. Pure: the engine (Lesson 3) saves them.
import type { AlertType } from "@prisma/client";
import type { RiskSku } from "@/lib/dashboard/risk";
import { ALERT_META } from "./meta";
import { startOfToday } from "@/lib/time";

const ONE_HOUR_MS = 3_600_000;

export type AlertDraft = {
    type: AlertType;
    itemNo: string | null;
    title: string;
    body: string;
    actionUrl: string;
    dedupeByTitle?: boolean; // checkpoint alerts: de-dupe on their own title, so an earlier Shortage risk for the item doesn't hide them
}

export function alertsFromRisks(risks: RiskSku[]): AlertDraft[] {
    return risks.map((r) => {
        const type: AlertType = r.kind === "SHORTAGE" ? "SHORTAGE_RISK" : "WASTE_RISK";
        const meta = ALERT_META[type];
        const body = r.kind === "SHORTAGE" 
            ? `Forecast needs ${r.units} more units than you have before close (฿${r.value} lost sales).`
            : `Projected surplus ${r.units} units (${r.pct}% of stock) at close.`;
        return { type, itemNo: r.itemNo, title: `${meta.label} · ${r.itemNo} ${r.nameTh}`, body, actionUrl: meta.defaultUrl };
    });
}

// De-dupe window: the same (store, type, item) inside it is not created again.
// STALE_DATA keeps the old freshness-route rule (1 per hour); SKU alerts are once per Bangkok day.
export function dedupeSince(type: AlertType, now: Date): Date {
    return type === "STALE_DATA" ? new Date(now.getTime() - ONE_HOUR_MS) : startOfToday(now);
}