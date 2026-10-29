# models/ — exported ONNX models

**Owner:** Mew · branch `feature/forecast`

**Purpose:** The trained LightGBM model in ONNX format, loaded by `src/lib/forecast` with `onnxruntime-node` (NFR8).

**Done means:**
- `models/<name>.onnx` plus a small metadata file (version, trained-on date range, feature order, metrics).
- Files are small enough to commit; large intermediate artefacts stay out of git.

## Files
| File | What it is |
|---|---|
| `rest_of_day.onnx` | Model 1: units sold today from 13:30 to closing (26 inputs, 77 trees) |
| `tomorrow.onnx` | Model 2: units sold tomorrow, whole day (19 inputs, 94 trees) |
| `features.json` | Input order for each model (the ONNX input must follow it exactly) |
| `encoders.json` | Integer codes for `sku_id`, `category_id`, `branch_id`, `branch_tier_id` |
| `holidays.csv` | Thai public holidays used for `is_holiday` |
| `model_info.json` | Version, date ranges, trees, library versions, level formula, test accuracy |
| `onnx_test_cases.json` | Every test row (Apr – Aug 2023): inputs + LightGBM prediction, for the NFR7 check in `src/lib/forecast` |
| `onnx_check.md` | ONNX Runtime vs LightGBM: max difference 3.7e-07 / 2.4e-07 (limit 0.001) → PASS |

## Using the models (onnxruntime-node)
- Input name `input`, `float32`, shape `[n, 26]` or `[n, 19]`; missing values = `NaN`.
- Output = ratio to the recent sales level. **Predicted units = output × level**:
  - rest_of_day: `level = max(0.5, mean_full_7d × share_after_T_28d)` (share = 0.5 if missing)
  - tomorrow: `level = max(1, mean_full_7d)`
- Regenerate with `python ml/export_onnx.py` (see `ml/README.md`).
