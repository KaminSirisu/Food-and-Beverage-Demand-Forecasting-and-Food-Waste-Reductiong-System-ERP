// SM5 / SM6: an alert limit is a value + unit. PCT = % of the category's display capacity (lib/config.ts).
// Pure — used by the page (example line) and the alert engine, so the screen and the alerts always agree.
import type { ThresholdUnit } from "@prisma/client";

export type Limit = { value: number; unit: ThresholdUnit };

// Slider ranges from the mockup. The server action validates against the same numbers.
// start = where the slider jumps when the unit is switched (3 units and 10% can't be converted without a category)
export const LIMIT_RANGE = {
    UNITS: { min: 1, max: 20, start: 3 },
    PCT: { min: 5, max: 40, start: 10 },
} as const satisfies Record<ThresholdUnit, { min: number; max: number; start: number }>;


// Whole units: you can't count 1.6 cakes on a shelf
export function toUnits(limit: Limit, capacity: number): number {
    return limit.unit === "UNITS" ? limit.value : Math.round((limit.value / 100) * capacity);
}

export function toPct(limit: Limit, capacity: number): number {
    return limit.unit === "PCT" ? limit.value : Math.round((limit.value / capacity) * 100);
}

export function formatLimit({ value, unit }: Limit): string {
    return unit === "UNITS" ? `${value} ${value === 1 ? "unit" : "units"}` : `${value}%`;
}