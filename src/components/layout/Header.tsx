import { Bell, FileText } from "lucide-react";
import type { CurrentUser } from "@/lib/auth/dal";
import { initials } from "@/lib/user-display";
import type { SyncStatus } from "@/lib/dashboard/queries";
import { HeaderStatus } from "./HeaderStatus";

export function Header({ user, sync }: { user: CurrentUser; sync: SyncStatus }) {
    return (
        <header className="flex h-16 shrink-0 items-center gap-4 border-b border-slate-200 bg-white px-6">
            <p className="text-sm text-slate-500">Sat 3 Oct 2026 · 13:42</p>

            <HeaderStatus {...sync} />

            <div className="ml-auto flex items-center gap-3">
                <button
                    type="button"
                    className="rounded-lg border border-emerald-600 px-4 py-2 text-sm font-semibold text-emerald-700 hover:bg-emerald-50"
                >
                    Simulate Data Ingestion
                </button>
                <button
                    type="button"
                    aria-label="Reports"
                    className="grid size-10 place-items-center rounded-lg border border-slate-200 hover:bg-slate-50"    
                >
                    <FileText size={20} aria-hidden />
                </button>
                <button
                    type="button"
                    aria-label="Notifications"
                    className="relative grid size-10 place-items-center rounded-lg border border-slate-200 hover:bg-slate-50"    
                >
                    <Bell size={20} aria-hidden />
                    <span className="absolute -right-1 -top-1 grid size-4 place-items-center rounded-full bg-red-500 text-[10px] font-semibold text-white">5</span>
                </button>
                <span
                    title={user.name}
                    className="grid size-10 place-items-center rounded-full bg-indigo-500 text-sm font-semibold text-white"
                >
                    {initials(user.name)}
                </span>
            </div>
        </header>
    )
}