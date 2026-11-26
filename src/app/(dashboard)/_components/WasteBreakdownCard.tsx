import type { WasteByCategory } from "@/lib/waste/queries";
import { baht } from "@/lib/format";

const BAR: Record<string, string> = { ST: "bg-red-500", SC: "bg-amber-500", SB: "bg-indigo-500", SCP: "bg-emerald-500" };

// Manual 3.1.2 no. 5. The D365 export has no waste reason, so the only cause we can measure is
// "unsold at expiry" (1-day items delivered but not sold, orders/estimate.ts) — split by product group.
export function WasteBreakdownCard({ items }: { items: WasteByCategory[] }) {
    const total = items.reduce((s, i) => s + i.value, 0);
    return (
        <section className="rounded-2xl border border-slate-200 bg-white p-6">
            <h2 className="text-xl font-bold text-slate-900">Waste Cause Breakdown</h2>
            <p className="mt-1 text-sm text-slate-500">Last 7 days · unsold at expiry, by product group</p>
            {total === 0 ? (
                <p className="mt-4 text-sm text-slate-500">No waste recorded in the last 7 days.</p>
            ) : (
                <ul className="mt-4 space-y-3">
                    {items.map((i) => {
                        const pct = Math.round((i.value / total) * 100);
                        return (
                            <li key={i.code}>
                                <div className="flex items-baseline justify-between text-sm">
                                    <span className="font-medium text-slate-800">{i.name}</span>
                                    <span className="tabular-nums text-slate-600">
                                        <span className="font-semibold text-slate-900">{baht(i.value)}</span> · {i.qty} pcs · {pct}%
                                    </span>
                                </div>
                                <div className="mt-1 h-2 rounded-full bg-slate-100" aria-hidden>
                                    <div className={`h-2 rounded-full ${BAR[i.code] ?? "bg-slate-400"}`} style={{ width: `${pct}%` }} />
                                </div>
                            </li>
                        );
                    })}
                </ul>
            )}
        </section>
    );
}
