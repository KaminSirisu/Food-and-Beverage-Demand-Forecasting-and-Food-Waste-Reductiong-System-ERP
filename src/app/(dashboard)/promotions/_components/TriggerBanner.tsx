// SM9: the category discounts the engine applies. They are edited on Branch Thresholds, not here.
import Link from "next/link";
import type { CategoryTrigger } from "@/lib/promotions/queries";

export function TriggerBanner({ triggers }: { triggers: CategoryTrigger[] }) {
    return (
        <p className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            Promotion trigger by category: {triggers.map((t) => `${t.name} ${t.discountPct}%`).join(" · ")} · change these in{" "}
            <Link href="/thresholds" className="font-semibold underline-offset-2 hover:underline">
                Branch Thresholds &amp; Checkpoints
            </Link>
        </p>
    );
}
