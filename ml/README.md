# ml/ — model training (Python)

**Owner:** Mew · branch `feature/forecast`

**Purpose:** Train the LightGBM model that forecasts tomorrow's demand per SKU for branch 801,
reading `daily_sales` (never `sales_line`). Notebooks and training scripts live here.

**Done means:**
- A reproducible training script (`python ml/train.py` or similar) with pinned requirements.
- Model exported to ONNX in `models/`, with the feature list and version recorded.
- A test-set file of inputs + Python predictions that `lib/forecast` can compare against (NFR7, ≤ 0.001 difference).
- Accuracy numbers (e.g. MAE/WAPE vs. a naive baseline) written up for the report.
