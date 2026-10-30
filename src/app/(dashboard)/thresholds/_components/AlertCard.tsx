// SM5 / SM6: one alert's settings — check time, unit, limit — and what they mean in plain words.
import type { CategoryThresholds } from "@/lib/thresholds/queries";
import { formatLimit, LIMIT_RANGE, toPct, toUnits, type Limit } from "@/lib/thresholds/units";
import { UnitToggle } from "./UnitToggle";

type Copy = {
    n: number;
    title: string;
    description: string;
    op: "≤" | "≥";
    accent: string;
    summary: (time: string, amount: string) => string;
}

// The two cards differ only in words and colour, so one component + a copy table
const COPY = {
    opportunity: {
        n: 1,
        title: "Opportunity Sale Alert",
        description: "Warns when items are at risk of selling out before closing, so you can top up stock or move items between branches in time.",
        op: "≤",
        accent: "text-red-600",
        summary: (time, amount) =>
            `At ${time}, if any item has ${amount} or less left, the system sends an Opportunity Sale Alert.`
    },
    cheer: {
        n: 2,
        title: "Cheer Sale Alert",
        description:
            "Rallies the team to push items that expire today and still have more stock than they should, before they turn into waste.",
        op: "≥",
        accent: "text-amber-600",
        summary: (time, amount) =>
            `At ${time}, if items expiring today still have ${amount} or more of stock left, the system sends a Cheer Sale Alert.`,
    },
} satisfies Record<string, Copy>;

type Props = {
    kind: keyof typeof COPY;
    time: string;
    limit: Limit;
    categories: CategoryThresholds[];
    onTime: (time: string) => void;
    onLimit: (limit: Limit) => void;
};

export function AlertCard({ kind, time, limit, categories, onTime, onLimit }: Props) {
    const c = COPY[kind];
    const range = LIMIT_RANGE[limit.unit];
    const amount = formatLimit(limit);
    // Same toPct / toUnits the alert engine will use, so the example can't drift from the real rule
    const examples = categories
        .filter((cat) => cat.capacity > 0)
        .map((cat) => 
            limit.unit === "UNITS"
                ? `${toPct(limit, cat.capacity)}% of ${cat.name} (${cat.capacity})`
                : `${toUnits(limit, cat.capacity)} units of ${cat.name} (${cat.capacity})`,
        )
        .join(", ");

    return (
        <section className="space-y-5 rounded-2xl border border-slate-200 bg-white p-6">
            <div>
                <p className={`text-xs font-semibold uppercase tracking-widest ${c.accent}`}>Alert type {c.n}</p>
                <h2 className="mt-1 text-xl font-bold text-slate-900">{c.title}</h2>
                <p className="mt-1 text-sm text-slate-500">{c.description}</p>
            </div>

            <div>
                <label htmlFor={`${kind}-time`} className="text-sm font-semibold text-slate-900">
                    Check time
                </label>
                <input
                    id={`${kind}-time`}
                    type="time"
                    required
                    value={time}
                    onChange={(e) => onTime(e.target.value)}
                    className="mt-2 block rounded-lg border border-slate-200 px-3 py-2 font-mono text-slate-900"
                />
            </div>

            <div className="flex items-center gap-3 text-sm text-slate-500">
                Measure trigger in
                <UnitToggle
                    label={`${c.title} unit`}
                    value={limit.unit}
                    onChange={(unit) => {
                        if (unit !== limit.unit) onLimit({ unit, value: LIMIT_RANGE[unit].start });
                    }}
                />
            </div>

            <div>
                <div className="flex items-baseline justify-between gap-4">
                    <label htmlFor={`${kind}-limit`} className="text-sm font-semibold text-slate-900">
                        Remaining stock {c.op} (alert trigger)
                    </label>
                    <output htmlFor={`${kind}-limit`} className={`font-mono text-2xl ${c.accent}`}>
                        {c.op} {amount}
                    </output>
                </div>
                <input
                    id={`${kind}-limit`}
                    type="range"
                    min={range.min}
                    max={range.max}
                    step={1}
                    value={limit.value}
                    onChange={(e) => onLimit({ unit: limit.unit, value: Number(e.target.value) })}
                    className="mt-3 w-full accent-emerald-500"
                />
                <div className="flex justify-between font-mono text-xs text-slate-500">
                    <span>{formatLimit({ unit: limit.unit, value: range.min })}</span>
                    <span>{formatLimit({ unit: limit.unit, value: range.max })}</span>
                </div>
                {examples && (
                    <p className="mt-2 text-xs text-slate-500">
                        Example (by max display capacity): {c.op} {amount} ≈ {examples}
                    </p>
                )}
            </div>
            <p className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
                {c.summary(time, amount)}
            </p>
        </section>
    )
}