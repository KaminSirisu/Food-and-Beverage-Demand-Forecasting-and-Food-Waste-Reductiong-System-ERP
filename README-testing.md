# FreshWaste ERP — testing

Three layers: **unit tests** (Vitest, pure maths), **UI tests** (Playwright, real app + Neon), and the
**manual test** below (a person checks the page against the mockup before a demo or a merge to `main`).

## 0. Prepare the data (all layers except unit tests)

```bash
npm run db:seed          # branch 801, 8 SKUs, default thresholds
npm run db:seed:demo     # today's forecasts + 30 days of history, waste and an e2e user
```

`db:seed:demo` is idempotent: run it again any time (e.g. the next day, so "today" moves) and it rebuilds
its own rows. Days that have real ingested sales (`sales_line` for 801) are never touched.

## 1. Unit tests — Vitest

```bash
npm test
```

Covers `src/lib/analytics/metrics.ts` (variance %, MAPE, RMSE, Good / Fair / Review bands, filling missing
days, waste totals — 16 tests) and `src/lib/promotions/rules.ts` (waste risk by expiry and over-stock, promo price,
auto / manual rates, POS status, KPI cards, dashboard risk rule — 19 tests). Expected: **35 passed**. No database needed.

## 2. UI tests — Playwright

```bash
npx playwright install chromium   # once per machine
npm run test:e2e                  # uses `npm run dev` on :3000 (starts it if it isn't running)
```

Without touching your dev server (production build on :3001):

```bash
npm run build && E2E_PORT=3001 npm run test:e2e
```

Expected: **6 passed**. Login is automatic: `e2e/global-setup.ts` signs a session cookie for
`e2e-manager@freshwaste.test` (created by `db:seed:demo`, no password). Needs `SESSION_SECRET` in `.env`.
On failure, open the report: `npx playwright show-report`.

## 3. Manual test — Forecast vs. Actual Analytics (`/analytics`)

**Before you start**
- Data prepared (step 0), `npm run dev` running, browser at desktop width (≥ 1280 px).
- Log in with your own invited Store Manager account for branch 801 (`npx tsx prisma/invite.ts <email> 801`).
  The e2e user has no password and can't log in by hand.
- Have the mockup open next to the browser.

Tick each box. If a result differs, note the case ID, what you saw and a screenshot.

### A. Page load and layout

| ID | Steps | Expected |
|---|---|---|
| A1 | Click **Forecast vs. Actual Analytics** in the sidebar | URL is `/analytics`; sidebar item highlighted (green bar) |
| A2 | Look at the header area | Title "Forecast vs. Actual Analytics"; subtitle ends with "at Central Salaya." |
| A3 | Look at the model badge (top right) | "Model: LightGBM ONNX · demo-stub", then "trained ‹today› · data ‹today − 90 d› → ‹yesterday›" |
| A4 | Scroll the whole page | In order: filters, forecast line chart, Food Waste Trend + Waste Totals side by side, SKU Forecast Accuracy table, blue disclaimer box |
| A5 | Reload with the browser's dev tools console open | No red errors in the console |

### B. Forecast vs actual chart (S8)

| ID | Steps | Expected |
|---|---|---|
| B1 | 7-Day selected (default) | Subtitle "Units per day · 8 SKUs · last 7 days (to yesterday)"; 7 x-axis labels, the last is **yesterday** (`d/M`) |
| B2 | Look at the lines | Dashed indigo = forecast, solid green + light fill = actual; green dot on the last point |
| B3 | Compare the two lines | They stay close (demo noise ±8–30 %); y-axis starts at 0 with round steps |

### C. Range toggle

| ID | Steps | Expected |
|---|---|---|
| C1 | Click **30-Day** | URL gets `?range=30`; button turns dark; chart subtitle says "last 30 days"; about 7 date labels spread over 30 days |
| C2 | Check the waste chart | "last 30 days", 30 thin bars |
| C3 | Check the table subtitle | "…over the selected 30-day window"; MAPE / RMSE values change |
| C4 | Click **7-Day** | `range` disappears from the URL; everything back to the 7-day view |
| C5 | Browser **Back** button | Returns to the previous range |

### D. Category filter

| ID | Steps | Expected |
|---|---|---|
| D1 | Open the category dropdown | All categories, Bread, Cake slice, Pound cake, Thai dessert |
| D2 | Choose **Bread** | URL `?category=SB`; chart "3 SKUs"; table shows only SB062, SB078, SB094 |
| D3 | Choose **Thai dessert** | 2 rows: ST058, ST068 |
| D4 | Choose **Pound cake** | 1 row: SCP1993 |
| D5 | Choose **All categories** | 8 rows; `category` removed from the URL |
| D6 | With Bread selected, click **30-Day** | Both kept: `?category=SB&range=30` |
| D7 | Any category | Waste chart and tiles do **not** change (waste is branch-level) |

### E. Waste (charts and totals)

Values come from `WASTE_30_DAYS` in `prisma/seed-demo.ts`; they're relative to today, so they're the same any day.

