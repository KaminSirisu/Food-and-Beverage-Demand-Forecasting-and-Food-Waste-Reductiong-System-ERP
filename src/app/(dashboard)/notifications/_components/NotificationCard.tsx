// One alert row (S10): icon tile, type chip, title, unread dot, body, follow-up link, time.
// No "use client": it's only imported by NotificationList, so it's already part of the client bundle.
import Link from "next/link";
import type { AlertType } from "@prisma/client";
import { Database, Tag, Trash, TriangleAlert, Zap, type LucideIcon } from "lucide-react";
import { ALERT_META, ctaFor, type AlertTone } from "@/lib/alerts/meta";
import { formatAlertTime, type NotificationDto } from "@/lib/alerts/view";

const ICONS: Record<AlertType, LucideIcon> = {
    SHORTAGE_RISK: Zap,
    WASTE_RISK: Trash,
    PROMOTION: Tag,
    STALE_DATA: Database,
    SYSTEM: TriangleAlert,
};

// Full class strings: Tailwind only generates classes it can find written out in the source
const TONE: Record<AlertTone, { tile: string; chip: string }> = {
    red:     { tile: "bg-red-50 text-red-500",         chip: "bg-red-100 text-red-700" },
    amber:   { tile: "bg-amber-50 text-amber-500",     chip: "bg-amber-100 text-amber-700" },
    emerald: { tile: "bg-emerald-50 text-emerald-600", chip: "bg-emerald-100 text-emerald-700" },
    indigo:  { tile: "bg-indigo-50 text-indigo-500",   chip: "bg-indigo-100 text-indigo-700" },
    slate:   { tile: "bg-slate-100 text-slate-500",    chip: "bg-slate-100 text-slate-600" },
};

type Props = { n: NotificationDto; serverNow: number; onRead: (id: string) => void };

export function NotificationCard({ n, serverNow, onRead }: Props) {
    const meta = ALERT_META[n.type];
    const tone = TONE[meta.tone];
    const Icon = ICONS[n.type];
    const cta = ctaFor(n.type, n.title);

    return (
        <li className={`flex gap-4 px-6 py-5 ${n.read ? "bg-white" : "bg-slate-50"}`}>
            <span className={`grid size-10 shrink-0 place-items-center rounded-lg ${tone.tile}`}>
                <Icon className="size-5" aria-hidden />
            </span>

            <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                    <span className={`rounded-full px-3 py-0.5 text-xs font-medium ${tone.chip}`}>{meta.label}</span>
                    <h2 className="font-semibold text-slate-900">{n.title}</h2>
                    {!n.read && (
                        <>
                            <span className="size-2 rounded-full bg-indigo-500" aria-hidden />
                            <span className="sr-only">Unread</span>
                        </>
                    )}
                </div>
                <p className="mt-1 text-sm text-slate-500">{n.body}</p>
                {/* S10: the follow-up action. Opening it counts as reading the alert. "Produce more" has none (manager acts in person). */}
                {cta && (
                    <Link
                        href={n.actionUrl}
                        onClick={() => { if (!n.read) onRead(n.id); }}
                        className="mt-3 inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
                    >
                        {cta} <span aria-hidden>→</span>
                    </Link>
                )}
            </div>

            <time dateTime={new Date(n.createdAt).toISOString()} className="shrink-0 text-sm text-slate-500">
                {formatAlertTime(n.createdAt, serverNow)}
            </time>
        </li>
    );
}