// Shared by FactoryOrderCard, CompactView and TableView (kept here to avoid a circular import).
import type { OrderInputs, OrderRow } from "@/lib/orders/formula";

export type Line = { input: OrderInputs; row: OrderRow };

export type Handlers = {
    onLeft: (itemNo: string, value: string) => void;
    onOrder: (itemNo: string, value: number) => void;
    locked: boolean;
};

// Red = shortage or needs AM approval (S5), amber = last day (S4), null = followed the suggestion
export function tone(row: OrderRow): "red" | "amber" | null {
    if (row.shortage > 0 || row.needsApproval) return "red";
    if (row.lastDay) return "amber";
    return null;
}