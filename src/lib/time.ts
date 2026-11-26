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
// T1 demo: NEXT_PUBLIC_DEMO_TODAY=2023-05-01 makes the whole app treat that day as today.
// Only the calendar day changes; the clock stays real, so the 13:30 cutoff and alert times still work.
// NEXT_PUBLIC_ so the header (client) sees it too. Unset = the real Bangkok date.
// Auto-advance: NEXT_PUBLIC_DEMO_ANCHOR=2026-11-26 is the real day that shows as DEMO_TODAY; each later real day
// moves the demo one day forward (27 Nov → DEMO_TODAY + 1), so a replay runs for weeks without editing .env.
// Unset = the demo stays on DEMO_TODAY.
const YMD = /^\d{4}-\d{2}-\d{2}$/;
const DEMO_TODAY = process.env.NEXT_PUBLIC_DEMO_TODAY;
const DEMO_ANCHOR = process.env.NEXT_PUBLIC_DEMO_ANCHOR;
const isDemo = !!DEMO_TODAY && YMD.test(DEMO_TODAY);
const hasAnchor = isDemo && !!DEMO_ANCHOR && YMD.test(DEMO_ANCHOR);

export function todayDate(now = new Date()): Date {
    const real = new Date(`${bangkokYmd(now)}T00:00:00Z`);
    if (!isDemo) return real;
    const demo = new Date(`${DEMO_TODAY}T00:00:00Z`);
    if (!hasAnchor) return demo;
    const daysSinceAnchor = Math.round((real.getTime() - new Date(`${DEMO_ANCHOR}T00:00:00Z`).getTime()) / DAY_MS);
    return new Date(demo.getTime() + daysSinceAnchor * DAY_MS);
}
// T1 demo: the same clock time, moved onto the demo day. Use it for timestamps that "today" queries read back
// (e.g. a stock count), so a count typed during demo day 2 May doesn't still count on 3 May. Real time when no demo.
export function appNow(now = new Date()): Date {
    if (!isDemo) return now;
    const realDay = new Date(`${bangkokYmd(now)}T00:00:00Z`);
    return new Date(now.getTime() + (todayDate(now).getTime() - realDay.getTime()));
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
export function formatHeaderTime(now = new Date()): string {
    // todayDate() is UTC midnight of the (demo or real) Bangkok day, so format it in UTC
    const date = new Intl.DateTimeFormat("en-GB", { timeZone: "UTC", weekday: "short", day: "numeric", month: "short", year: "numeric" }).format(todayDate(now));
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