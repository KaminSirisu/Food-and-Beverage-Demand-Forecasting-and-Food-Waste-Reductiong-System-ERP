import Link from "next/link";
import type { PromoCandidate } from "@/lib/dashboard/queries";
import { baht } from "@/lib/format";
import { Badge, type BadgeTone } from "./Badge";

const STATUS: Record<string, { label: string; tone: BadgeTone }> = {
    SUGGESTED: { label: "Suggested", tone: "slate" },
    PENDING: { label: "Pending POS", tone: "amber" },
    LIVE: { label: "Live", tone: "green" },
    NONE: { label: "Not pushed", tone: "slate" },
};

// Last-day SKUs at/above the branch waste-risk threshold → discount suggestion. The Promotions page pushes it to POS.
export function AutoPromotionsCard({ promos }: { promos: PromoCandidate[] }) {
    return (
        <section className="rounded-2xl border border-slate-200 bg-white p-6">
            <div className="flex items-center justify-between">
                <h2 className="text-xl font-bold text-slate-900">Auto-Promotions</h2>
                <Link href="/promotions" className="text-sm font-semibold text-emerald-600 hover:underline">
                    Open engine
                </Link>
            </div>
            {promos.length === 0 ? (
                <p className="mt-4 text-sm text-slate-500">No item is above the waste-risk threshold right now.</p>
            ) : (
                <ul className="mt-4 divide-y divide-slate-100">
                    {promos.map((p) => {
                        const status = STATUS[p.status] ?? STATUS.SUGGESTED;
                        return (
                            <li key={p.itemNo} className="flex items-center justify-between gap-3 py-3">
                                <div className="min-w-0">
                                    <p className="truncate font-semibold text-slate-900">{p.nameTh}</p>
                                    <p className="text-xs text-slate-500">
                                        {p.itemNo} · {p.units} left at close ({p.pct}%) · {baht(p.value)} at risk
                                    </p>
                                </div>
                                <div className="flex shrink-0 flex-col items-end gap-1">
                                    <span className="text-lg font-bold text-emerald-600">−{p.discountPct}%</span>
                                    <Badge tone={status.tone}>{status.label}</Badge>
                                </div>
                            </li>
                        )
                    })}
                </ul>
            )}
        </section>
    )
}