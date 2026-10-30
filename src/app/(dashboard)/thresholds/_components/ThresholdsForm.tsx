"use client";
// SM5 / SM6 / S7 / SM9: Branch Thresholds form. Holds the manager's edits until Save (Lesson 6).
import { useState } from "react";
import type { ThresholdsData } from "@/lib/thresholds/queries";
import type { Thresholds } from "@/lib/thresholds/resolve";
import { AlertCard } from "./AlertCard";

type Props = {
    data: ThresholdsData;
}

export function ThresholdsForm({ data }: Props) {
    const [ branch, setBranch ] = useState<Thresholds>(data.branch);
    // One typed setter: set("cheer", 5) is a compile error, set("cheer", { value: 5, unit: "PCT" }) is fine
    function set<K extends keyof Thresholds>(key: K, value: Thresholds[K]) {
        setBranch((b) => ({...b, [key]: value }));
    }

    return (
        <div className="space-y-6">
            <div className="grid gap-6 xl:grid-cols-2">
                <AlertCard
                    kind="opportunity"
                    time={branch.opportunityCheckAt}
                    limit={branch.opportunity}
                    categories={data.categories}
                    onTime={(v) => set("opportunityCheckAt", v)}
                    onLimit={(v) => set("opportunity", v)}
                />
                <AlertCard
                    kind="cheer"
                    time={branch.cheerCheckAt}
                    limit={branch.cheer}
                    categories={data.categories}
                    onTime={(v) => set("cheerCheckAt", v)}
                    onLimit={(v) => set("cheer", v)}
                />
            </div>
        </div> 
    )
}