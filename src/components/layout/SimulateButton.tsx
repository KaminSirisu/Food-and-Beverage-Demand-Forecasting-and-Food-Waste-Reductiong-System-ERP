"use client";
// Manual 3.1.1 no. 6: "Simulate Data Ingestion — demo only. Loads new sample sales data."
// Click = load today's sales up to now once. "Live" = repeat every minute, so each sale arrives at its real time
// (e.g. a 10:00 sale shows up at 10:00) and stock goes down on screen like a real POS feed.
// The action also runs tomorrow's forecast when it is due (first sync, then after 13:30), and the first sync of a day
// loads the rest of the previous days (evening sales after Live was stopped, or days the demo was closed).
import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { RefreshCw } from "lucide-react";
import { sileo } from "sileo";
import { simulateIngestionAction } from "@/app/(dashboard)/actions";

const SOURCE = { "d365-file": "D365 sample day", "last-week": "same weekday last week" } as const;
const LIVE_EVERY_MS = 60_000;

export function SimulateButton() {
    const [pending, startTransition] = useTransition();
    const [live, setLive] = useState(false);
    const busy = useRef(false); // skip a tick while the previous load is still running

    // "click" = Simulate button, "live-start" = Live just switched on, "tick" = Live's every-minute load
    const run = useCallback((mode: "click" | "live-start" | "tick") => {
        if (busy.current) return;
        busy.current = true;
        startTransition(async () => {
            try {
                const r = await simulateIngestionAction();
                if (r.ok && r.catchUp && r.catchUp.days.length > 0) {
                    sileo.info({
                        title: `Caught up ${r.catchUp.days.length} earlier day${r.catchUp.days.length > 1 ? "s" : ""}`,
                        description: `${r.catchUp.lines} sales lines added for ${r.catchUp.days.join(", ")}`,
                    });
                }
                if (!r.ok) {
                    sileo.error({ title: "Simulation failed", description: r.error });
                } else if (r.status === "NO_NEW_DATA") {
                    // A quiet Live minute is normal, no toast. But say so when Live starts, e.g. before the shop's
                    // first sale of the day, so the switch doesn't look broken.
                    if (mode === "click") sileo.info({ title: "No new sales", description: `Everything up to ${r.upTo.slice(0, 5)} is already loaded.` });
                    if (mode === "live-start") sileo.info({ title: "Live is on", description: `No new sales up to ${r.upTo.slice(0, 5)}. Each new sale loads within a minute.` });
                } else {
                    const rejected = r.rejected > 0 ? ` · ${r.rejected} rejected` : "";
                    sileo.success({
                        title: `${r.loaded} sales line${r.loaded > 1 ? "s" : ""} loaded`,
                        description: `Up to ${r.upTo.slice(0, 5)} · ${SOURCE[r.source]}${rejected}`,
                    });
                }
                if (r.ok && r.forecast?.ran) {
                    sileo.success({
                        title: r.forecast.reason === "decision" ? "13:30 forecast updated" : "Tomorrow's forecast ready",
                        description: `${r.forecast.rows} SKUs · model ${r.forecast.modelVersion}${r.forecast.reason === "first" ? " · updates again after 13:30" : ""}`,
                    });
                }
            } finally {
                busy.current = false;
            }
        });
    }, []);

    useEffect(() => {
        if (!live) return;
        run("live-start"); // catch up at once, then every minute
        const id = setInterval(() => run("tick"), LIVE_EVERY_MS);
        return () => clearInterval(id); // stop when Live is turned off
    }, [live, run]);

    return (
        <div className="flex items-center overflow-hidden rounded-lg border border-emerald-600">
            <button
                type="button"
                onClick={() => run("click")}
                disabled={pending}
                title="Demo only: loads today's sales up to now"
                className="flex items-center gap-2 px-4 py-2 text-sm font-semibold text-emerald-700 hover:bg-emerald-50 disabled:cursor-wait disabled:opacity-60"
            >
                <RefreshCw size={16} aria-hidden className={pending ? "animate-spin" : undefined} />
                {pending && !live ? "Loading sales…" : "Simulate Data Ingestion"}
            </button>
            <button
                type="button"
                role="switch"
                aria-checked={live}
                onClick={() => setLive((v) => !v)}
                title={live ? "Live replay on: loads new sales every minute. Click to stop." : "Live replay: load each sale at its real time (every minute)"}
                className={`flex items-center gap-1.5 border-l border-emerald-600 px-3 py-2 text-xs font-semibold ${
                    live ? "bg-emerald-600 text-white" : "text-emerald-700 hover:bg-emerald-50"
                }`}
            >
                <span className={`size-2 rounded-full ${live ? "animate-pulse bg-white" : "bg-emerald-300"}`} aria-hidden />
                Live
            </button>
        </div>
    );
}
