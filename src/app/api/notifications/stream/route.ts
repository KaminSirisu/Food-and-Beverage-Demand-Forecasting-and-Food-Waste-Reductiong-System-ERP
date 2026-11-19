// GET /api/notifications/stream - live notifications for the signed-in branch (S10), as Server-Sent Events.
// ?after=<id> first connect: the newest id the page already rendered
// Last-Event-ID header reconnect: sent by EventSource automatically (wins over ?after)
// Events: alert (id = alert id, data = NotificationDto) ·  unread  (data = { count })  ·  ": ping" every 15s
import { NextRequest } from "next/server";
import { onAlert } from "@/lib/alerts/bus";
import { getNotificationsAfter, unreadCount } from "@/lib/alerts/queries";
import { formatSseEvent, parseCursor, sseComment, sseRetry } from "@/lib/alerts/sse";
import { decrypt, SESSION_COOKIE } from "@/lib/auth/session";

export const runtime = "nodejs"; // Prisma + node:events
export const dynamic = "force-dynamic"; // never cache a live stream

const POLL_MS = 5_000; // the DB is the source of truth: catches alerts from other processes
const PING_MS = 15_000; // keeps proxies from closing an idle connection
const RETRY_MS = 5_000; // browser waits this long before reconnecting

export async function GET(req: NextRequest) {
    // proxy.ts skips /api -> check the cookie here. 401, never redirect(): a redirect inside a stream is just a broken stream.
    const session = await decrypt(req.cookies.get(SESSION_COOKIE)?.value);
    if (!session) return new Response("unauthorized", { status: 401 });
    const { storeNo } = session; // G2: from the signed cookie, never the URL

    let cursor = parseCursor(req.headers.get("last-event-id"), req.nextUrl.searchParams.get("after"));
    let lastUnread = -1; // -1 -> the first check always sends the count
    const encoder = new TextEncoder();
    let cleanup = () => {};

    const stream = new ReadableStream<Uint8Array>({
        start(controller) {
            let closed = false;
            let busy = false;
            let again = false;
            const send = (text: string) => {
                if (closed) return;
                try {
                    controller.enqueue(encoder.encode(text));
                } catch {
                    cleanup(); // stream already gone: stop timers and the bus listener now
                }
            };

            // Poll tick and bus wake-up both call this. Never run two at once (they'd both send the same alerts):
            // if one is running, ask it to loop once more instead.
            const check = async () => {
                if (busy) { again = true; return; }
                busy = true;
                try {
                    do {
                        again = false;
                        const [fresh, unread] = await Promise.all([getNotificationsAfter(storeNo, cursor), unreadCount(storeNo)]);
                        for (const n of fresh) {
                            send(formatSseEvent({ event: "alert", id: n.id, data: n }));

                            cursor = BigInt(n.id);
                        }
                        if (unread !== lastUnread) {
                            send(formatSseEvent({ event: "unread", data: { count: unread }}));

                            lastUnread = unread;
                        }
                    } while (again && !closed);
                } catch (err) {
                    console.error("notifications stream check failed", err); // keep the stream open; the next tick retries
                } finally {
                    busy = false;
                }
            };

            send(sseRetry(RETRY_MS));
            void check(); // send the current unread count right away
            const poll = setInterval(check, POLL_MS);
            const ping = setInterval(() => send(sseComment("ping")), PING_MS);
            const off = onAlert((s) => { if (s === storeNo) void check(); });

            cleanup = () => {
                if (closed) return;
                closed = true;
                clearInterval(poll);
                clearInterval(ping);
                off(); // the listener from Lesson 2: forget this and every closed tab leaks one

                try { controller.close(); } catch { /* already closed by the client */ }
            }
            req.signal.addEventListener("abort", cleanup); // tab closed / navigated away
        },
        cancel() { cleanup(); }, // the reader gave up
    });

    return new Response(stream, {
        headers: {
            "Content-Type": "text/event-stream; charset=utf-8",
            "Cache-control": "no-cache, no-transform", // no-transform: compression would buffer the chunks
            "X-Accel-Buffering": "no", // nginx-style proxies: don't buffer
        },
    });
}