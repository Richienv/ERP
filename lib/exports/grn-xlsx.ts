"use client"

import * as XLSX from "xlsx"

export interface GRNExportRow {
    number: string
    poNumber: string
    vendorName: string
    warehouseName: string
    receivedBy: string
    receivedDate: string
    status: string
    itemCount: number
    totalAccepted: number
    totalRejected: number
    notes?: string | null
}

/**
 * Export a list of GRN rows to an XLSX file and trigger a browser download.
 * Returns the number of rows that were exported (0 if input is empty —
 * caller handles empty-state UX).
 *
 * The caller is responsible for mapping raw enum values (e.g. status) to
 * Bahasa labels and dates to display strings before passing rows in, so
 * this helper stays free of page-specific lookup tables.
 */
function buildGRNSheet(rows: GRNExportRow[]) {
    const sheetData = rows.map((r) => ({
        "No GRN": r.number,
        "PO Ref": r.poNumber,
        "Vendor": r.vendorName,
        "Gudang": r.warehouseName,
        "Penerima": r.receivedBy,
        "Tgl Terima": r.receivedDate,
        "Status": r.status,
        "Jumlah Item": r.itemCount,
        "Diterima": r.totalAccepted,
        "Ditolak": r.totalRejected,
        "Catatan": r.notes ?? "",
    }))

    const ws = XLSX.utils.json_to_sheet(sheetData)

    // Auto-fit column widths (rough approximation by content length)
    const keys = Object.keys(sheetData[0] ?? {}) as Array<keyof (typeof sheetData)[number]>
    const colWidths = keys.map((key) => ({
        wch:
            Math.max(
                String(key).length,
                ...sheetData.map((r) => String(r[key] ?? "").length),
            ) + 2,
    }))
    ws["!cols"] = colWidths

    return ws
}

export function exportGRNsToXlsx(rows: GRNExportRow[], filename?: string): number {
    if (rows.length === 0) return 0

    const ws = buildGRNSheet(rows)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, "Surat Jalan Masuk")

    const fname =
        filename ??
        `surat-jalan-masuk-${new Date().toISOString().slice(0, 10)}.xlsx`
    XLSX.writeFile(wb, fname)
    return rows.length
}

/**
 * Export the same GRN rows as `exportGRNsToXlsx` but as a CSV file. Preferred
 * by warehouse audit/finance teams for archival and easier ad-hoc parsing.
 */
export function exportGRNsToCsv(rows: GRNExportRow[], filename?: string): number {
    if (rows.length === 0) return 0

    const ws = buildGRNSheet(rows)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, "Surat Jalan Masuk")

    const fname =
        filename ??
        `surat-jalan-masuk-${new Date().toISOString().slice(0, 10)}.csv`
    XLSX.writeFile(wb, fname, { bookType: "csv" })
    return rows.length
}
