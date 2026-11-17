// S8 / NFR6: per-SKU accuracy. Forecast / Actual / Variance = latest day; MAPE / RMSE = the whole window.
import { Badge, type BadgeTone } from "../../_components/Badge";
import { VARIANCE_ALERT_PCT, type Accuracy } from "@/lib/analytics/metrics";
import type { AnalyticsData } from "@/lib/analytics/queries";

const ACCURACY: Record<Accuracy, { label: string; tone: BadgeTone }> = {
    GOOD: { label: "Good", tone: "green" },
    FAIR: { label: "Fair", tone: "amber" },
    REVIEW: { label: "Review", tone: "red" },
};

const signed = (v: number) => `${v > 0 ? "+" : ""}${Math.round(v)}%`;
const oneDecimal = (v: number | null) => (v === null ? "–" : (Math.round(v * 10) / 10).toString());

type Props = { rows: AnalyticsData["rows"]; range: number; latestDate: string | undefined };

export function SkuAccuracyTable({ rows, range, latestDate }: Props) {
    return (
        <section className="rounded-2xl border border-slate-200 bg-white p-6">
            <h2 className="text-lg font-bold text-slate-900">SKU Forecast Accuracy</h2>
            <p className="mt-0.5 text-sm text-slate-500">
                {latestDate ? `Latest day ${latestDate}` : "Latest day"}, units · MAPE and RMSE over the selected {range}-day window
            </p>

            {rows.length === 0 ? (
                <p className="mt-4 rounded-lg bg-slate-50 p-4 text-sm text-slate-500">No SKUs in this category.</p>
            ) : (
                <div className="mt-4 overflow-x-auto rounded-xl border border-slate-200">
                    <table className="w-full min-w-[720px] text-sm">
                        <thead className="bg-slate-50 text-xs font-semibold text-slate-500">
                            <tr>
                                <th className="px-4 py-3 text-left">SKU Name</th>
                                <th className="px-4 py-3 text-right">LightGBM Forecast</th>
                                <th className="px-4 py-3 text-right">Actual POS Sales</th>
                                <th className="px-4 py-3 text-right">Variance (%)</th>
                                <th className="px-4 py-3 text-right">MAPE</th>
                                <th className="px-4 py-3 text-right">RMSE</th>
                                <th className="px-4 py-3 text-left">Accuracy</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {rows.map((r) => {
                                const off = r.variancePct !== null && Math.abs(r.variancePct) >= VARIANCE_ALERT_PCT;
                                const acc = ACCURACY[r.accuracy];
                                return (
                                    <tr key={r.itemNo} data-testid="sku-row">
                                        <td className="px-4 py-3">
                                            <p className="font-semibold text-slate-900">{r.nameTh}</p>
                                            <p className="text-xs text-slate-500">{r.itemNo}</p>
                                        </td>
                                        <td className="px-4 py-3 text-right tabular-nums">
                                            {r.forecast === null ? "–" : Math.round(r.forecast)}
                                        </td>
                                        <td className="px-4 py-3 text-right tabular-nums">{r.actual}</td>
                                        <td className={`px-4 py-3 text-right tabular-nums ${off ? "font-semibold text-red-600" : ""}`}>
                                            {r.variancePct === null ? "–" : signed(r.variancePct)}
                                        </td>
                                        <td className="px-4 py-3 text-right tabular-nums">
                                            {r.mape === null ? "–" : `${oneDecimal(r.mape)}%`}
                                        </td>
                                        <td className="px-4 py-3 text-right tabular-nums">{oneDecimal(r.rmse)}</td>
                                        <td className="px-4 py-3">
                                            <Badge tone={acc.tone}>● {acc.label}</Badge>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            )}
        </section>
    );
}
