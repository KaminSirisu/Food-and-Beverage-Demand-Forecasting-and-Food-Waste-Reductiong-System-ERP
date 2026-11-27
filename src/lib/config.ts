// App-wide constants. Each one marked "open decision" is waiting on the Leader (see CLAUDE.md).
// Keep them here so changing one doesn't mean searching through the pages.

export const STORE_NO = 801; // Scope: Central Salaya only

// SM3: factory order cutoff, in Bangkok time. Matches the mockup; the alert times are a separate open decision.
export const ORDER_CUTOFF = "14:00";

// S3: the store opens at this time (Bangkok). At opening the server timer saves tomorrow's provisional forecast
// (4-week same-weekday average), so the order card is ready before the first sale. The model replaces it at 13:30.
export const STORE_OPEN_AT = process.env.STORE_OPEN_AT ?? "09:00";

// S5: lines more than this % above Suggested need Area Manager approval
export const AM_APPROVAL_PCT = 20;

// SM7 / S6 waste KPI: a day's waste should stay at or below this % of that day's total sales (whole branch).
// Used by Daily Waste vs Target, Food Waste Trend, Waste Totals and the Value of Waste card (waste/target.ts).
export const WASTE_TARGET_PCT = 5;

// Header: the D365 sync shows as "Stale" if the last loaded batch is older than this
export const SYNC_STALE_HOURS = 4;

// SM5 / SM6: max units each category's display holds — the base for % alert limits.
// Demo values (Bread 60 and Pound cake 16 from the mockup). In a real store the manager would set these.
export const DISPLAY_CAPACITY: Record<string, number> = { SB: 60, ST: 30, SC: 20, SCP: 16 };