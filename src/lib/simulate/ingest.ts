// "Simulate Data Ingestion" (manual 3.1.1 no. 6, S1): demo only. Loads today's sales "so far" — every line up to
// the current clock time — through the same pipeline as Power Automate (validate → sales_line → daily_sales,
// import log). Each click loads only the new lines since the last one, like an intraday D365 export.
// Source, in order:
//   1. data/daily/Sales_Entry_<today>.xlsx — the real D365 day (local demo files, split from the monthly exports)
//   2. otherwise the same weekday last week from the database, re-dated to today (transaction no. + offset)
// The first sync of a day also catches up the previous days (catchUpPreviousDays).
// Tomorrow's forecast: the provisional baseline before 13:30, then the model from the same trigger as the D365 upload
// (forecastIfDue below).
import "server-only";
import { existsSync } from "node:fs";
import path from "node:path";
import { Readable } from "node:stream";
import ExcelJS from "exceljs";
import JSZip from "jszip";
import { db } from "@/lib/db";
import { openBatch, sha256 } from "@/lib/ingest/batch";
import { SALES_ENTRY_HEADER, SalesEntryRow, type SalesEntryColumn } from "@/lib/ingest/columns";
import { loadSalesEntry, type LoadResult } from "@/lib/ingest/load";
import { readSalesEntry } from "@/lib/ingest/parse";
import { runForecastAfterLoad } from "@/lib/forecast/trigger";
import { BASELINE_VERSION, DECISION_TIME } from "@/lib/orders/forecast-pick";
import { ensureProvisionalForecast } from "@/lib/orders/provisional";
import { addDays, todayDate } from "@/lib/time";

const TX_OFFSET = 7_000_000; // re-dated lines get new transaction numbers, so the natural key stays unique

export type SimulateResult =
    | { ok: true; status: "LOADED" | "LOADED_WITH_ERRORS"; day: string; upTo: string; loaded: number; rejected: number; source: "d365-file" | "last-week" }
    | { ok: true; status: "NO_NEW_DATA"; day: string; upTo: string; source: "d365-file" | "last-week" | null }
    | { ok: false; error: string };

type Row = Partial<Record<SalesEntryColumn, unknown>>;

/** "HH:mm:ss" in Bangkok — the clock stays real in demo mode. */
function bangkokClock(now: Date): string {
    return new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Bangkok", hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23" }).format(now);
}
const timeOf = (v: unknown) => (v instanceof Date ? v.toISOString().slice(11, 19) : "");

async function fromDayFile(file: string, storeNo: number, upTo: string): Promise<Row[]> {
    const rows: Row[] = [];
    for await (const { raw } of readSalesEntry(file)) {
        const r = raw as Row;
        if (Number(r["Store No_"]) === storeNo && timeOf(r.Time) <= upTo) rows.push(r);
    }
    return rows;
}

async function fromLastWeek(storeNo: number, day: Date, upTo: string): Promise<Row[]> {
    const lines = await db.salesLine.findMany({
        where: { storeNo, saleDate: addDays(day, -7), saleTime: { lte: new Date(`1970-01-01T${upTo}Z`) } },
        orderBy: [{ saleTime: "asc" }, { lineNo: "asc" }],
    });
    return lines.map((l) => ({
        "Store No_": l.storeNo,
        "POS Terminal No_": l.posTerminalNo,
        Date: day,
        Time: l.saleTime,
        "Transaction No_": Number(l.transactionNo) + TX_OFFSET,
        "Receipt No_": l.receiptNo,
        "Line No_": l.lineNo,
        "Item No_": l.itemNo,
        "Item Category Code": l.categoryCode,
        Price: Number(l.price),
        "Net Price": Number(l.netPrice),
        Quantity: l.quantity,
        "Price Group Code": l.priceGroupCode,
        "Discount Amount": Number(l.discountAmount),
        "Net Amount": Number(l.netAmount),
        "Total Rounded Amt_": Number(l.totalAmount),
        "Customer No_": l.customerNo,
    }));
}