| ID | Steps | Expected |
|---|---|---|
| E1 | 7-Day view, Food Waste Trend | 7 bars ending **today**; dashed line labelled "Target ฿1,200" |
| E2 | Bar colours | Over ฿1,200 = red (3 bars: 1st, 2nd, last); others green |
| E3 | Hover a bar | Tooltip "YYYY-MM-DD: ฿value" |
| E4 | Waste Totals tiles | Last 7 days **฿8,074** · Last 30 days **฿34,584** · 7-day avg **฿1,153** (red, over target) · Days over target (30d) **11** (red) |
| E5 | Note under the tiles | "11 of the last 30 days went over the ฿1,200 daily target." |
| E6 | Open `/` (dashboard) | Daily Waste vs Target chart unchanged: same 7 values, "Today" label, 3 over target |

### F. SKU accuracy table (S8, NFR6)

| ID | Steps | Expected |
|---|---|---|
| F1 | All categories, 7-Day | 8 rows, sorted by SKU code; Thai name on top, code below |
| F2 | Pick one row and check by hand | Variance % = (Actual − Forecast) / Forecast × 100, rounded, with + or − |
| F3 | Accuracy badges | MAPE < 10 % → green **Good**; 10–14.9 % → amber **Fair**; ≥ 15 % → red **Review** |
| F4 | Variance colour | Values ≥ +20 % or ≤ −20 % shown in **red bold**; others normal |
| F5 | Compare SB078 and ST068 in 30-Day | SB078 (smallest demo noise) is not "Review"; ST068 (largest) is not "Good" |
| F6 | Table subtitle | "Latest day ‹yesterday›" — Forecast / Actual columns are yesterday's numbers |

### G. Bad input and edge cases

| ID | Steps | Expected |
|---|---|---|
| G1 | Open `/analytics?range=999` | 7-day view, no error page |
| G2 | Open `/analytics?category=XX` | All 8 SKUs, dropdown shows "All categories" |
| G3 | Open `/analytics?category=sb` (lower case) | All 8 SKUs (codes are upper case) |
| G4 | Log out, open `/analytics` | Redirected to `/login` (G2 / NFR4) |
| G5 | *(optional, shared DB — tell the team first)* deactivate the demo model in Neon: `update model_version set is_active=false where version='demo-stub'` | Page still loads using the newest model; run `npm run db:seed:demo` afterwards to restore |

### H. Look and feel

| ID | Steps | Expected |
|---|---|---|
| H1 | Compare with the mockup side by side | Same sections, order, colours (indigo forecast, green actual, red/green bars) |
| H2 | Resize to ~1024 px | Waste chart and totals stack or stay side by side without overlapping; table scrolls sideways if needed |
| H3 | Keyboard: Tab through the filters | 7-Day, 30-Day and the dropdown get a visible focus ring and work with Enter / arrow keys |

> Known limitation: below ~768 px the shared sidebar layout squeezes every page (not specific to `/analytics`).

### Sign-off

| Date | Tester | Branch / commit | Result (all pass / failed IDs) |
|---|---|---|---|
| | | | |

## 4. Manual test — Waste & Auto-Promotion Engine (`/promotions`)

**Before you start:** data prepared (step 0), `npx prisma db push` done for `auto_promotion_enabled`,
`npm run dev` running, logged in as a Store Manager of 801, mockup open next to the browser.
The POS is simulated: nothing is sent outside the app.

| ID | Steps | Expected |
|---|---|---|
| P1 | Click **Waste & Auto-Promotion Engine** in the sidebar | URL `/promotions`; item highlighted; title "Waste Mitigation & Automated Promotion Management" |
| P2 | Look at the KPI cards | "SKUs at waste risk" = 2, "2 expire today" (ST068, ST058); Pending push 2 "ST058 · ST068"; Live 0 |
| P3 | Look at the table | 8 rows max, 1-day items first (red shelf life), 2-day amber; ST068 15% → ฿11, ST058 15% → ฿30, others 0% "No promotion" |
| P4 | Banner | "Promotion trigger by category: …" shows the rates from Branch Thresholds; link opens `/thresholds` |
| P5 | **Push Discount to POS** on ST068 | Green toast; button becomes "Pushed ✓"; status "Live on POS"; Live card 1 "ST068 15%"; badge "Last push HH:mm" |
| P6 | **Manual Override** on SB078 → 25 → Save rate | Rate 25% with blue "Manual" chip; promo price ฿10; status "Pending push"; Push button enabled |
| P7 | Manual Override on SB078 → **Back to auto** | Rate back to 0% "Auto"; "No promotion" |
| P8 | Manual Override → type 95 | Save disabled / input red (max 90) |
| P9 | Turn the engine switch **off** | Text "Off · …"; ST058 rate 0% (not pushed yet); ST068 stays Live; manual overrides kept |
| P10 | Turn it **on** again, reload | Switch stays on after reload (saved) |
| P11 | Change Thai dessert discount on `/thresholds` to 25%, come back | ST058 now 25% (ST068 keeps its pushed 15%) |
| P12 | Open the dashboard `/` | Auto-Promotions card lists the same SKUs and rates as this page |
| P13 | Width 375 px | Table scrolls sideways inside its card; no page-wide horizontal scroll |

To repeat the test from a clean state, delete today's rows: `promotion` where `store_no = 801` and `promo_date` = today
(e.g. in Prisma Studio), or wait for the next day and re-run `npm run db:seed:demo`.
