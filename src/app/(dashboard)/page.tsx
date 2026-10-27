import { getCurrentUser } from "@/lib/auth/dal";
import { ORDER_CUTOFF } from "@/lib/config";
import { getOrderInputs } from "@/lib/orders/queries";
import { FactoryOrderCard } from "./_components/factory-order/FactoryOrderCard";

export default async function DashboardPage() {
    const user = await getCurrentUser(); // G2: storeNo comes from the session, never the URL
    const order = await getOrderInputs(user.storeNo);

    return (
        <div className="space-y-6">
            <h1 className="text-3xl font-bold text-slate-900">Today&apos;s Overview</h1>
            <div className="max-w-3xl">
                <FactoryOrderCard lines={order.lines} cutoff={ORDER_CUTOFF} serverNow={order.serverNow} />
            </div>
        </div>
    );
}