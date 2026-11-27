// Shown when tomorrow has no forecast yet: before store opening (STORE_OPEN_AT), or the demo data is from another day.
export function OrderEmptyState() {
    return (
        <section id="factory-order" className="scroll-mt-6 rounded-2xl border border-dashed border-slate-300 bg-white p-6">
            <h2 className="text-xl font-bold text-slate-900">Tomorrow&apos;s Factory Order</h2>
            <p className="mt-2 text-sm text-slate-600">
                Tomorrow&apos;s forecast isn&apos;t available yet. A provisional forecast is made when the store opens, and the model updates it at 13:30.
            </p>
            <p className="mt-2 text-xs text-slate-500">
                Demo: press Simulate Data Ingestion or switch Live on to make it now.
            </p>
        </section>
    )
}