async function toXlsx(rows: Row[]): Promise<Buffer> {
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet("Sales Entry");
    ws.addRow([...SALES_ENTRY_HEADER]);
    const dateCol = SALES_ENTRY_HEADER.indexOf("Date") + 1;
    const timeCol = SALES_ENTRY_HEADER.indexOf("Time") + 1;
    for (const r of rows) {
        const added = ws.addRow(SALES_ENTRY_HEADER.map((c) => r[c] ?? null));
        added.getCell(dateCol).numFmt = "yyyy-mm-dd";
        added.getCell(timeCol).numFmt = "hh:mm:ss";
    }
    return workbookFirst(Buffer.from(await wb.xlsx.writeBuffer()));
}

// ExcelJS writes xl/workbook.xml as the LAST zip entry. The streaming reader (ingest/parse.ts) then sometimes
// meets the sheet before the workbook and fails ("reading 'sheets'"). Excel and D365 put the workbook first,
// so re-pack the generated file in that order. Real export files are not affected.
async function workbookFirst(buf: Buffer): Promise<Buffer> {
    const src = await JSZip.loadAsync(buf);
    const names = Object.keys(src.files).filter((n) => !src.files[n].dir);
    const rank = (n: string) => (n.startsWith("xl/worksheets/") ? 2 : n === "xl/workbook.xml" || n.startsWith("[") || n.startsWith("_rels") ? 0 : 1);
    const out = new JSZip();
    for (const n of names.sort((a, b) => rank(a) - rank(b))) out.file(n, await src.files[n].async("nodebuffer"));
    return out.generateAsync({ type: "nodebuffer", compression: "DEFLATE" });
}

/** Lines of `day` up to `upTo` that are valid and not loaded yet (natural key). */
async function missingLines(storeNo: number, day: Date, upTo: string, allowFallback: boolean) {
    const ymd = day.toISOString().slice(0, 10);
    const file = path.join(process.cwd(), "data", "daily", `Sales_Entry_${ymd}.xlsx`);
    const source: "d365-file" | "last-week" | null = existsSync(file) ? "d365-file" : allowFallback ? "last-week" : null;
    if (!source) return { source, all: 0, rows: [] as Row[] };
    const all = source === "d365-file" ? await fromDayFile(file, storeNo, upTo) : await fromLastWeek(storeNo, day, upTo);

    const existing = await db.salesLine.findMany({
        where: { storeNo, saleDate: day },
        select: { posTerminalNo: true, transactionNo: true, lineNo: true },
    });
    const loadedKeys = new Set(existing.map((l) => `${l.posTerminalNo}|${l.transactionNo}|${l.lineNo}`));
    // Invalid rows (e.g. fractional quantity) are left out: they would be re-sent and rejected on every click.
    // Validation itself is shown by the real Power Automate files in the import log.
    const rows = all.filter((r) => SalesEntryRow.safeParse(r).success && !loadedKeys.has(`${Number(r["POS Terminal No_"])}|${Number(r["Transaction No_"])}|${Number(r["Line No_"])}`));
    return { source, all: all.length, rows };
}

/** Builds the file and loads it through the ingest pipeline (no forecast). Returns lines loaded, or an error. */
async function loadRows(rows: Row[], fileName: string): Promise<{ ok: true; loaded: number; rejected: number; status: "LOADED" | "LOADED_WITH_ERRORS" } | { ok: false; error: string } | null> {
    const body = await toXlsx(rows);
    const { batch, duplicate } = await openBatch(fileName, sha256(body), "simulate");
    if (duplicate) return null;
    const result: LoadResult = await loadSalesEntry(batch.id, Readable.from(body), { forecast: false });
    if (result.status === "FAILED") return { ok: false, error: result.message ?? "Load failed." };
    return { ok: true, loaded: result.rows.loaded, rejected: result.rows.rejected, status: result.status };
}

const CATCH_UP_DAYS = 7;

export type CatchUp = { days: string[]; lines: number };

/**
 * First sync of a day only (today has no sales yet): load the rest of the previous days from data/daily, e.g. the
 * evening sales after Live was stopped, or a whole day the demo was closed (up to 7 days back). For a day whose
 * next-day forecast was never made, run the trigger, oldest day first, so stock and orders have a baseline.
 */
