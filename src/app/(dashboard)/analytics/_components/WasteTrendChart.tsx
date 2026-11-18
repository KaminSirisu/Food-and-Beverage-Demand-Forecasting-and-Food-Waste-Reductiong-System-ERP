// Food waste ฿ per day vs the daily target (branch-level, so the category filter doesn't apply).
import { baht, dayMonth, niceStep } from "@/lib/format";

type Props = { days: { date: string; value: number }[]; target: number };

export function WasteTrendChart({ days, target }: Props) {
    const highest = Math.max(target, ...days.map((d) => d.value));
    const step = niceStep(highest);
    const axisMax = Math.ceil(highest / step) * step;
    const gridlines = Array.from({ length: axisMax / step + 1 }, (_, i) => i * step);
    const pct = (v: number) => `${(v / axisMax) * 100}%`;
    const labelEvery = Math.ceil(days.length / 7);

    return (
        <section className="rounded-2xl border border-slate-200 bg-white p-6">
            <h2 className="text-lg font-bold text-slate-900">Food Waste Trend</h2>
            <p className="mt-0.5 text-sm text-slate-500">฿ per day · last {days.length} days · whole branch</p>

            <div className="relative mt-8 ml-12 h-40" aria-hidden>
                {gridlines.map((g) => (
                    <div
                        key={g}
                        className={`absolute inset-x-0 border-t ${g === 0 ? "border-slate-300" : "border-slate-100"}`}
                        style={{ bottom: pct(g) }}
                    >
                        <span className="absolute -left-12 w-10 -translate-y-1/2 text-right text-xs text-slate-400">
                            {g.toLocaleString("en-US")}
                        </span>
                    </div>
                ))}
                <div className="absolute inset-x-0 z-10 border-t-2 border-dashed border-slate-500" style={{ bottom: pct(target) }}>
                    <span className="absolute right-0 bottom-1 rounded bg-white/80 px-1 text-xs font-semibold text-slate-700">
                        Target {baht(target)}
                    </span>
                </div>
                <div className={`relative flex h-full items-end ${days.length > 10 ? "gap-0.5" : "gap-3"}`}>
                    {days.map((d) => (
                        <div
                            key={d.date}
                            title={`${d.date}: ${baht(d.value)}`}
                            className={`flex-1 rounded-t ${d.value > target ? "bg-red-500" : "bg-emerald-400"}`}
                            style={{ height: pct(d.value) }}
                        />
                    ))}
                </div>
            </div>
            <div className={`mt-2 ml-12 flex ${days.length > 10 ? "gap-0.5" : "gap-3"}`} aria-hidden>
                {days.map((d, i) => (
                    <span key={d.date} className="flex-1 text-center text-xs text-slate-500">
                        {(days.length - 1 - i) % labelEvery === 0 ? dayMonth(d.date) : ""}
                    </span>
                ))}
            </div>

            <table className="sr-only">
                <caption>Food waste per day, target {baht(target)}</caption>
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
