# FreshWaste ERP — project guide for Claude Code

Senior project (SIIT, SU4-2026). A decision layer on top of Microsoft Dynamics 365 for a Thai bakery chain:
forecast tomorrow's demand per SKU, suggest the factory order, and raise shortage / waste alerts during the day.
Code freeze **Nov 10, 2026**; final presentation **Nov 15, 2026**.

## Scope (do not widen)
- **One role:** Store Manager of **branch 801** (Central Salaya). No Area Manager / IT Admin screens.
- **8 SKUs:** SC220, SB094, SB062, SB078, ST058, SC076, SCP1993, ST068 (seeded in `prisma/seed.ts`).
- Orders are simulated: saved in our DB, never sent to D365.
- Sidebar and navbar are done. Remaining UI work = the main content of each page.

## Stack
- One Next.js (App Router) + TypeScript app: pages, API routes, alert logic, model inference (report NFR8).
- PostgreSQL on **Neon**, accessed with **Prisma**. `DATABASE_URL` = pooled, `DIRECT_URL` = direct.
- Forecast: LightGBM trained in Python (`ml/`), exported to ONNX (`models/`), run in TypeScript with `onnxruntime-node`.
  No separate Python service. TypeScript and Python predictions must match within 0.001 (NFR7).
- Ingestion: Power Automate → `POST /api/ingest` (raw .xlsx body, `x-api-key`, `x-file-name`) → ExcelJS stream → Zod → Prisma.

## Who owns what
| Area | Owner | Paths |
|---|---|---|
| Schema, seed, all pages, alert engine | Leader | `prisma/`, `app/(store)/`, `components/`, `lib/alerts/` |
| Forecast model + inference | Mew | `ml/`, `models/`, `lib/forecast/`, `app/api/forecast/`, `app/api/model-info/` |
| Data pipeline | Auto | `lib/ingest/`, `app/api/ingest/`, `scripts/`, `fixtures/`, `power-automate/` |

Branches: `main` (Leader merges), `feature/forecast` (Mew), `feature/ingestion` (Auto), `feature/app` (Leader).

## Rules
- **Only the Leader changes `prisma/schema.prisma` and runs `npx prisma db push`.** Everyone else runs `npx prisma generate`.
- Never commit `.env` or real D365 exports (`data/`). Test files live in `fixtures/` (small).
- Do not delete or rewrite the existing sidebar / navbar / layout components.
- Keep requirement IDs (SM3, S4, NFR7 …) in comments where code implements them — the report cites them.

## Data facts (checked on Sales_Entry_2022_11.xlsx)
- 24 columns, header row 1, one sheet; all 36 branches in one file. Only active branches (801) are loaded.
- **Quantity < 0 = sale, > 0 = return** (D365 sign). Amounts follow the same sign.
- `daily_sales` (branch × SKU × day) is rebuilt after each load; the model and pages read it, not `sales_line`.
- Branch 801 sells ~5 units/day of most in-scope SKUs (low volume).

## Order rule (pending final decision — see open decisions)
Report S4: `Suggested = Need − Usable` (Usable = leftover still sellable tomorrow, 0 on its last day).
Slide 6: `max(0, k × Tomorrow × (1 + Buffer%) − Carry)`. Lines > 20% above Suggested are flagged "Needs AM approval" (S5).

## Open decisions (ask the Leader before building on them)
- Order formula (above) · default alert times (2 PM / 6 PM vs 14:30 / 17:00) · midday export from D365 · stock data source.

## Commands
```bash
npm run dev                      # app on :3000
npx prisma generate              # after pulling schema changes
npx prisma db push               # Leader only
npm run db:seed                  # branch 801, 8 SKUs, default thresholds
npx tsx scripts/dry-run.ts <file.xlsx> 801       # validate a file without the DB
npm run backfill -- data/Sales_Entry_2022_08.xlsx  # load history
```
