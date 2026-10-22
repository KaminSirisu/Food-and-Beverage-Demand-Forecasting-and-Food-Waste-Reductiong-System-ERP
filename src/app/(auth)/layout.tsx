import Link from "next/link";

// Auth shell (folk-style): brand top-left, form centred, note at the bottom. No sidebar — not signed in yet.
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col bg-white px-6 py-6 sm:px-8">
      <header>
        <Link href="/login" className="inline-flex items-center gap-2 text-2xl font-semibold tracking-tight text-slate-900">
          <span className="grid size-8 place-items-center rounded-full border-2 border-slate-900 text-xs font-bold" aria-hidden>
            FW
          </span>
          FreshWaste.
        </Link>
      </header>

      <main className="flex flex-1 items-center justify-center py-12">
        <div className="w-full max-w-sm">{children}</div>
      </main>

      <footer className="text-center text-sm text-slate-500">
        Access is by invitation only. Ask your Area Manager for an invite link.
      </footer>
    </div>
  );
}