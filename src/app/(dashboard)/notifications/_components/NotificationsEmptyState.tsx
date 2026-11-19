// Two empty cases: nothing at all, or filters hide everything (then say how to get rows back)
export function NotificationsEmptyState({ filtered }: { filtered: boolean }) {
    return (
        <section className="rounded-2xl border border-dashed border-slate-300 bg-white p-6 text-center">
            <p className="font-semibold text-slate-900">
                {filtered ? "No notifications match these filters" : "You're all caught up"}
            </p>
            <p className="mt-1 text-sm text-slate-500">
                {filtered
                    ? "Clear a type filter or turn off Unread only."
                    : "New alerts appear here as soon as they're raised. No need to reload."}
            </p>
        </section>
    );
}