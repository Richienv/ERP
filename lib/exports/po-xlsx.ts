"use client"

import * as XLSX from "xlsx"

export interface POExportRow {
    id: string
    vendor: string
    status: string
    date: string
    eta: string
    requester?: string
    approver?: string
    items: number
    total: number
}

/**
 * Export a list of Purchase Order rows to an XLSX file and trigger a browser
 * download. Returns the number of rows that were exported (0 if the input
 * was empty — caller should handle empty-state UX).
 *
 * The caller is responsible for mapping raw enum values (e.g. status) to
 * Bahasa labels before passing rows in, so that this helper stays free of
 * page-specific lookup tables.
 */
function buildPOSheet(rows: POExportRow[]) {
    const sheetData = rows.map((r) => ({
        "No PO": r.id,
        "Vendor": r.vendor,
        "Status": r.status,
        "Tanggal Buat": r.date,
        "Tgl Diharapkan": r.eta,
        "Permintaan / Approval": `${r.requester ?? ""} / ${r.approver ?? ""}`,
        "Item": r.items,
        "Total (Rp)": r.total,
    }))

    const ws = XLSX.utils.json_to_sheet(sheetData)

    // Auto-fit column widths (rough approximation based on content length)
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

export function exportPOsToXlsx(rows: POExportRow[], filename?: string): number {
    if (rows.length === 0) return 0

    const ws = buildPOSheet(rows)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, "Pesanan Pembelian")

    const fname =
        filename ??
        `pesanan-pembelian-${new Date().toISOString().slice(0, 10)}.xlsx`
    XLSX.writeFile(wb, fname)
    return rows.length
}

/**
 * Export the same rows as `exportPOsToXlsx` but as a CSV file. Useful for
 * accountants/auditors who prefer CSV (smaller, easier to parse with text
 * tools, importable into legacy systems).
 */
export function exportPOsToCsv(rows: POExportRow[], filename?: string): number {
    if (rows.length === 0) return 0

    const ws = buildPOSheet(rows)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, "Pesanan Pembelian")

    const fname =
        filename ??
        `pesanan-pembelian-${new Date().toISOString().slice(0, 10)}.csv`
    XLSX.writeFile(wb, fname, { bookType: "csv" })
    return rows.length
}
