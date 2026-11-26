// Data import log (manual 3.1.1 no. 7, report 3.4, NFR5): every received file, newest first. Server only.
// Files hold all 36 branches, so the log is not filtered by branch (same as the header sync pill, S1/S9).
import "server-only";
import { db } from "@/lib/db";

export type ImportRow = {
    id: string;
    fileName: string;
    source: string;
    status: string;
    receivedAt: Date;
    periodFrom: Date | null;
    periodTo: Date | null;
    rowsTotal: number;
    rowsLoaded: number;
    rowsSkipped: number;
    rowsRejected: number;
    message: string | null;
    errors: { rowNumber: number; column: string | null; message: string }[]; // first few only
    errorCount: number;
};

export async function getImportLog(limit = 50): Promise<ImportRow[]> {
    const batches = await db.importBatch.findMany({
        orderBy: { receivedAt: "desc" },
        take: limit,
        select: {
            id: true, fileName: true, source: true, status: true, receivedAt: true, periodFrom: true, periodTo: true,
            rowsTotal: true, rowsLoaded: true, rowsSkipped: true, rowsRejected: true, message: true,
            errors: { orderBy: { rowNumber: "asc" }, take: 5, select: { rowNumber: true, column: true, message: true } },
            _count: { select: { errors: true } },
        },
    });
    return batches.map(({ _count, ...b }) => ({ ...b, errorCount: _count.errors }));
}
