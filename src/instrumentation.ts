// Runs once when the Next.js server starts. Starts the checkpoint timer (SM5 / SM6): every minute it asks the app to
// run any Opportunity / Cheer checkpoint that is due, so alerts fire at the times on Branch Thresholds & Checkpoints
// even when nobody has the dashboard open. It calls the API route instead of importing the engine, because the
// engine is server-only app code (Prisma, "server-only") that belongs to the request layer.
const EVERY_MS = 60_000;

export function register() {
    if (process.env.NEXT_RUNTIME !== "nodejs") return;
    const g = globalThis as unknown as { checkpointTimer?: ReturnType<typeof setInterval> };
    if (g.checkpointTimer) return; // dev server reloads: keep a single timer

    const base = process.env.APP_URL ?? `http://localhost:${process.env.PORT ?? 3000}`;
    const key = process.env.INGEST_API_KEY;
    if (!key) {
        console.warn("[checkpoints] INGEST_API_KEY is not set: checkpoint timer not started");
        return;
    }
    g.checkpointTimer = setInterval(async () => {
        try {
            const res = await fetch(`${base}/api/alerts/checkpoints`, { method: "POST", headers: { "x-api-key": key } });
            if (!res.ok) return console.error(`[checkpoints] ${res.status}`);
            const { ran } = (await res.json()) as { ran: { kind: string; created: number }[] };
            for (const r of ran) console.log(`[checkpoints] ${r.kind} ran: ${r.created} alert(s)`);
        } catch (err) {
            console.error("[checkpoints] timer call failed", (err as Error).message);
        }
    }, EVERY_MS);
}
