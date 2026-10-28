import { DAILY_WASTE_TARGET } from "@/lib/config";
import type { WasteDay } from "@/lib/dashboard/queries";
import { baht } from "@/lib/format";

// `date` is already a Bangkok day ("YYYY-MM-DD"), so format it as UTC, not shifted again
const WEEKDAY = new Intl.DateTimeFormat("en-GB", { weekday: "short", timeZone: "UTC" });
const FULL_DAY = new Intl.DateTimeFormat("en-GB", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" });

/** A round step (1, 2, 2.5 or 5 × 10ⁿ) that splits 0…max into about `lines` gridlines. max must be > 0. */
function niceStep(max: number, lines = 4): number {
    const raw = max / lines;
    const magnitude = 10 ** Math.floor(Math.log10(raw));
    return [1, 2, 2.5, 5, 10].map((m) => m * magnitude).find((s) => s >= raw) ?? raw;
}

type Props = { days: WasteDay[]; target?: number };

export function WasteChart({ days, target = DAILY_WASTE_TARGET }: Props) {
    // Axis: 0 → the next round number above the highest bar (or the target, so its line is always visible)
    const highest = Math.max(target, ...days.map((d) => d.value));
    const step = niceStep(highest);
    const axisMax = Math.ceil(highest / step) * step; // e.g. 1,425 → 1,500
    const gridlines = Array.from({ length: axisMax / step + 1 }, (_, i) => i * step); // 0, 500, 1000, 1500
    const pct = (v: number) => `${(v / axisMax) * 100}%`;
    const overDays = days.filter((d) => d.value > target).length;

    return (
        <section className="rounded-2xl border border-slate-200 bg-white p-6">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
                <h2 className="text-xl font-bold text-slate-900">Daily Waste vs Target</h2>
                <p className="text-sm text-slate-500">Last 7 days · {overDays} over target</p>
            </div>

            {/* ml-12 = gutter for the ฿ axis labels. Screen readers use the table below instead. */}
            <div className="relative mt-8 ml-12 h-48" aria-hidden>
                {gridlines.map((g) => (
                    <div
                        key={g}
                        className={`absolute inset-x-0 border-t ${g === 0 ? "border-slate-300" : "border-slate-100"}`}
                        style={{ bottom: pct(g) }}
                    >
                        <span className="absolute -left-12 w-10 -translate-y-1/2 text-right text-xs text-slate-400">
                            {baht(g)}
                        </span>
                    </div>
                ))}

                <div className="absolute inset-x-0 border-t-2 border-dashed border-slate-400" style={{ bottom: pct(target) }} />

                <div className="relative flex h-full items-end gap-2">
                    {days.map((d) => {
                        const over = d.value > target;
                        const diff = Math.abs(d.value - target);
                        return (
                            <div key={d.date} className="group relative flex h-full flex-1 flex-col items-center justify-end">
                                {over && <span className="mb-1 text-xs font-semibold text-slate-700">{baht(d.value)}</span>}
                                <div
                                    className={`w-full max-w-10 rounded-t transition-opacity group-hover:opacity-75 ${over ? "bg-red-600" : "bg-emerald-300"}`}
                                    style={{ height: pct(d.value) }}
                                />
                                <div className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-2 hidden -translate-x-1/2 whitespace-nowrap rounded-lg bg-slate-900 px-3 py-2 text-xs text-white shadow-lg group-hover:block">
                                    <p className="font-semibold">{FULL_DAY.format(new Date(`${d.date}T00:00:00Z`))}</p>
                                    <p>Daily waste {baht(d.value)}</p>
                                    <p className="text-slate-300">{baht(diff)} {over ? "over" : "under"} target</p>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>

            <div className="mt-2 ml-12 flex gap-2" aria-hidden>
                {days.map((d, i) => (
                    <span key={d.date} className="flex-1 text-center text-xs text-slate-500">
                        {i === days.length - 1 ? "Today" : WEEKDAY.format(new Date(`${d.date}T00:00:00Z`))}
                    </span>
                ))}
            </div>

            <div className="mt-4 flex flex-wrap gap-4 text-xs text-slate-600" aria-hidden>
                <span className="flex items-center gap-1.5">
                    <span className="size-3 rounded-sm bg-emerald-300" /> Within target
                </span>
                <span className="flex items-center gap-1.5">
                    <span className="size-3 rounded-sm bg-red-600" /> Over target (value shown)
                </span>
                <span className="flex items-center gap-1.5">
                    <span className="w-4 border-t-2 border-dashed border-slate-400" /> Target {baht(target)}
                </span>
            </div>

            <table className="sr-only">
                <caption>Daily waste value for the last 7 days, target {baht(target)}</caption>
                <thead>
                    <tr><th>Day</th><th>Waste</th><th>Status</th></tr>
                </thead>
                <tbody>
                    {days.map((d) => (
                        <tr key={d.date}>
                            <td>{d.date}</td>
                            <td>{baht(d.value)}</td>
                            <td>{d.value > target ? "Over target" : "Within target"}</td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </section>
    );
}