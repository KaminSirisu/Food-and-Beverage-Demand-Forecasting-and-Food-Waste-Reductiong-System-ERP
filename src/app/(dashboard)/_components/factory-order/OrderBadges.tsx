import type { ReactNode } from "react";
import type { OrderRow } from "@/lib/orders/formula";

const TONES = {
    amber: "bg-amber-100 text-amber-800",
    red: "bg-red-100 text-red-700",
    indigo: "bg-indigo-100 text-indigo-700"
}

function Badge({ tone, children }: { tone: keyof typeof TONES; children: ReactNode}) {
    return <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${TONES[tone]}`}>{children}</span>
}
// S4 last day · shortage · S5 approval
export function OrderBadges({ row }: { row: OrderRow }) {
    if (!row.lastDay && row.shortage === 0 && !row.needsApproval) return null;
    return (
        <div className="mt-1 flex flex-wrap gap-1">
            {row.lastDay && <Badge tone="amber">Last day</Badge>}
            {row.shortage > 0 && <Badge tone="red">Short ~{row.shortage}</Badge>}
            {row.needsApproval && <Badge tone="indigo">Needs AM approval</Badge>}
        </div>
    );
}