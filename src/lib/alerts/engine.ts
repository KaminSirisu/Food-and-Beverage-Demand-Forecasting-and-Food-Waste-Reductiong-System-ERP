// Alert engine (SM5, SM6, S7): today's risks -> SHORTAGE_RISK / WASTE_RISK alerts.
// Same inputs and rule as the dashboard Top Risk table, so the bell and the dashboard always agree.
import "server-only";
import { riskSkus } from "@/lib/dashboard/risk";
import { getOrderInputs } from "@/lib/orders/queries";
import { getBranchRules } from "@/lib/thresholds/queries";
import { createAlert } from "./create";
import { alertsFromRisks } from "./rules";
import { cheerDrafts, opportunityDrafts, type CheckpointKind } from "./checkpoints";
import { db } from "@/lib/db";
import { openingStockToday } from "@/lib/orders/estimate";
import { bangkokHHmm, todayDate } from "@/lib/time";

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

export type CheckpointResult = { kind: CheckpointKind; at: string; atRisk: number; created: number };

/**
 * SM5 / SM6: run each checkpoint once a day, when the clock passes the time set on Branch Thresholds & Checkpoints
 * (editable, so it's read every time). Called every minute by the server timer (instrumentation.ts) and by each
 * Simulate/Live sync. The Opportunity check is skipped once the Cheer time has passed (too late to produce).
 * NFR5: each run is written to the audit log, which is also how "already ran today" is known.
 */
export async function runDueCheckpoints(storeNo: number, now = new Date()): Promise<CheckpointResult[]> {
    const rules = await getBranchRules(storeNo);
    const clock = bangkokHHmm(now);
    const day = todayDate(now).toISOString().slice(0, 10);
    const { opportunityCheckAt: oppAt, cheerCheckAt: cheerAt } = rules.branch;

    const due: { kind: CheckpointKind; at: string }[] = [];
    if (clock >= oppAt && clock < cheerAt) due.push({ kind: "OPPORTUNITY", at: oppAt });
    if (clock >= cheerAt) due.push({ kind: "CHEER", at: cheerAt });

    const results: CheckpointResult[] = [];
    for (const cp of due) {
        const entityId = `${storeNo}:${day}:${cp.kind}`;
        if (await db.auditLog.findFirst({ where: { action: "CHECKPOINT_RUN", entityId }, select: { id: true } })) continue;

        const order = await getOrderInputs(storeNo, now);
        if (order.lines.length === 0) continue; // no forecast yet → try again next minute
        const drafts = cp.kind === "OPPORTUNITY"
            ? opportunityDrafts(order.lines, await openingStockToday(storeNo, order.lines, todayDate(now)), rules.forCategory, clock)
            : cheerDrafts(order.lines, rules.forCategory, clock);

        let created = 0;
        for (const draft of drafts) {
            if (await createAlert(storeNo, draft, "system", now)) created++;
        }
        await db.auditLog.create({
            data: {
                actor: "system", action: "CHECKPOINT_RUN", entity: "branch_threshold", entityId,
                detail: { kind: cp.kind, checkAt: cp.at, ranAt: clock, atRisk: drafts.length, created, items: drafts.map((d) => d.itemNo) },
            },
        });
        results.push({ kind: cp.kind, at: cp.at, atRisk: drafts.length, created });
    }
    return results;
}
