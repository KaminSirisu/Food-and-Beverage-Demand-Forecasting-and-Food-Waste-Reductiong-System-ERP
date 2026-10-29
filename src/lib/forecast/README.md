# src/lib/forecast — model inference (TypeScript)

**Owner:** Mew · branch `feature/forecast`

**Purpose:** Build the feature row for each (branch 801 × SKU × tomorrow) from `daily_sales`,
run the ONNX model with `onnxruntime-node` inside the Next.js app (NFR8 — no Python service),
and save results to the `Forecast` table.

**Done means:**
- `predict()` returns the same numbers as Python for the shared test set, within 0.001 (NFR7), with a script/test that checks it.
- `GET /api/forecast` and `GET /api/model-info` (stubs in `src/app/api/`) return real data instead of 501.
- Import with `@/lib/forecast/...`; DB access through `@/lib/db`. Do not edit `prisma/schema.prisma` — ask the Leader.

**Demo data:** `npm run db:seed:demo` creates ModelVersion `demo-stub` (isActive). When your real model goes live,
set your version `isActive = true` and `demo-stub` to `false`. Pages read only the active model, latest `runAt` per SKU.
