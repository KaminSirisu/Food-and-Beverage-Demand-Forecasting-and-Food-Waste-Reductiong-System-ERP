#!/usr/bin/env python3
"""
FreshWaste ERP - Task A2: reproducible training script for both LightGBM models.

One command:
    python train_models.py --train-dir <folder with Aug 2022-Mar 2023 files> \
                           --test-dir  <folder with Apr-Aug 2023 files>      \
                           --out-dir   <folder for models and metrics>

What it does
    1. Reads the Sales Entry files (.xlsx / .xls / .csv / .parquet), keeps branch 801.
    2. Builds one row per (SKU, day D) at decision time T = 13:30 (same features as the notebook).
    3. Trains rest_of_day and tomorrow:
         fit        Aug 2022 - Feb 2023
         validate   Mar 2023  (early stopping picks the number of trees)
         refit      Aug 2022 - Mar 2023 with that number of trees (final model)
       Use --no-refit to keep the model fitted on Aug 2022 - Feb 2023 only.
    4. Tests on Apr - Aug 2023 and prints WAPE, MAE and Bias for each model and both baselines
       (also for the validation month).
    5. Saves rest_of_day.txt, tomorrow.txt, features.json, encoders.json, holidays.csv,
       accuracy.csv and accuracy.md in --out-dir.

Same data + same settings -> same numbers every run (fixed seed, deterministic LightGBM).
"""
import argparse, glob, json, os, sys, platform
import numpy as np
import pandas as pd

# ------------------------------------------------------------------ settings (same as notebook)
STORE       = 801
CUTOFF_T    = '13:30'
CLOSE_TIME  = '21:00'
BRANCH_TIER = 'mall'
SKU_INFO = {   # code: (name, category, shelf life in days)
    'SB078':   ('Butter Sugar Bread',              'Bread',        2),
    'SB062':   ('Buttercream Bread',               'Bread',        2),
    'ST068':   ('Khao Tom Mat (banana leaf rice)', 'Thai Dessert', 1),
    'ST058':   ('Taro Tako (4 pcs)',               'Thai Dessert', 1),
    'SC220':   ('Young Coconut Chiffon',           'Cake Slice',   1),
    'SC076':   ('Orange Cake',                     'Cake Slice',   3),
    'SCP1993': ('Minimal Mini Cake (pink swirl)',  'Cake Pound',   5),
    'SB094':   ('Buttermilk Bread',                'Bread',        2),
}
SKUS = list(SKU_INFO)
PARAMS = {'objective': 'poisson', 'learning_rate': 0.05, 'num_leaves': 31, 'feature_fraction': 0.8,
          'bagging_fraction': 0.8, 'bagging_freq': 1, 'lambda_l2': 5.0, 'verbose': -1, 'seed': 42}
N_ESTIMATORS, EARLY_STOP, MIN_TREES = 2000, 100, 50
USECOLS = ['Store No_', 'Date', 'Time', 'Item No_', 'Item Category Code', 'Price', 'Quantity', 'Discount Amount']


# ------------------------------------------------------------------ 1. read data
def load_folder(folder):
    files = sorted(f for f in glob.glob(os.path.join(folder, '*'))
                   if f.lower().endswith(('.xlsx', '.xls', '.csv', '.parquet')))
    if not files:
        sys.exit(f'No .xlsx/.xls/.csv/.parquet files found in {folder}')
    parts = []
    for f in files:
        if f.lower().endswith('.parquet'):
            df = pd.read_parquet(f, columns=USECOLS)
        elif f.lower().endswith('.csv'):
            df = pd.read_csv(f, usecols=USECOLS, dtype={'Item No_': str})
        else:
            df = pd.read_excel(f, usecols=USECOLS, dtype={'Item No_': str})
        df = df[df['Store No_'] == STORE]
        print(f'  read {os.path.basename(f)}: {len(df):,} rows')
        parts.append(df)
    raw = pd.concat(parts, ignore_index=True)
    raw['Date'] = pd.to_datetime(raw['Date']).dt.normalize()
    raw['Item No_'] = raw['Item No_'].astype(str).str.strip()
    raw['Time'] = raw['Time'].astype(str)
    raw['Item Category Code'] = raw['Item Category Code'].astype(str).str.strip()
    return raw


