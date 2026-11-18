// Alert engine (SM5, SM6, SM7): today's risks -> SHORTAGE_RISK / WASTE_RISK alerts.
// Same inputs and rule as the dashboard Top Risk table, so the bell and the dashboard always agree.
import "server-only";
import { riskSkus } from "../dashboard/risk";
import { getOrderInputs } from "../orders/queries";
import { getBranchRules } from "../thresholds/queries";
import { createAlert } from "./create";
import { alertsFromRisks } from "./rules";

export type EvaluateResult = { atRisk: number; created: number };

export async function evaluateAlerts(storeNo: number, now = new Date()): Promise<EvaluateResult> {
    const [ order, rules ] = await Promise.all([getOrderInputs(storeNo, now), getBranchRules(storeNo)]);
    const risks = riskSkus(order.lines, (code) => rules.forCategory(code).wasteRiskPct);
    const drafts = alertsFromRisks(risks);

    // One after another, not Promise.all: at most 8 SKUs, and it keeps the Neon pool free for page requests
    let created = 0;
    for (const draft of drafts) {
        if (await createAlert(storeNo, draft, "system", now)) created++;
    }
    return { atRisk: drafts.length, created };
}