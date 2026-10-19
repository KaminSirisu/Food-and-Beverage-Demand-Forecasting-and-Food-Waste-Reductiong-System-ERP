// Streaming reader: never loads the whole workbook into memory (a monthly export is ~66 MB / 525k rows).
import ExcelJS from "exceljs";
import { Readable } from "node:stream";
import { SALES_ENTRY_HEADER, type RawRow } from "./columns";

export class HeaderError extends Error {}

export interface ParsedRow {
  rowNumber: number; // Excel row number (header = 1)
  raw: RawRow;
}

/**
 * Yields every data row of the first worksheet as { column name → cell value }.
 * Throws HeaderError if row 1 is not exactly SALES_ENTRY_HEADER.
 */
export async function* readSalesEntry(input: string | Readable): AsyncGenerator<ParsedRow> {
  const reader = new ExcelJS.stream.xlsx.WorkbookReader(input, {
    entries: "emit",
    sharedStrings: "cache",
    hyperlinks: "ignore",
    styles: "cache", // needed so date/time cells come back as Date, not serial numbers
    worksheets: "emit",
  });

  for await (const worksheet of reader) {
    let header: string[] | null = null;
    for await (const row of worksheet) {
      // row.values is 1-based: values[1] = column A
      const values = (row.values as unknown[]).slice(1);
      if (!header) {
        header = values.map((v) => String(v ?? "").trim());
        const expected = SALES_ENTRY_HEADER as readonly string[];
        const missing = expected.filter((c) => !header!.includes(c));
        if (missing.length > 0 || header.length < expected.length) {
          throw new HeaderError(`Header mismatch. Missing: ${missing.join(", ") || "none"}; found ${header.length} columns.`);
        }
        continue;
      }
      const raw = {} as RawRow;
      header.forEach((name, i) => {
        (raw as Record<string, unknown>)[name] = values[i] ?? null;
      });
      yield { rowNumber: row.number, raw };
    }
    return; // first sheet only
  }
  throw new HeaderError("Workbook has no worksheet.");
}
