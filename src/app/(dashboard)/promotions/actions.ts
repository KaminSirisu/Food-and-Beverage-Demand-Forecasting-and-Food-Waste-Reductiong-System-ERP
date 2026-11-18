"use server";
// Waste & Auto-Promotion server actions (SM9, SM10, NFR5). Every export here is a public POST endpoint — keep them minimal.
// POS is simulated, like the factory order: "push" only marks today's promotion row LIVE; nothing leaves the app.
import { z } from "zod";
import { refresh } from "next/cache";
import { verifySession } from "@/lib/auth/dal";
import { db } from "@/lib/db";
import { getPromotions } from "@/lib/promotions/queries";
import { canPush } from "@/lib/promotions/rules";
import { BRANCH_DEFAULTS } from "@/lib/thresholds/defaults";
import { todayDate } from "@/lib/time";
import { createAlert } from "@/lib/alerts/create";
import { formatClock } from "@/lib/time"; // add to the existing "@/lib/time import"

export type PromoResult = { ok: true } | { ok: false; error: string };

const ItemNo = z.string().min(1).max(20);
const Discount = z.number().int().min(0).max(90); // same cap as Branch Thresholds: never give stock away for free

// The SKU's row as the server computes it now. The client's rate is never trusted.
async function currentRow(storeNo: number, itemNo: string, now: Date) {
    const { rows } = await getPromotions(storeNo, now);
    return rows.find((r) => r.itemNo === itemNo) ?? null;
}

const key = (storeNo: number, itemNo: string, promoDate: Date) => ({ storeNo_itemNo_promoDate: { storeNo, itemNo, promoDate } });

// SM10: push today's discount to the (simulated) POS
export async function pushDiscount(input: unknown): Promise<PromoResult> {
    const { userId, storeNo } = await verifySession(); // G2: branch and user from the session, never the client
    const parsed = ItemNo.safeParse(input);
    if (!parsed.success) return { ok: false, error: "Invalid item." };

    const now = new Date();
    const row = await currentRow(storeNo, parsed.data, now);
    if (!row) return { ok: false, error: "This item has no forecast today. Reload the page." };
    if (!canPush(row)) {
        return { ok: false, error: row.status === "LIVE" ? "Already live on POS." : "No discount to push." };
    }

    const promoDate = todayDate(now);
    const fields = { discountPct: row.discountPct, mode: row.mode, posStatus: "LIVE", pushedAt: now, pushedBy: userId };
    await db.$transaction([
        db.promotion.upsert({
            where: key(storeNo, row.itemNo, promoDate),
            create: { storeNo, itemNo: row.itemNo, promoDate, ...fields },
            update: fields,
        }),
        // NFR5: audit trail
        db.auditLog.create({
            data: {
                actor: userId,
                action: "PROMO_PUSH",
                entity: "promotion",
                entityId: `${row.itemNo}|${promoDate.toISOString().slice(0, 10)}`,
                detail: { storeNo, itemNo: row.itemNo, discountPct: row.discountPct, mode: row.mode, promoPrice: row.promoPrice },
            },
        }),
    ]);

    // S10: tell the bell (best effort: the push is already saved)
    await createAlert(storeNo, {
        type: "PROMOTION",
        itemNo: row.itemNo,
        title: `Promotion pushed · ${row.itemNo} ${row.nameTh}`,
        body: `${row.discountPct}% discount live on POS since ${formatClock(now)}.`,
        actionUrl: "/promotions",
    }, userId, now).catch((err) => console.error("createAlert failed", err));

    refresh();
    return { ok: true };
}

const OverrideInput = z.object({ itemNo: ItemNo, discountPct: Discount });

// SM9: Manual Override — the manager's rate for one SKU, today only. It must be pushed again.
export async function overrideDiscount(input: unknown): Promise<PromoResult> {
    const { userId, storeNo } = await verifySession();
    const parsed = OverrideInput.safeParse(input);
    if (!parsed.success) return { ok: false, error: "Discount must be a whole number from 0 to 90%." };
    const { itemNo, discountPct } = parsed.data;

    const now = new Date();
    const row = await currentRow(storeNo, itemNo, now);
    if (!row) return { ok: false, error: "This item has no forecast today. Reload the page." };

    const promoDate = todayDate(now);
    const fields = {
        discountPct,
        mode: "MANUAL",
        posStatus: discountPct > 0 ? "PENDING" : "NONE", // 0% = no promotion today
        pushedAt: null,
        pushedBy: null,
    };
    await db.$transaction([
        db.promotion.upsert({
            where: key(storeNo, itemNo, promoDate),
            create: { storeNo, itemNo, promoDate, ...fields },
            update: fields,
        }),
        db.auditLog.create({
            data: {
                actor: userId,
                action: "PROMO_OVERRIDE",
                entity: "promotion",
                entityId: `${itemNo}|${promoDate.toISOString().slice(0, 10)}`,
                detail: { storeNo, itemNo, before: { discountPct: row.discountPct, mode: row.mode, status: row.status }, after: { discountPct } },
            },
        }),
    ]);

    refresh();
    return { ok: true };
}

// SM9: drop today's Manual Override → the SKU follows the category rule again
export async function resetToAuto(input: unknown): Promise<PromoResult> {
    const { userId, storeNo } = await verifySession();
    const parsed = ItemNo.safeParse(input);
    if (!parsed.success) return { ok: false, error: "Invalid item." };

    const promoDate = todayDate();
    const [deleted] = await db.$transaction([
        db.promotion.deleteMany({ where: { storeNo, itemNo: parsed.data, promoDate, mode: "MANUAL" } }),
        db.auditLog.create({
            data: {
                actor: userId,
                action: "PROMO_RESET",
                entity: "promotion",
                entityId: `${parsed.data}|${promoDate.toISOString().slice(0, 10)}`,
                detail: { storeNo, itemNo: parsed.data },
            },
        }),
    ]);
    if (deleted.count === 0) return { ok: false, error: "No manual rate to reset." };

    refresh();
    return { ok: true };
}

// SM9: turn the Auto-Promotion engine on or off for the branch (stored on the default threshold row)
export async function setAutoPromotion(input: unknown): Promise<PromoResult> {
    const { userId, storeNo } = await verifySession();
    const parsed = z.boolean().safeParse(input);
    if (!parsed.success) return { ok: false, error: "Invalid value." };
    const enabled = parsed.data;

    // categoryCode NULL can't go through the compound unique key (Postgres: NULLs are distinct) → find, then by id
    const current = await db.branchThreshold.findFirst({ where: { storeNo, categoryCode: null } });
    await db.$transaction([
        current
            ? db.branchThreshold.update({ where: { id: current.id }, data: { autoPromotionEnabled: enabled, updatedBy: userId } })
            : db.branchThreshold.create({ data: { storeNo, ...BRANCH_DEFAULTS, autoPromotionEnabled: enabled, updatedBy: userId } }),
        db.auditLog.create({
            data: {
                actor: userId,
                action: "THRESHOLD_CHANGE",
                entity: "branch_threshold",
                entityId: String(storeNo),
                detail: { before: { autoPromotionEnabled: current?.autoPromotionEnabled ?? true }, after: { autoPromotionEnabled: enabled } },
            },
        }),
    ]);

    refresh();
    return { ok: true };
}
