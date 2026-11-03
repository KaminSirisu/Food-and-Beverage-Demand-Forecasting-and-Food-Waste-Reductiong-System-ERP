// Branch Thresholds page data (SM5, SM6, S7, SM9). Server only: reads Neon via Prisma.
import "server-only";
import type { BranchThreshold, Prisma } from "@prisma/client";
import { DISPLAY_CAPACITY } from "@/lib/config";
import { db } from "@/lib/db";
import { DEFAULT_THRESHOLDS, resolve, type ThresholdRow, type Thresholds } from "./resolve";

export type CategoryThresholds = {
    code: string; // SB, ST, SC, SCP
    name: string;
    capacity: number; // 0 = unknown → the page shows no % example for it
    override: ThresholdRow | null; // null = no row → every box shows "Default"
};

export type ThresholdsData = {
    branch: Thresholds; // the default row, gaps filled from code defaults
    categories: CategoryThresholds[];
    lastEdited: { at: Date; by: string | null } | null; // by null = set by the seed, not a person
};

// Decimal is a class instance. Client Components only take plain values, so convert here.
function num(d: Prisma.Decimal | null): number | null {
    return d == null ? null : d.toNumber();
}

export function toRow(r: BranchThreshold): ThresholdRow {
    return {
        opportunityCheckAt: r.opportunityCheckAt,
        opportunityValue: num(r.opportunityValue),
        opportunityUnit: r.opportunityUnit,
        cheerCheckAt: r.cheerCheckAt,
        cheerValue: num(r.cheerValue),
        cheerUnit: r.cheerUnit,
        wasteRiskPct: num(r.wasteRiskPct),
        discountPct: num(r.discountPct),
    };
}

export async function getThresholds(storeNo: number): Promise<ThresholdsData> {
    // 2 independent queries → one round trip to Neon
    const [rows, skus] = await Promise.all([
        db.branchThreshold.findMany({ where: { storeNo } }),
        db.sku.findMany({
            where: { inScope: true },
            distinct: ["categoryCode"],
            select: { categoryCode: true, categoryName: true },
            orderBy: { categoryCode: "asc" },
        }),
    ]);

    // Key null = the branch default row. A Map is fine with a null key, unlike the DB unique index.
    const byCategory = new Map(rows.map((r) => [r.categoryCode, r]));
    const defaultRow = byCategory.get(null);

    // Every save updates the default row (Lesson 4), so its updatedAt / updatedBy is the last edit
    const editor = defaultRow?.updatedBy
        ? await db.user.findUnique({ where: { id: defaultRow.updatedBy }, select: { name: true } })
        : null;

    return {
        branch: resolve(DEFAULT_THRESHOLDS, defaultRow ? toRow(defaultRow) : null),
        categories: skus.map((s) => {
            const row = byCategory.get(s.categoryCode);
            return {
                code: s.categoryCode,
                name: s.categoryName ?? s.categoryCode,
                capacity: DISPLAY_CAPACITY[s.categoryCode] ?? 0,
                override: row ? toRow(row) : null,
            };
        }),
        lastEdited: defaultRow ? { at: defaultRow.updatedAt, by: editor?.name ?? null } : null,
    };
}