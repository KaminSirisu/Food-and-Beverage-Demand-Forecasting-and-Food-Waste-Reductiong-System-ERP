import { LogOut } from "lucide-react";
import { NAV_SECTIONS } from "@/components/layout/nav-config";
import { NavLink } from "@/components/layout/NavLink";
import { logout } from "@/app/(auth)/actions";
import type { CurrentUser } from "@/lib/auth/dal";
import { initials, ROLE_LABEL } from "@/lib/user-display";

export function Sidebar({ user }: { user: CurrentUser }) {
  return (
    <aside className="flex w-72 shrink-0 flex-col bg-slate-800 px-4 py-6 text-slate-300">
      {/* Brand */}
      <div className="px-2">
        <p className="text-base font-bold text-white">FreshWaste ERP</p>
        <p className="text-xs text-slate-400">Forecast &amp; Waste Module</p>
      </div>

      {/* Nav sections */}
      <nav aria-label="Main" className="mt-8 flex flex-col gap-6">
        {NAV_SECTIONS.map((section) => (
          <div key={section.title}>
            <p className="mb-2 px-3 text-xs font-semibold uppercase tracking-wider text-slate-400">
              {section.title}
            </p>
            <ul className="flex flex-col gap-1">
              {section.items.map(({ href, label, badge, icon: Icon }) => (
                <li key={href}>
                  <NavLink href={href} badge={badge}>
                    <Icon className="size-4 shrink-0" aria-hidden />
                    <span className="truncate">{label}</span>
                  </NavLink>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </nav>

      {/* User card pinned to bottom */}
      <div className="mt-auto flex items-center gap-3 rounded-xl bg-slate-700/60 p-3">
        <span className="grid size-10 shrink-0 place-items-center rounded-full bg-indigo-500 text-sm font-semibold text-white">
          {initials(user.name)}
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-white">{user.name}</p>
          <p className="truncate text-xs text-slate-400">
            {ROLE_LABEL[user.role]} · {user.branchName}
          </p>
        </div>
        {/* Server action in a plain form: works with zero client JS. */}
        <form action={logout}>
          <button
            type="submit"
            aria-label="Log out"
            title="Log out"
            className="grid size-8 place-items-center rounded-lg text-white hover:bg-slate-600 hover:text-red-500"
          >
            <LogOut className="size-4" aria-hidden />
          </button>
        </form>
      </div>
    </aside>
  );
}