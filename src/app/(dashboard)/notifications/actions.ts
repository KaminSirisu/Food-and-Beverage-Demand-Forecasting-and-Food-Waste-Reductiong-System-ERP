"use server";
// Notifications server actions (S10). Every export is a public POST endpoint: validate, scope to the session's branch.
import { z } from "zod";
import { verifySession } from "@/lib/auth/dal";
import { emitAlert } from "@/lib/alerts/bus";
import { db } from "@/lib/db";

export type ReadResult = { ok: true } | { ok: false; error: string };

const AlertId = z.string().regex(/^\d{1,18}$/); // the DTO id (BigInt as a string)

export async function markRead(input: unknown): Promise<ReadResult> {
    const { storeNo } = await verifySession(); // G2
    const parsed = AlertId.safeParse(input);
    if (!parsed.success) return { ok: false, error: "Invalid alert." };

    // updateMany, not update: the storeNo filter turns another branch's id into a no-op (G2),
    // and an alert that's already read is not an error.
    await db.alert.updateMany({
        where: { id: BigInt(parsed.data), storeNo, readAt: null },
        data: { readAt: new Date() },
    });
    emitAlert(storeNo); // other open tabs get the new unread count now
    return { ok: true };
}

export async function markAllRead(input: unknown): Promise<ReadResult> {
    const { storeNo } = await verifySession();
    const parsed = AlertId.safeParse(input); // newest id the manager could see
    if (!parsed.success) return { ok: false, error: "Invalid alert." };
    // lte: an alert that arrives after the click stays unread (the manager hasn't seen it)
    await db.alert.updateMany({ where: { storeNo, readAt: null, id: { lte: BigInt(parsed.data) } }, data: { readAt: new Date() } });
    emitAlert(storeNo);
    return { ok: true };
}