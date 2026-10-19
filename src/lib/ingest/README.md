# src/lib/ingest — sales file ingestion

**Owner:** Auto · branch `feature/ingestion` (with `src/app/api/ingest/`, `scripts/`, `fixtures/`, `power-automate/`)

**Purpose:** Stream a D365 `Sales_Entry` .xlsx (ExcelJS) → validate each row (Zod) → insert `SalesLine` for active
branches → rebuild `daily_sales` → close the `ImportBatch`. Full flow, file roles and API contract: [`README-ingest.md`](../../../README-ingest.md).

| File | Role |
|---|---|
| `columns.ts` | 24 export columns + per-row validation |
| `parse.ts` | Streaming reader; rejects a wrong header |
| `batch.ts` | File name rule, size limit, duplicate check (sha256), freshness (S9) |
| `load.ts` | Insert lines, rebuild `daily_sales`, finish the batch |

**Done means** (the `TODO(Member B)` list in README-ingest.md):
- Fixtures pass: 11-05 = LOADED (516 lines for 801), same file again = DUPLICATE, 11-06 = LOADED_WITH_ERRORS (3 errors).
- Extra row rules found on real files added in `columns.ts`.
- History Aug 2022 – Aug 2023 loaded with `npm run backfill`.
- File-name pattern agreed with the Power Automate flow and the report §3.4.
