// Server-Sent Events wire format (text/event-stream). Pure, so it can be unit tested.
export type SseEvent = { event?: string; id?: string; data: unknown };

export function formatSseEvent({ event, id, data}: SseEvent): string {
    const lines: string[] = [];
    if (event) lines.push(`event: ${event}`);
    if (id) lines.push(`id: ${id}`);
    const text = typeof data === "string" ? data : JSON.stringify(data);
    for (const line of text.split("\n")) lines.push(`data: ${line}`);
    return `${lines.join("\n")}\n\n`;
}

export const sseComment = (text: string) => `: ${text}\n\n`; // heartbeat: keeps proxies from closing an idle stream
export const sseRetry = (ms: number) => `retry: ${ms}\n\n`; // how long the browser waits before reconnecting

// Where to resume: the Last-Event-ID header (auto reconnect) wins over ?after=(first connect).
// Anything that isn't a plain id is ignored -> start from 0. tsconfig targets ES2017, so use BigInt(), not 0n.
export function parseCursor(lastEventId: string | null, after: string | null):bigint {
    for (const raw of [lastEventId, after]) {
        if (raw && /^\d{1,18}$/.test(raw)) return BigInt(raw);
    }
    return BigInt(0);
}