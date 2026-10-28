import Link from "next/link";
import type { RiskSku } from "@/lib/dashboard/risk";
import { baht } from "@/lib/format";
import { Badge } from "./Badge";

const ACTION = "rounded-lg border border-slate-300 px-3 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50";

export function TopRiskTable({ risks }: { risks: RiskSku[] }) {
    return (
        <section className="rounded-2xl border border-slate-200 bg-white p-6">
            <h2 className="text-xl font-bold text-slate-900">Top Risk SKUs</h2>
            {risks.length === 0 ? (
                <p className="mt-4 text-sm text-slate-500">No shortage or waste risk for the rest of today.</p>
            ) : (
                <div className="mt-4 overflow-x-auto">
                    <table className="w-full min-w-140 text-sm">
                        <thead className="text-left text-xs uppercase text-slate-500">
                            <tr>
                                <th className="pb-2 font-medium">SKU</th>
                                <th className="pb-2 font-medium">Risk</th>
                                <th className="pb-2 text-right font-medium">At risk</th>
                                <th className="pb-2 text-right font-medium">Action</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {risks.map((r) => (
                                <tr key={r.itemNo}>
                                    <td className="py-3">
                                        <p className="font-semibold text-slate-900">{r.nameTh}</p>
                                        <p className="text-xs text-slate-500">{r.itemNo}</p>
                                    </td>
                                    <td>
                                        {r.kind === "SHORTAGE" ? (
                                            <Badge tone="red">Short ~{r.units}</Badge>
                                        ): (
                                            <Badge tone="amber">Waste {r.pct}% · {r.units} pcs</Badge>
                                        )}
                                    </td>
                                    <td className="text-right font-semibold text-slate-900">
                                        {baht(r.value)}
                                    </td>
                                    <td className="text-right">
                                        {r.kind === 'SHORTAGE' ? (
                                            <a href="#factory-order" className={ACTION}>Adjust Order</a>
                                        ) : (
                                            <Link href={`/promotions?sku=${encodeURIComponent(r.itemNo)}`} className={ACTION}>View Promo</Link>
                                        )}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </section>
    )
}