"use client";
// SM5 / SM6 / S7 / SM9: Branch Thresholds form. Edits stay here until Save; Cancel puts back what was loaded.
import { useState, useTransition, type FormEvent } from "react";
import { sileo } from "sileo";
import type { ThresholdsData } from "@/lib/thresholds/queries";
import type { Thresholds } from "@/lib/thresholds/resolve";
import { formatClock, formatShortDate } from "@/lib/time";
import { saveThresholds, type CategoryInput } from "../actions";
import { AlertCard } from "./AlertCard";
import { CategoryTable } from "./CategoryTable"

// Same shape saveThresholds takes, so Save sends the state as it is
type FormState = { branch: Thresholds; categories: CategoryInput[] };

function initialForm(data: ThresholdsData): FormState {
    return {
        branch: data.branch,
        categories: data.categories.map(({ code, override: o }) => ({
            code,
            opportunity:
                o?.opportunityValue != null && o.opportunityUnit ? { value: o.opportunityValue, unit: o.opportunityUnit } : null,
            cheer: o?.cheerValue != null && o.cheerUnit ? { value: o.cheerValue, unit: o.cheerUnit } : null,
            wasteRiskPct: o?.wasteRiskPct ?? null,
            discountPct: o?.discountPct ?? null,
        })),
    };
}

type Props = { data: ThresholdsData };

export function ThresholdsForm({ data }: Props) {
    const [initial] = useState(() => initialForm(data));
    const [form, setForm] = useState(initial);
    const [pending, startTransition] = useTransition();
    // Small object: comparing JSON is cheap and can't miss a nested field
    const dirty = JSON.stringify(form) !== JSON.stringify(initial);

    function setBranch<K extends keyof Thresholds>(key: K, value: Thresholds[K]) {
        setForm((f) => ({ ...f, branch: { ...f.branch, [key]: value } }));
    }
    function setCategory(code: string, patch: Partial<CategoryInput>) {
        setForm((f) => ({ ...f, categories: f.categories.map((c) => (c.code === code ? { ...c, ...patch } : c)) }));
    }
    function save(e: FormEvent<HTMLFormElement>) {
        e.preventDefault(); // the browser has already checked min / max / required before submit fires
        startTransition(async () => {
            const result = await saveThresholds(form);
            if (!result.ok) {
                sileo.error({ title: "Settings not saved", description: result.error });
                return;
            }
            sileo.success({ title: "Settings saved", description: "New thresholds apply from the next check." });
        });
    }

    const edited = data.lastEdited;

    return (
        <form onSubmit={save} className="space-y-6">
            <div className="grid gap-6 xl:grid-cols-2">
                <AlertCard
                    kind="opportunity"
                    time={form.branch.opportunityCheckAt}
                    limit={form.branch.opportunity}
                    categories={data.categories}
                    onTime={(v) => setBranch("opportunityCheckAt", v)}
                    onLimit={(v) => setBranch("opportunity", v)}
                />
                <AlertCard
                    kind="cheer"
                    time={form.branch.cheerCheckAt}
                    limit={form.branch.cheer}
                    categories={data.categories}
                    onTime={(v) => setBranch("cheerCheckAt", v)}
                    onLimit={(v) => setBranch("cheer", v)}
                />
            </div>
            <CategoryTable categories={data.categories} values={form.categories} branch={form.branch} onChange={setCategory} />

            <div className="flex flex-wrap items-center justify-between gap-4">
                <p className="text-sm text-slate-500">
                    {edited
                        ? `Last edited ${formatShortDate(edited.at)} · ${formatClock(edited.at)} by ${edited.by ?? "system setup"}`
                        : "Not edited yet"
                    }
                </p>
                <div className="flex gap-3">
                    <button
                        type="button"
                        disabled={!dirty || pending}
                        onClick={() => setForm(initial)}
                        className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                    >
                        Cancel
                    </button>
                    <button
                        type="submit"
                        disabled={!dirty || pending}
                        className="rounded-lg bg-emerald-500 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-600 disabled:opacity-50"
                    >
                        { pending ? "Saving..." : "Save settings" }
                    </button>
                </div>
            </div>
        </form> 
    );
}