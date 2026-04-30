"use client"

import * as XLSX from "xlsx"

export interface VendorExportRow {
    code: string
    name: string
    contactName: string | null
    email: string | null
    phone: string | null
    npwp: string | null
    paymentTerm: string | null
    rating: number
    onTimeRate: number
    status: string
    totalOrders: number
}

/**
 * Export a list of Vendor rows to an XLSX file and trigger a browser download.
 * Returns the number of rows exported (0 if input was empty — caller handles
 * empty-state UX).
 *
 * Caller is responsible for translating enum/status values to Bahasa labels
 * before passing rows in.
 */
function buildVendorSheet(rows: VendorExportRow[]) {
    const sheetData = rows.map((r) => ({
        "Kode": r.code,
        "Nama Vendor": r.name,
        "Kontak (PIC)": r.contactName ?? "",
        "Email": r.email ?? "",
        "Telepon": r.phone ?? "",
        "NPWP": r.npwp ?? "",
        "Pembayaran": r.paymentTerm ?? "",
        "Rating": r.rating,
        "OTD %": r.onTimeRate,
        "Status": r.status,
        "Total PO": r.totalOrders,
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

export function exportVendorsToXlsx(rows: VendorExportRow[], filename?: string): number {
    if (rows.length === 0) return 0

    const ws = buildVendorSheet(rows)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, "Pemasok")

    const fname =
        filename ?? `pemasok-${new Date().toISOString().slice(0, 10)}.xlsx`
    XLSX.writeFile(wb, fname)
    return rows.length
}

/**
 * Export the same vendor rows as `exportVendorsToXlsx` but as a CSV file.
 * Useful for finance/audit teams who prefer CSV.
 */
export function exportVendorsToCsv(rows: VendorExportRow[], filename?: string): number {
    if (rows.length === 0) return 0

    const ws = buildVendorSheet(rows)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, "Pemasok")

    const fname =
        filename ?? `pemasok-${new Date().toISOString().slice(0, 10)}.csv`
    XLSX.writeFile(wb, fname, { bookType: "csv" })
    return rows.length
}