# ------------------------------------------------------------------ 2. features (notebook Cell 4)
def build_features(raw_train, raw_test, out_dir):
    import holidays
    raw_all = pd.concat([raw_train, raw_test], ignore_index=True)
    train_end = raw_train['Date'].max()

    n_pos = int((raw_all['Quantity'] > 0).sum())                  # returns / adjustments -> removed
    raw_all = raw_all[raw_all['Quantity'] < 0].copy()
    raw_all['qty'] = raw_all['Quantity'].abs()

    t = raw_all['Time'].str.extract(r'(\d{1,2}):(\d{2})').astype(float)
    raw_all['hour'] = t[0] + t[1] / 60
    t_hour = int(CUTOFF_T[:2]) + int(CUTOFF_T[3:]) / 60
    close_hour = int(CLOSE_TIME[:2]) + int(CLOSE_TIME[3:]) / 60
    raw_all['before_T'] = raw_all['hour'] < t_hour

    open_days = set(raw_all['Date'].unique())
    all_dates = pd.date_range(raw_all['Date'].min(), raw_all['Date'].max(), freq='D')

    th = holidays.Thailand(years=sorted(set(all_dates.year)))
    hol = pd.DataFrame(sorted(th.items()), columns=['date', 'name'])
    hol['date'] = pd.to_datetime(hol['date'])
    hol = hol[(hol['date'] >= all_dates.min()) & (hol['date'] <= all_dates.max() + pd.Timedelta(days=1))]
    hol.to_csv(os.path.join(out_dir, 'holidays.csv'), index=False, encoding='utf-8-sig')
    HOL = set(hol['date'])

    d = raw_all[raw_all['Item No_'].isin(SKUS)].copy()
    d['gross'] = d['Price'] * d['qty']
    d['disc'] = d['Discount Amount'].abs()
    bt = d[d['before_T']]
    g_full = d.groupby(['Item No_', 'Date'])['qty'].sum()
    g_toT = bt.groupby(['Item No_', 'Date'])['qty'].sum()
    g_price = bt.sort_values('hour').groupby(['Item No_', 'Date'])['Price'].last()
    g_disc = bt.groupby(['Item No_', 'Date'])[['disc', 'gross']].sum()
    cat_map = d.groupby('Item No_')['Item Category Code'].agg(lambda s: s.mode().iat[0]).to_dict()

    def cal(df, col, p=''):
        dt = df[col]; day = dt.dt.day
        df[p + 'dow'] = dt.dt.dayofweek
        df[p + 'is_weekend'] = (dt.dt.dayofweek >= 4).astype(int)
        df[p + 'is_payday'] = ((day >= 25) | (day <= 2) | day.isin([15, 16])).astype(int)
        df[p + 'is_holiday'] = dt.isin(HOL).astype(int)
        df[p + 'day_of_month'] = day
        return df

    rows = []
    for i, s in enumerate(SKUS):
        f = pd.DataFrame({'Date': all_dates}); f['sku'] = s
        f['store_open'] = f['Date'].isin(open_days)
        key = pd.MultiIndex.from_arrays([[s] * len(f), f['Date']])
        f['sold_full'] = g_full.reindex(key).fillna(0).values
        f['sold_to_T'] = g_toT.reindex(key).fillna(0).values
        f['sold_after_T'] = f['sold_full'] - f['sold_to_T']
        f.loc[~f['store_open'], ['sold_full', 'sold_to_T', 'sold_after_T']] = np.nan
        avg_day = f.loc[f['Date'] <= train_end, 'sold_full'].mean()          # not-on-sale rule
        z = f['sold_full'].eq(0)
        run_len = z.groupby((z != z.shift()).cumsum()).transform('sum')
        f['on_sale'] = f['store_open'] & ~(z & (run_len >= (3 if avg_day >= 2 else 21)))
        f.loc[~f['on_sale'], ['sold_full', 'sold_to_T', 'sold_after_T']] = np.nan
        f['price'] = pd.Series(g_price.reindex(key).values).ffill().bfill().values
        dg = g_disc.reindex(key)
        f['discount_pct'] = (dg['disc'] / dg['gross'].replace(0, np.nan)).fillna(0).clip(0, 1).values

        full, toT, aft = f['sold_full'], f['sold_to_T'], f['sold_after_T']
        same_dow_toT = pd.concat([toT.shift(7 * k) for k in range(1, 5)], axis=1).mean(axis=1)
        f['ratio_to_T'] = toT / same_dow_toT.replace(0, np.nan)
        f['mean_full_7d'] = full.shift(1).rolling(7, min_periods=3).mean()
        for k in range(1, 5):
            f[f'lag_after_T_{k}'] = aft.shift(7 * k)
            f[f'lag_full_{k}'] = full.shift(7 * k)
            f[f'm2_lag_full_{k}'] = full.shift(7 * k - 1)
        f['mean_after_T_7d'] = aft.shift(1).rolling(7, min_periods=3).mean()
        f['share_after_T_28d'] = (aft.shift(1).rolling(28, min_periods=7).sum()
                                  / full.shift(1).rolling(28, min_periods=7).sum().replace(0, np.nan))
        f['target_date_m2'] = f['Date'] + pd.Timedelta(days=1)
        f['y_rest'] = aft
        f['y_tomorrow'] = full.shift(-1)
        f['tomorrow_open'] = f['on_sale'].shift(-1).astype('boolean').fillna(False).astype(bool)
        f['sku_id'] = i
        f['category'] = cat_map.get(s, SKU_INFO[s][1])
        f['shelf_life_days'] = SKU_INFO[s][2]
        f['minutes_to_close'] = int(round((close_hour - t_hour) * 60))
        f['branch_tier'] = BRANCH_TIER
        f['active_28d'] = full.shift(1).rolling(28, min_periods=1).sum().fillna(0) > 0
        rows.append(f)

    ds = pd.concat(rows, ignore_index=True)
    ds = cal(ds, 'Date')
    ds = cal(ds, 'target_date_m2', 'm2_')
    enc = {'sku': {s: i for i, s in enumerate(SKUS)},
           'category': {c: i for i, c in enumerate(sorted(ds['category'].unique()))},
           'branch': {str(STORE): 0}, 'branch_tier': {'mall': 0, 'standalone': 1}}
    ds['category_id'] = ds['category'].map(enc['category'])
    ds['branch_id'] = 0
    ds['branch_tier_id'] = ds['branch_tier'].map(enc['branch_tier'])

    common = ['sku_id', 'category_id', 'branch_id', 'branch_tier_id', 'shelf_life_days', 'price',
              'discount_pct', 'sold_to_T', 'ratio_to_T', 'mean_full_7d']
    feats_rest = (common + [f'lag_after_T_{k}' for k in range(1, 5)] + [f'lag_full_{k}' for k in range(1, 5)]
                  + ['mean_after_T_7d', 'share_after_T_28d', 'dow', 'is_weekend', 'is_payday', 'is_holiday',
                     'day_of_month', 'minutes_to_close'])
    feats_tom = (common + [f'm2_lag_full_{k}' for k in range(1, 5)]
                 + ['m2_dow', 'm2_is_weekend', 'm2_is_payday', 'm2_is_holiday', 'm2_day_of_month'])

    base = ds[ds['on_sale'] & ds['active_28d']].copy()
    rest = base.dropna(subset=['y_rest', 'mean_full_7d']).copy()
    tom = base[base['tomorrow_open']].dropna(subset=['y_tomorrow', 'mean_full_7d']).copy()
    # Level of the last 7 days: models learn "how many times the recent level"
    rest['level'] = (rest['mean_full_7d'] * rest['share_after_T_28d'].fillna(0.5)).clip(lower=0.5)
    tom['level'] = tom['mean_full_7d'].clip(lower=1)
    rest['y_ratio'] = rest['y_rest'] / rest['level']
    tom['y_ratio'] = tom['y_tomorrow'] / tom['level']
    print(f'  removed rows with positive Quantity: {n_pos:,} | holidays: {len(hol)} days')
    print(f'  rest_of_day rows: {len(rest):,} ({len(feats_rest)} features) | '
          f'tomorrow rows: {len(tom):,} ({len(feats_tom)} features)')
    return rest, tom, feats_rest, feats_tom, enc


