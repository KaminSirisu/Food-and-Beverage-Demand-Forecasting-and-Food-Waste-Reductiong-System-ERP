"use client";
// Live unread count (S10). Renders nothing at 0, like the old static badge with no number.
import { useNotifications } from "./NotificationStreamProvider";

export function UnreadBadge({ className }: { className: string }) {
    const { unread } = useNotifications();
    if (unread === 0) return null;
    return (
        <span className={className} aria-label={`${unread} unread notifications`}>
            {unread > 99 ? "99+" : unread}
        </span>
    );
}