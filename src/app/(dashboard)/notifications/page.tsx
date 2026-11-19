import type { Metadata } from "next";
import { getCurrentUser } from "@/lib/auth/dal";
import { getNotifications } from "@/lib/alerts/queries";
import { NotificationList } from "../_components/NotificationList";

export const metadata: Metadata = { title: "Notifications" };

// S10: every alert, newest first, each linked to its follow-up action. Kept live by the layout's SSE provider.
export default async function NotificationsPage() {
    const user = await getCurrentUser(); // G2: storeNo from the session
    const initial = await getNotifications(user.storeNo);
    const serverNow = new Date().getTime(); // one clock for "today" checks, passed to the client (no hydration mismatch)

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-3xl font-bold text-slate-900">Notifications</h1>
                <p className="mt-1 text-sm text-slate-500">Newest first · each alert links to its follow-up action</p>
            </div>
            <NotificationList initial={initial} serverNow={serverNow} />
        </div>
    );
}