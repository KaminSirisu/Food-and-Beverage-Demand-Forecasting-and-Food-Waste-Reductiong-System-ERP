// SM7 / S6: waste ฿ per day as bars (red = over that day's target, green = within) and each day's target as a
// dashed line across the bars: 5% of that day's total sales, so it moves with sales instead of one flat ฿ line.
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
    const axisMax = Math.ceil(highest / step) * step; // e.g. 1,425 → 1,500
    const gridlines = Array.from({ length: axisMax / step + 1 }, (_, i) => i * step);
    const pct = (v: number) => `${(v / axisMax) * 100}%`;
    // Equal columns, so bar i is centred at (i + ½) / n: the target line passes through each bar's middle
    const n = Math.max(1, days.length);
    const cx = (i: number) => ((i + 0.5) / n) * W;
    const y = (v: number) => H - (v / axisMax) * H;
    const targetPath = days.map((d, i) => `${i === 0 ? "M" : "L"}${cx(i)},${y(d.target)}`).join(" ");
    const showValues = days.length <= 10;
    const barPad = days.length > 10 ? "px-px" : "px-1.5";

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

                <div className="relative flex h-full items-end">
                    {days.map((d) => {
                        const over = isOverTarget(d);
                        return (
                            <div key={d.date} className={`group relative flex h-full flex-1 flex-col items-center justify-end ${barPad}`}>
                                {over && showValues && <span aria-hidden className="mb-1 text-xs font-semibold text-slate-700">{baht(d.value)}</span>}
                                <div
                                    aria-hidden
                                    className={`w-full max-w-10 rounded-t transition-opacity group-hover:opacity-75 ${over ? "bg-red-600" : "bg-emerald-300"}`}
                                    style={{ height: pct(d.value) }}
                                />
                                <div className="pointer-events-none absolute bottom-full left-1/2 z-20 mb-2 hidden -translate-x-1/2 rounded-lg bg-slate-900 px-3 py-2 text-xs whitespace-nowrap text-white shadow-lg group-hover:block">
                                    <p className="font-semibold">{FULL_DAY.format(new Date(`${d.date}T00:00:00Z`))}</p>
                                    <p>Daily waste {baht(d.value)}</p>
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

                <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="pointer-events-none absolute inset-0 size-full overflow-visible" aria-hidden>
                    <path d={targetPath} fill="none" className="stroke-slate-500" strokeWidth={2} strokeDasharray="5 4" vectorEffect="non-scaling-stroke" />
                    {days.length <= 10 &&
                        days.map((d, i) => <circle key={d.date} cx={cx(i)} cy={y(d.target)} r={3} className="fill-white stroke-slate-500" strokeWidth={1.5} vectorEffect="non-scaling-stroke" />)}
                </svg>
            </div>

            <div className="relative mt-2 ml-12 h-4" aria-hidden>
                {days.map((d, i) => {
                    const text = label(d, i);
                    return text ? (
                        <span key={d.date} className="absolute -translate-x-1/2 text-xs text-slate-500" style={{ left: `${((i + 0.5) / n) * 100}%` }}>
                            {text}
                        </span>
                    ) : null;
                })}
            </div>

            <div className="mt-4 flex flex-wrap gap-4 text-xs text-slate-600" aria-hidden>
                <span className="flex items-center gap-1.5">
                    <span className="size-3 rounded-sm bg-emerald-300" /> Within target
                </span>
                <span className="flex items-center gap-1.5">
                    <span className="size-3 rounded-sm bg-red-600" /> Over target{showValues ? " (value shown)" : ""}
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
