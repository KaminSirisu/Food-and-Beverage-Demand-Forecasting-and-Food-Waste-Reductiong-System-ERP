# models/ — exported ONNX models

**Owner:** Mew · branch `feature/forecast`

**Purpose:** The trained LightGBM model in ONNX format, loaded by `src/lib/forecast` with `onnxruntime-node` (NFR8).

**Done means:**
- `models/<name>.onnx` plus a small metadata file (version, trained-on date range, feature order, metrics).
- Files are small enough to commit; large intermediate artefacts stay out of git.
