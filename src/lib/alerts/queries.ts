// Notifications reads (S10). Server only. Always filtered by storeNo from the session (G2).
import "server-only";
import { db } from "@/lib/db";
import { toDto, type NotificationDto } from "./view";

// Only the columns AlertRow needs (no storeNo leaks to the browser)
const SELECT = { id: true, type: true, itemNo: true, message: true, actionUrl: true, createdAt: true, readAt: true } as const;

/** First page load: newest first. */
export async function getNotifications(storeNo: number, limit = 50): Promise<NotificationDto[]> {
    const rows = await db.alert.findMany({ where: { storeNo }, orderBy: { id: "desc" }, take: limit, select: SELECT });
    return rows.map(toDto);
}

/** SSE: everything after the cursor, OLDEST first, so the cursor only moves forward (no gaps if > limit). */
export async function getNotificationsAfter(storeNo: number, after: bigint, limit = 50): Promise<NotificationDto[]> {
    const rows = await db.alert.findMany({
        where: { storeNo, id: { gt: after } },
        orderBy: { id: "asc" },
        take: limit,
        select: SELECT,
    });
    return rows.map(toDto);
}

export function unreadCount(storeNo: number): Promise<number> {
    return db.alert.count({ where: { storeNo, readAt: null } });
}

/** Newest alert id for the branch ("0" if none): the SSE stream starts after it. */
export async function latestAlertId(storeNo: number): Promise<string> {
    const last = await db.alert.findFirst({ where: { storeNo }, orderBy: { id: "desc" }, select: { id: true } });
    return last ? last.id.toString() : "0";
}