// Pre-Rush risk rules for the dashboard: shortage and waste risk per SKU. Pure, like formula.ts.
// Waste risk uses the same rule as the Waste & Auto-Promotion page (lib/promotions/rules.ts, S7).
import { computeRow, type OrderInputs } from "@/lib/orders/formula";
import { isAtRisk, wasteRisk } from "@/lib/promotions/rules";

export type RiskKind = "SHORTAGE" | "WASTE";

export type RiskSku = {
    itemNo: string;
    nameTh: string;
    kind: RiskKind;
    units: number; // SHORTAGE: units we run out of before close · WASTE: units expected to be wasted
    pct: number; // WASTE: % of stock expected to be wasted · SHORTAGE: 0
    value: number; // ฿ at risk = units × price → one scale to rank both kinds
};

/** SKUs with a shortage, or a waste risk at/above their category's threshold (S7). Biggest ฿ first. */
export function riskSkus(lines: OrderInputs[], wasteRiskFor: (categoryCode: string) => number): RiskSku[] {
    const risks: RiskSku[] = [];
    for (const line of lines) {
        const row = computeRow(line);
        const base = { itemNo: line.itemNo, nameTh: line.nameTh };
        const waste = wasteRisk(row);
        // A line can't be both: a shortage means nothing is left tonight, so waste risk is 0
        if (row.shortage > 0) {
            risks.push({ ...base, kind: "SHORTAGE", units: row.shortage, pct: 0, value: row.shortage * line.price });
        } else if (isAtRisk(waste, wasteRiskFor(line.categoryCode))) {
            risks.push({ ...base, kind: "WASTE", units: waste.units, pct: waste.pct, value: waste.units * line.price });
        }
    }
    return risks.sort((a, b) => b.value - a.value);
}

export function sumValue(risks: RiskSku[], kind: RiskKind): number {
    return risks.filter((r) => r.kind === kind).reduce((sum, r) => sum + r.value, 0);
}
