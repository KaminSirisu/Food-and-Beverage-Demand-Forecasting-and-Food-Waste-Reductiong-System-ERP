// Pre-Rush risk rules for the dashboard: shortage and waste risk per SKU. Pure, like formula.ts.
import { computeRow, type OrderInputs } from "@/lib/orders/formula";

export type RiskKind = "SHORTAGE" | "WASTE";

export type RiskSku = {
    itemNo: string;
    nameTh: string;
    kind: RiskKind;
    units: number; // SHORTAGE: units we run out of before close · WASTE: units left at close on the last day
    pct: number; // WASTE: % of stock left at close · SHORTAGE: 0
    value: number; // ฿ at risk = units × price → one scale to rank both kinds
};

/** SKUs with a shortage, or a waste risk at/above the branch threshold. Biggest ฿ first. */
export function riskSkus(lines: OrderInputs[], wasteRiskThreshold: number): RiskSku[] {
    const risks: RiskSku[] = [];
    for (const line of lines) {
        const row = computeRow(line);
        const base = { itemNo: line.itemNo, nameTh: line.nameTh };
        // A line can't be both: a shortage means nothing is left tonight, so waste risk is 0
        if (row.shortage > 0) {
            risks.push({ ...base, kind: "SHORTAGE", units: row.shortage, pct: 0, value: row.shortage * line.price });
        } else if (row.wasteRiskPct > 0 && row.wasteRiskPct >= wasteRiskThreshold) {
            risks.push({ ...base, kind: "WASTE", units: row.tonight, pct: row.wasteRiskPct, value: row.tonight * line.price });
        }
    }
    return risks.sort((a, b) => b.value - a.value);
}

export function sumValue(risks: RiskSku[], kind: RiskKind): number {
    return risks.filter((r) => r.kind === kind).reduce((sum, r) => sum + r.value, 0);
}