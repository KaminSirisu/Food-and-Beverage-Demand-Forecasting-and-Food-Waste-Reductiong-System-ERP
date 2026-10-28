import type { ReactNode } from 'react';

const TONES = {
    amber: "bg-amber-100 text-amber-800",
    red: "bg-red-100 text-amber-700",
    indigo: "bg-indigo-100 text-indigo-700",
    green: "bg-emerald-100 text-emerald-700",
    slate: "bg-slate-100 text-slate-600",
}

export type BadgeTone = keyof typeof TONES;

export function Badge({ tone, children }: { tone: BadgeTone; children: ReactNode }) {
    return <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${TONES[tone]}`}>{children}</span>
}