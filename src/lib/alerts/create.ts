// The ONE way to create an alert (S10, NFR5): de-dupe -> insert + audit in one transaction -> wake the SSE streams.
import "server-only";
import { db } from "@/lib/db";
import { emitAlert } from './bus';
import { joinMessage } from "./message";
import { dedupeSince, type AlertDraft } from "./rules";

/** Returns the new alert id, or null when the same alert already exists in its de-dupe window. */
export async function createAlert(
    storeNo: number,
    draft: AlertDraft,
    actor = "system", // user id when a person caused it (e.g. a promotion push)
    now = new Date(),
): Promise<bigint | null> {
    const existing = await db.alert.findFirst({
        // itemNo: null -> Prisma writes IS NULL, so branch-level alerts de-dupe too
        where: { storeNo, type: draft.type, itemNo: draft.itemNo, createdAt: {
            gte: dedupeSince(draft.type, now)
        }},
        select: { id: true },
    })
    if (existing) return null;

    // Interactive transaction (not the array form used in promotions/actions.ts): the audit row needs the new id
    const alert = await db.$transaction(async (tx) => {
        const created = await tx.alert.create({
            data: {
                storeNo,
                itemNo: draft.itemNo,
                type: draft.type,
                message: joinMessage(draft.title, draft.body),
                actionUrl: draft.actionUrl,
                createdAt: now,
            },
            select: { id: true },
        });
        await tx.auditLog.create({
            data: {
                actor,
                action: "ALERT_CREATE",
                entity: "alert",
                entityId: created.id.toString(),
                detail: { storeNo, type: draft.type, itemNo: draft.itemNo },
            }
        })
        return created;
    })

    emitAlert(storeNo); // AFTER the commit: a stream woken earlier would query before the row is visible
    return alert.id;
}