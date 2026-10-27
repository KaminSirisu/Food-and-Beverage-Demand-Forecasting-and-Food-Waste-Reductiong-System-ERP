import type { Metadata } from "next";
import { getCurrentUser } from "@/lib/auth/dal";
import { ORDER_CUTOFF } from "@/lib/config";
import { getOrderInputs } from "@/lib/orders/queries";
import { formatHeaderTime } from "@/lib/time";
import { FactoryOrderCard } from "./_components/factory-order/FactoryOrderCard";
import { OrderEmptyState } from "./_components/factory-order/OrderEmptyState";

export const metadata: Metadata = { title: "Dashboard & Pre-Rush Alerts" };

export default async function DashboardPage() {
    const user = await getCurrentUser(); // G2: storeNo comes from the session, never the URL
    const order = await getOrderInputs(user.storeNo);

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-3xl font-bold text-slate-900">Today&apos;s Overview</h1>
                <p className="mt-1 text-sm text-slate-500">
                    {user.branchName} · {formatHeaderTime(new Date(order.serverNow))}
                </p>
            </div>

            {/* Lesson 8 adds the KPI row above and the Auto-Promotions column beside the order card */}
            <div className="grid gap-6 xl:grid-cols-5">
                <div className="xl:col-span-3">
                    {order.lines.length === 0 ? (
                        <OrderEmptyState />
                    ) : (
                        <FactoryOrderCard
                            lines={order.lines}
                            cutoff={ORDER_CUTOFF}
                            serverNow={order.serverNow}
                            confirmedAt={order.confirmedAt}
                        />
                    )}
                </div>
            </div>
        </div>
    );
}