# ------------------------------------------------------------------ 3. train (notebook Cell 5)
def train_one(rows, feats, date_col, val_start, train_end, refit):
    import lightgbm as lgb
    fit = rows[rows[date_col] < val_start]
    val = rows[(rows[date_col] >= val_start) & (rows[date_col] <= train_end)]
    m_val = lgb.train(PARAMS, lgb.Dataset(fit[feats], fit['y_ratio']), N_ESTIMATORS,
                      valid_sets=[lgb.Dataset(val[feats], val['y_ratio'])],
                      callbacks=[lgb.early_stopping(EARLY_STOP, verbose=False)])
    n = max(m_val.best_iteration, MIN_TREES)
    if refit:
        full = rows[rows[date_col] <= train_end]
        m_final = lgb.train(PARAMS, lgb.Dataset(full[feats], full['y_ratio']), n)
    else:
        m_final = m_val
    return m_val, m_final, n, fit[date_col].min(), fit[date_col].max()


# ------------------------------------------------------------------ 4. metrics (notebook Cell 6)
def acc(y, p):
    y, p = np.asarray(y, float), np.asarray(p, float)
    return {'WAPE %': round(100 * np.abs(y - p).sum() / y.sum(), 1),
            'MAE': round(float(np.abs(y - p).mean()), 2),
            'Bias %': round(100 * (p - y).sum() / y.sum(), 1),
            'rows': len(y)}


def evaluate(rest, tom, period):
    b1 = (rest['mean_full_7d'] * rest['share_after_T_28d']).fillna(rest['mean_full_7d'] * 0.5)
    b2 = tom['m2_lag_full_1'].fillna(tom['mean_full_7d'])
    t = pd.DataFrame({
        'Model 1 rest_of_day':             acc(rest['y_rest'], rest['pred']),
        'Baseline 1 (mean_7d x share)':    acc(rest['y_rest'], b1),
        'Model 2 tomorrow':                acc(tom['y_tomorrow'], tom['pred']),
        'Baseline 2 (same day last week)': acc(tom['y_tomorrow'], b2)}).T
    t['rows'] = t['rows'].astype(int)
    t.insert(0, 'period', period)
    return t


