// Dashboard box: flagged lines with a stepper, the rest collapsed into one summary line.
import { baht } from "@/lib/format";
import { OrderBadges } from "./OrderBadges";
import { Stepper } from "./Stepper";
import { tone, type Handlers, type Line } from "./order-view";

type Props = { rows: Line[]; totals: { suggested: number; value: number } } & Handlers;

export function CompactView({ rows, totals, onOrder, locked }: Props) {
    const review = rows.filter(({ row }) => tone(row) !== null);
    const followed = rows.filter(({ row }) => tone(row) === null);
    const box = { red: "border-red-200 bg-red-50", amber: "border-amber-200 bg-amber-50" };

    return (
        <div className="mt-4 space-y-4">
            <div className="grid grid-cols-3 gap-3">
                <Stat label="Suggested" value={`${totals.suggested} PCS`} />
                <Stat label="Needs review" value={`${review.length} Items`} accent />
                <Stat label="Total value" value={baht(totals.value)} />
            </div>

            {review.length > 0 && (
                <div className="space-y-2">
                    <h3 className="text-sm font-semibold text-slate-900">Needs review</h3>
                    {review.map(({ input, row }) => (
                        <div key={input.itemNo} className={`flex items-center justify-between rounded-lg border p-3 ${box[tone(row)!]}`}>
                            <div>
                                <p className="text-sm font-semibold text-slate-900">{input.itemNo} · {input.nameTh}</p>
                                <p className="text-xs text-slate-500">Suggested {row.suggested}</p>
                                <OrderBadges row={row} />
                            </div>
                            <Stepper label={`${input.itemNo} order`} value={row.ordered} onChange={(v) => onOrder(input.itemNo, v)} disabled={locked} />
                        </div>
                    ))}
                </div>
            )}

            {followed.length > 0 && (
                <div className="rounded-lg bg-slate-50 p-3">
                    <p className="text-sm font-semibold text-slate-900">{followed.length} other items followed the suggestion</p>
                    <p className="text-xs text-slate-500">
                        {followed.map(({ input }) => input.itemNo).join(", ")} · {followed.reduce((n, { row }) => n + row.ordered, 0)} PCS
                    </p>
                </div>
            )}
        </div>
    );
}

function Stat({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
    return (
        <div className="rounded-lg border border-slate-200 p-3">
            <p className="text-xs text-slate-500">{label}</p>
            <p className={`text-lg font-bold ${accent ? "text-red-600" : "text-slate-900"}`}>{value}</p>
        </div>
    );
}