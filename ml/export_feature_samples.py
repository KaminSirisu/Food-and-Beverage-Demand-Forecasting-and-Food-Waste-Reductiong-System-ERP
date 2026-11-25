#!/usr/bin/env python3
"""
FreshWaste ERP - Task A4: export the Python features of 20 sample branch-SKU-days for the TypeScript check.

    python ml/export_feature_samples.py --train-dir data/train --test-dir data/test --out ml/feature_samples.json

The JSON holds
    daily     per SKU and day, the same numbers daily_sales gives TypeScript:
              qtySold, qtyBeforeCutoff, priceBeforeCutoff, discountBeforeCutoff, grossBeforeCutoff
    openDays  days the branch sold anything (any item)
    holidays  Thai public holidays (holidays.csv)
    samples   20 (SKU, day) rows with every rest_of_day and tomorrow feature as Python computes it
src/lib/forecast/features.check.ts rebuilds the features from `daily` and compares them one by one.
"""
import argparse, json, os, sys, tempfile
import numpy as np
import pandas as pd

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from train_models import load_folder, build_features, SKUS, CUTOFF_T   # same feature code as training

N_SAMPLES = 20


def num(x):
    return None if x is None or (isinstance(x, float) and np.isnan(x)) else float(x)


def daily_inputs(raw_train, raw_test):
    """What daily_sales holds for the in-scope SKUs (sales only, Quantity < 0)."""
    raw = pd.concat([raw_train, raw_test], ignore_index=True)
    raw = raw[raw['Quantity'] < 0].copy()
    raw['qty'] = raw['Quantity'].abs()
    t = raw['Time'].str.extract(r'(\d{1,2}):(\d{2})').astype(float)
    raw['hour'] = t[0] + t[1] / 60
    raw['before_T'] = raw['hour'] < int(CUTOFF_T[:2]) + int(CUTOFF_T[3:]) / 60
    open_days = sorted(d.strftime('%Y-%m-%d') for d in raw['Date'].unique())
    d = raw[raw['Item No_'].isin(SKUS)].copy()
    d['gross'] = d['Price'] * d['qty']
    d['disc'] = d['Discount Amount'].abs()
    bt = d[d['before_T']]
    full = d.groupby(['Item No_', 'Date'])['qty'].sum()
    to_t = bt.groupby(['Item No_', 'Date'])['qty'].sum()
    price = bt.sort_values('hour').groupby(['Item No_', 'Date'])['Price'].last()
    disc = bt.groupby(['Item No_', 'Date'])[['disc', 'gross']].sum()
    out = {s: [] for s in SKUS}
    for (s, day), q in full.items():
        k = (s, day)
        out[s].append({'date': day.strftime('%Y-%m-%d'), 'qtySold': float(q),
                       'qtyBeforeCutoff': float(to_t.get(k, 0.0)),
                       'priceBeforeCutoff': num(price.get(k, np.nan)),
                       'discountBeforeCutoff': float(disc['disc'].get(k, 0.0)),
                       'grossBeforeCutoff': float(disc['gross'].get(k, 0.0))})
    return open_days, out


def main():
    ap = argparse.ArgumentParser(description='Export 20 sample feature rows for the TypeScript check (Task A4).')
    ap.add_argument('--train-dir', required=True)
    ap.add_argument('--test-dir', required=True)
    ap.add_argument('--out', default='ml/feature_samples.json')
    ap.add_argument('--all', action='store_true', help='Export every row both models use, not just 20 (bigger file)')
    a = ap.parse_args()
    tmp = tempfile.mkdtemp()                                   # holidays.csv from build_features goes here

    raw_train, raw_test = load_folder(a.train_dir), load_folder(a.test_dir)
    rest, tom, f_rest, f_tom, enc = build_features(raw_train, raw_test, tmp)
    holidays = sorted(pd.read_csv(os.path.join(tmp, 'holidays.csv'))['date'].astype(str).str[:10])
    open_days, daily = daily_inputs(raw_train, raw_test)

    # 20 rows that exist for both models, spread over the 8 SKUs and the whole period,
    # plus the cases most likely to break: discount before 13:30, missing ratio_to_T,
    # first day back after a not-on-sale gap, holidays.
    both = rest.merge(tom[['sku', 'Date']], on=['sku', 'Date'])
    picks = []
    def add(df, n):
        for _, r in df.sample(min(n, len(df)), random_state=42).iterrows():
            if (r['sku'], r['Date']) not in [(p['sku'], p['Date']) for p in picks] and len(picks) < N_SAMPLES:
                picks.append(r)
    add(both[both['discount_pct'] > 0], 2)
    add(both[both['ratio_to_T'].isna()], 2)
    add(both[both['is_holiday'] == 1], 1)
    add(both[both['lag_full_1'].isna() & both['mean_full_7d'].notna()], 1)          # back after a gap
    for s in SKUS:                                                                    # 1-2 per SKU
        add(both[both['sku'] == s], 2)
    if a.all:
        picks = [r for _, r in both.iterrows()]

    rest_i = rest.set_index(['sku', 'Date']); tom_i = tom.set_index(['sku', 'Date'])
    samples = []
    for p in sorted(picks, key=lambda r: (r['Date'], r['sku'])):
        k = (p['sku'], p['Date'])
        samples.append({'sku': p['sku'], 'date': p['Date'].strftime('%Y-%m-%d'),
                        'restOfDay': {'features': {f: num(rest_i.loc[k, f]) for f in f_rest},
                                      'level': num(rest_i.loc[k, 'level'])},
                        'tomorrow': {'features': {f: num(tom_i.loc[k, f]) for f in f_tom},
                                     'level': num(tom_i.loc[k, 'level'])}})

    json.dump({'note': 'Python features for the A4 TypeScript check. null = NaN (missing).',
               'trainEnd': raw_train['Date'].max().strftime('%Y-%m-%d'),
               'skus': SKUS, 'encoders': enc, 'featureOrder': {'rest_of_day': f_rest, 'tomorrow': f_tom},
               'openDays': open_days, 'holidays': holidays, 'daily': daily, 'samples': samples},
              open(a.out, 'w'), separators=(',', ':'))
    print(f'Saved {a.out}: {len(samples)} samples, {sum(len(v) for v in daily.values()):,} daily rows')


if __name__ == '__main__':
    main()
