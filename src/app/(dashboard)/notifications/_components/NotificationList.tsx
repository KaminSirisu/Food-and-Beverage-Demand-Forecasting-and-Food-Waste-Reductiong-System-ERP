"use client";
// S10: filter chips, Unread only, Mark all as read. Server list + live SSE alerts, with optimistic read state.
import { useMemo, useState } from "react";
import type { AlertType } from "@prisma/client";
import { useNotifications } from "@/components/notifications/NotificationStreamProvider";
import { ALERT_META, ALERT_TYPES } from "@/lib/alerts/meta";
import { applyReadOverrides, filterNotifications, mergeIncoming, type NotificationDto } from "@/lib/alerts/view";
import { NotificationCard } from "./NotificationCard";
import { NotificationsEmptyState } from "./NotificationsEmptyState";

export function NotificationList({ initial, serverNow }: { initial: NotificationDto[]; serverNow: number }) {
    const { incoming, overrides, connected, readOne, readAll } = useNotifications();
    const [types, setTypes] = useState<AlertType[]>([]); // [] = all types
    const [unreadOnly, setUnreadOnly] = useState(false);

    // Server-rendered list + whatever arrived live, then this tab's read clicks on top
    const all = useMemo(
        () => applyReadOverrides(mergeIncoming(initial, incoming), overrides),
        [initial, incoming, overrides],
    );
    const shown = filterNotifications(all, { types, unreadOnly });
    const hasUnread = all.some((n) => !n.read);

    const toggle = (t: AlertType) =>
        setTypes((prev) => (prev.includes(t) ? prev.filter((x) => x !== t) : [...prev, t]));

    return (
        <section className="space-y-4">
            <div className="flex flex-wrap items-center gap-3">
                <div role="group" aria-label="Filter by type" className="flex flex-wrap gap-2">
                    {ALERT_TYPES.map((t) => {
                        const on = types.includes(t);
                        return (
                            <button
                                key={t}
                                type="button"
                                aria-pressed={on}
                                onClick={() => toggle(t)}
                                className={`rounded-full border px-4 py-1.5 text-sm transition-colors ${
                                    on ? "border-slate-800 bg-slate-800 text-white" : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                                }`}
                            >
                                {ALERT_META[t].label}
                            </button>
                        );
                    })}
                </div>

                <span className="flex items-center gap-1.5 text-xs text-slate-500" role="status">
                    <span className={`size-2 rounded-full ${connected ? "bg-emerald-500" : "bg-slate-300"}`} aria-hidden />
                    {connected ? "Live" : "Connecting…"}
                </span>

                <label className="ml-auto flex items-center gap-2 text-sm text-slate-700">
                    <input
                        type="checkbox"
                        checked={unreadOnly}
                        onChange={(e) => setUnreadOnly(e.target.checked)}
                        className="size-4 accent-emerald-600"
                    />
                    Unread only
                </label>
                <button
                    type="button"
                    disabled={!hasUnread}
                    onClick={() => readAll(all[0].id)} // all is newest first → [0] is the highest id the manager can see
                    className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                >
                    Mark all as read
                </button>
            </div>

            {shown.length === 0 ? (
                <NotificationsEmptyState filtered={all.length > 0} />
            ) : (
                <ul className="divide-y divide-slate-200 overflow-hidden rounded-2xl border border-slate-200 bg-white">
                    {shown.map((n) => (
                        <NotificationCard key={n.id} n={n} serverNow={serverNow} onRead={readOne} />
                    ))}
                </ul>
            )}
        </section>
    );
}