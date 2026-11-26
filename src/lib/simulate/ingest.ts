// "Simulate Data Ingestion" (manual 3.1.1 no. 6, S1): demo only. Loads today's sales "so far" — every line up to
// the current clock time — through the same pipeline as Power Automate (validate → sales_line → daily_sales,
// import log). Each click loads only the new lines since the last one, like an intraday D365 export.
// Source, in order:
//   1. data/daily/Sales_Entry_<today>.xlsx — the real D365 day (local demo files, split from the monthly exports)
//   2. otherwise the same weekday last week from the database, re-dated to today (transaction no. + offset)
// Tomorrow's forecast runs from the same trigger as the D365 upload, only when due (forecastIfDue below).
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

export async function simulateIngestion(storeNo: number, now = new Date()): Promise<SimulateResult> {
    const today = todayDate(now);
    const day = today.toISOString().slice(0, 10);
    const upTo = bangkokClock(now);

    const file = path.join(process.cwd(), "data", "daily", `Sales_Entry_${day}.xlsx`);
    const source = existsSync(file) ? "d365-file" : "last-week";
    const all = source === "d365-file" ? await fromDayFile(file, storeNo, upTo) : await fromLastWeek(storeNo, today, upTo);

    // Send only lines not loaded yet (natural key), so each click is a small "since last sync" file
    const existing = await db.salesLine.findMany({
        where: { storeNo, saleDate: today },
        select: { posTerminalNo: true, transactionNo: true, lineNo: true },
    });
    const loadedKeys = new Set(existing.map((l) => `${l.posTerminalNo}|${l.transactionNo}|${l.lineNo}`));
    // Invalid rows (e.g. fractional quantity) are left out: they would be re-sent and rejected on every click.
    // Validation itself is shown by the real Power Automate files in the import log.
    const rows = all.filter((r) => SalesEntryRow.safeParse(r).success && !loadedKeys.has(`${Number(r["POS Terminal No_"])}|${Number(r["Transaction No_"])}|${Number(r["Line No_"])}`));
    if (rows.length === 0) return { ok: true, status: "NO_NEW_DATA", day, upTo, source: all.length ? source : null };

    // Same name pattern as an intraday D365 export (batch.ts): Sales_Entry_YYYY-MM-DD_HHMM.xlsx
    const body = await toXlsx(rows);
    const fileName = `Sales_Entry_${day}_${upTo.slice(0, 2)}${upTo.slice(3, 5)}.xlsx`;
    const { batch, duplicate } = await openBatch(fileName, sha256(body), "simulate");
    if (duplicate) return { ok: true, status: "NO_NEW_DATA", day, upTo, source };

    const result: LoadResult = await loadSalesEntry(batch.id, Readable.from(body), { forecast: false });
    if (result.status === "FAILED") return { ok: false, error: result.message ?? "Load failed." };
    if (result.rows.loaded === 0) return { ok: true, status: "NO_NEW_DATA", day, upTo, source };
    return { ok: true, status: result.status, day, upTo, loaded: result.rows.loaded, rejected: result.rows.rejected, source };
}

const DECISION_TIME = "13:30"; // the model decides tomorrow at 13:30 (forecast.ts)

export type SimForecast = { ran: boolean; reason?: "first" | "decision"; modelVersion?: string; rows?: number };

/**
 * Live demo: the order card needs tomorrow's forecast, so a sync runs the forecast trigger (L7, the same one
 * the D365 upload uses) when it is due: once at the first sync of the day (provisional, morning sales only)
 * and once more after 13:30 (the official decision). Never more than that, so the forecast table stays small.
 */
export async function forecastIfDue(storeNo: number, now = new Date()): Promise<SimForecast> {
    const today = todayDate(now);
    const latest = await db.forecast.findFirst({
        where: { storeNo, targetDate: addDays(today, 1), modelVersion: { kind: "TOMORROW", isActive: true } },
        orderBy: { runAt: "desc" },
        select: { runAt: true },
    });
    const clock = bangkokClock(now).slice(0, 5);
    // 13:30 Bangkok of the real day (the clock stays real in demo mode)
    const realYmd = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Bangkok" }).format(now);
    const decisionAt = new Date(`${realYmd}T${DECISION_TIME}:00+07:00`);

    let reason: SimForecast["reason"];
    if (!latest) reason = "first";
    else if (clock >= DECISION_TIME && latest.runAt < decisionAt) reason = "decision";
    if (!reason) return { ran: false };

    const r = await runForecastAfterLoad(today.toISOString().slice(0, 10), storeNo);
    return { ran: true, reason, modelVersion: r.modelVersion, rows: r.rows };
}
