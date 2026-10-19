# FreshWaste ERP — schema + ingestion skeleton

Leader owns `prisma/schema.prisma` (frozen Oct 23). Member B owns everything marked `TODO(Member B)`.

## Setup (one shared Neon database)

**Leader — once**
```bash
npm install
cp .env.example .env          # paste Neon's pooled URL → DATABASE_URL, direct URL → DIRECT_URL
npx prisma db push            # creates the 17 tables in the shared database
npm run db:seed               # branch 801 + 8 SKUs + default thresholds
```
Share the `.env` values with the team privately (never commit `.env`).

**Leader — after every schema change:** edit `schema.prisma` → `npx prisma db push` → commit → tell the team.

**Member A / B**
```bash
npm install
cp .env.example .env          # paste the values the Leader sent
npx prisma generate           # after every pull that changes schema.prisma — never db push
npx tsx scripts/dry-run.ts fixtures/Sales_Entry_2022-11-05.xlsx 801   # check a file, no DB
npm run dev                   # POST /api/ingest is live
```

## How a file flows

```
Power Automate ──POST /api/ingest──▶ name check ─▶ sha256 (same file twice = DUPLICATE)
                                       │
                                       ▼
                     ImportBatch(RECEIVED) = processingId
                                       │
        stream rows (ExcelJS) ─▶ Zod check ─▶ active branch? ─▶ insert SalesLine (1,000 per batch)
                 │ bad row → ImportError      │ no → skipped       │ same line again → skipped (natural key)
                 ▼
     rebuild DailySales for each (branch, day) touched ─▶ ImportBatch(LOADED / LOADED_WITH_ERRORS) ─▶ AuditLog
```

| File | What it does | Owner |
|---|---|---|
| `prisma/schema.prisma` | 17 tables: master data, ingestion, sales, forecast, orders, alerts, audit | Leader |
| `lib/ingest/columns.ts` | The 24 export columns + per-row validation (Zod) | Member B adds rules |
| `lib/ingest/parse.ts` | Streaming Excel reader; rejects a wrong header before reading rows | done |
| `lib/ingest/batch.ts` | File name rule, size limit, duplicate check, data freshness (S9) | Member B confirms name |
| `lib/ingest/load.ts` | Insert lines, rebuild `daily_sales`, close the batch | Member B tests |
| `app/api/ingest/route.ts` | `POST` endpoint Power Automate calls | Member B tests |
| `app/api/ingest/[id]/route.ts` | `GET` status of one upload | done |
| `scripts/backfill.ts` | Load monthly history files from disk (L6) | Member B runs |
| `scripts/dry-run.ts` | Validate a file without the database | anyone |
| `fixtures/` | `…2022-11-05.xlsx` good file (branches 801 + 804); `…2022-11-06.xlsx` 3 bad rows | — |

## API contract (for the Power Automate HTTP action)

```
POST {APP_URL}/api/ingest
Headers   x-api-key: {INGEST_API_KEY}
          x-file-name: Sales_Entry_2026-11-03.xlsx
          content-type: application/octet-stream
Body      the file content (Get file content → body)

200  { "processingId": "…", "status": "LOADED", "rows": { "total": 17498, "loaded": 376, "skipped": 17122, "rejected": 0 },
       "period": { "from": "2026-11-03", "to": "2026-11-03" }, "errors": [] }
200  { "processingId": "…", "status": "DUPLICATE" }        → move file to /archive, no alert
401  bad key · 400 bad name or empty · 413 > 25 MB · 422 header mismatch / load failed → move to /failed + alert
```

## Facts from Sales_Entry_2022_11.xlsx (checked)

- 1 sheet, 24 columns, 524,947 lines, 36 branches, 1–30 Nov 2022. All lines pass validation.
- **Quantity < 0 = sale, > 0 = return** (D365 sign). 2,613 return lines. Amounts follow the same sign.
- Branch 801 = 11,285 lines/month (~376/day). A daily all-branch file ≈ 17,500 lines → ~2 s to load.
- The whole month takes ~53 s to parse → too slow for one HTTP call; use `scripts/backfill.ts`.
- No duplicate (store, terminal, transaction, line) keys → safe natural key.
- `daily_sales` rebuild checked against pandas for 801 on 5 Nov 2022: identical, and running it twice changes nothing.

## TODO(Member B) — in order

1. **L3** Power Automate: watch the export folder/email → rename to `Sales_Entry_YYYY-MM-DD.xlsx` → HTTP POST as above → move to `/archive` (200) or `/failed` (4xx) → Teams/email on failure.
2. **L4** Run the two fixtures through `POST /api/ingest`; confirm: good file = LOADED, 801 lines loaded, 804 skipped; bad file = LOADED_WITH_ERRORS with 3 errors; same file again = DUPLICATE.
3. Add any extra row rules in `columns.ts` (see the TODO there).
4. **L6** `npm run backfill -- data/Sales_Entry_2022_08.xlsx …` for Aug 2022 – Aug 2023.
5. Check `GET /api/ingest/{processingId}` shows the counts and errors.

## Not yet decided (affects this code)

- File name: report §3.4 says `{branch_code}_{YYYY-MM-DD}_export.xlsx`, but the export holds all 36 branches in one file. This code uses `Sales_Entry_YYYY-MM-DD.xlsx`; update §3.4.
- Midday file (`_1300` suffix) only if IT can export at 13:00.
- `prisma db push` and the API were not run end-to-end in the build environment (Prisma engines could not be downloaded there). Schema validated; parser and SQL tested. The Leader's first `db push` is the first real run.
