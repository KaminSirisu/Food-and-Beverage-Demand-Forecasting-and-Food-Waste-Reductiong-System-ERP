// Inheritance: a category row overrides the branch default field by field; NULL = inherit.
// The same resolve() also fills the default row from BRANCH_DEFAULTS, so a NULL there can't crash a page.
import type { ThresholdUnit } from "@prisma/client";
import { BRANCH_DEFAULTS } from "./defaults";
import type { Limit } from "./units";

// Effective settings for one category: every field filled
export type Thresholds = {
    opportunityCheckAt: string;
    opportunity: Limit;
    cheerCheckAt: string;
    cheer: Limit;
    wasteRiskPct: number;
    discountPct: number;
};

// A branch_threshold row with Decimals already turned into numbers (the query does that, Lesson 3)
export type ThresholdRow = {
    opportunityCheckAt: string | null;
    opportunityValue: number | null;
    opportunityUnit: ThresholdUnit | null;
    cheerCheckAt: string | null;
    cheerValue: number | null;
    cheerUnit: ThresholdUnit | null;
    wasteRiskPct: number | null;
    discountPct: number | null;
};

export const DEFAULT_THRESHOLDS: Thresholds = {
    opportunityCheckAt: BRANCH_DEFAULTS.opportunityCheckAt,
    opportunity: { value: BRANCH_DEFAULTS.opportunityValue, unit: BRANCH_DEFAULTS.opportunityUnit },
    cheerCheckAt: BRANCH_DEFAULTS.cheerCheckAt,
    cheer: { value: BRANCH_DEFAULTS.cheerValue, unit: BRANCH_DEFAULTS.cheerUnit },
    wasteRiskPct: BRANCH_DEFAULTS.wasteRiskPct,
    discountPct: BRANCH_DEFAULTS.discountPct,
};

// Value and unit inherit together: "10" without its unit means nothing
function limit(value: number | null, unit: ThresholdUnit | null, fallback: Limit): Limit {
    return value != null && unit != null ? { value, unit } : fallback;
}

export function resolve(base: Thresholds, row: ThresholdRow | null): Thresholds {
    if (!row) return base;
    return {
        opportunityCheckAt: row.opportunityCheckAt ?? base.opportunityCheckAt,
        opportunity: limit(row.opportunityValue, row.opportunityUnit, base.opportunity),
        cheerCheckAt: row.cheerCheckAt ?? base.cheerCheckAt,
        cheer: limit(row.cheerValue, row.cheerUnit, base.cheer),
        wasteRiskPct: row.wasteRiskPct ?? base.wasteRiskPct,
        discountPct: row.discountPct ?? base.discountPct,
    };
}