import * as XLSX from "xlsx"

interface ExportOptions {
  filename?: string
  sheetName?: string
}

/**
 * Export table data to Excel (.xlsx) file.
 *
 * @param columns - Array of { header: string, accessorKey: string }
 * @param data - Array of row objects
 * @param options - filename and sheet name
 *
 * @example
 * exportToExcel(
 *   [{ header: "Nama", accessorKey: "name" }, { header: "Harga", accessorKey: "price" }],
 *   products,
 *   { filename: "produk" }
 * )
 */
export function exportToExcel<T extends Record<string, unknown>>(
  columns: { header: string; accessorKey: string }[],
  data: T[],
  options?: ExportOptions
) {
  const { filename = "export", sheetName = "Data" } = options || {}

  // Build header row
  const headers = columns.map((col) => col.header)

  // Build data rows
  const rows = data.map((row) =>
    columns.map((col) => {
      const value = row[col.accessorKey]
      // Handle nested values
      if (value === null || value === undefined) return ""
      if (value instanceof Date) return value.toISOString()
      return value
    })
  )

  // Create worksheet
  const ws = XLSX.utils.aoa_to_sheet([headers, ...rows])

  // Auto-size columns
  const colWidths = columns.map((col, i) => {
    const maxLen = Math.max(
      col.header.length,
      ...rows.map((row) => String(row[i] ?? "").length)
    )
    return { wch: Math.min(maxLen + 2, 50) }
  })
  ws["!cols"] = colWidths

  // Create workbook and download
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, sheetName)

  const timestamp = new Date().toISOString().slice(0, 10)
  XLSX.writeFile(wb, `${filename}-${timestamp}.xlsx`)
}

/**
 * Export visible/filtered TanStack Table rows to Excel.
 *
 * @example
 * exportTableToExcel(table, { filename: "produk" })
 */
export function exportTableToExcel<T>(
  table: { getFilteredRowModel: () => { rows: { original: T }[] }; getAllColumns: () => { id: string; columnDef: { header?: unknown; meta?: { exportHeader?: string } }; getIsVisible: () => boolean }[] },
  options?: ExportOptions
) {
  const visibleColumns = table
    .getAllColumns()
    .filter((col) => col.getIsVisible() && col.id !== "select" && col.id !== "actions" && col.id !== "drag-handle")
    .map((col) => ({
      header: (col.columnDef.meta as Record<string, string>)?.exportHeader || (typeof col.columnDef.header === "string" ? col.columnDef.header : col.id),
      accessorKey: col.id,
    }))

  const data = table.getFilteredRowModel().rows.map((row) => row.original as Record<string, unknown>)

  exportToExcel(visibleColumns, data, options)
}
