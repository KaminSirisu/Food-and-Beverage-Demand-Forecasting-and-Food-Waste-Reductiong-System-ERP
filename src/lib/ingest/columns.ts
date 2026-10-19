// Column contract for the D365 "Sales Entry" export.
// Checked against Sales_Entry_2022_11.xlsx: 1 sheet, 24 columns, header in row 1.
import { z } from "zod";

/** Exact header row, in order. A file whose header differs is rejected before any row is read. */
export const SALES_ENTRY_HEADER = [
  "Store No_",
  "POS Terminal No_",
  "Date",
  "Time",
  "Transaction No_",
  "Receipt No_",
  "Line No_",
  "Item No_",
  "Description",
  "Item Category Code",
  "Product Group Code",
  "Price",
  "Net Price",
  "Quantity",
  "Unit of Measure",
  "Price Group Code",
  "Division",
  "Discount Amount",
  "Cost Amount",
  "Net Amount",
  "VAT Amount",
  "Total Rounded Amt_",
  "Customer No_",
  "Staff ID",
] as const;

export type SalesEntryColumn = (typeof SALES_ENTRY_HEADER)[number];
export type RawRow = Record<SalesEntryColumn, unknown>;

// ── cell helpers (ExcelJS gives numbers, strings, Dates, null, or {richText}/{result} objects) ──

const unwrap = (v: unknown): unknown => {
  if (v && typeof v === "object" && !(v instanceof Date)) {
    const o = v as { result?: unknown; richText?: { text: string }[]; text?: string };
    if (o.result !== undefined) return o.result; // formula cell
    if (o.richText) return o.richText.map((t) => t.text).join("");
    if (o.text !== undefined) return o.text;
  }
  return v;
};

const int = z.preprocess((v) => {
  const u = unwrap(v);
  return typeof u === "string" && u.trim() !== "" ? Number(u) : u;
}, z.number().int());

const num = z.preprocess((v) => {
  const u = unwrap(v);
  return typeof u === "string" && u.trim() !== "" ? Number(u) : u;
}, z.number().finite());

const optText = z.preprocess((v) => {
  const u = unwrap(v);
  if (u === null || u === undefined) return null;
  const s = String(u).trim();
  return s === "" ? null : s;
}, z.string().nullable());

const text = optText.pipe(z.string({ message: "required" }));

/** "Date" column: a date cell (ExcelJS → Date at UTC midnight). Returned as YYYY-MM-DD. */
const excelDate = z.preprocess((v) => {
  const u = unwrap(v);
  if (u instanceof Date) return u.toISOString().slice(0, 10);
  if (typeof u === "number") return new Date(Math.round((u - 25569) * 864e5)).toISOString().slice(0, 10); // serial
  return u;
}, z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "not a date"));

/** "Time" column: a time cell (ExcelJS → Date on 1899-12-30, UTC). Returned as HH:mm:ss.SSS. */
const excelTime = z.preprocess((v) => {
  const u = unwrap(v);
  if (u instanceof Date) return u.toISOString().slice(11, 23);
  if (typeof u === "number") return new Date(Math.round((u % 1) * 864e5)).toISOString().slice(11, 23); // day fraction
  return u;
}, z.string().regex(/^\d{2}:\d{2}:\d{2}(\.\d{1,3})?$/, "not a time"));

/** One validated row, already in the shape SalesLine needs. */
export const SalesEntryRow = z
  .object({
    "Store No_": int,
    "POS Terminal No_": int,
    Date: excelDate,
    Time: excelTime,
    "Transaction No_": int,
    "Receipt No_": text, // 11-digit number in the file; kept as text
    "Line No_": int,
    "Item No_": text,
    "Item Category Code": optText,
    Price: num,
    "Net Price": num,
    Quantity: int.refine((q) => q !== 0, "quantity is 0"),
    "Price Group Code": optText,
    "Discount Amount": num,
    "Net Amount": num,
    "Total Rounded Amt_": num,
    "Customer No_": optText,
    // TODO(Member B): add rules found while testing real files, e.g.
    //  - reject Division other than FG?  (file has FG 99.8%, plus EX / PK / OE / SSM)
    //  - quantity outside ±600?
  })
  .transform((r) => ({
    storeNo: r["Store No_"],
    posTerminalNo: r["POS Terminal No_"],
    transactionNo: BigInt(r["Transaction No_"]),
    lineNo: r["Line No_"],
    receiptNo: String(r["Receipt No_"]),
    saleDate: new Date(`${r.Date}T00:00:00Z`),
    saleTime: new Date(`1970-01-01T${r.Time}Z`),
    itemNo: r["Item No_"],
    categoryCode: r["Item Category Code"],
    quantity: r.Quantity,
    price: r.Price,
    netPrice: r["Net Price"],
    discountAmount: r["Discount Amount"],
    netAmount: r["Net Amount"],
    totalAmount: r["Total Rounded Amt_"],
    priceGroupCode: r["Price Group Code"],
    customerNo: r["Customer No_"],
  }));

export type SalesLineInput = z.output<typeof SalesEntryRow>;
