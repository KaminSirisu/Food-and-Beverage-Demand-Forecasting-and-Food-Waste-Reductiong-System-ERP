import type { Metadata } from "next";
import { getCurrentUser } from "@/lib/auth/dal";
import { getImportLog, type ImportRow } from "@/lib/imports/queries";
import { formatClock, formatShortDate } from "@/lib/time";
import { Badge, type BadgeTone } from "../_components/Badge";

export const metadata: Metadata = { title: "Data Import Log" };

const STATUS: Record<string, { label: string; tone: BadgeTone }> = {
    LOADED: { label: "Loaded", tone: "green" },
    LOADED_WITH_ERRORS: { label: "Loaded with errors", tone: "amber" },
    FAILED: { label: "Failed", tone: "red" },
    DUPLICATE: { label: "Duplicate", tone: "slate" },
    PROCESSING: { label: "Processing", tone: "indigo" },
    RECEIVED: { label: "Received", tone: "indigo" },
};
const SOURCE: Record<string, string> = { "power-automate": "Power Automate", backfill: "Backfill", simulate: "Simulated" };

const day = (d: Date) => d.toISOString().slice(0, 10);
const period = (r: ImportRow) =>
    !r.periodFrom || !r.periodTo ? "–" : day(r.periodFrom) === day(r.periodTo) ? day(r.periodFrom) : `${day(r.periodFrom)} → ${day(r.periodTo)}`;
const n = (v: number) => v.toLocaleString("en-US");

// Manual 3.1.1 no. 7 / report 3.4: the Report icon opens the data import log (NFR5).
export default async function ImportsPage() {
    await getCurrentUser(); // G2: signed-in users only
    const rows = await getImportLog();
    const failed = rows.filter((r) => r.status === "FAILED").length;

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-3xl font-bold text-slate-900">Data Import Log</h1>
                <p className="mt-1 text-sm text-slate-500">
                    Every sales file received from D365, newest first · last {rows.length} files
                    {failed > 0 && <span className="font-semibold text-red-600"> · {failed} failed</span>}
                </p>
            </div>

            <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
                <table className="w-full text-sm">
                    <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                        <tr>
                            <th className="px-4 py-3">Received</th>
                            <th className="px-4 py-3">Status</th>
                            <th className="px-4 py-3">File</th>
                            <th className="px-4 py-3">Source</th>
                            <th className="px-4 py-3">Sales date</th>
                            <th className="px-4 py-3 text-right">Rows</th>
                            <th className="px-4 py-3 text-right">Loaded</th>
                            <th className="px-4 py-3 text-right">Skipped</th>
                            <th className="px-4 py-3 text-right">Rejected</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                        {rows.length === 0 && (
                            <tr>
                                <td colSpan={9} className="px-4 py-10 text-center text-slate-500">No file received yet.</td>
                            </tr>
                        )}
                        {rows.map((r) => {
                            const s = STATUS[r.status] ?? { label: r.status, tone: "slate" as const };
                            return (
                                <tr key={r.id} className="align-top">
                                    <td className="whitespace-nowrap px-4 py-3 text-slate-600">
                                        {formatShortDate(r.receivedAt)} · {formatClock(r.receivedAt)}
                                    </td>
                                    <td className="whitespace-nowrap px-4 py-3"><Badge tone={s.tone}>{s.label}</Badge></td>
                                    <td className="px-4 py-3">
                                        <p className="whitespace-nowrap font-medium text-slate-900">{r.fileName}</p>
                                        <p className="font-mono text-xs text-slate-400" title="Processing ID">{r.id.slice(0, 8)}</p>
                                        {r.message && <p className="mt-1 text-xs text-red-600">{r.message}</p>}
                                        {r.errorCount > 0 && (
                                            <details className="mt-1 text-xs text-slate-600">
                                                <summary className="cursor-pointer font-semibold text-amber-700">
                                                    {n(Math.max(r.rowsRejected, r.errorCount))} rejected row{Math.max(r.rowsRejected, r.errorCount) > 1 ? "s" : ""} · first {r.errors.length} shown
                                                </summary>
                                                <ul className="mt-1 space-y-0.5">
                                                    {r.errors.map((e) => (
                                                        <li key={`${e.rowNumber}-${e.column}`}>
                                                            Row {e.rowNumber}{e.column ? ` · ${e.column}` : ""}: {e.message}
                                                        </li>
                                                    ))}
                                                </ul>
                                            </details>
                                        )}
                                    </td>
                                    <td className="whitespace-nowrap px-4 py-3 text-slate-600">{SOURCE[r.source] ?? r.source}</td>
                                    <td className="whitespace-nowrap px-4 py-3 text-slate-600">{period(r)}</td>
                                    <td className="px-4 py-3 text-right tabular-nums">{n(r.rowsTotal)}</td>
                                    <td className="px-4 py-3 text-right tabular-nums font-semibold text-slate-900">{n(r.rowsLoaded)}</td>
                                    <td className="px-4 py-3 text-right tabular-nums text-slate-500">{n(r.rowsSkipped)}</td>
                                    <td className={`px-4 py-3 text-right tabular-nums ${r.rowsRejected > 0 ? "font-semibold text-amber-700" : "text-slate-500"}`}>
                                        {n(r.rowsRejected)}
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>
            <p className="text-xs text-slate-500">
                Skipped = other branches in the file or lines already loaded. Rejected = rows that failed validation (e.g. a fractional quantity).
                Files are moved to /archive (loaded) or /failed in OneDrive by Power Automate.
            </p>
        </div>
    );
}
