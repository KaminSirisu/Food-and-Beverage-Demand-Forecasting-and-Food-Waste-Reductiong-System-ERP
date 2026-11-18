// S8: forecast (dashed) vs actual POS sales (solid + fill), units/day summed over the shown SKUs.
// Hand-written SVG like WasteChart: no chart library for two lines.
import type { SeriesPoint } from "@/lib/analytics/queries";
import { dayMonth, niceStep } from "@/lib/format";

const W = 700; // viewBox units; the SVG stretches to the card width
const H = 200;

type Props = { series: SeriesPoint[]; skuCount: number; range: number };

export function ForecastLineChart({ series, skuCount, range }: Props) {
    const highest = Math.max(1, ...series.flatMap((p) => [p.actual, p.forecast ?? 0]));
    const step = niceStep(highest);
    const axisMax = Math.ceil(highest / step) * step;
    const gridlines = Array.from({ length: axisMax / step + 1 }, (_, i) => i * step);

    const x = (i: number) => (series.length <= 1 ? W / 2 : (i / (series.length - 1)) * W);
    const y = (v: number) => H - (v / axisMax) * H;
    const pct = (v: number) => `${(v / axisMax) * 100}%`;

    const actualPath = series.map((p, i) => `${i === 0 ? "M" : "L"}${x(i)},${y(p.actual)}`).join(" ");
    const areaPath = `${actualPath} L${x(series.length - 1)},${H} L${x(0)},${H} Z`;
    // A day with no forecast breaks the dashed line instead of dropping it to 0
    const forecastPath = series
        .map((p, i) => (p.forecast === null ? null : `${i === 0 || series[i - 1].forecast === null ? "M" : "L"}${x(i)},${y(p.forecast)}`))
        .filter(Boolean)
        .join(" ");

    // 30 days → about 7 labels, 7 days → all of them
    const labelEvery = Math.ceil(series.length / 7);
    const last = series.at(-1);

    return (
        <section className="rounded-2xl border border-slate-200 bg-white p-6">
            <h2 className="text-lg font-bold text-slate-900">Forecast Baseline vs Actual POS Sales</h2>
            <p className="mt-0.5 text-sm text-slate-500">
                Units per day · {skuCount} SKUs · last {range} days (to yesterday)
            </p>

            <div className="mt-4 flex flex-wrap gap-4 text-xs text-slate-600" aria-hidden>
                <span className="flex items-center gap-1.5">
                    <span className="w-5 border-t-2 border-dashed border-indigo-500" /> LightGBM forecast (dashed)
                </span>
                <span className="flex items-center gap-1.5">
                    <span className="w-5 border-t-2 border-emerald-500" /> Actual POS sales
                </span>
            </div>

            <div className="relative mt-6 ml-10 h-56" aria-hidden>
                {gridlines.map((g) => (
                    <div
                        key={g}
                        className={`absolute inset-x-0 border-t ${g === 0 ? "border-slate-300" : "border-slate-100"}`}
                        style={{ bottom: pct(g) }}
                    >
                        <span className="absolute -left-10 w-8 -translate-y-1/2 text-right text-xs text-slate-400">{g}</span>
                    </div>
                ))}
                <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="absolute inset-0 size-full overflow-visible">
                    <path d={areaPath} className="fill-emerald-500/10" />
                    <path d={actualPath} fill="none" className="stroke-emerald-500" strokeWidth={2} vectorEffect="non-scaling-stroke" />
                    <path
                        d={forecastPath} fill="none" className="stroke-indigo-500" strokeWidth={2} strokeDasharray="5 4"
                        vectorEffect="non-scaling-stroke"
                    />
                </svg>
                {last && (
                    <span
                        className="absolute size-2.5 -translate-x-1/2 translate-y-1/2 rounded-full border-2 border-white bg-emerald-500"
                        style={{ left: "100%", bottom: pct(last.actual) }}
                    />
                )}
            </div>

            <div className="relative mt-2 ml-10 h-4" aria-hidden>
                {series.map((p, i) =>
                    (series.length - 1 - i) % labelEvery === 0 ? (
                        <span
                            key={p.date}
                            className="absolute -translate-x-1/2 text-xs text-slate-500"
                            style={{ left: `${(x(i) / W) * 100}%` }}
                        >
                            {dayMonth(p.date)}
                        </span>
                    ) : null,
                )}
            </div>

            <table className="sr-only" data-testid="forecast-series">
                <caption>Forecast and actual units per day</caption>
                <thead>
                    <tr><th>Day</th><th>Forecast</th><th>Actual</th></tr>
                </thead>
                <tbody>
                    {series.map((p) => (
                        <tr key={p.date}>
                            <td>{p.date}</td>
                            <td>{p.forecast === null ? "no forecast" : Math.round(p.forecast)}</td>
                            <td>{p.actual}</td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </section>
    );
}
