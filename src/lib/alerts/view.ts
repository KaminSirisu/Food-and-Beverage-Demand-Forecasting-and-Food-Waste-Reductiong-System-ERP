// What the page and the SSE stream send to the browser, plus the list operations the client needs.
import type { AlertType } from "@prisma/client";
import { ALERT_META } from "./meta";
import { splitMessage } from "./message";
import { formatClock, formatShortDate, todayDate } from "@/lib/time";

export type NotificationDto = {
    id: string;        // BigInt as a string: JSON.stringify throws on BigInt
    type: AlertType;
    itemNo: string | null;
    title: string;
    body: string;
    actionUrl: string; // S10: every alert links to its follow-up
    createdAt: number; // epoch ms: serialisable, and the client formats it in Bangkok time
    read: boolean;
};

// The columns we select from `alert` (a subset of the Prisma model, so tests don't need a full row)
export type AlertRow = {
    id: bigint; type: AlertType; itemNo: string | null; message: string;
    actionUrl: string | null; createdAt: Date; readAt: Date | null;
};

export function toDto(a: AlertRow): NotificationDto {
    const meta = ALERT_META[a.type];
    const { title, body } = splitMessage(a.message, meta.label);
    return {
        id: a.id.toString(), type: a.type, itemNo: a.itemNo, title, body,
        actionUrl: a.actionUrl ?? meta.defaultUrl,
        createdAt: a.createdAt.getTime(),
        read: a.readAt !== null,
    };
}

export type NotificationFilter = { types: AlertType[]; unreadOnly: boolean }; // types [] = all types

export function filterNotifications(list: NotificationDto[], f: NotificationFilter): NotificationDto[] {
    return list.filter((n) => (f.types.length === 0 || f.types.includes(n.type)) && (!f.unreadOnly || !n.read));
}

export const MAX_KEPT = 100; // a tab left open all day must not grow forever

// SSE can send an alert we already have (reconnect, or the first page load overlaps the stream).
// Use a Map keyed by id: the newer copy wins, and nothing is duplicated. Newest first = highest id (autoincrement).
export function mergeIncoming(list: NotificationDto[], incoming: NotificationDto[]): NotificationDto[] {
    const byId = new Map(list.map((n) => [n.id, n]));
    for (const n of incoming) byId.set(n.id, n);
    return [...byId.values()]
        .sort((a, b) => (BigInt(b.id) > BigInt(a.id) ? 1 : -1))
        .slice(0, MAX_KEPT);
}

// Optimistic read state kept by the client: ids read in this tab + "everything up to id N" (Mark all as read)
export type ReadOverrides = { ids: ReadonlySet<string>; allUpTo: string | null };

export function applyReadOverrides(list: NotificationDto[], o: ReadOverrides): NotificationDto[] {
    const upTo = o.allUpTo === null ? null : BigInt(o.allUpTo);
    return list.map((n) =>
        n.read || o.ids.has(n.id) || (upTo !== null && BigInt(n.id) <= upTo) ? { ...n, read: true } : n,
    );
}

// "13:40" for today, "18 Nov · 13:40" for older alerts — always Bangkok time, so server and client HTML match
export function formatAlertTime(createdAt: number, now: number): string {
    const d = new Date(createdAt);
    const sameDay = todayDate(d).getTime() === todayDate(new Date(now)).getTime();
    return sameDay ? formatClock(d) : `${formatShortDate(d)} · ${formatClock(d)}`;
}