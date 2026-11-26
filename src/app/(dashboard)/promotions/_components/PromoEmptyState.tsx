// Shown when no SKU has a forecast today (same cause as the factory order empty state)
export function PromoEmptyState() {
    return (
        <section className="rounded-2xl border border-dashed border-slate-300 bg-white p-6">
            <h2 className="text-xl font-bold text-slate-900">SKUs Approaching Expiry / Over-Stock</h2>
            <p className="mt-2 text-sm text-slate-600">
                Today&apos;s forecast isn&apos;t available yet. Waste risk and discounts appear after today&apos;s sales are loaded and the model runs.
            </p>
            <p className="mt-2 text-xs text-slate-500">
                Load today&apos;s sales (Simulate Data Ingestion or the D365 file), then run the forecast.
            </p>
        </section>
    );
}
