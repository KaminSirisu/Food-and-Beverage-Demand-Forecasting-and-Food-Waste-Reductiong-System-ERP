// Bangkok time helpers. Neon runs on UTC; @db.Date columns are stored as UTC midnight,
// so "today" must be the Bangkok calendar day turned into a UTC-midnight Date.
// Thailand has no daylight saving time, so a fixed timezone is safe.]
// No "server-only": the client cutoff badge uses minutesUntil() too.
const TimeZone = "Asia/Bangkok";
const DAY_MS = 86_400_000;

// "2026-10-26": the Bangkok calendar day of `now` (the en-CA locale formats as YYYY-MM-DD)
function bangkokYmd(now: Date): string {
    return new Intl.DateTimeFormat("en-CA", { timeZone: TimeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
}
export function todayDate(now = new Date()): Date {
    return new Date(`${bangkokYmd(now)}T00:00:00Z`);
}
export function addDays(date: Date, days: number): Date {
    return new Date(date.getTime() + days * DAY_MS);
}
// Delivery date of the factory order (SM3)
export function tomorrowDate(now = new Date()): Date {
    return addDays(todayDate(now), 1);
}

// Minutes since Bangkok midnight, e.g. 13:42 → 822
function bangkokMinutes(now: Date): number {
    const parts = new Intl.DateTimeFormat("en-GB", { timeZone: TimeZone, hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(now);
    const get = (type: "hour" | "minute") => Number(parts.find((p) => p.type === type)?.value ?? 0);
    return get("hour")* 60 + get("minute");
} 
function toMinutes(hhmm: string): number {
    const [h, m] = hhmm.split(":").map(Number);
    return h * 60 + m;
}
// Minutes left until a "HH:mm" time today (negative once it has passed)
export function minutesUntil(hhmm: string, now = new Date()): number {
    return toMinutes(hhmm) - bangkokMinutes(now);
}
export function isAfterCutoff(hhmm: string, now = new Date()): boolean {
    return minutesUntil(hhmm, now) <= 0;
}
// Header: "Mon 26 Oct 2026 · 13:42"
export function formatHeaderTime(now = new Date()): string {
    const date = new Intl.DateTimeFormat("en-GB", { timeZone: TimeZone, weekday: "short", day: "numeric", month: "short", year: "numeric" }).format(now);
    return `${date.replace(",", "")} · ${formatClock(now)}`;
}
// "13:42"
export function formatClock(date: Date): string {
    return new Intl.DateTimeFormat("en-GB", { timeZone: TimeZone, hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(date);
}
// "27 Oct" — for "last sync" when it wasn't today
export function formatShortDate(date: Date): string {
    return new Intl.DateTimeFormat("en-GB", { timeZone: TimeZone, day: "numeric", month: "short" }).format(date);
}
// Bangkok midnight as a real instant (UTC+7, no DST) — for timestamp columns like taken_at
export function startOfToday(now = new Date()): Date {
    return new Date(todayDate(now).getTime() - 7 * 3_600_000);
}