import { useEffect, useState } from "react";

// Starts from the SERVER's clock so the first client render matches the server HTML
// (Date.now() here would cause a hydration mismatch), then ticks every 30 s.
export function useNow(serverNow: number, everyMs = 30_000): number {
    const [now, setNow] = useState(serverNow);
    useEffect(() => {
        const id = setInterval(() => setNow(Date.now()), everyMs);
        return () => clearInterval(id); // cleanup: no timers left running after unmount
    }, [everyMs]);
    return now;
}