import type { Metadata } from "next";
import { Trash2, TrendingDown } from "lucide-react";
import { getCurrentUser } from "@/lib/auth/dal";
import { ORDER_CUTOFF, WASTE_TARGET_PCT } from "@/lib/config";
import { getDashboard } from "@/lib/dashboard/queries";
import { baht } from "@/lib/format";
import { AutoPromotionsCard } from "./_components/AutoPromotionsCard";
import { KpiCard } from "./_components/KpiCard";
import { FactoryOrderCard } from "./_components/factory-order/FactoryOrderCard";
import { OrderEmptyState } from "./_components/factory-order/OrderEmptyState";
import { WasteChart } from "./_components/WasteChart";
import { TopRiskTable } from "./_components/TopRiskTable";
import { WasteBreakdownCard } from "./_components/WasteBreakdownCard";

export const metadata: Metadata = { title: "Dashboard & Pre-Rush Alerts" };

export default async function DashboardPage() {
    const user = await getCurrentUser(); // G2: storeNo comes from the session, never the URL
    const data = await getDashboard(user.storeNo);
    const { order } = data;
    // Manual 3.1.2 no. 1: waste is only known at close, so show what's logged so far + what tonight will add
    const wasteTotal = data.wasteToday + data.wasteProjected;
    // SM7: today's target = 5% of today's expected total sales (waste/target.ts)
    const targetToday = data.wasteLast7Days.at(-1)?.target ?? 0;
    const overTarget = wasteTotal > targetToday;
    const targetText = `target ${baht(targetToday)} (${WASTE_TARGET_PCT}% of sales)`;
    const wasteHint = data.wasteProjected > 0
        ? `${baht(data.wasteProjected)} projected unsold at close${data.wasteToday > 0 ? ` + ${baht(data.wasteToday)} logged` : ""} · ${targetText}`
        : `Nothing expected left at close · ${targetText}`;

    return (
        <div className="space-y-4">
            <div>
                <h1 className="text-3xl font-bold text-slate-900">Today&apos;s Overview</h1>
                <p className="mt-1 text-sm text-slate-500">
                    {user.branchName}
                </p>
            </div>

            <div className="grid gap-6 sm:grid-cols-2">
                <KpiCard 
                    label="Value of Waste (today, projected)"
                    value={baht(wasteTotal)}
                    hint={wasteHint}
                    icon={<Trash2 className="size-5" aria-hidden />}
                    alert={overTarget}
                />
                <KpiCard
                    label="Lost-sales Risk"
                    value={baht(data.lostSalesRisk)}
                    hint="Expected sell-outs before close × price"
                    icon={<TrendingDown className="size-5" aria-hidden />}
                    alert={data.lostSalesRisk > 0}
                />
            </div>

            <div className="grid gap-6 xl:grid-cols-5">
                <div className="xl:col-span-3">
                    {order.lines.length === 0 ? (
                        <OrderEmptyState />
                    ) : (
                        <FactoryOrderCard
                            lines={order.lines}
                            notOnSale={order.notOnSale}
                            cutoff={ORDER_CUTOFF}
                            serverNow={order.serverNow}
                            confirmedAt={order.confirmedAt}
                            provisional={order.provisional}
                        />
                    )}
                </div>
                <div className="space-y-6 xl:col-span-2">
                    <AutoPromotionsCard promos={data.promos} />
                    <WasteBreakdownCard items={data.wasteByCategory} />
                </div>
            </div>
            <WasteChart days={data.wasteLast7Days} />
            <TopRiskTable risks={data.topRisk} />
        </div>
    );
}