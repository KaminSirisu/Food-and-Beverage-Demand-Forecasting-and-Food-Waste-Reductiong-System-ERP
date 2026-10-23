# ml/ — model training (Python)

**Owner:** Mew · branch `feature/forecast`

**Purpose:** Train the LightGBM model that forecasts tomorrow's demand per SKU for branch 801,
reading `daily_sales` (never `sales_line`). Notebooks and training scripts live here.

**Done means:**
- A reproducible training script (`python ml/train.py` or similar) with pinned requirements.
- Model exported to ONNX in `models/`, with the feature list and version recorded.
- A test-set file of inputs + Python predictions that `lib/forecast` can compare against (NFR7, ≤ 0.001 difference).
- Accuracy numbers (e.g. MAE/WAPE vs. a naive baseline) written up for the report.

## How to run
Put the Sales Entry exports in `data/train/` (Aug 2022 – Mar 2023) and `data/test/` (Apr – Aug 2023).
`data/` is git-ignored, so the 66 MB files never get committed.

```bash
pip install -r ml/requirements.txt
python ml/train_models.py --train-dir data/train --test-dir data/test --out-dir ml/output        # Task A2
python ml/export_onnx.py  --train-dir data/train --test-dir data/test --model-dir ml/output --out-dir models   # Task A3
```

| Script | What it does |
|---|---|
| `train_models.py` | Builds features at 13:30, trains `rest_of_day` and `tomorrow` (fit Aug 2022 – Feb 2023, validate Mar 2023, refit incl. March), prints WAPE / MAE / Bias for both models and both baselines on Mar 2023 and Apr – Aug 2023. `--no-refit` keeps the Aug – Feb model. |
| `export_onnx.py` | Exports both models to `models/*.onnx`, checks ONNX vs LightGBM on the test months (≤ 0.001), writes `model_info.json` and `onnx_test_cases.json`. |

Same data + same versions → identical models every run (seed 42).

## Results (test, Apr – Aug 2023, branch 801, 8 SKUs)
| | WAPE % | MAE | Bias % |
|---|---|---|---|
| Model 1 rest_of_day | 45.2 | 1.99 | −10.4 |
| Baseline 1 (7-day avg × afternoon share) | 52.4 | 2.30 | −2.2 |
| Model 2 tomorrow | 34.5 | 2.35 | −17.3 |
| Baseline 2 (same weekday last week) | 37.1 | 2.52 | −2.4 |

With `--no-refit`: rest_of_day 45.1, tomorrow 33.3 (WAPE %).

Note: the scripts currently read the Sales Entry .xlsx exports directly, not `daily_sales`.
