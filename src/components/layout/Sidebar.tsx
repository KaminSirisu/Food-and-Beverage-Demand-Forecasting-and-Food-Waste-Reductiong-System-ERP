import { NAV_SECTIONS } from "@/components/layout/nav-config";
import { NavLink } from "@/components/layout/NavLink";

export function Sidebar() {
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
          SK
        </span>
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-white">Somchai K.</p>
          <p className="truncate text-xs text-slate-400">Store Manager · Central Flagship</p>
        </div>
      </div>
    </aside>
  );
}