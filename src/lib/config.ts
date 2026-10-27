// App-wide constants. Each one marked "open decision" is waiting on the Leader (see CLAUDE.md).
// Keep them here so changing one doesn't mean searching through the pages.

export const STORE_NO = 801; // Scope: Central Salaya only

// SM3: factory order cutoff, in Bangkok time. Matches the mockup; the alert times are a separate open decision.
export const ORDER_CUTOFF = "14:00";

// S5: lines more than this % above Suggested need Area Manager approval
export const AM_APPROVAL_PCT = 20;

// Daily Waste vs Target chart (฿ per day). Constant for now; could move to BranchThreshold later.
export const DAILY_WASTE_TARGET = 1200;

// Header: the D365 sync shows as "Stale" if the last loaded batch is older than this
export const SYNC_STALE_HOURS = 4;