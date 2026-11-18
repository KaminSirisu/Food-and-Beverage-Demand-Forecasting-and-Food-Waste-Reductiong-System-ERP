// Forecast vs. Actual Analytics data for one branch (S8, NFR6). Server only: reads Neon via Prisma.
// Actuals come from daily_sales (never sales_line); forecasts from the TOMORROW model (Model 2).
import "server-only";
import { db } from "@/lib/db";
import { DAILY_WASTE_TARGET } from "@/lib/config";
import { addDays, todayDate } from "@/lib/time";
import { dayKeys, fillDays, skuAccuracy, wasteTotals, type DayPair, type SkuAccuracy, type WasteTotals } from "./metrics";

export const RANGES = [7, 30] as const;
export type Range = (typeof RANGES)[number];

export type AnalyticsFilter = { range: Range; category: string | null }; // category null = all

export type ModelInfo = { version: string; trainedAt: Date; dataFrom: Date; dataTo: Date } | null;

export type SeriesPoint = { date: string; forecast: number | null; actual: number };

export type AnalyticsData = {
    model: ModelInfo;
    category: string | null; // the filter actually applied (an unknown code → null = all)
    categories: { code: string; name: string }[];
    series: SeriesPoint[]; // forecast vs actual, units/day summed over the shown SKUs, oldest → yesterday
    skuCount: number;
    rows: (SkuAccuracy & { nameTh: string })[];
    waste: { date: string; value: number }[]; // ฿/day, oldest → today, `range` entries
    wasteTotals: WasteTotals;
    wasteTarget: number;
};

const key = (d: Date) => d.toISOString().slice(0, 10);

export async function getAnalytics(storeNo: number, filter: AnalyticsFilter, now = new Date()): Promise<AnalyticsData> {
    const today = todayDate(now);
    // Sales window ends yesterday: today's sales are still coming in, so today would always look "under"
    const salesFrom = addDays(today, -filter.range);
    const salesTo = addDays(today, -1);
    const waste30From = addDays(today, -29);

    // Active TOMORROW model; if none is active, the newest one (so the page still shows history)
    const model = await db.modelVersion.findFirst({
        where: { kind: "TOMORROW" },
        orderBy: [{ isActive: "desc" }, { trainedAt: "desc" }],
        select: { id: true, version: true, trainedAt: true, dataFrom: true, dataTo: true },
    });

    const [allSkus, forecasts, sales, waste] = await Promise.all([
        db.sku.findMany({
            where: { inScope: true },
            select: { itemNo: true, nameTh: true, categoryCode: true, categoryName: true },
            orderBy: { itemNo: "asc" },
        }),
        model
            ? db.forecast.findMany({
                  where: { storeNo, modelVersionId: model.id, targetDate: { gte: salesFrom, lte: salesTo } },
                  select: { itemNo: true, targetDate: true, predictedQty: true },
                  orderBy: { runAt: "desc" }, // newest first → first row per SKU/day wins
              })
            : Promise.resolve([]),
        db.dailySales.findMany({
            where: { storeNo, saleDate: { gte: salesFrom, lte: salesTo } },
            select: { itemNo: true, saleDate: true, qtySold: true, qtyReturned: true },
        }),
        // Waste is branch-level (DailyReport), so the category filter does not apply to it
        db.wasteRecord.groupBy({
            by: ["wasteDate"],
            where: { storeNo, wasteDate: { gte: waste30From, lte: today } },
            _sum: { value: true },
        }),
    ]);

    const categories = [...new Map(allSkus.map((s) => [s.categoryCode, s.categoryName ?? s.categoryCode])).entries()]
        .map(([code, name]) => ({ code, name }));
    const category = categories.some((c) => c.code === filter.category) ? filter.category : null;
    const skus = category ? allSkus.filter((s) => s.categoryCode === category) : allSkus;

    // Group in JS (no N+1): "itemNo|date" → qty
    const forecastBy = new Map<string, number>();
    for (const f of forecasts) {
        const k = `${f.itemNo}|${key(f.targetDate)}`;
        if (!forecastBy.has(k)) forecastBy.set(k, Number(f.predictedQty));
    }
    const actualBy = new Map<string, number>();
    for (const s of sales) actualBy.set(`${s.itemNo}|${key(s.saleDate)}`, s.qtySold - s.qtyReturned);

    const days = dayKeys(salesFrom, filter.range);
    const pairsBySku = skus.map((s) => ({
        sku: s,
        pairs: days.map<DayPair>((date) => ({
            date,
            forecast: forecastBy.get(`${s.itemNo}|${date}`) ?? null,
            actual: actualBy.get(`${s.itemNo}|${date}`) ?? 0,
        })),
    }));

    const series = days.map<SeriesPoint>((date, i) => {
        const forecastsToday = pairsBySku.map((p) => p.pairs[i].forecast).filter((f): f is number => f !== null);
        return {
            date,
            forecast: forecastsToday.length ? forecastsToday.reduce((a, b) => a + b, 0) : null,
            actual: pairsBySku.reduce((sum, p) => sum + p.pairs[i].actual, 0),
        };
    });

    const rows = pairsBySku.map(({ sku, pairs }) => ({ ...skuAccuracy(sku.itemNo, pairs), nameTh: sku.nameTh }));

    const wasteByDay = new Map(waste.map((w) => [key(w.wasteDate), Number(w._sum.value ?? 0)]));
    const waste30 = fillDays(dayKeys(waste30From, 30), wasteByDay, 0);

    return {
        model: model && { version: model.version, trainedAt: model.trainedAt, dataFrom: model.dataFrom, dataTo: model.dataTo },
        category,
        categories,
        series,
        skuCount: skus.length,
        rows,
        waste: waste30.slice(-filter.range),
        wasteTotals: wasteTotals(waste30.map((w) => w.value), DAILY_WASTE_TARGET),
        wasteTarget: DAILY_WASTE_TARGET,
    };
}
