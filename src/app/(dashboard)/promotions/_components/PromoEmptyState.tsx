// Shown when no SKU has a forecast today (same cause as the factory order empty state)
export function PromoEmptyState() {
    return (
        <section className="rounded-2xl border border-dashed border-slate-300 bg-white p-6">
            <h2 className="text-xl font-bold text-slate-900">SKUs Approaching Expiry / Over-Stock</h2>
            <p className="mt-2 text-sm text-slate-600">
                Today&apos;s forecast isn&apos;t available yet. Waste risk and discounts appear after today&apos;s sales are loaded and the model runs.
            </p>
            {process.env.NODE_ENV !== "production" && (
                <p className="mt-2 text-xs text-slate-400">
                    Dev: run <code className="rounded bg-slate-100 px-1">npm run db:seed:demo</code> to load demo forecasts for today.
                </p>
            )}
        </section>
    );
}
