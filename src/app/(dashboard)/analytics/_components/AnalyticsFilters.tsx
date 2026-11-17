"use client";
// 7-Day / 30-Day toggle + category filter. State lives in the URL (?range=&category=) so the server page reads it.
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { ChevronDown } from "lucide-react";

type Props = { range: number; category: string | null; categories: { code: string; name: string }[] };

export function AnalyticsFilters({ range, category, categories }: Props) {
    const router = useRouter();
    const pathname = usePathname();
    const params = useSearchParams();

    function href(changes: Record<string, string | null>) {
        const next = new URLSearchParams(params.toString());
        for (const [k, v] of Object.entries(changes)) {
            if (v === null) next.delete(k);
            else next.set(k, v);
        }
        const qs = next.toString();
        return qs ? `${pathname}?${qs}` : pathname;
    }

    return (
        <div className="flex flex-wrap items-center gap-3">
            <div className="inline-flex rounded-lg border border-slate-200 bg-white p-0.5" role="group" aria-label="Time range">
                {[7, 30].map((r) => (
                    <Link
                        key={r}
                        href={href({ range: r === 7 ? null : String(r) })}
                        aria-current={r === range ? "true" : undefined}
                        className={`rounded-md px-3 py-1.5 text-sm font-semibold ${
                            r === range ? "bg-slate-900 text-white" : "text-slate-600 hover:bg-slate-100"
                        }`}
                    >
                        {r}-Day
                    </Link>
                ))}
            </div>

            <label className="relative">
                <span className="sr-only">Category</span>
                <select
                    value={category ?? ""}
                    onChange={(e) => router.push(href({ category: e.target.value || null }))}
                    className="h-9 appearance-none rounded-lg border border-slate-200 bg-white pr-9 pl-3 text-sm font-medium text-slate-700"
                >
                    <option value="">All categories</option>
                    {categories.map((c) => (
                        <option key={c.code} value={c.code}>{c.name}</option>
                    ))}
                </select>
                <ChevronDown className="pointer-events-none absolute top-1/2 right-3 size-4 -translate-y-1/2 text-slate-400" aria-hidden />
            </label>
        </div>
    );
}
