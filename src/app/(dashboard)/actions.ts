"use server";
// Dashboard server actions. Every export here is a public POST endpoint — keep them minimal.
import { z } from "zod";
import { refresh } from "next/cache";
import { verifySession } from "@/lib/auth/dal";
import { db } from "@/lib/db";
import { deleteFlash } from "@/lib/flash";
import { ORDER_CUTOFF } from "@/lib/config";
import { computeRow } from "@/lib/orders/formula";
import { getOrderInputs } from "@/lib/orders/queries";
import { appNow, isAfterCutoff, tomorrowDate } from "@/lib/time";
import { evaluateAlerts, runDueCheckpoints } from "@/lib/alerts/engine";
import { forecastIfDue, simulateIngestion, type CatchUp, type SimForecast, type SimulateResult } from "@/lib/simulate/ingest";

export async function clearFlash(): Promise<void> {
    await deleteFlash();
}
// Only what the manager decides. Everything else is recomputed on the server.
const ConfirmInput = z
    .array(
        z.object({
            itemNo: z.string().min(1).max(20),
            leftNow: z.number().int().min(0).max(10_000), // SM4
            ordered: z.number().int().min(0).max(10_000),
        }),
    )
    .min(1)
    .max(50);

export type ConfirmResult = { ok: true; pendingAm: string[] } | { ok: false; error: string };

// SM3 / SM4 / S4 / S5 / NFR5: save tomorrow's order. Re-confirming before the cutoff overwrites it.
export async function confirmOrder(input: unknown): Promise<ConfirmResult> {
    const { userId, storeNo } = await verifySession(); // G2: branch from the session, never from the client

    const parsed = ConfirmInput.safeParse(input);
    if (!parsed.success) return { ok: false, error: "Invalid order data." };

    const now = new Date(); // one instant for the cutoff, the dates and the audit row
    if (isAfterCutoff(ORDER_CUTOFF, now)) return { ok: false, error: `Ordering closed at ${ORDER_CUTOFF}.` };

    // S4: recompute from DB forecasts. The client's Suggested is never trusted.
    const { lines } = await getOrderInputs(storeNo, now);
    const byItem = new Map(lines.map((l) => [l.itemNo, l]));
    if (new Set(parsed.data.map((l) => l.itemNo)).size !== parsed.data.length) {
        return { ok: false, error: "Duplicate item in order." };
    }
    if (parsed.data.some((l) => !byItem.has(l.itemNo))) {
        return { ok: false, error: "Order has an item with no forecast. Reload the page." };
    }

    const computed = parsed.data.map((sent) => {
        const input = byItem.get(sent.itemNo)!;
        return { sent, input, row: computeRow(input, sent.leftNow, sent.ordered) };
    });
    const pendingAm = computed.filter((c) => c.row.needsApproval).map((c) => c.sent.itemNo); // S5
    const deliveryDate = tomorrowDate(now);

    // One transaction: either the whole order is saved, or none of it is
    await db.$transaction([
        // SM4: store the manager's count only where it differs from what we had
        db.stockSnapshot.createMany({
            data: computed
                .filter((c) => c.sent.leftNow !== c.input.leftNow)
                .map((c) => ({ storeNo, itemNo: c.sent.itemNo, takenAt: appNow(now), qty: c.sent.leftNow, source: "COUNT", userId })),
        }),
        ...computed.map(({ sent, row }) => {
            const fields = {
                needQty: row.need,
                usableQty: row.usable,
                suggestedQty: row.suggested,
                orderedQty: row.ordered,
                status: row.needsApproval ? ("PENDING_AM" as const) : ("CONFIRMED" as const),
                confirmedBy: userId,
                confirmedAt: now,
                reviewedBy: null, // a re-confirm restarts any AM review
                reviewedAt: null,
            };
            return db.orderLine.upsert({
                where: { storeNo_itemNo_deliveryDate: { storeNo, itemNo: sent.itemNo, deliveryDate } },
                create: { storeNo, itemNo: sent.itemNo, deliveryDate, ...fields },
                update: fields,
            });
        }),
        // NFR5: audit trail, the same numbers the screen showed
        db.auditLog.create({
            data: {
                actor: userId,
                action: "ORDER_CONFIRM",
                entity: "order_line",
                entityId: deliveryDate.toISOString().slice(0, 10),
                detail: {
                    storeNo,
                    pendingAm,
                    lines: computed.map(({ sent, row }) => ({ itemNo: sent.itemNo, leftNow: row.leftNow, suggested: row.suggested, ordered: row.ordered })),
                },
            },
        }),
    ]);

    // SM5 / SM6: the new "Left now" counts can change today's risks -> re-check alerts (best effort: the order is already saved)
    await evaluateAlerts(storeNo, now).catch((err) => console.error("evaluateAlerts failed", err));

    refresh(); // Next 16: re-render the page so "Confirmed at …" and the saved orders show
    return { ok: true, pendingAm };
}
// Manual 3.1.1 no. 6 (S1, demo only): load today's sales so far, run the forecast when due (L7), re-check alerts (S7).
export async function simulateIngestionAction(): Promise<SimulateResult & { forecast?: SimForecast; catchUp?: CatchUp }> {
    const { storeNo } = await verifySession(); // G2: branch from the session
    const now = new Date();
    const result = await simulateIngestion(storeNo, now).catch((err: Error): SimulateResult & { catchUp?: CatchUp } => {
        console.error("simulateIngestion failed", err);
        return { ok: false, error: "Simulation failed. Check the server log." };
    });
    if (!result.ok) return result;

    // Only when today has sales: the model needs today's data (it decides tomorrow from it)
    const hasSales = result.status !== "NO_NEW_DATA" || result.source !== null;
    const forecast = hasSales
        ? await forecastIfDue(storeNo, now).catch((err): SimForecast => {
              console.error("forecastIfDue failed", err);
              return { ran: false };
          })
        : { ran: false };
    // re-check even with no new lines: forecasts or counts may have changed since the last check
    await evaluateAlerts(storeNo, now).catch((err) => console.error("evaluateAlerts failed", err));
    // SM5 / SM6: a checkpoint that is due runs now, with the stock this sync just updated
    await runDueCheckpoints(storeNo, now).catch((err) => console.error("runDueCheckpoints failed", err));
    refresh(); // header sync pill, KPIs and the order card read the new sales
    return { ...result, forecast };
}
