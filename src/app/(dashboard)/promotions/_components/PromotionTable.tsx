"use client";
// S7 / SM9 / SM10: SKUs approaching expiry or over-stock, their discount and the (simulated) push to POS.
import { useState, useTransition } from "react";
import { sileo } from "sileo";
import type { PosStatus, PromotionRow } from "@/lib/promotions/rules";
import { canPush } from "@/lib/promotions/rules";
import { baht } from "@/lib/format";
import { overrideDiscount, pushDiscount, resetToAuto, type PromoResult } from "../actions";
import { OverrideDialog } from "./OverrideDialog";

const STATUS: Record<PosStatus, { label: string; className: string }> = {
    LIVE: { label: "Live on POS", className: "bg-emerald-50 text-emerald-700" },
    PENDING: { label: "Pending push", className: "bg-amber-50 text-amber-700" },
    NONE: { label: "No promotion", className: "bg-slate-100 text-slate-500" },
};

// ≤ 1 day red (expires today), 2 days amber, longer neutral
function shelfLifeClass(days: number): string {
    if (days <= 1) return "text-red-600 font-semibold";
    if (days === 2) return "text-amber-600 font-semibold";
    return "text-slate-700";
}

const BTN = "w-full rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors disabled:cursor-not-allowed";

export function PromotionTable({ rows }: { rows: PromotionRow[] }) {
    const [editing, setEditing] = useState<PromotionRow | null>(null);
    const [pushing, setPushing] = useState<string | null>(null); // itemNo being pushed → "Pushing…" on that button only
    const [pending, startTransition] = useTransition();

    function run(itemNo: string, action: () => Promise<PromoResult>, success: string, onDone?: () => void) {
        startTransition(async () => {
            const result = await action();
            setPushing(null);
            if (!result.ok) {
                sileo.error({ title: "Not saved", description: result.error });
                return;
            }
            sileo.success({ title: success, description: itemNo });
            onDone?.();
        });
    }

    return (
        <section className="rounded-2xl border border-slate-200 bg-white">
            <div className="border-b border-slate-100 p-5">
                <h2 className="text-lg font-bold text-slate-900">SKUs Approaching Expiry / Over-Stock</h2>
                <p className="text-xs text-slate-500">Auto rates are set by the rule and locked. Use Manual Override to change one SKU&apos;s rate for today only.</p>
            </div>
            <div className="overflow-x-auto">
                <table className="w-full min-w-240 text-sm">
                    <thead className="bg-slate-50 text-left text-xs text-slate-500">
                        <tr>
                            <th className="px-5 py-3 font-medium">SKU Name</th>
                            <th className="px-3 py-3 font-medium">Category</th>
                            <th className="px-3 py-3 font-medium">Shelf Life</th>
                            <th className="px-3 py-3 text-right font-medium">Price</th>
                            <th className="px-3 py-3 text-right font-medium">Current Stock</th>
                            <th className="px-3 py-3 text-right font-medium">Auto-Discount Rate</th>
                            <th className="px-3 py-3 text-right font-medium">Promo Price</th>
                            <th className="px-3 py-3 font-medium">POS Sync Status</th>
                            <th className="px-5 py-3 font-medium">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                        {rows.map((r) => {
                            const status = STATUS[r.status];
                            const busy = pending && pushing === r.itemNo;
                            return (
                                <tr key={r.itemNo} data-testid={`promo-row-${r.itemNo}`}>
                                    <td className="px-5 py-4">
                                        <p className="font-semibold text-slate-900">{r.nameTh}</p>
                                        <p className="text-xs text-slate-500">{r.itemNo}</p>
                                        {r.atRisk && (
                                            <p className="mt-0.5 text-xs text-red-600">
                                                {r.risk.reason === "EXPIRY" ? "Expires tonight" : "Over-stock"} · {r.risk.units} units ({r.risk.pct}%)
                                            </p>
                                        )}
                                    </td>
                                    <td className="px-3 py-4 text-slate-700">{r.categoryName}</td>
                                    <td className={`px-3 py-4 ${shelfLifeClass(r.shelfLifeDays)}`}>
                                        {r.shelfLifeDays} {r.shelfLifeDays === 1 ? "day" : "days"}
                                    </td>
                                    <td className="px-3 py-4 text-right text-slate-700">{baht(r.price)}</td>
                                    <td className="px-3 py-4 text-right text-slate-700">{r.stock}</td>
                                    <td className="px-3 py-4 text-right">
                                        <span className="text-base font-bold text-slate-900">{r.discountPct}%</span>{" "}
                                        <span className={`rounded px-1.5 py-0.5 text-xs ${r.mode === "MANUAL" ? "bg-indigo-100 text-indigo-700" : "bg-slate-100 text-slate-500"}`}>
                                            {r.mode === "MANUAL" ? "Manual" : "Auto"}
                                        </span>
                                    </td>
                                    <td className="px-3 py-4 text-right font-bold text-slate-900">{baht(r.promoPrice)}</td>
                                    <td className="px-3 py-4">
                                        <span className={`whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-medium ${status.className}`}>● {status.label}</span>
                                    </td>
                                    <td className="space-y-2 px-5 py-4">
                                        {r.status === "LIVE" ? (
                                            <button type="button" disabled className={`${BTN} bg-emerald-100 text-emerald-700`}>
                                                Pushed ✓
                                            </button>
                                        ) : (
                                            <button
                                                type="button"
                                                disabled={!canPush(r) || pending}
                                                onClick={() => {
                                                    setPushing(r.itemNo);
                                                    run(r.itemNo, () => pushDiscount(r.itemNo), `Discount ${r.discountPct}% live on POS`);
                                                }}
                                                className={`${BTN} bg-emerald-600 text-white hover:bg-emerald-700 disabled:bg-emerald-200`}
                                            >
                                                {busy ? "Pushing…" : "Push Discount to POS"}
                                            </button>
                                        )}
                                        <button
                                            type="button"
                                            disabled={pending}
                                            onClick={() => setEditing(r)}
                                            className={`${BTN} border border-slate-300 text-slate-700 hover:bg-slate-50 disabled:opacity-50`}
                                        >
                                            Manual Override
                                        </button>
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>
            <p className="px-5 py-3 text-xs text-slate-500">
                <span className="rounded bg-slate-100 px-1.5 py-0.5">Auto</span> rate comes from the category rule in Branch Thresholds and cannot be edited here.{" "}
                <span className="rounded bg-indigo-100 px-1.5 py-0.5 text-indigo-700">Manual</span> rate was set by you with Manual Override and applies today only.
            </p>

            <OverrideDialog
                row={editing}
                pending={pending}
                onClose={() => setEditing(null)}
                onSave={(pct) => editing && run(editing.itemNo, () => overrideDiscount({ itemNo: editing.itemNo, discountPct: pct }), `Manual rate ${pct}% saved`, () => setEditing(null))}
                onReset={() => editing && run(editing.itemNo, () => resetToAuto(editing.itemNo), "Back to the auto rate", () => setEditing(null))}
            />
        </section>
    );
}