export async function catchUpPreviousDays(storeNo: number, now = new Date()): Promise<CatchUp> {
    const today = todayDate(now);
    if ((await db.salesLine.count({ where: { storeNo, saleDate: today } })) > 0) return { days: [], lines: 0 };

    const out: CatchUp = { days: [], lines: 0 };
    for (let back = CATCH_UP_DAYS; back >= 1; back--) {
        const day = addDays(today, -back);
        const { rows } = await missingLines(storeNo, day, "23:59:59", false);
        if (rows.length === 0) continue;
        const ymd = day.toISOString().slice(0, 10);
        const r = await loadRows(rows, `Sales_Entry_${ymd}_2359.xlsx`); // the whole day, like an end-of-day export
        if (!r || !r.ok || r.loaded === 0) continue;
        out.days.push(ymd);
        out.lines += r.loaded;
        const nextForecast = await db.forecast.count({
            where: { storeNo, targetDate: addDays(day, 1), modelVersion: { kind: "TOMORROW", isActive: true } },
        });
        if (nextForecast === 0) await runForecastAfterLoad(ymd, storeNo).catch((e) => console.error("catch-up forecast failed", e));
    }
    return out;
}

export async function simulateIngestion(storeNo: number, now = new Date()): Promise<SimulateResult & { catchUp?: CatchUp }> {
    const today = todayDate(now);
    const day = today.toISOString().slice(0, 10);
    const upTo = bangkokClock(now);

    const catchUp = await catchUpPreviousDays(storeNo, now);
    const { source, all, rows } = await missingLines(storeNo, today, upTo, true);
    if (rows.length === 0) return { ok: true, status: "NO_NEW_DATA", day, upTo, source: all ? source : null, catchUp };

    // Same name pattern as an intraday D365 export (batch.ts): Sales_Entry_YYYY-MM-DD_HHMM.xlsx
    const r = await loadRows(rows, `Sales_Entry_${day}_${upTo.slice(0, 2)}${upTo.slice(3, 5)}.xlsx`);
    if (r === null || (r.ok && r.loaded === 0)) return { ok: true, status: "NO_NEW_DATA", day, upTo, source: source!, catchUp };
    if (!r.ok) return { ok: false, error: r.error };
    return { ok: true, status: r.status, day, upTo, loaded: r.loaded, rejected: r.rejected, source: source!, catchUp };
}

export type SimForecast = { ran: boolean; reason?: "provisional" | "decision"; modelVersion?: string; rows?: number };

/**
 * Live demo: the order card needs tomorrow's forecast.
 *   Before 13:30: the provisional 4-week baseline (orders/provisional.ts), saved once. It needs no sales today, so
 *     pressing Live before the first sale (or before opening) still fills the order card.
 *   From 13:30: the model, through the forecast trigger (L7, the same one the D365 upload uses), once, and only when
 *     today has sales, because it decides tomorrow from them. The model no longer runs on a few morning sales:
 *     it was trained on the 13:30 picture of the day.
 */
export async function forecastIfDue(storeNo: number, now = new Date()): Promise<SimForecast> {
    const clock = bangkokClock(now).slice(0, 5);
    if (clock < DECISION_TIME) {
        const p = await ensureProvisionalForecast(storeNo, now);
        return p.saved ? { ran: true, reason: "provisional", modelVersion: BASELINE_VERSION, rows: p.rows } : { ran: false };
    }

    const today = todayDate(now);
    // 13:30 Bangkok of the real day (the clock stays real in demo mode)
    const realYmd = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Bangkok" }).format(now);
    const decisionAt = new Date(`${realYmd}T${DECISION_TIME}:00+07:00`);
    // Any version counts: if the model fails, the trigger saves the baseline instead, and that must not repeat every minute
    const ranSince = await db.forecast.count({
        where: { storeNo, targetDate: addDays(today, 1), runAt: { gte: decisionAt }, modelVersion: { kind: "TOMORROW" } },
    });
    if (ranSince > 0) return { ran: false };
    const sold = await db.dailySales.count({ where: { storeNo, saleDate: today, qtySold: { gt: 0 } } });
    if (sold === 0) return { ran: false };

    const r = await runForecastAfterLoad(today.toISOString().slice(0, 10), storeNo);
    return { ran: true, reason: "decision", modelVersion: r.modelVersion, rows: r.rows };
}
