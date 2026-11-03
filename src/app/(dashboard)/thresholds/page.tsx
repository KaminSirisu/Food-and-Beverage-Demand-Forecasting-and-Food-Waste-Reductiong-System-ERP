import type { Metadata } from "next";
import { getCurrentUser } from "@/lib/auth/dal";
import { getThresholds } from "@/lib/thresholds/queries";
import { ThresholdsForm } from "./_components/ThresholdsForm";

export const metadata: Metadata = { title: "Branch Thresholds & Checkpoints" };

export default async function ThresholdsPage() {
    const user = await getCurrentUser();

    const data = await getThresholds(user.storeNo);
    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-3xl font-bold text-slate-900">Branch Alert Thresholds</h1>
                <p className="mt-1 text-sm text-slate-500">{user.branchName} · set by the Store Manager</p>
            </div>
            {/* key: after Save, refresh() brings a new lastEdited → the form remounts with the saved values */}
            <ThresholdsForm key={data.lastEdited?.at.toISOString() ?? "new"} data={data} />
        </div>
    )
}