export default function Loading() {
    return (
        <div className="animate-pulse space-y-4" aria-busy="true" aria-label="Loading">
            <div className="h-9 w-72 rounded-lg bg-slate-200" />
            <div className="grid grid-cols-2 gap-4">
                <div className="h-28 rounded-xl bg-slate-200" />
                <div className="h-28 rounded-xl bg-slate-200" />
            </div>
            <div className="h-64 rounded-xl bg-slate-200" />
        </div>
    )
}