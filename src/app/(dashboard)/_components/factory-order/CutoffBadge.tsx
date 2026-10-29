import { Clock } from "lucide-react";
import { minutesUntil } from "@/lib/time";
import { useNow } from "@/lib/use-now";

// Starts from the SERVER's clock so the first client render matches the server HTML
// (Date.now() here would cause a hydration mismatch), then ticks every 30 s.
export function useMinutesLeft(cutoff: string, serverNow: number): number {
    return minutesUntil(cutoff, new Date(useNow(serverNow)));
}

function formatLeft(minutes: number): string {
    return minutes >= 60 ? `${Math.floor(minutes / 60)} h ${minutes % 60} min` : `${minutes} min`;
}

export function CutoffBadge({ cutoff, minutesLeft }: {cutoff: string, minutesLeft: number}) {
    const closed = minutesLeft <= 0;
    return (
        <span
            className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-semibold ${
                closed ? "bg-red-50 text-red-700" : "bg-amber-100 text-amber-800"
            }`}
        >
            <Clock size={16} aria-hidden />
            {closed ? `Ordering closed at ${cutoff}` : `Cutoff ${cutoff} · ${formatLeft(minutesLeft)} left`}
        </span>
    );
}