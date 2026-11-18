"use client";
// SM9: Auto-Promotion engine on/off for the branch. POS sync is simulated (orders and promotions never leave the app).
import { useOptimistic, useTransition } from "react";
import { sileo } from "sileo";
import { formatClock } from "@/lib/time";
import { setAutoPromotion } from "../actions";

type Props = { engineOn: boolean; checkpoints: [string, string]; lastPushAt: Date | null };

export function EngineToggle({ engineOn, checkpoints, lastPushAt }: Props) {
    const [on, setOn] = useOptimistic(engineOn);
    const [pending, startTransition] = useTransition();

    function toggle() {
        startTransition(async () => {
            setOn(!on); // flip at once; refresh() brings the saved value, or it falls back on error
            const result = await setAutoPromotion(!on);
            if (!result.ok) sileo.error({ title: "Engine not changed", description: result.error });
            else sileo.success({ title: `Auto-promotion ${!on ? "on" : "off"}`, description: !on ? "Category rates apply to at-risk SKUs." : "Auto rates set to 0%. Manual overrides still work." });
        });
    }

    return (
        <section className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-slate-200 bg-white p-5">
            <div className="flex items-center gap-4">
                <button
                    type="button"
                    role="switch"
                    aria-checked={on}
                    aria-label="Enable Auto-Promotion Rule Engine"
                    disabled={pending}
                    onClick={toggle}
                    className={`relative h-7 w-12 shrink-0 rounded-full transition-colors disabled:opacity-60 ${on ? "bg-emerald-500" : "bg-slate-300"}`}
                >
                    <span className={`absolute top-1 left-1 size-5 rounded-full bg-white shadow transition-transform ${on ? "translate-x-5" : ""}`} />
                </button>
                <div>
                    <p className="font-semibold text-slate-900">Enable Auto-Promotion Rule Engine</p>
                    <p className="text-xs text-slate-500">
                        {on
                            ? `On · runs at the ${checkpoints[0]} and ${checkpoints[1]} checkpoints using your branch thresholds`
                            : "Off · no automatic discounts today; Manual Override still works"}
                    </p>
                </div>
            </div>
            <div className="flex flex-wrap gap-2 text-xs font-semibold">
                <span className="rounded-full bg-indigo-50 px-3 py-1 text-indigo-700">● POS Sync Status: Connected</span>
                <span className="rounded-full bg-emerald-50 px-3 py-1 text-emerald-700">
                    ● {lastPushAt ? `Last push ${formatClock(lastPushAt)}` : "No push today"}
                </span>
            </div>
        </section>
    );
}
