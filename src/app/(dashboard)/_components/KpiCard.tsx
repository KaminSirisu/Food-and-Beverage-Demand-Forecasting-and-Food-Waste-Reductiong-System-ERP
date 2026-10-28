import type { ReactNode } from 'react';

type Props = { label: string, value: string, hint: string, icon: ReactNode, alert?: boolean };

export function KpiCard({ label, value, hint, icon, alert=false }: Props) {
    return (
        <section className="rounded-2xl border border-slate-200 bg-white p-5">
            <div className="flex items-center justify-between">
                <p className="text-sm font-medium text-slate-500">{label}</p>
                <span className={alert ? "text-red-500" : "text-slate-400"}>{icon}</span>
            </div>
            <p className={`mt-2 text-3xl font-bold ${alert ? "text-red-600" : "text-slate-900"}`}>{value}</p>
            <p className="mt-1 text-xs text-slate-500">{hint}</p>
        </section>
    )
}