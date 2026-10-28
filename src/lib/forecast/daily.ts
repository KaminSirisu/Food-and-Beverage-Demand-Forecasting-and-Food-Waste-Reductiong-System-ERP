// Load daily_sales from the DB and build the model features with features.ts (A4). Owner: Mew.
// The model reads daily_sales, never sales_line (CLAUDE.md).
import path from "node:path";
import { readFileSync } from "node:fs";
import { db } from "@/lib/db";
import { STORE_NO } from "@/lib/config";
import { buildFeatureRows, type DailyInput, type FeatureRow } from "./features";

// Last training day of the live model (ml/train_models.py). Sets the not-on-sale rule per SKU.
export const TRAIN_END = "2023-03-31";

const MODELS_DIR = path.join(process.cwd(), "models");
const ymd = (d: Date) => d.toISOString().slice(0, 10); // @db.Date is stored as UTC midnight

type Encoders = { sku: Record<string, number>; category: Record<string, number>; branch: Record<string, number> };
function encoders(): Encoders {
    return JSON.parse(readFileSync(path.join(MODELS_DIR, "encoders.json"), "utf8"));
}
/** Thai public holidays used in training (models/holidays.csv, first column = YYYY-MM-DD). */
function holidays(): string[] {
    return readFileSync(path.join(MODELS_DIR, "holidays.csv"), "utf8")
        .split(/\r?\n/)
        .map((line) => line.match(/^(\d{4}-\d{2}-\d{2})/)?.[1])
        .filter((d): d is string => Boolean(d));
}

/** Open days of the branch + the daily inputs of each SKU, up to and including `upTo`. */
export async function loadDailyInputs(storeNo: number, itemNos: string[], upTo?: Date) {
    const dateFilter = upTo ? { saleDate: { lte: upTo } } : {};
    // A branch day is open when any item sold (same rule as training)
    const open = await db.dailySales.findMany({
        where: { storeNo, qtySold: { gt: 0 }, ...dateFilter },
        select: { saleDate: true },
        distinct: ["saleDate"],
    });
    const rows = await db.dailySales.findMany({
        where: { storeNo, itemNo: { in: itemNos }, qtySold: { gt: 0 }, ...dateFilter },
        select: {
            itemNo: true, saleDate: true, qtySold: true, qtyBeforeCutoff: true,
            priceBeforeCutoff: true, discountBeforeCutoff: true, grossBeforeCutoff: true,
        },
        orderBy: { saleDate: "asc" },
    });
    const daily: Record<string, DailyInput[]> = Object.fromEntries(itemNos.map((i) => [i, []]));
    for (const r of rows) {
        daily[r.itemNo].push({
            date: ymd(r.saleDate),
            qtySold: r.qtySold,
            qtyBeforeCutoff: r.qtyBeforeCutoff,
            priceBeforeCutoff: r.priceBeforeCutoff === null ? null : Number(r.priceBeforeCutoff),
            discountBeforeCutoff: Number(r.discountBeforeCutoff),
            grossBeforeCutoff: Number(r.grossBeforeCutoff),
        });
    }
    return { openDays: open.map((o) => ymd(o.saleDate)), daily };
}

/**
 * Feature rows of every in-scope SKU for every day of the branch history up to `upTo` (default: last loaded day).
 * Take the row whose date is today for the 13:30 forecast.
 */
export async function buildFeaturesFromDb(storeNo = STORE_NO, upTo?: Date): Promise<FeatureRow[]> {
    const enc = encoders();
    const skus = await db.sku.findMany({ where: { inScope: true }, select: { itemNo: true, categoryCode: true, shelfLifeDays: true } });
    const itemNos = skus.map((s) => s.itemNo);
    const { openDays, daily } = await loadDailyInputs(storeNo, itemNos, upTo);
    if (openDays.length === 0) return [];
    const opts = { openDays, holidays: holidays(), trainEnd: TRAIN_END, to: upTo ? ymd(upTo) : undefined };
    return skus.flatMap((s) =>
        buildFeatureRows(
            {
                itemNo: s.itemNo,
                skuId: enc.sku[s.itemNo],
                categoryId: enc.category[s.categoryCode],
                shelfLifeDays: s.shelfLifeDays,
                branchId: enc.branch[String(storeNo)] ?? 0,
            },
            daily[s.itemNo],
            opts,
        ),
    );
}
