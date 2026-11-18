// Display formatting shared by server and client components.
export function baht(value: number): string {
    return `฿${Math.round(value).toLocaleString("en-US")}`;
}
/** A round step (1, 2, 2.5 or 5 × 10ⁿ) that splits 0…max into about `lines` gridlines. max must be > 0. */
export function niceStep(max: number, lines = 4): number {
    const raw = max / lines;
    const magnitude = 10 ** Math.floor(Math.log10(raw));
    return [1, 2, 2.5, 5, 10].map((m) => m * magnitude).find((s) => s >= raw) ?? raw;
}

/** "YYYY-MM-DD" (already a Bangkok day) → "3/10" like the analytics axis */
export function dayMonth(ymd: string): string {
    const [, m, d] = ymd.split("-").map(Number);
    return `${d}/${m}`;
}