def main():
    ap = argparse.ArgumentParser(description='Train rest_of_day and tomorrow (Task A2).')
    ap.add_argument('--train-dir', required=True, help='Folder with the 8 training months (Aug 2022 - Mar 2023)')
    ap.add_argument('--test-dir', required=True, help='Folder with the 5 test months (Apr - Aug 2023)')
    ap.add_argument('--out-dir', default='a2_output', help='Where models and metrics are saved')
    ap.add_argument('--no-refit', action='store_true',
                    help='Test with the model fitted on Aug 2022 - Feb 2023 only (no refit including March)')
    a = ap.parse_args()
    os.makedirs(a.out_dir, exist_ok=True)

    import lightgbm as lgb
    print(f'Python {platform.python_version()} | pandas {pd.__version__} | lightgbm {lgb.__version__}')
    print('[1/4] Reading data'); raw_train = load_folder(a.train_dir); raw_test = load_folder(a.test_dir)
    train_end, test_start = raw_train['Date'].max(), raw_test['Date'].min()
    val_start = train_end.replace(day=1)

    print('[2/4] Building features')
    rest, tom, f_rest, f_tom, enc = build_features(raw_train, raw_test, a.out_dir)

    print('[3/4] Training')
    mr_val, mr, n_r, fit_from, fit_to = train_one(rest, f_rest, 'Date', val_start, train_end, not a.no_refit)
    mt_val, mt, n_t, _, _ = train_one(tom, f_tom, 'target_date_m2', val_start, train_end, not a.no_refit)
    print(f'  fit {fit_from.date()} -> {fit_to.date()} | validate {val_start.date()} -> {train_end.date()} | '
          f'test {test_start.date()} -> {raw_test["Date"].max().date()}')
    print(f'  rest_of_day: {n_r} trees | tomorrow: {n_t} trees | refit incl. March: {not a.no_refit}')

    # predictions in units = predicted ratio x level
    rest['pred'] = rest['level'] * np.where(rest['Date'] >= test_start,
                                            mr.predict(rest[f_rest]), mr_val.predict(rest[f_rest]))
    tom['pred'] = tom['level'] * np.where(tom['target_date_m2'] >= test_start,
                                          mt.predict(tom[f_tom]), mt_val.predict(tom[f_tom]))

    print('[4/4] Accuracy')
    in_val_r = (rest['Date'] >= val_start) & (rest['Date'] <= train_end)
    in_val_t = (tom['target_date_m2'] >= val_start) & (tom['target_date_m2'] <= train_end)
    table = pd.concat([evaluate(rest[in_val_r], tom[in_val_t], 'validation Mar 2023'),
                       evaluate(rest[rest['Date'] >= test_start], tom[tom['target_date_m2'] >= test_start],
                                'test Apr-Aug 2023')])
    pd.set_option('display.width', 200)
    for period, g in table.groupby('period', sort=False):
        print(f'\n=== {period} ===')
        print(g.drop(columns='period').to_string())

    mr.save_model(os.path.join(a.out_dir, 'rest_of_day.txt'))
    mt.save_model(os.path.join(a.out_dir, 'tomorrow.txt'))
    json.dump({'rest_of_day': f_rest, 'tomorrow': f_tom}, open(os.path.join(a.out_dir, 'features.json'), 'w'), indent=2)
    json.dump(enc, open(os.path.join(a.out_dir, 'encoders.json'), 'w'), indent=2)
    table.to_csv(os.path.join(a.out_dir, 'accuracy.csv'))
    with open(os.path.join(a.out_dir, 'accuracy.md'), 'w', encoding='utf-8') as fh:
        fh.write(f'# Accuracy\nStore {STORE} | SKUs {", ".join(SKUS)} | T = {CUTOFF_T}\n\n')
        fh.write(f'Fit {fit_from.date()} - {fit_to.date()} | Validate {val_start.date()} - {train_end.date()} | '
                 f'Test {test_start.date()} - {raw_test["Date"].max().date()} | Refit incl. March: {not a.no_refit}\n\n')
        fh.write(f'Trees: rest_of_day {n_r}, tomorrow {n_t} | lightgbm {lgb.__version__}\n\n')
        fh.write(table.to_markdown())
    print(f'\nSaved to {a.out_dir}: rest_of_day.txt, tomorrow.txt, features.json, encoders.json, '
          f'holidays.csv, accuracy.csv, accuracy.md')


if __name__ == '__main__':
    main()
