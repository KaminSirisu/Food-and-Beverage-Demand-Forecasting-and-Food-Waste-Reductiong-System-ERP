# src/lib/forecast — model inference (TypeScript)

**Owner:** Mew · branch `feature/forecast`

**Purpose:** Build the feature row for each (branch 801 × SKU × day) from `daily_sales`, run the two ONNX models with
`onnxruntime-node` inside the Next.js app (NFR8 — no Python service), and save the results to the `Forecast` table.
The decision time is **13:30** on day D: model 1 (`rest_of_day`) predicts the units sold on D from 13:30 to closing,
model 2 (`tomorrow`) predicts the units sold on D+1. Predicted units = model output × level (see `models/README.md`).

## Files
| File | What it does |
|---|---|
| `features.ts` | Pure feature builder (no DB). Same numbers as `ml/train_models.py` (NFR7). |
| `daily.ts` | Loads `daily_sales` for branch 801 and calls the feature builder (`buildFeaturesFromDb`). |
| `model.ts` | One cached ONNX session per model; `predict(rows)` → units (null when the model does not cover the row). |
| `forecast.ts` | `forecastForDay(store, targetDate)`: features → ONNX → one row per SKU. Used by `GET /api/forecast`. |
| `info.ts` | Model metadata from `models/model_info.json`. Used by `GET /api/model-info`. |
| `save.ts` | `registerModels()` (ModelVersion rows) and `saveForecast()` (TOMORROW + REST_OF_DAY rows with the model version, FA7). |
| `run-forecast.ts` | Command line for `save.ts` (one day, or a backtest over a date range). |
| `k.ts`, `choose-k.ts` | Production multiplier k per SKU from the last 56 days → `models/k_plan.json` (port of Cell 7 of the training notebook). |
| `trigger.ts` | Auto's L7 trigger after a daily load: calls `/api/forecast` (needs `APP_URL`), otherwise a 4-week baseline. |
| `*.check.ts` | Checks, see below. |

## API
`GET /api/forecast?store=801&date=YYYY-MM-DD` — `date` is the day to forecast (default: tomorrow, Bangkok); it is decided at 13:30 of the day before.
```
200 { store, date, decisionDate, decisionTime, modelVersion,
      rows: [{ itemNo, nameEn, onSale, predictedQty, restOfDay }],   predictedQty = units on `date`
      restOfDayRows: [{ itemNo, restOfDay }],                         units still to sell on decisionDate
      notCovered: [itemNo] }                                          not on sale, or no history yet
400 bad store or date · 404 no sales loaded for the day before · 500 error
```
The route only computes; `saveForecast()` (or `trigger.ts`) writes to the table. `GET /api/model-info` returns version, training date and data range.

## Checks (NFR7: TypeScript and Python must agree within 0.001)
```bash
npx tsx src/lib/forecast/features.check.ts     # 20 sample days: TS features == Python features (900 values)
npx tsx src/lib/forecast/predict.check.ts      # ONNX in Node vs LightGBM, every test row (1,107 + 1,106 rows)
npx tsx src/lib/forecast/forecast.check.ts     # sample days → makeForecast() vs Python predictions (no DB)
npx tsx src/lib/forecast/features.db.check.ts  # same 20 days but built from daily_sales (needs the history loaded)
```
**Live mode:** on the last day of the series nothing is known about D+1, so the tomorrow model assumes D+1 stays on sale (`features.ts`).
The features need 28 days of history before D; a SKU without it is returned in `notCovered`.

## Save forecasts and choose k (A7)
```bash
npx tsx src/lib/forecast/run-forecast.ts --register                         # ModelVersion rows, not active
npx tsx src/lib/forecast/run-forecast.ts --date 2023-05-06                  # one day: TOMORROW for that date + REST_OF_DAY for the day before
npx tsx src/lib/forecast/run-forecast.ts --from 2023-04-02 --to 2023-04-30  # backtest (runAt = 13:30 the day before, safe to rerun)
npx tsx src/lib/forecast/run-forecast.ts --register --activate              # make the real model the active one
npx tsx src/lib/forecast/choose-k.ts [--asof 2023-04-30] [--no-write]       # k per SKU from the last 56 days → models/k_plan.json
```
- The pages read only the **active** ModelVersion (newest `runAt` per SKU): the order screen uses REST_OF_DAY rows for today and TOMORROW rows for tomorrow.
  `--activate` turns the other versions of that kind off (for example `demo-stub`), so the Analytics page then shows the real model.
- `run-forecast.ts` refuses to run when `DATABASE_URL` points to Neon unless `--neon` is given; a write to the shared database needs the Leader's OK.
- `k_plan.json` is written for the order rule `max(0, k × F_tomorrow × (1 + Buffer%) − Carry)`; the order screen does not use k yet (open decision).

## Testing without Neon
`npm run backfill` loads the monthly files (Aug 2022 – Aug 2023) into any Postgres; the checks above and `run-forecast.ts` then run against it.
Set `DATABASE_URL` and `DIRECT_URL` in the same terminal first (a shell variable wins over `.env`), and run `prisma db push` only on a local database.

## Demo data
`npm run db:seed:demo` creates ModelVersion `demo-stub` (active only while no real model of that kind is active).
