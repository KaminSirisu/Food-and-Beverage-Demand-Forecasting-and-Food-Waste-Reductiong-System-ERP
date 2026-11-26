import { Bell, FileText } from "lucide-react";
import type { CurrentUser } from "@/lib/auth/dal";
import { initials } from "@/lib/user-display";
import type { SyncStatus } from "@/lib/dashboard/queries";
import { HeaderStatus } from "./HeaderStatus";
import Link from "next/link";
import { UnreadBadge } from "@/components/notifications/UnreadBadge";
import { SimulateButton } from "./SimulateButton";

export function Header({ user, sync }: { user: CurrentUser; sync: SyncStatus }) {
    return (
        <header className="flex h-16 shrink-0 items-center gap-4 border-b border-slate-200 bg-white px-6">
            <HeaderStatus {...sync} />

            <div className="ml-auto flex items-center gap-3">
                <SimulateButton />
                <Link
                    href="/imports"
                    aria-label="Data import log"
                    title="Data import log"
                    className="grid size-10 place-items-center rounded-lg border border-slate-200 hover:bg-slate-50"
                >
                    <FileText size={20} aria-hidden />
                </Link>
                <Link
                    href="/notifications"
                    aria-label="Notifications"
                    className="relative grid size-10 place-items-center rounded-lg border border-slate-200 hover:bg-slate-50"
                >
                    <Bell size={20} aria-hidden />
                    <UnreadBadge className="absolute -right-1 -top-1 grid h-4 min-w-4 place-items-center rounded-full bg-red-500 px-1 text-[10px] font-semibold text-white" />
                </Link>
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