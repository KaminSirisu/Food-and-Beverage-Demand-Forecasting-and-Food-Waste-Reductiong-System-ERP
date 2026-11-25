# ml/ — model training (Python)

**Owner:** Mew · branch `feature/forecast`

**Purpose:** Train the two LightGBM models (`rest_of_day`, `tomorrow`) that forecast demand per SKU for branch 801 at 13:30,
export them to ONNX and produce the files `src/lib/forecast` needs to check itself against Python (NFR7, ≤ 0.001 difference).

## How to run
Put the Sales Entry exports in `data/train/` (Aug 2022 – Mar 2023) and `data/test/` (Apr – Aug 2023).
`data/` is git-ignored, so the 66 MB files never get committed.

```bash
pip install -r ml/requirements.txt
python ml/train_models.py --train-dir data/train --test-dir data/test --out-dir ml/output        # Task A2
python ml/export_onnx.py  --train-dir data/train --test-dir data/test --model-dir ml/output --out-dir models   # Task A3
python ml/export_feature_samples.py --train-dir data/train --test-dir data/test --out ml/feature_samples.json  # Task A4
```

| Script | What it does |
|---|---|
| `train_models.py` | Builds features at 13:30, trains `rest_of_day` and `tomorrow` (fit Aug 2022 – Feb 2023, validate Mar 2023, refit incl. March), prints WAPE / MAE / Bias for both models and both baselines on Mar 2023 and Apr – Aug 2023. `--no-refit` keeps the Aug – Feb model. |
| `export_onnx.py` | Exports both models to `models/*.onnx`, checks ONNX vs LightGBM on the test months (≤ 0.001), writes `model_info.json` (incl. `train_period` and `validation_period`) and `onnx_test_cases.json` (missing values are `null`). |
| `export_feature_samples.py` | Writes `feature_samples.json`: the Python features of 20 sample branch-SKU-days plus the daily inputs, so `src/lib/forecast/features.check.ts` can compare the TypeScript features one by one. `--all` exports every row both models use instead of 20 (bigger file; `features.check.ts <file>` accepts it). |

Same data + same versions → identical models every run (seed 42).

## Results (test, Apr – Aug 2023, branch 801, 8 SKUs)
| | WAPE % | MAE | Bias % |
|---|---|---|---|
| Model 1 rest_of_day | 45.2 | 1.99 | −10.4 |
| Baseline 1 (7-day avg × afternoon share) | 52.4 | 2.30 | −2.2 |
| Model 2 tomorrow | 34.5 | 2.35 | −17.3 |
| Baseline 2 (same weekday last week) | 37.1 | 2.52 | −2.4 |

With `--no-refit`: rest_of_day 45.1, tomorrow 33.3 (WAPE %).

## Not in this folder
The order rule (buffer %, shelf-life stock simulation, k per SKU) comes from Cell 7 of the training notebook (`ERP_Forecast.ipynb`, in Notion).
It is ported to TypeScript in `src/lib/forecast/k.ts`; the TypeScript port gave the same k as the notebook code on three 56-day windows.

Note: the scripts read the Sales Entry .xlsx exports directly, not `daily_sales`; `src/lib/forecast/daily.ts` builds the same features from `daily_sales`.
