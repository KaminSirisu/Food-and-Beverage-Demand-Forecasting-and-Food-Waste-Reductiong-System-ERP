"use client";
// SM3 / SM4 / S4 / S5: tomorrow's factory order. Compact box on the dashboard; "View all items" expands the full table in place.
import { useState, useTransition } from "react";
import { sileo } from "sileo";
import { formatClock } from "@/lib/time";
import { confirmOrder } from "../../actions";
import { ReviewPanel } from "./ReviewPanel";
import { computeRow, type OrderInputs } from "@/lib/orders/formula";
import { baht } from "@/lib/format";
import { CompactView } from "./CompactView";
import { CutoffBadge, useMinutesLeft } from "./CutoffBadge";
import { type Handlers, type Line } from "./order-view";
import { TableView } from "./TableView";

type Props = { lines: OrderInputs[]; cutoff: string; serverNow: number; confirmedAt: Date | null };

export function FactoryOrderCard({ lines, cutoff, serverNow, confirmedAt }: Props) {
    const [mode, setMode] = useState<"compact" | "all">("compact");
    // SM4: Left now as typed by the manager (starts at the latest snapshot)
    const [leftNow, setLeftNow] = useState<Record<string, number>>(() =>
        Object.fromEntries(lines.map((l) => [l.itemNo, l.leftNow])),
    );
    // Order chosen by the manager. No entry = follow Suggested, so a new Left now moves Order too.
    const [ordered, setOrdered] = useState<Record<string, number>>(() => 
        Object.fromEntries(lines.flatMap((l) => (l.savedOrdered == null ? [] : [[l.itemNo, l.savedOrdered]]))),
    )
    const minutesLeft = useMinutesLeft(cutoff, serverNow);
    const locked = minutesLeft <= 0; // UI lock only — the server action enforces it again (Lesson 5)
    const [reviewing, setReviewing] = useState(false);
    const [pending, startTransition] = useTransition();
    
    // Derived every render, never stored in state → can't go stale
    const rows: Line[] = lines.map((input) => ({
        input,
        row: computeRow(input, leftNow[input.itemNo], ordered[input.itemNo]),
    }));
    const totals = rows.reduce(
        (t, { input, row }) => ({
            suggested: t.suggested + row.suggested,
            ordered: t.ordered + row.ordered,
            value: t.value + row.ordered * input.price,
        }),
        { suggested: 0, ordered: 0, value: 0 },
    );

    const handlers: Handlers = {
        locked,
        onLeft: (itemNo, value) => {
            const n = Number(value);
            if (Number.isInteger(n) && n >= 0) setLeftNow((prev) => ({ ...prev, [itemNo]: n }));
        },
        onOrder: (itemNo, value) => setOrdered((prev) => ({ ...prev, [itemNo]: value })),
    };

    const submit = () => 
        startTransition(async () => {
            const result = await confirmOrder(
                rows.map(({ input, row }) => ({ itemNo: input.itemNo, leftNow: row.leftNow, ordered: row.ordered })),
            );
            if (!result.ok) {
                sileo.error({ title: "Order not saved", description: result.error });
                return;
            }
            setReviewing(false);
            sileo.success({
                title: "Order confirmed",
                description: result.pendingAm.length
                    ? `Sent for AM approval: ${result.pendingAm.join(", ")}`
                    : "All lines auto-approved.",
            });
        })

    return (
        <section id="factory-order" className="scroll-mt-6 rounded-2xl border border-slate-200 bg-white p-6">
            <h2 className="text-xl font-bold text-slate-900">Tomorrow&apos;s Factory Order</h2>
            {mode === "all" && (
                <p className="mt-1 text-sm text-slate-500">
                    Change Left now if the case count differs. Suggested updates, then change Order only if you know something the system does not.
                </p>
            )}
            <div className="mt-3 flex flex-wrap items-center gap-3">
                <CutoffBadge cutoff={cutoff} minutesLeft={minutesLeft} />
                {confirmedAt && <span className="text-sm text-emerald-700">✓ Confirmed at {formatClock(confirmedAt)}</span>}
            </div>
            {mode === "compact" ? <CompactView rows={rows} totals={totals} {...handlers} /> : <TableView rows={rows} {...handlers} />}
            {reviewing && <ReviewPanel rows={rows} totals={totals} pending={pending} onBack={() => setReviewing(false)} onConfirm={submit} />}
            <footer className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-4">
                <p className="font-semibold text-slate-900">
                    Suggested {totals.suggested} pcs · Your order {totals.ordered} pcs · Total value {baht(totals.value)}
                </p>
                <div className="flex gap-3">
                    <button
                        type="button"
                        onClick={() => setMode(mode === "all" ? "compact" : "all")}
                        className="rounded-lg border border-emerald-600 px-4 py-2 text-sm font-semibold text-emerald-700 hover:bg-emerald-50"
                    >
                        {mode === "all" ? "Show less" : "View all items"}
                    </button>
                    <button
                        type="button"
                        disabled={locked || reviewing}
                        onClick={() => setReviewing(true)}
                        className="rounded-lg bg-emerald-500 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-600 disabled:cursor-not-allowed disabled:bg-slate-300"
                    >
                        Review &amp; Confirm Order →
                    </button>
                </div>
            </footer>
        </section>
    )
}