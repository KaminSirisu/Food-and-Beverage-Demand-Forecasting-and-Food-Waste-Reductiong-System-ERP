"use client";
// One EventSource per tab (S10). The page list, sidebar badge and header bell all read this context,
// so opening the app never costs more than one stream connection (browsers allow ~6 per host on HTTP/1.1).
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { sileo } from "sileo";
import { markAllRead, markRead } from "@/app/(dashboard)/notifications/actions";
import { mergeIncoming, type NotificationDto, type ReadOverrides } from "@/lib/alerts/view";

type NotificationsCtx = {
    incoming: NotificationDto[]; // alerts that arrived over SSE since this tab opened
    unread: number;
    connected: boolean;
    overrides: ReadOverrides;
    readOne: (id: string) => void;
    readAll: (upToId: string) => void; 
}

const Ctx = createContext<NotificationsCtx | null>(null);

export function useNotifications(): NotificationsCtx {
    const ctx = useContext(Ctx);
    if (!ctx) throw new Error("useNotifications must be used inside <NotificationStreamProvider>");
    return ctx;
}

const TOAST_TYPES = new Set(["SHORTAGE_RISK", "WASTE_RISK", "STALE_DATA"]); // the ones that need action now

export function NotificationStreamProvider({ initialUnread, latestId, children }: {
    initialUnread: number;
    latestId: string;
    children: React.ReactNode;
}) {
    const [incoming, setIncoming] = useState<NotificationDto[]>([]);
    const [unread, setUnread] = useState(initialUnread);
    const [connected, setConnected] = useState(false);
    const [overrides, setOverrides] = useState<ReadOverrides>({ ids: new Set(), allUpTo: null });

    // Only the FIRST latestId counts. refresh() in other actions re-renders the layout with a newer id;
    // reconnecting each time would be wasted work, because EventSource resumes with Last-Event-ID anyway.
    const after = useRef(latestId);

    useEffect(() => {
        const es = new EventSource(`/api/notifications/stream?after=${after.current}`);
        es.onopen = () => setConnected(true);
        es.onerror = () => setConnected(false); // network drop: the browser reconnects by itself after `retry`; a 401 closes it for good

        es.addEventListener("alert", (e) => {
            const n = JSON.parse((e as MessageEvent<string>).data) as NotificationDto;
            setIncoming((prev) => mergeIncoming(prev, [n]));
            if (TOAST_TYPES.has(n.type)) sileo.warning({ title: n.title, description: n.body });
        });
        es.addEventListener("unread", (e) => {
            setUnread((JSON.parse((e as MessageEvent<string>).data) as { count: number }).count); // server count = the truth
        });

        return () => es.close(); // unmount (and StrictMode's dev double-mount): no orphan connection
    }, []);

    // Optimistic: update the UI now, tell the server in the background. The next "unread" event corrects any drift.
    const readOne = useCallback((id: string) => {
        setOverrides((o) => (o.ids.has(id) ? o : { ...o, ids: new Set(o.ids).add(id) }));
        setUnread((u) => Math.max(0, u - 1));
        void markRead(id);
    }, []);

    const readAll = useCallback((upToId: string) => {
        setOverrides((o) => ({ ...o, allUpTo: upToId }));
        setUnread(0);
        void markAllRead(upToId);
    }, []);

    const value = useMemo(
        () => ({ incoming, unread, connected, overrides, readOne, readAll }),
        [incoming, unread, connected, overrides, readOne, readAll],
    );
    return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}