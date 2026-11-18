# Waste & Auto-Promotion Engine (`/promotions`)

Store Manager page for branch 801. It shows which SKUs will probably be wasted tonight or are over-stocked,
gives them the category's auto-discount, and lets the manager push the discount to the POS or override it
for today. **The POS is simulated**: like the factory order, a push only writes our `promotion` table.
Nothing is sent to D365 or a real POS.

Requirements: **S7** (waste risk) · **SM9** (auto-discount, engine switch, manual override) · **SM10** (push to POS) · **NFR5** (audit log).

## What is on the page

| Block | Source |
|---|---|
| 4 KPI cards: SKUs at waste risk (and how many expire today), promotions live on POS, pending push, projected waste avoided | `promotionKpis()` |
| Auto-Promotion engine switch, the two checkpoint times, POS sync and last push time | `branch_threshold.auto_promotion_enabled` (default row), `opportunityCheckAt` / `cheerCheckAt`, newest `promotion.pushed_at` today |
| Amber banner: discount per category | Branch Thresholds (category override, otherwise the branch default) |
| Table: one row per in-scope SKU with a forecast today | `buildPromotionRows()` |

## Rules (`src/lib/promotions/rules.ts`, pure)

Inputs per SKU come from `getOrderInputs()` (the same as the factory order): Left now, Model 1 rest-of-day, Model 2 tomorrow.
`computeRow()` gives `tonight = max(0, LeftNow − round(restOfDay))` and `need = ceil(tomorrow)`.

**Waste risk (S7)** — `wasteRisk(row)`

| Case | Units at risk | % |
|---|---|---|
| Last day (shelf life ≤ 1) → `EXPIRY` | `tonight` | `tonight ÷ LeftNow` |
| Multi-day → `OVERSTOCK` | `max(0, tonight − need)` (what tomorrow can't sell) | `units ÷ LeftNow` |

A SKU is **at risk** when units > 0 and % ≥ the category's `wasteRiskPct`.
The dashboard's Top Risk table and Auto-Promotions card use the same rule (`lib/dashboard/risk.ts`), so both pages agree.

**Discount (SM9)**

- Auto rate = the category's `discountPct` when the SKU is at risk **and** the engine is on, otherwise 0%.
- A saved `promotion` row for today wins: a `MANUAL` rate, or the rate an `AUTO` row was pushed at.
- Promo price = `round(price × (1 − rate/100))` in whole baht (฿13 − 20% = ฿10).

**POS status**

| Status | When |
|---|---|
| Pending push | rate > 0 and not pushed yet (no row, or a `MANUAL` row with `PENDING`) |
| Live on POS | row with `pos_status = LIVE` |
| No promotion | rate 0% (also a manual 0%) |

**Projected waste avoided** = Σ units at risk × full price, over SKUs with a discount (pending or live).

## Actions (`actions.ts`)

All of them read the branch and user from the session (G2), validate with Zod, recompute the row on the server
(the client's rate is never trusted), write in one transaction with an `audit_log` row, then `refresh()`.

| Action | Effect | Audit action |
|---|---|---|
| `pushDiscount(itemNo)` | upsert today's row with the current rate, `LIVE`, `pushed_at/by` | `PROMO_PUSH` |
| `overrideDiscount({ itemNo, discountPct })` | 0–90 %, `mode = MANUAL`, `PENDING` (or `NONE` for 0%) — push again afterwards | `PROMO_OVERRIDE` |
| `resetToAuto(itemNo)` | delete today's `MANUAL` row → back to the rule | `PROMO_RESET` |
| `setAutoPromotion(enabled)` | update the branch default threshold row | `THRESHOLD_CHANGE` |

Turning the engine **off** sets every auto rate to 0%. Manual overrides and promotions that are already live stay as they are.

## Files

```
src/app/(dashboard)/promotions/
  page.tsx                     server component: loads getPromotions()
  actions.ts                   server actions above
  _components/PromoKpis.tsx    4 KPI cards
  _components/EngineToggle.tsx engine switch (client)
  _components/TriggerBanner.tsx
  _components/PromotionTable.tsx   table + push / override buttons (client)
  _components/OverrideDialog.tsx   native <dialog> for Manual Override
  _components/PromoEmptyState.tsx  no forecast today
src/lib/promotions/rules.ts    pure rules
src/lib/promotions/rules.test.ts
src/lib/promotions/queries.ts  getPromotions() (server only)
src/lib/thresholds/queries.ts  getBranchRules(): resolved thresholds per category + engine switch
```

## Schema change

`branch_threshold.auto_promotion_enabled Boolean?` (default row only, NULL = on). After pulling, run:

```bash
npx prisma generate
```

The Leader runs `npx prisma db push` once.

## Testing

```bash
npm test     # Vitest — src/lib/promotions/rules.test.ts (19 tests)
```

The manual checklist is in [README-testing.md](../../../../README-testing.md), section 4.

**Demo data note:** with `npm run db:seed:demo`, ST068 and ST058 (last day) are at risk. No multi-day SKU is
over-stocked in the demo numbers, so SB078 shows 0% (the mockup shows 20%). To see over-stock, use
Manual Override, or raise a multi-day SKU's Left now in the factory order card.
