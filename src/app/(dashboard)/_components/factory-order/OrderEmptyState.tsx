// Shown when no active model has a forecast for tomorrow (S3 not run yet, or the demo data is from another day).
export function OrderEmptyState() {
    return (
        <section id="factory-order" className="scroll-mt-6 rounded-2xl border border-dashed border-slate-300 bg-white p-6">
            <h2 className="text-xl font-bold text-slate-900">Tomorrow&apos;s Factory Order</h2>
            <p className="mt-2 text-sm text-slate-600">
                Tomorrow&apos;s forecast isn&apos;t available yet. Suggestions appear after today&apos;s sales are loaded and the model runs.
            </p>
            <p className="mt-2 text-xs text-slate-500">
                Load today&apos;s sales (Simulate Data Ingestion or the D365 file), then run the forecast.
            </p>
        </section>
    )
}