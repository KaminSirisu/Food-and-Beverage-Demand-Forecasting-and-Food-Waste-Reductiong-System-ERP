// Last check before saving: totals, and which lines will go to the Area Manager (S5).
import { baht } from "@/lib/format";
import type { Line } from "./order-view";

type Props = {
    rows: Line[];
    totals: { ordered: number; value: number };
    pending: boolean;
    onBack: () => void;
    onConfirm: () => void;
};

export function ReviewPanel({ rows, totals, pending, onBack, onConfirm }: Props) {
    const needsAm = rows.filter(({ row }) => row.needsApproval);

    return (
        <div role="region" aria-label="Review order" className="mt-4 rounded-lg border border-emerald-200 bg-emerald-50 p-4">
            <p className="font-semibold text-slate-900">
                Send {totals.ordered} pcs ({baht(totals.value)}) to the factory for tomorrow?
            </p>
            {needsAm.length > 0 ? (
                <ul className="mt-2 space-y-1 text-sm text-indigo-700">
                    {needsAm.map(({ input, row }) => (
                        <li key={input.itemNo}>
                            {input.itemNo}: order {row.ordered} vs suggested {row.suggested} → needs AM approval
                        </li>
                    ))}
                </ul>
            ) : (
                <p className="mt-2 text-sm text-slate-600">All lines are within 20% of Suggested and will be auto-approved.</p>
            )}
            <div className="mt-3 flex gap-3">
                <button type="button" onClick={onBack} disabled={pending} className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50">
                    Back
                </button>
                <button type="button" onClick={onConfirm} disabled={pending} className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:bg-slate-300">
                    {pending ? "Saving…" : "Confirm order"}
                </button>
            </div>
        </div>
    );
}