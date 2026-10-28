import { DAILY_WASTE_TARGET } from "@/lib/config";
import type { WasteDay } from "@/lib/dashboard/queries";
import { baht } from "@/lib/format";

// `date` is already a Bangkok day ("YYYY-MM-DD"), so format it as UTC, not shifted again
const WEEKDAY = new Intl.DateTimeFormat("en-GB", { weekday: "short", timeZone: "UTC" });

type Props = { days: WasteDay[], target?: number };

export function WasteChart({ days, target = DAILY_WASTE_TARGET }: Props) {
    // Scale to the tallest bar or the target line, +10% headroom for the value labels
    const max = Math.max(target, ...days.map((d) => d.value)) * 1.1;
    const pct = (v: number) => `${(v / max) * 100}%`;
    const overDays = days.filter((d) => d.value > target).length;

    return (
        <section className="rounded-2xl border border-slate-200 bg-white p-6">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
                <h2 className="text-xl font-bold text-slate-900">Daily Waste vs Target</h2>
                <p className="text-sm text-slate-500">Last 7 days · {overDays} over target</p>
            </div>

            <div className="relative mt-8 h-48" aria-hidden>
                <div className="absolute inset-x-0 border-t-2 border-dashed border-slate-400" style={{ bottom: pct(target) }}>
                    <span className="absolute -top-5 right-0 text-xs font-medium text-slate-500">
                        Target {baht(target)}
                    </span>
                </div>
                <div className="flex h-full items-end gap-2 border-b border-slate-200">
                    {days.map((d) => {
                        const over = d.value > target;
                        return (
                            <div
                                key={d.date}
                                title={`${d.date}: ${baht(d.value)}`}
                                className="flex h-full flex-1 flex-col items-center justify-end"
                            >
                                {over && <span className="mb-1 text-xs font-semibold text-slate-700">{baht(d.value)}</span>}
                                <div 
                                    className={`w-full max-w-10 rounded-t ${over ? "bg-red-600" : "bg-emerald-300"}`}
                                    style={{ height: pct(d.value) }}
                                />
                            </div>
                        )
                    })}
                </div>
            </div>

            <div className="mt-2 flex gap-2" aria-hidden>
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
                    <span className="w-4 border-t-2 border-dashed border-slate-400" /> Target
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
    )
}