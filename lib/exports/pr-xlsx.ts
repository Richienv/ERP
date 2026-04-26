"use client"

import * as XLSX from "xlsx"

export interface PRExportRow {
    id: string
    department: string
    requester: string
    priority: string
    status: string
    items: number
    estimatedTotal: number
    approver: string
    date: string
}

/**
 * Export a list of Purchase Request rows to an XLSX file and trigger a
 * browser download. Returns the number of rows exported (0 if input is
 * empty — caller should handle empty-state UX).
 *
 * The caller is responsible for translating raw enum values (status,
 * priority) to Bahasa labels before passing rows in.
 */
export function exportPRsToXlsx(rows: PRExportRow[], filename?: string): number {
    if (rows.length === 0) return 0

    const sheetData = rows.map((r) => ({
        "No PR": r.id,
        "Departemen": r.department,
        "Pemohon": r.requester,
        "Prioritas": r.priority,
        "Status": r.status,
        "Item": r.items,
        "Nilai Estimasi (Rp)": r.estimatedTotal,
        "Approver": r.approver,
        "Tanggal Buat": r.date,
    }))

    const ws = XLSX.utils.json_to_sheet(sheetData)

    const keys = Object.keys(sheetData[0] ?? {}) as Array<keyof (typeof sheetData)[number]>
    const colWidths = keys.map((key) => ({
        wch:
            Math.max(
                String(key).length,
                ...sheetData.map((r) => String(r[key] ?? "").length),
            ) + 2,
    }))
    ws["!cols"] = colWidths

    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, "Permintaan Pembelian")

    const fname =
        filename ??
        `permintaan-pembelian-${new Date().toISOString().slice(0, 10)}.xlsx`
    XLSX.writeFile(wb, fname)
    return rows.length
}
