import type { Metadata } from "next";
import { getCurrentUser } from "@/lib/auth/dal";
import { getPromotions } from "@/lib/promotions/queries";
import { EngineToggle } from "./_components/EngineToggle";
import { PromoEmptyState } from "./_components/PromoEmptyState";
import { PromoKpis } from "./_components/PromoKpis";
import { PromotionTable } from "./_components/PromotionTable";
import { TriggerBanner } from "./_components/TriggerBanner";

export const metadata: Metadata = { title: "Waste & Auto-Promotion Engine" };

// S7 / SM9 / SM10: waste-risk SKUs, the category auto-discount and the (simulated) push to POS
export default async function PromotionsPage() {
    const user = await getCurrentUser(); // G2: storeNo comes from the session, never the URL
    const data = await getPromotions(user.storeNo);

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-3xl font-bold text-slate-900">Waste Mitigation &amp; Automated Promotion Management</h1>
                <p className="mt-1 text-sm text-slate-500">
                    Discounts are triggered by the waste-risk and promotion thresholds you set for {user.branchName}.
                </p>
            </div>

            <PromoKpis kpis={data.kpis} />
            <EngineToggle engineOn={data.engineOn} checkpoints={data.checkpoints} lastPushAt={data.lastPushAt} />
            <TriggerBanner triggers={data.triggers} />

            {data.rows.length === 0 ? <PromoEmptyState /> : <PromotionTable rows={data.rows} />}
        </div>
    );
}
