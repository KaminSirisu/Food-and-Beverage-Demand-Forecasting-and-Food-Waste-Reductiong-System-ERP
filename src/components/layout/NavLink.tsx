"use client"
// use client because usePathname is a hook, Everything else stays on the server and ship zero JS.
import { UnreadBadge } from "@/components/notifications/UnreadBadge";
import Link from "next/link";
import { usePathname } from "next/navigation";

type NavLinkProps = {
    href: string;
    badge?: "unread";
    children: React.ReactNode; // icon + label, rendered on the server
}

export function NavLink({ href, badge, children }: NavLinkProps ) {
    const pathname = usePathname();
    const isActive = href === "/" ? pathname === "/" : pathname.startsWith(href);

    return (
        <Link
            href={href}
            aria-current={isActive ? "page" : undefined}
            className={`relative flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors ${
                isActive
                ? "bg-slate-700 font-semibold text-white before:absolute before:inset-y-2 before:left-0 before:w-1 before:rounded-full before:bg-emerald-400"
                : "text-slate-300 hover:bg-slate-700/50 hover:text-white"
            }`}
        >
            {children}
            {badge === "unread" ? (
                <UnreadBadge className="ml-auto grid h-5 min-w-5 place-items-center rounded-full bg-red-500 px-1 text-xs font-semibold text-white" />
            ) : null}
        </Link>
    )
}