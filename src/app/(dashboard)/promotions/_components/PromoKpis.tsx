// S7 / SM9: the four summary cards at the top of the page
import type { PromotionKpis } from "@/lib/promotions/rules";
import { baht } from "@/lib/format";

function Card({ label, value, hint, tone }: { label: string; value: string; hint: string; tone: string }) {
    return (
        <section className="rounded-2xl border border-slate-200 bg-white p-5">
            <p className="text-sm font-medium text-slate-500">{label}</p>
            <p className={`mt-2 text-2xl font-bold ${tone}`}>{value}</p>
            <p className="mt-1 truncate text-xs text-slate-500">{hint}</p>
        </section>
    );
}

export function PromoKpis({ kpis }: { kpis: PromotionKpis }) {
    return (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <Card
                label="SKUs at waste risk"
                value={String(kpis.atRisk)}
                hint={`${kpis.expireToday} expire today`}
                tone={kpis.atRisk > 0 ? "text-red-600" : "text-slate-900"}
            />
            <Card
                label="Promotions live on POS"
                value={String(kpis.live.length)}
                hint={kpis.live.length ? kpis.live.map((p) => `${p.itemNo} ${p.discountPct}%`).join(" · ") : "None yet"}
                tone="text-emerald-600"
            />
            <Card
                label="Pending push"
                value={String(kpis.pending.length)}
                hint={kpis.pending.length ? kpis.pending.join(" · ") : "Nothing waiting"}
                tone={kpis.pending.length > 0 ? "text-amber-600" : "text-slate-900"}
            />
            <Card label="Projected waste avoided" value={baht(kpis.wasteAvoided)} hint="if promotions sell through" tone="text-slate-900" />
        </div>
    );
}
