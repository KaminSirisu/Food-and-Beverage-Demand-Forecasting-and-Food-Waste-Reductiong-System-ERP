// Dashboard: Daily Waste vs Target, last 7 days (SM7). Each day's target is 5% of that day's total sales
// (today: of the expected sales), drawn as a dashed line that moves with sales (WasteTargetPlot).
import type { WasteDay } from "@/lib/dashboard/queries";
import { isOverTarget } from "@/lib/waste/target";
import { WasteTargetPlot } from "./WasteTargetPlot";

// `date` is already a Bangkok day ("YYYY-MM-DD"), so format it as UTC, not shifted again
const WEEKDAY = new Intl.DateTimeFormat("en-GB", { weekday: "short", timeZone: "UTC" });

export function WasteChart({ days }: { days: WasteDay[] }) {
    const overDays = days.filter(isOverTarget).length;
    return (
        <section className="rounded-2xl border border-slate-200 bg-white p-6">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
                <h2 className="text-xl font-bold text-slate-900">Daily Waste vs Target</h2>
                <p className="text-sm text-slate-500">Last 7 days · {overDays} over target</p>
            </div>
            <WasteTargetPlot
                days={days}
                heightClass="h-48"
                label={(d, i) => (i === days.length - 1 ? "Today" : WEEKDAY.format(new Date(`${d.date}T00:00:00Z`)))}
            />
        </section>
    );
}
