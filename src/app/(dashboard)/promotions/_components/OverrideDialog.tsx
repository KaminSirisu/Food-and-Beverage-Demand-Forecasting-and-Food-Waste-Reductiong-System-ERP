"use client";
// SM9: Manual Override — one SKU's discount for today only. Uses the native <dialog> (focus trap + Esc for free).
import { useEffect, useRef, useState, type FormEvent } from "react";
import type { PromotionRow } from "@/lib/promotions/rules";
import { promoPrice } from "@/lib/promotions/rules";
import { baht } from "@/lib/format";

type Props = {
    row: PromotionRow | null; // null = closed
    pending: boolean;
    onSave: (discountPct: number) => void;
    onReset: () => void;
    onClose: () => void;
};

export function OverrideDialog({ row, pending, onSave, onReset, onClose }: Props) {
    const ref = useRef<HTMLDialogElement>(null);

    // Only syncs the browser dialog with `row`; the form state lives in OverrideForm
    useEffect(() => {
        const dialog = ref.current;
        if (!dialog) return;
        if (row && !dialog.open) dialog.showModal();
        else if (!row && dialog.open) dialog.close();
    }, [row]);

    return (
        <dialog
            ref={ref}
            onClose={onClose}
            className="m-auto w-full max-w-sm rounded-2xl p-0 shadow-xl backdrop:bg-slate-900/40"
            aria-labelledby="override-title"
        >
            {/* key: a new SKU starts a fresh form with its own current rate */}
            {row && <OverrideForm key={row.itemNo} row={row} pending={pending} onSave={onSave} onReset={onReset} onClose={onClose} />}
        </dialog>
    );
}

function OverrideForm({ row, pending, onSave, onReset, onClose }: Omit<Props, "row"> & { row: PromotionRow }) {
    const [value, setValue] = useState(String(row.discountPct));
    const pct = Number(value);
    const valid = value !== "" && Number.isInteger(pct) && pct >= 0 && pct <= 90;

    function submit(e: FormEvent<HTMLFormElement>) {
        e.preventDefault();
        if (valid) onSave(pct);
    }

    return (
        <form onSubmit={submit} className="space-y-4 p-6">
            <div>
                <h2 id="override-title" className="text-lg font-bold text-slate-900">Manual Override</h2>
                <p className="text-sm text-slate-500">
                    {row.nameTh} · {row.itemNo} · applies today only
                </p>
            </div>
            <label className="block text-sm font-medium text-slate-700">
                Discount rate (%)
                <input
                    type="number"
                    min={0}
                    max={90}
                    step={1}
                    required
                    autoFocus
                    value={value}
                    onChange={(e) => setValue(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-slate-900 invalid:border-red-400"
                />
            </label>
            <p className="text-xs text-slate-500">
                Rule rate {row.autoPct}% · Promo price {valid ? baht(promoPrice(row.price, pct)) : "—"} (from {baht(row.price)}).
                After saving, push it to POS again.
            </p>
            <div className="flex flex-wrap justify-between gap-2">
                {row.mode === "MANUAL" ? (
                    <button type="button" disabled={pending} onClick={onReset} className="rounded-lg px-3 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100 disabled:opacity-50">
                        Back to auto
                    </button>
                ) : <span />}
                <div className="flex gap-2">
                    <button type="button" onClick={onClose} className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50">
                        Cancel
                    </button>
                    <button type="submit" disabled={!valid || pending} className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50">
                        Save rate
                    </button>
                </div>
            </div>
        </form>
    );
}
