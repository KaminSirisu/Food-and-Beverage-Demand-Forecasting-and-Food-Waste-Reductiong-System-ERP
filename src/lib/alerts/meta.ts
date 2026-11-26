// Alert type → how the Notifications page shows it (S10). Pure: imported by server and client.
// Icons live in the UI component (lucide is React); this file stays plain data.
import type { AlertType } from '@prisma/client'; // type-only: erased at build, safe in client code

export type AlertTone = "red" | "amber" | "emerald" | "indigo" | "slate";

export type AlertMeta = {
    label: string; // chip text
    tone: AlertTone; // chip + icon tile colour
    cta: string; // follow-up button (S10)
    defaultUrl: string; // used when alert.action_url is null
}

export const ALERT_META: Record<AlertType, AlertMeta> = {
    SHORTAGE_RISK: { label: "Shortage risk", tone: "red", cta: "View stock & order", defaultUrl: "/" },
    WASTE_RISK:    { label: "Waste risk",     tone: "amber",   cta: "Open promotion",        defaultUrl: "/promotions" },
    PROMOTION:     { label: "Promotion",      tone: "emerald", cta: "View promotion status", defaultUrl: "/promotions" },
    STALE_DATA:    { label: "Stale data",     tone: "indigo",  cta: "View data sync",        defaultUrl: "/" },
    SYSTEM:        { label: "System warning", tone: "slate",   cta: "Review thresholds",     defaultUrl: "/thresholds" },
}

// Filter chips, in the mockup's order
export const ALERT_TYPES = Object.keys(ALERT_META) as AlertType[];
// SM5 / SM6 checkpoint alerts reuse the Shortage / Waste risk types; their title says which one it is
export const OPPORTUNITY_TITLE = "Opportunity sale";
export const CHEER_TITLE = "Cheer sale";

/** Follow-up button text (S10): the checkpoint alerts get their own action. */
export function ctaFor(type: AlertType, title: string): string {
    if (title.startsWith(OPPORTUNITY_TITLE)) return "Produce more";
    if (title.startsWith(CHEER_TITLE)) return "Cheer sale / push discount";
    return ALERT_META[type].cta;
}
