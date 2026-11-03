// SM5 / SM6 / S7 / SM9: per-category overrides. An empty box = NULL = use the branch default.
import type { ChangeEvent } from "react";
import { ChevronDown } from "lucide-react";
import type { CategoryThresholds } from "@/lib/thresholds/queries";
import type { Thresholds } from "@/lib/thresholds/resolve";
import { formatLimit, LIMIT_RANGE, type Limit } from "@/lib/thresholds/units";
import type { CategoryInput } from "../actions";
import { UnitToggle } from "./UnitToggle";

const INPUT = "w-20 rounded-lg border border-slate-200 px-3 py-1.5 text-sm text-slate-900 placeholder:text-slate-400 invalid:border-red-400";

// Empty box → null ("Default"). valueAsNumber is NaN when the box is empty.
function readNumber(e: ChangeEvent<HTMLInputElement>): number | null {
    const n = e.target.valueAsNumber;
    return Number.isNaN(n) ? null : n;
}

function LimitCell({ label, value, inherited, onChange }: {
    label: string;
    value: Limit | null;
    inherited: Limit;
    onChange: (value: Limit | null) => void;
}) {
    const unit = value?.unit ?? inherited.unit;
    const range = LIMIT_RANGE[unit];
    return (
        <div className="flex items-center gap-2">
            <input
                type="number"
                aria-label={label}
                min={range.min}
                max={range.max}
                step={1}
                value={value?.value ?? ""}
                placeholder={formatLimit(inherited)}
                onChange={(e) => {
                    const n = readNumber(e);
                    onChange(n == null ? null : { unit, value: n });
                }}
                className={INPUT}
            />
            <UnitToggle
                compact
                label={`${label} unit`}
                value={unit}
                onChange={(u) => {
                    if (u !== unit) onChange({ unit: u, value: LIMIT_RANGE[u].start });
                }}
            />
        </div>
    );
}

function PctCell({ label, prefix, value, inherited, max, onChange }: {
    label: string;
    prefix?: string;
    value: number| null;
    inherited: number;
    max: number;
    onChange: (value: number | null) => void
}) {
    return (
        <div className="flex items-center gap-2 whitespace-nowrap text-slate-600">
            {prefix}
            <input
                type="number"
                aria-label={label}
                min={0}
                max={max}
                step={1}
                value={value ?? ""}
                placeholder={String(inherited)}
                onChange={(e) => onChange(readNumber(e))}
                className={INPUT}
            />
            %
        </div>
    );
}

type Props = {
    categories: CategoryThresholds[];
    values: CategoryInput[];
    branch: Thresholds; // the live defaults, for the placeholders
    onChange: (code: string, patch: Partial<CategoryInput>) => void;
}

export function CategoryTable({ categories, values, branch, onChange }: Props) {
    const custom = values.filter(
        (v) => v.opportunity !== null || v.cheer !== null || v.wasteRiskPct !== null || v.discountPct != null,
    ).length;

    return (
        <details open className="group rounded-2xl border border-slate-200 bg-white">
            <summary className="flex cursor-pointer list-none flex-wrap items-center gap-3 px-6 py-4 [&::-webkit-details-marker]:hidden">
                <h2 className="text-base font-bold text-slate-900">Settings by category</h2>
                <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-600">
                    {custom} custom
                </span>
                <span className="text-xs text-slate-500">Leave a box empty to use the default above</span>
                <ChevronDown className="ml-auto size-4 text-slate-400 transition group-open:rotate-180" aria-hidden />
            </summary>

            <div className="overflow-x-auto border-t border-slate-200 px-6 pb-4">
                <table className="w-full text-left text-sm">
                    <thead className="text-xs text-slate-500">
                        <tr className="border-b border-slate-200">    
                            <th scope="col" className="py-3 pr-4 font-medium">Category</th>
                            <th scope="col" className="py-3 pr-4 font-medium">Opportunity Sale Alert (remaining ≤)</th>
                            <th scope="col" className="py-3 pr-4 font-medium">Cheer Sale Alert (remaining ≥)</th>
                            <th scope="col" className="py-3 pr-4 font-medium">Waste-risk trigger</th>
                            <th scope="col" className="py-3 font-medium">Auto-discount rate</th>
                        </tr>
                    </thead>   
                    <tbody className="divide-y divide-slate-100">
                        {categories.map((cat) => {
                            const v = values.find((x) => x.code === cat.code)!; // built from the same list
                            const set = (patch: Partial<CategoryInput>) => onChange(cat.code, patch);
                            return (
                                <tr key={cat.code}>
                                    <th scope="row" className="py-3 pr-4 font-semibold text-slate-900">
                                        {cat.name}
                                    </th>
                                    <td className="py-3 pr-4">
                                        <LimitCell
                                            label={`${cat.name} opportunity limit`}
                                            value={v.opportunity}
                                            inherited={branch.opportunity}
                                            onChange={(opportunity) => set({ opportunity })}
                                        />
                                    </td>
                                    <td className="py-3 pr-4">
                                        <LimitCell
                                            label={`${cat.name} cheer limit`}
                                            value={v.cheer}
                                            inherited={branch.cheer}
                                            onChange={(cheer) => set({ cheer })}
                                        />
                                    </td>
                                    <td className="py-3 pr-4">
                                        <PctCell
                                            label={`${cat.name} waste-risk trigger`}
                                            prefix="Surplus ≥"
                                            value={v.wasteRiskPct}
                                            inherited={branch.wasteRiskPct}
                                            max={100}
                                            onChange={(wasteRiskPct) => set({ wasteRiskPct })}
                                        />
                                    </td>
                                    <td className="py-3">
                                        <PctCell
                                            label={`${cat.name} auto-discount rate`}
                                            value={v.discountPct}
                                            inherited={branch.discountPct}
                                            max={90}
                                            onChange={(discountPct) => set({ discountPct })}
                                        />
                                    </td>
                                </tr>
                            )
                        })}
                    </tbody>
                </table>
            </div>
        </details>
    )
}