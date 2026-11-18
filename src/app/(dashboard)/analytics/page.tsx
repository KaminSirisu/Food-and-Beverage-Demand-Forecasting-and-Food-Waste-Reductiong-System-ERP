import type { Metadata } from "next";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth/dal";
import { getAnalytics } from "@/lib/analytics/queries";
import { AnalyticsFilters } from "./_components/AnalyticsFilters";
import { ForecastLineChart } from "./_components/ForecastLineChart";
import { ModelBadge } from "./_components/ModelBadge";
import { SkuAccuracyTable } from "./_components/SkuAccuracyTable";
import { WasteTotals } from "./_components/WasteTotals";
import { WasteTrendChart } from "./_components/WasteTrendChart";

export const metadata: Metadata = { title: "Forecast vs. Actual Analytics" };

// Anything unexpected in the URL falls back to the default view instead of erroring
const Params = z.object({
    range: z.coerce.number().refine((r) => r === 7 || r === 30).catch(7),
    category: z.string().regex(/^[A-Z]{2,4}$/).optional().catch(undefined),
});

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

export default async function AnalyticsPage({ searchParams }: Props) {
    const user = await getCurrentUser(); // G2: storeNo comes from the session, never the URL
    const { range, category } = Params.parse(await searchParams);
    const data = await getAnalytics(user.storeNo, { range: range as 7 | 30, category: category ?? null });

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-3xl font-bold text-slate-900">Forecast vs. Actual Analytics</h1>
                <p className="mt-1 text-sm text-slate-500">
                    Compare the LightGBM demand reference with actual POS sales for in-scope SKUs at {user.branchName}.
                </p>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3">
                <AnalyticsFilters range={range} category={data.category} categories={data.categories} />
                <ModelBadge model={data.model} />
            </div>

            <ForecastLineChart series={data.series} skuCount={data.skuCount} range={range} />

            <div className="grid gap-6 lg:grid-cols-5">
                <div className="lg:col-span-3">
                    <WasteTrendChart days={data.waste} target={data.wasteTarget} />
                </div>
                <div className="lg:col-span-2">
                    <WasteTotals totals={data.wasteTotals} target={data.wasteTarget} />
                </div>
            </div>

            <SkuAccuracyTable rows={data.rows} range={range} latestDate={data.series.at(-1)?.date} />

            <p className="rounded-xl border border-indigo-100 bg-indigo-50 px-4 py-3 text-xs text-indigo-700">
                Forecast values are a reference for alert interpretation only and are kept separate from the client&apos;s
                production-planning forecast.
            </p>
        </div>
    );
}
