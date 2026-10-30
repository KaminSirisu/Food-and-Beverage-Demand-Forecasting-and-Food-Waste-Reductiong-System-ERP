"use server";
// Branch Thresholds server action (SM5, SM6, S7, SM9, NFR5). Every export here is a public POST endpoint — keep them minimal.
import { z } from "zod";
import { refresh } from "next/cache";
import { verifySession } from "@/lib/auth/dal";
import { db } from "@/lib/db";
import { toRow } from "@/lib/thresholds/queries";
import { LIMIT_RANGE } from "@/lib/thresholds/units";

const Time = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/); // HH:mm, what <input type="time"> sends
// The range depends on the unit: 1–20 units or 5–40 %
const Limit = z.discriminatedUnion("unit", [
    z.object({ unit: z.literal("UNITS"), value: z.number().int().min(LIMIT_RANGE.UNITS.min).max(LIMIT_RANGE.UNITS.max) }),
    z.object({ unit: z.literal("PCT"), value: z.number().int().min(LIMIT_RANGE.PCT.min).max(LIMIT_RANGE.PCT.max) }),
]);
const Pct = z.number().min(0).max(100); // S7 waste-risk
const Discount = z.number().min(0).max(90); // SM9: never give stock away for free

const SaveInput = z.object({
    branch: z.object({
        opportunityCheckAt: Time,
        opportunity: Limit,
        cheerCheckAt: Time,
        cheer: Limit,
        wasteRiskPct: Pct,
        discountPct: Discount,
    }),
    // null = the "Default" box: inherit. A limit is one object, so a value without its unit can't even be sent.
    categories: z
        .array(
            z.object({
                code: z.string().min(1).max(10),
                opportunity: Limit.nullable(),
                cheer: Limit.nullable(),
                wasteRiskPct: Pct.nullable(),
                discountPct: Discount.nullable(),
            }),
        )
        .max(20),
});

export type SaveThresholdsInput = z.infer<typeof SaveInput>;
export type SaveResult = { ok: true } | { ok: false; error: string };

type Values = Omit<SaveThresholdsInput["categories"][number], "code">;

// Form shape → table columns. The branch default fits too: its fields are the same, just never null.
function columns(v: Values) {
    return {
        opportunityValue: v.opportunity?.value ?? null,
        opportunityUnit: v.opportunity?.unit ?? null,
        cheerValue: v.cheer?.value ?? null,
        cheerUnit: v.cheer?.unit ?? null,
        wasteRiskPct: v.wasteRiskPct,
        discountPct: v.discountPct,
    };
}

function isEmpty(v: Values): boolean {
    return v.opportunity == null && v.cheer == null && v.wasteRiskPct == null && v.discountPct == null;
}

// SM5 / SM6 / S7 / SM9 / NFR5: save the branch default and the category overrides together.
export async function saveThresholds(input: unknown): Promise<SaveResult> {
    const { userId, storeNo } = await verifySession(); // G2: branch and editor from the session, never the client

    const parsed = SaveInput.safeParse(input);
    if (!parsed.success) return { ok: false, error: "Invalid threshold values." };
    const { branch, categories } = parsed.data;

    const [before, skus] = await Promise.all([
        db.branchThreshold.findMany({ where: { storeNo } }),
        db.sku.findMany({ where: { inScope: true }, distinct: ["categoryCode"], select: { categoryCode: true } }),
    ]);
    const inScope = new Set(skus.map((s) => s.categoryCode));
    const codes = categories.map((c) => c.code);
    if (new Set(codes).size !== codes.length || codes.some((c) => !inScope.has(c))) {
        return { ok: false, error: "Unknown or duplicate category. Reload the page." };
    }

    const defaultRow = before.find((r) => r.categoryCode === null);
    const branchData = {
        opportunityCheckAt: branch.opportunityCheckAt,
        cheerCheckAt: branch.cheerCheckAt,
        ...columns(branch),
        updatedBy: userId, // always written: "Last edited" reads the default row (Lesson 3)
    };

    // One transaction: either every row is saved, or none
    await db.$transaction([
        // categoryCode NULL can't go through the compound unique key (Postgres: NULLs are distinct) → by id
        defaultRow
            ? db.branchThreshold.update({ where: { id: defaultRow.id }, data: branchData })
            : db.branchThreshold.create({ data: { storeNo, ...branchData } }),
        ...categories.map((c) =>
            isEmpty(c)
                ? // Every box back to "Default" → remove the row, so nothing stale is left behind
                  db.branchThreshold.deleteMany({ where: { storeNo, categoryCode: c.code } })
                : db.branchThreshold.upsert({
                      where: { storeNo_categoryCode: { storeNo, categoryCode: c.code } },
                      create: { storeNo, categoryCode: c.code, ...columns(c), updatedBy: userId },
                      update: { ...columns(c), updatedBy: userId },
                  }),
        ),
        // NFR5: audit trail with the old and new values
        db.auditLog.create({
            data: {
                actor: userId,
                action: "THRESHOLD_CHANGE",
                entity: "branch_threshold",
                entityId: String(storeNo),
                detail: {
                    before: before.map((r) => ({ categoryCode: r.categoryCode, ...toRow(r) })),
                    after: parsed.data,
                },
            },
        }),
    ]);

    refresh(); // Next 16: re-render so the form and "Last edited" show the saved values
    return { ok: true };
}