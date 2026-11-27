// SM7 / S6: daily waste target = WASTE_TARGET_PCT (5%) of that day's total sales (whole branch, every item it
// sells, from daily_sales). So the target moves with each day's sales instead of one flat ฿ line.
// Today is still open: its target uses the day's EXPECTED sales, the 4-week same-weekday average, or the sales
// so far once they are higher. Otherwise every morning would look over target.
// Pure: the queries (waste/queries.ts) load the numbers.
import { WASTE_TARGET_PCT } from "@/lib/config";

export type WasteDay = {
    date: string; // "YYYY-MM-DD" (Bangkok day)
    value: number; // ฿ waste
    sales: number; // ฿ total sales of the day (today: expected)
    target: number; // ฿ = WASTE_TARGET_PCT % of sales
    expected?: boolean; // today: sales are the expected total, not final
};

export function wasteTarget(sales: number, pct = WASTE_TARGET_PCT): number {
    return (Math.max(0, sales) * pct) / 100;
}

/** Today's expected total sales: the same-weekday average (days with sales only), or the sales so far if higher. */
export function expectedDaySales(soFar: number, sameWeekdays: number[]): number {
    const known = sameWeekdays.filter((v) => v > 0);
    const avg = known.length ? known.reduce((a, b) => a + b, 0) / known.length : 0;
    return Math.max(soFar, avg);
}

export const isOverTarget = (d: { value: number; target: number }) => d.value > d.target;
