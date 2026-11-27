// Food waste ฿ per day vs each day's target, 5% of that day's total sales (branch-level, so the category filter
// doesn't apply). Same plot as the dashboard's Daily Waste vs Target (WasteTargetPlot).
import { dayMonth } from "@/lib/format";
import type { WasteDay } from "@/lib/waste/target";
import { WasteTargetPlot } from "../../_components/WasteTargetPlot";

export function WasteTrendChart({ days }: { days: WasteDay[] }) {
    const labelEvery = Math.ceil(days.length / 7); // 30 days → about 7 labels, 7 days → all of them
    return (
        <section className="rounded-2xl border border-slate-200 bg-white p-6">
            <h2 className="text-lg font-bold text-slate-900">Food Waste Trend</h2>
            <p className="mt-0.5 text-sm text-slate-500">฿ per day · last {days.length} days · whole branch</p>
            <WasteTargetPlot
                days={days}
                heightClass="h-40"
                label={(d, i) => ((days.length - 1 - i) % labelEvery === 0 ? dayMonth(d.date) : "")}
            />
        </section>
    );
}
