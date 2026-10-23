#!/usr/bin/env python3
"""
FreshWaste ERP - Task A3: export both LightGBM models to ONNX and check they give the same predictions.

One command (run after train_models.py):
    python export_onnx.py --train-dir <Aug 2022-Mar 2023 files> --test-dir <Apr-Aug 2023 files> \
                          --model-dir <train_models.py output, e.g. a2_output> --out-dir models

What it does
    1. Loads rest_of_day.txt and tomorrow.txt saved by train_models.py.
    2. Converts each to ONNX (input name 'input', float32, feature order = features.json):
           models/rest_of_day.onnx   (26 inputs)
           models/tomorrow.onnx      (19 inputs)
    3. Rebuilds the test-month rows (Apr-Aug 2023) with the same feature code as train_models.py,
       predicts with LightGBM and with ONNX Runtime, and compares them.
    4. PASS if the largest difference is <= 0.001 for both models. Writes models/onnx_check.md.
       Exit code 1 if a check fails.
    5. Writes models/model_info.json (version, date ranges, trees, feature order, test accuracy)
       and models/onnx_test_cases.json (every test row: inputs + LightGBM prediction), so
       src/lib/forecast (onnxruntime-node) can check its own predictions against Python (NFR7).

The model output is a ratio to the recent sales level; units = ratio x level. Both are checked.
"""
import argparse, datetime, json, os, shutil, sys
import numpy as np

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from train_models import load_folder, build_features   # same data + feature code as training

TOLERANCE = 1e-3


def to_onnx(booster, n_features, path):
    import onnxmltools
    from onnxmltools.convert.common.data_types import FloatTensorType
    onx = onnxmltools.convert_lightgbm(booster, initial_types=[('input', FloatTensorType([None, n_features]))],
                                       target_opset=15)
    onnxmltools.utils.save_model(onx, path)


def check(booster, onnx_path, rows, feats):
    import onnxruntime as ort
    X = rows[feats].astype(np.float32).values                      # NaN = missing value, as in training
    p_lgb = booster.predict(rows[feats])
    p_onnx = ort.InferenceSession(onnx_path, providers=['CPUExecutionProvider']).run(
        None, {'input': X})[0].ravel()
    d_ratio = np.abs(p_onnx - p_lgb)
    d_units = np.abs(p_onnx * rows['level'].values - p_lgb * rows['level'].values)
    return {'rows': len(X), 'inputs': len(feats),
            'max_diff_ratio': float(d_ratio.max()), 'mean_diff_ratio': float(d_ratio.mean()),
            'max_diff_units': float(d_units.max()),
            'pass': bool(d_ratio.max() <= TOLERANCE and d_units.max() <= TOLERANCE)}


