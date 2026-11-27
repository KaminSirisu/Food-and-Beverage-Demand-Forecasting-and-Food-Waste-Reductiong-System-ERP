// SM7 / S6: waste ฿ per day (solid line + fill) against each day's target (dashed), 5% of that day's total sales.
// The target moves with sales, so it is a line, not a flat bar. Days over their target are red (dot + segment,
// value shown when there are few days). Same hand-written SVG style as ForecastLineChart (no chart library).
// Used by Daily Waste vs Target (dashboard) and Food Waste Trend (analytics).
import { WASTE_TARGET_PCT } from "@/lib/config";
import { baht, niceStep } from "@/lib/format";
import { isOverTarget, type WasteDay } from "@/lib/waste/target";

const W = 700; // viewBox units; the SVG stretches to the card width
const H = 200;
const FULL_DAY = new Intl.DateTimeFormat("en-GB", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" });

type Props = {
    days: WasteDay[];
    heightClass: string; // e.g. "h-48"
    label: (day: WasteDay, i: number) => string; // x-axis label, "" = none
};

export function WasteTargetPlot({ days, heightClass, label }: Props) {
    const highest = Math.max(1, ...days.flatMap((d) => [d.value, d.target]));
    const step = niceStep(highest);
    const axisMax = Math.ceil(highest / step) * step;
    const gridlines = Array.from({ length: axisMax / step + 1 }, (_, i) => i * step);

    const x = (i: number) => (days.length <= 1 ? W / 2 : (i / (days.length - 1)) * W);
    const y = (v: number) => H - (v / axisMax) * H;
    const pct = (v: number) => `${(v / axisMax) * 100}%`;
    const left = (i: number) => `${(x(i) / W) * 100}%`;

    const line = (pick: (d: WasteDay) => number) => days.map((d, i) => `${i === 0 ? "M" : "L"}${x(i)},${y(pick(d))}`).join(" ");
    const wastePath = line((d) => d.value);
    const areaPath = `${wastePath} L${x(days.length - 1)},${H} L${x(0)},${H} Z`;
    const targetPath = line((d) => d.target);
    // A segment turns red when the day it ends on is over target
    const redSegments = days.flatMap((d, i) => (i > 0 && isOverTarget(d) ? [`M${x(i - 1)},${y(days[i - 1].value)} L${x(i)},${y(d.value)}`] : []));
    const showValues = days.length <= 10;

    return (
        <>
            {/* ml-12 = gutter for the ฿ axis labels. Screen readers use the table below instead. */}
            <div className={`relative mt-8 ml-12 ${heightClass}`}>
                {gridlines.map((g) => (
                    <div
                        key={g}
                        aria-hidden
                        className={`absolute inset-x-0 border-t ${g === 0 ? "border-slate-300" : "border-slate-100"}`}
                        style={{ bottom: pct(g) }}
                    >
                        <span className="absolute -left-12 w-10 -translate-y-1/2 text-right text-xs text-slate-400">{baht(g)}</span>
                    </div>
                ))}
                <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="absolute inset-0 size-full overflow-visible" aria-hidden>
                    <path d={areaPath} className="fill-emerald-500/10" />
                    <path d={wastePath} fill="none" className="stroke-emerald-500" strokeWidth={2} vectorEffect="non-scaling-stroke" />
                    {redSegments.map((d) => (
                        <path key={d} d={d} fill="none" className="stroke-red-600" strokeWidth={2.5} vectorEffect="non-scaling-stroke" />
                    ))}
                    <path
                        d={targetPath} fill="none" className="stroke-slate-500" strokeWidth={2} strokeDasharray="5 4"
                        vectorEffect="non-scaling-stroke"
                    />
                </svg>

                {days.map((d, i) => {
                    const over = isOverTarget(d);
                    const isLast = i === days.length - 1;
                    return (
                        // One hover column per day (dot + tooltip)
                        <div
                            key={d.date}
                            className="group absolute inset-y-0 -translate-x-1/2"
                            style={{ left: left(i), width: `${100 / Math.max(1, days.length)}%` }}
                        >
                            {(over || isLast) && (
                                <span
                                    aria-hidden
                                    className={`absolute left-1/2 size-2.5 -translate-x-1/2 translate-y-1/2 rounded-full border-2 border-white ${over ? "bg-red-600" : "bg-emerald-500"}`}
                                    style={{ bottom: pct(d.value) }}
                                />
                            )}
                            {over && showValues && (
                                <span
                                    aria-hidden
                                    className="absolute left-1/2 mb-2 -translate-x-1/2 text-xs font-semibold whitespace-nowrap text-red-700"
                                    style={{ bottom: pct(d.value) }}
                                >
                                    {baht(d.value)}
                                </span>
                            )}
                            <div className="pointer-events-none absolute bottom-full left-1/2 z-20 mb-2 hidden -translate-x-1/2 rounded-lg bg-slate-900 px-3 py-2 text-xs whitespace-nowrap text-white shadow-lg group-hover:block">
                                <p className="font-semibold">{FULL_DAY.format(new Date(`${d.date}T00:00:00Z`))}</p>
                                <p>Waste {baht(d.value)}</p>
                                <p>
                                    Target {baht(d.target)} = {WASTE_TARGET_PCT}% of {d.expected ? "expected sales" : "sales"} {baht(d.sales)}
                                </p>
                                <p className={over ? "text-red-300" : "text-slate-300"}>
                                    {baht(Math.abs(d.value - d.target))} {over ? "over" : "under"} target
                                </p>
                            </div>
                        </div>
                    );
                })}
            </div>

            <div className="relative mt-2 ml-12 h-4" aria-hidden>
                {days.map((d, i) => {
                    const text = label(d, i);
                    return text ? (
                        <span key={d.date} className="absolute -translate-x-1/2 text-xs text-slate-500" style={{ left: left(i) }}>
                            {text}
                        </span>
                    ) : null;
                })}
            </div>

            <div className="mt-4 flex flex-wrap gap-4 text-xs text-slate-600" aria-hidden>
                <span className="flex items-center gap-1.5">
                    <span className="w-5 border-t-2 border-emerald-500" /> Daily waste
                </span>
                <span className="flex items-center gap-1.5">
                    <span className="size-2.5 rounded-full bg-red-600" /> Over target{showValues ? " (value shown)" : ""}
                </span>
                <span className="flex items-center gap-1.5">
                    <span className="w-5 border-t-2 border-dashed border-slate-500" /> Target = {WASTE_TARGET_PCT}% of the day&apos;s total sales
                </span>
            </div>

            <table className="sr-only">
                <caption>Daily waste and target ({WASTE_TARGET_PCT}% of the day&apos;s total sales)</caption>
                <thead>
                    <tr><th>Day</th><th>Waste</th><th>Target</th><th>Status</th></tr>
                </thead>
                <tbody>
                    {days.map((d) => (
                        <tr key={d.date}>
                            <td>{d.date}</td>
                            <td>{baht(d.value)}</td>
                            <td>{baht(d.target)}</td>
                            <td>{isOverTarget(d) ? "Over target" : "Within target"}</td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </>
    );
}
