import { Minus, Plus } from "lucide-react";

type Props = { value: number; onChange: (value: number) => void; label: string; disabled?: boolean };

export function Stepper({ value, onChange, label, disabled }: Props) {
    const btn = "grid size-9 place-items-center text-slate-700 hover:bg-slate-100 disabled:opacity-40 disabled:hover:bg-transparent";
    return (
        <div className="inline-flex items-center overflow-hidden rounded-lg border border-slate-300 bg-white">
            <button type="button" aria-label={`Decrease ${label}`} className={btn} disabled={disabled || value <= 0} onClick={() => onChange(value - 1)}>
                <Minus size={16} aria-hidden />
            </button>
            <span aria-live="polite" className="w-10 text-center font-semibold tabular-nums">{value}</span>
            <button type="button" aria-label={`Increase ${label}`} className={btn} disabled={disabled} onClick={() => onChange(value + 1)}>
                <Plus size={16} aria-hidden />
            </button>
        </div>
    );
}