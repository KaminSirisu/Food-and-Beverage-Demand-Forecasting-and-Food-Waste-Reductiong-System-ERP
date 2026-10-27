# ONNX check

ONNX Runtime vs LightGBM predictions on the test months (2023-04-01 - 2023-08-31), tolerance <= 0.001.

lightgbm 4.6.0 | onnxmltools 1.16.0 | onnxruntime 1.23.2 | opset 15 | input name "input", float32

| Model | Test rows | Inputs | Max diff (ratio) | Mean diff (ratio) | Max diff (units) | Result |
|---|---|---|---|---|---|---|
| rest_of_day.onnx | 1107 | 26 | 3.74e-07 | 3.05e-08 | 7.83e-07 | PASS |
| tomorrow.onnx | 1106 | 19 | 2.43e-07 | 2.22e-08 | 9.66e-07 | PASS |

Overall: PASS
