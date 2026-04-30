export const MAX_BULK_IMPORT_ROWS = 500

export const BULK_IMPORT_ROLES = ["admin", "manager", "WAREHOUSE", "PURCHASING"] as const

export function bulkImportCapError(rowCount: number): string {
    return `Maksimal ${MAX_BULK_IMPORT_ROWS} baris per impor (file Anda: ${rowCount} baris). Pisahkan file menjadi beberapa bagian.`
}

export function checkBulkImportSize(rows: unknown[]): { ok: true } | { ok: false; error: string } {
    if (rows.length > MAX_BULK_IMPORT_ROWS) {
        return { ok: false, error: bulkImportCapError(rows.length) }
    }
    return { ok: true }
}
