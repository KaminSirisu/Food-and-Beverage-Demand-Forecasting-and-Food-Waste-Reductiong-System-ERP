// In-process wake-up signal for the SSE stream (lesson 5). NOT the source of truth: the data is.
// It only makes an alert created in this same Node process appear at once, instead of on the next 5s poll.
import "server-only";
import { EventEmitter } from "node:events";

// Kept on globalThis, like lib/db.ts. Here it's needed in production too: Next can load this module
// once for server actions and once for route handlers, and two emitters would never hear each other.
const g = globalThis as unknown as { alertBus?: EventEmitter };
const bus = (g.alertBus ??= new EventEmitter());
bus.setMaxListeners(0); // one listener per open tab; 0 = no "possible memory leak" warning at the 11th tab

const EVENT = "alert";

export function emitAlert(storeNo: number): void {
    bus.emit(EVENT, storeNo);
}

// Returns the unsubscribe function: the SSE route MUST call it when the tab disconnects
export function onAlert(listener: (storeNo: number) => void): () => void {
    bus.on(EVENT, listener);
    return () => bus.off(EVENT, listener);
}