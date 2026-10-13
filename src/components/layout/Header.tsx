import { Bell, FileText } from "lucide-react";

export function Header() {
    return (
        <header className="flex h-16 shrink-0 items-center gap-4 border-b border-slate-200 bg-white px-6">
            <p className="text-sm text-slate-500">Sat 3 Oct 2026 · 13:42</p>

            <span className="flex items-center gap-2 rounded-full bg-indigo-50 px-3 py-1 text-xs">
                <span className="size-2 rounded-full bg-emerald-500" aria-hidden />
                <span className="font-semibold text-indigo-700">D365 Data Sync: Active</span>
                <span className="text-indigo-500">Today 11:30 AM via Power Automate</span>
            </span>


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
                <span className="grid size-10 place-items-center rounded-full bg-indigo-500 text-sm font-semibold text-white">
                    SK
                </span>
            </div>
        </header>
    )
}