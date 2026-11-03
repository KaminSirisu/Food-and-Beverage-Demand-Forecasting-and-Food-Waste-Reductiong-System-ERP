// SM5 / SM6: "units | %" switch. Used by the alert cards and, in Lesson 6, by each category row.
import type { ThresholdUnit } from "@prisma/client";

const OPTIONS = [
    { unit: "UNITS", text: "units"},
    { unit: "PCT", text: "%"},
] as const satisfies readonly { unit: ThresholdUnit; text: string }[];

type Props = { value: ThresholdUnit; onChange: (unit: ThresholdUnit) => void; label: string; compact?: boolean };

export function UnitToggle({ value, onChange, label, compact = false }: Props) {
    return (
        <div role="group" aria-label={label} className="inline-flex overflow-hidden rounded-lg border border-slate-200">
            {OPTIONS.map((o) => {
                const active = value === o.unit;
                return (
                    <button
                        key={o.unit}
                        type="button"
                        aria-pressed={active}
                        onClick={() => onChange(o.unit)}
                        className={`${compact ? "px-2 py-1 text-xs" : "px-3 py-1.5 text-sm"} font-semibold ${
                            active ? "bg-emerald-500 text-white" : "bg-white text-slate-700 hover:bg-slate-50"
                        }`}
                    >
                        {o.text}
                    </button>
                )
            })}
        </div>
    )
}