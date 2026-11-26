"use client";
// Manual 3.1.1 no. 6: "Simulate Data Ingestion — demo only. Loads new sample sales data."
import { useTransition } from "react";
import { RefreshCw } from "lucide-react";
import { sileo } from "sileo";
import { simulateIngestionAction } from "@/app/(dashboard)/actions";

const SOURCE = { "d365-file": "D365 sample day", "last-week": "same weekday last week" } as const;

export function SimulateButton() {
    const [pending, startTransition] = useTransition();

    function run() {
        startTransition(async () => {
            const r = await simulateIngestionAction();
            if (!r.ok) {
                sileo.error({ title: "Simulation failed", description: r.error });
            } else if (r.status === "NO_NEW_DATA") {
                sileo.info({ title: "No new sales", description: `Everything up to ${r.upTo.slice(0, 5)} is already loaded.` });
            } else {
                const rejected = r.rejected > 0 ? ` · ${r.rejected} rejected` : "";
                sileo.success({
                    title: `${r.loaded} sales lines loaded`,
                    description: `Up to ${r.upTo.slice(0, 5)} · ${SOURCE[r.source]}${rejected}`,
                });
            }
        });
    }

    return (
        <button
            type="button"
            onClick={run}
            disabled={pending}
            title="Demo only: loads today's sales up to now"
            className="flex items-center gap-2 rounded-lg border border-emerald-600 px-4 py-2 text-sm font-semibold text-emerald-700 hover:bg-emerald-50 disabled:cursor-wait disabled:opacity-60"
        >
            <RefreshCw size={16} aria-hidden className={pending ? "animate-spin" : undefined} />
            {pending ? "Loading sales…" : "Simulate Data Ingestion"}
        </button>
    );
}
