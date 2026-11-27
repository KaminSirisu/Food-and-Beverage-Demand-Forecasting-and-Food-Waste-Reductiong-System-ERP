// Waste totals: short-term (7 days) vs monthly (30 days), always both, whatever the range toggle says.
import type { WasteTotals as Totals } from "@/lib/analytics/metrics";
import { WASTE_TARGET_PCT } from "@/lib/config";
import { baht } from "@/lib/format";

function Tile({ label, value, alert = false }: { label: string; value: string; alert?: boolean }) {
    return (
        <div className="rounded-xl border border-slate-200 p-4">
            <p className="text-xs text-slate-500">{label}</p>
            <p className={`mt-1 text-2xl font-bold ${alert ? "text-red-600" : "text-slate-900"}`}>{value}</p>
        </div>
    );
}

export function WasteTotals({ totals }: { totals: Totals }) {
    return (
        <section className="rounded-2xl border border-slate-200 bg-white p-6">
            <h2 className="text-lg font-bold text-slate-900">Waste Totals</h2>
            <p className="mt-0.5 text-sm text-slate-500">Short-term vs monthly</p>
            <div className="mt-4 grid grid-cols-2 gap-3">
                <Tile label="Last 7 days" value={baht(totals.last7)} />
                <Tile label="Last 30 days" value={baht(totals.last30)} />
                <Tile label="7-day avg / day" value={baht(totals.avg7)} alert={totals.avg7 > totals.targetAvg7} />
                <Tile label="Days over target (30d)" value={String(totals.daysOver30)} alert={totals.daysOver30 > 0} />
            </div>
            <p className="mt-3 text-xs text-slate-500">
                {totals.daysOver30} of the last 30 days went over their target ({WASTE_TARGET_PCT}% of that day&apos;s total sales;
                7-day average target {baht(totals.targetAvg7)}/day).
                1-day shelf-life items (Thai desserts, chiffon) carry the most risk.
            </p>
        </section>
    );
}
