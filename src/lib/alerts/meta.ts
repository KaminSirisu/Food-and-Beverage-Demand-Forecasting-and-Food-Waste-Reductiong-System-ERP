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