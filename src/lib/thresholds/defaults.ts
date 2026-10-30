// Branch default thresholds (the categoryCode = null row). The schema has no defaults on purpose:
// NULL on a category row means "inherit", so the values the branch starts with live here.
import type { Prisma } from "@prisma/client";

export const BRANCH_DEFAULTS = {
    opportunityCheckAt: "14:00", // open decision: 14:00 vs 14:30
    opportunityValue: 3,
    opportunityUnit: "UNITS",
    cheerCheckAt: "18:00", // open decision: 17:00 vs 18:00
    cheerValue: 10,
    cheerUnit: "PCT",
    wasteRiskPct: 10,
    discountPct: 20,
} satisfies Omit<Prisma.BranchThresholdUncheckedCreateInput, "storeNo">;