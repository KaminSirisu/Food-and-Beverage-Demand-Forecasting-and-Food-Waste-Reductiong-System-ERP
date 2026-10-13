"use client"
// use client because usePathname is a hook, Everything else stays on the server and ship zero JS.

import Link from "next/link";
import { usePathname } from "next/navigation";

type NavLinkProps = {
    href: string;
    badge?: number;
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
            {badge ? (
                <span className="ml-auto grid size-5 place-items-center rounded-full bg-red-500 text-xs font-semibold text-white">
                    {badge}
                </span>
            ): null}
        </Link>
    )
}