def main():
    ap = argparse.ArgumentParser(description='Export rest_of_day and tomorrow to ONNX and check them (Task A3).')
    ap.add_argument('--train-dir', required=True)
    ap.add_argument('--test-dir', required=True)
    ap.add_argument('--model-dir', default='a2_output', help='Folder with rest_of_day.txt, tomorrow.txt, features.json')
    ap.add_argument('--out-dir', default='models', help='Where the .onnx files are written')
    a = ap.parse_args()
    os.makedirs(a.out_dir, exist_ok=True)

    import lightgbm as lgb, onnxmltools, onnxruntime, onnx
    print(f'lightgbm {lgb.__version__} | onnxmltools {onnxmltools.__version__} | '
          f'onnxruntime {onnxruntime.__version__} | onnx {onnx.__version__}')

    feats = json.load(open(os.path.join(a.model_dir, 'features.json')))
    models = {name: lgb.Booster(model_file=os.path.join(a.model_dir, f'{name}.txt')) for name in feats}
    for name, b in models.items():
        if b.feature_name() != feats[name]:
            sys.exit(f'{name}: feature order in the model does not match features.json')

    print('[1/3] Exporting to ONNX')
    for name, b in models.items():
        path = os.path.join(a.out_dir, f'{name}.onnx')
        to_onnx(b, len(feats[name]), path)
        print(f'  {path}  ({os.path.getsize(path) / 1024:.0f} KB, {len(feats[name])} inputs, {b.num_trees()} trees)')
    for f in ('features.json', 'encoders.json', 'holidays.csv'):    # input order, category codes, holiday list travel with the models
        if os.path.exists(os.path.join(a.model_dir, f)):
            shutil.copy(os.path.join(a.model_dir, f), os.path.join(a.out_dir, f))

    print('[2/3] Rebuilding test-month rows (Apr-Aug 2023)')
    raw_train, raw_test = load_folder(a.train_dir), load_folder(a.test_dir)
    test_start = raw_test['Date'].min()
    rest, tom, _, _, _ = build_features(raw_train, raw_test, a.model_dir)
    test_rows = {'rest_of_day': rest[rest['Date'] >= test_start],
                 'tomorrow': tom[tom['target_date_m2'] >= test_start]}

    print('[3/3] ONNX vs LightGBM on the test months (tolerance <= 0.001)')
    results = {name: check(models[name], os.path.join(a.out_dir, f'{name}.onnx'), test_rows[name], feats[name])
               for name in feats}
    lines = ['| Model | Test rows | Inputs | Max diff (ratio) | Mean diff (ratio) | Max diff (units) | Result |',
             '|---|---|---|---|---|---|---|']
    for name, r in results.items():
        verdict = 'PASS' if r['pass'] else 'FAIL'
        print(f"  {name:12s} rows {r['rows']:5d} | max diff {r['max_diff_ratio']:.2e} (ratio), "
              f"{r['max_diff_units']:.2e} (units) -> {verdict}")
        lines.append(f"| {name}.onnx | {r['rows']} | {r['inputs']} | {r['max_diff_ratio']:.2e} | "
                     f"{r['mean_diff_ratio']:.2e} | {r['max_diff_units']:.2e} | {verdict} |")
    all_pass = all(r['pass'] for r in results.values())

    # ---- metadata + test cases for the TypeScript side (NFR7) ----
    acc_path = os.path.join(a.model_dir, 'accuracy.csv')
    accuracy = {}
    if os.path.exists(acc_path):
        import pandas as pd
        t = pd.read_csv(acc_path, index_col=0)
        t = t[t['period'].str.startswith('test')]
        accuracy = {k: {'WAPE_pct': float(v['WAPE %']), 'MAE': float(v['MAE']), 'Bias_pct': float(v['Bias %']),
                        'rows': int(v['rows'])} for k, v in t.iterrows()}
    level_rule = {'rest_of_day': 'max(0.5, mean_full_7d * share_after_T_28d (0.5 if missing))',
                  'tomorrow': 'max(1, mean_full_7d)'}
    info = {'version': f'v{datetime.date.today():%Y.%m.%d}', 'created': datetime.datetime.now().isoformat(timespec='seconds'),
            'store': 801, 'decision_time': '13:30', 'test_period': [str(test_start.date()), str(raw_test['Date'].max().date())],
            'training': 'fit Aug 2022 - Feb 2023, early stopping on Mar 2023, final model refit on Aug 2022 - Mar 2023',
            'libraries': {'lightgbm': lgb.__version__, 'onnxmltools': onnxmltools.__version__,
                          'onnxruntime': onnxruntime.__version__, 'onnx': onnx.__version__, 'opset': 15},
            'onnx_input': {'name': 'input', 'dtype': 'float32', 'missing_value': 'NaN'},
            'output': 'ratio to recent sales level; predicted units = output * level',
            'models': {name: {'file': f'{name}.onnx', 'trees': models[name].num_trees(), 'inputs': len(feats[name]),
                              'feature_order': feats[name], 'level': level_rule[name],
                              'onnx_vs_lightgbm_max_diff': results[name]['max_diff_ratio']} for name in feats},
            'test_accuracy': accuracy}
    json.dump(info, open(os.path.join(a.out_dir, 'model_info.json'), 'w'), indent=2)

    def r6(x):
        return None if x is None or (isinstance(x, float) and np.isnan(x)) else round(float(x), 6)
    cases = {'tolerance': TOLERANCE, 'note': 'inputs in feature_order; null = NaN (missing). '
             'expected_output = LightGBM prediction (ratio). predicted_units = expected_output * level.'}
    for name in feats:
        rows = test_rows[name]
        pred = models[name].predict(rows[feats[name]])
        date_col = 'Date' if name == 'rest_of_day' else 'target_date_m2'
        cases[name] = {'feature_order': feats[name], 'cases': [
            {'sku': s_, 'date': str(d_.date()), 'inputs': [r6(v) for v in x_], 'level': r6(l_),
             'expected_output': r6(p_), 'predicted_units': r6(p_ * l_)}
            for s_, d_, x_, l_, p_ in zip(rows['sku'], rows[date_col], rows[feats[name]].astype(np.float32).values,
                                          rows['level'].values, pred)]}
    json.dump(cases, open(os.path.join(a.out_dir, 'onnx_test_cases.json'), 'w'), separators=(',', ':'))
    print(f'  wrote {a.out_dir}/model_info.json and {a.out_dir}/onnx_test_cases.json')
    with open(os.path.join(a.out_dir, 'onnx_check.md'), 'w', encoding='utf-8') as fh:
        fh.write('# ONNX check\n\nONNX Runtime vs LightGBM predictions on the test months '
                 f'({test_start.date()} - {raw_test["Date"].max().date()}), tolerance <= {TOLERANCE}.\n\n')
        fh.write(f'lightgbm {lgb.__version__} | onnxmltools {onnxmltools.__version__} | '
                 f'onnxruntime {onnxruntime.__version__} | opset 15 | input name "input", float32\n\n')
        fh.write('\n'.join(lines) + f'\n\nOverall: {"PASS" if all_pass else "FAIL"}\n')
    print(f'\nOverall: {"PASS" if all_pass else "FAIL"} | saved {a.out_dir}/onnx_check.md')
    sys.exit(0 if all_pass else 1)


if __name__ == '__main__':
    main()
