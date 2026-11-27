// Pure helpers for the provisional forecast (provisional.ts): which forecast row the pages use, and when the
// provisional run is due. No database access, so unit tests can import them.
import { STORE_OPEN_AT } from "@/lib/config";

export const BASELINE_VERSION = "baseline-4w"; // same name as the trigger's fallback (lib/forecast/trigger.ts)
export const DECISION_TIME = "13:30"; // the model decides tomorrow at 13:30

/** Server timer: the provisional forecast is due from opening until the model's 13:30 decision. */
export function isProvisionalDue(clock: string, openAt = STORE_OPEN_AT): boolean {
    return clock >= openAt && clock < DECISION_TIME;
}

/** Readers: the active model's rows, or the provisional baseline's when the model has none yet. */
export const forecastVersionFilter = { OR: [{ isActive: true }, { version: BASELINE_VERSION }] };

/**
 * Keeps one value per key from forecast rows sorted newest first: the active model's newest row wins over any
 * baseline row, whatever their runAt.
 */
export function pickForecast<T extends { predictedQty: unknown; modelVersion: { isActive: boolean } }>(
    rows: T[],
    keyOf: (r: T) => string,
): Map<string, { qty: number; fromModel: boolean }> {
    const out = new Map<string, { qty: number; fromModel: boolean }>();
    for (const r of rows) {
        const key = keyOf(r);
        const prev = out.get(key);
        if (!prev || (!prev.fromModel && r.modelVersion.isActive)) out.set(key, { qty: Number(r.predictedQty), fromModel: r.modelVersion.isActive });
    }
    return out;
}
