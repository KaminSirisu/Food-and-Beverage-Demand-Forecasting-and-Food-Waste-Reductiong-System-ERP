"use client";

import { SYNC_STALE_HOURS } from "@/lib/config";
import type { SyncStatus } from "@/lib/dashboard/queries";
import { formatClock, formatHeaderTime, formatShortDate, todayDate } from "@/lib/time";
import { useNow } from "@/lib/use-now";

const HOUR_MS = 3_600_000;

const SOURCE: Record<string, string> = {
    "power-automate": "via Power Automate",
    backfill: "via backfill",
    simulate: "simulated",
};

const TONES = {
    active: { box: "bg-indigo-50", dot: "bg-emerald-500", label: "text-indigo-700", detail: "text-indigo-500" },
    stale: { box: "bg-amber-50", dot: "bg-amber-500", label: "text-amber-800", detail: "text-amber-700" },
    none: { box: "bg-slate-100", dot: "bg-slate-400", label: "text-slate-700", detail: "text-slate-500" },
};

// S1: live date + D365 sync pill. Client-side so it keeps ticking: the layout does NOT re-render between pages.
export function HeaderStatus({ serverNow, lastSync }: SyncStatus) {
    const now = useNow(serverNow);
    return (
        <>
            <p className="text-sm text-slate-500">{formatHeaderTime(new Date(now))}</p>
            <SyncPill now={now} lastSync={lastSync} />
        </>
    );
}

function SyncPill({ now, lastSync }: { now: number; lastSync: SyncStatus["lastSync"] }) {
    if (!lastSync) return <Pill tone="none" label="No data yet" detail="Waiting for the first D365 import" />;

    const at = new Date(lastSync.at);
    const today = todayDate(at).getTime() === todayDate(new Date(now)).getTime();
    const when = `${today ? "Today" : formatShortDate(at)} ${formatClock(at)}`;
    const stale = now - lastSync.at > SYNC_STALE_HOURS * HOUR_MS;

    return stale ? (
        <Pill tone="stale" label="Stale" detail={`Last sync ${when} · over ${SYNC_STALE_HOURS} h ago`} />
    ) : (
        <Pill tone="active" label="Active" detail={`${when} ${SOURCE[lastSync.source] ?? ""}`} />
    );
}

function Pill({ tone, label, detail }: { tone: keyof typeof TONES; label: string; detail: string }) {
    const t = TONES[tone];
    return (
        <span className={`flex items-center gap-2 rounded-full px-3 py-1 text-xs ${t.box}`}>
            <span className={`size-2 rounded-full ${t.dot}`} aria-hidden />
            <span className={`font-semibold ${t.label}`}>D365 Data Sync: {label}</span>
            <span className={t.detail}>{detail}</span>
        </span>
    );
}