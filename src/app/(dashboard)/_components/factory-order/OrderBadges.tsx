import { Badge } from "../Badge";
import type { OrderRow } from "@/lib/orders/formula";


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