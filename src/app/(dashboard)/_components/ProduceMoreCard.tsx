import { ChefHat } from "lucide-react";
import type { ProduceTask } from "@/lib/dashboard/queries";
import { formatClock } from "@/lib/time";

// SM5: today's Opportunity Sale checkpoint result. Items about to sell out with demand left → produce more at the
// branch (20% of this morning's stock). Hidden until the checkpoint has raised something.
export function ProduceMoreCard({ tasks }: { tasks: ProduceTask[] }) {
    if (tasks.length === 0) return null;
    return (
        <section id="produce-more" className="scroll-mt-6 rounded-2xl border border-red-200 bg-red-50 p-6">
            <div className="flex items-center gap-2">
                <ChefHat className="size-5 text-red-600" aria-hidden />
                <h2 className="text-xl font-bold text-slate-900">Produce More at the Branch</h2>
            </div>
            <p className="mt-1 text-sm text-slate-600">Opportunity Sale check · items likely to sell out before closing</p>
            <ul className="mt-4 divide-y divide-red-100">
                {tasks.map((t) => (
                    <li key={`${t.itemNo}-${t.at}`} className="py-3">
                        <div className="flex items-baseline justify-between gap-3">
                            <p className="font-semibold text-slate-900">{t.title.replace(/^Opportunity sale · /, "")}</p>
                            <time className="shrink-0 text-xs text-slate-500">{formatClock(new Date(t.at))}</time>
                        </div>
                        <p className="mt-0.5 text-sm text-slate-700">{t.body}</p>
                    </li>
                ))}
            </ul>
        </section>
    );
}
