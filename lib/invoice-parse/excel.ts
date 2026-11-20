import type { PdfText } from "./pdf-text"
import type { TextItem } from "./types"

/**
 * Excel → positioned text, so the same layout parser reads .xlsx documents (our company keeps
 * most POs, COs, surat jalan and invoices as Excel). Each non-empty cell becomes a TextItem placed
 * where it would print: x from the sheet's column widths, y from the row index. Merged cells span
 * their full width. Numbers are emitted plain ("2520000"), percentages as "11%", dates as ISO, so
 * nothing depends on the workbook's display format.
 */

type XlsxLike = {
    read: (data: Uint8Array, opts: Record<string, unknown>) => {
        SheetNames: string[]
        Sheets: Record<string, Record<string, unknown>>
    }
    utils: { decode_range: (ref: string) => { s: { r: number; c: number }; e: { r: number; c: number } }; encode_cell: (c: { r: number; c: number }) => string }
}

type Cell = { t?: string; v?: unknown; w?: string; z?: string }
type Merge = { s: { r: number; c: number }; e: { r: number; c: number } }

const ROW_H = 14
const PT_PER_CHAR = 5.6 // ≈ Calibri 11 at print size
const DEFAULT_WCH = 9

/** Pick the sheet that holds the document (an "Invoice" tab beats "kwitansi" / "tanda terima"). */
export function pickSheet(names: string[]): string {
    const prefer = names.find((n) => /^(invoice|faktur|po|purchase|surat ?jalan|sj|co)\b/i.test(n.trim()))
    return prefer ?? names[0]
}

function cellText(cell: Cell): string {
    if (cell.v == null || cell.v === "") return ""
    if (cell.t === "n" && typeof cell.v === "number") {
        if (cell.z && /%/.test(cell.z)) return `${Math.round(cell.v * 10000) / 100}%`
        return String(Math.round(cell.v * 100) / 100)
    }
    if (cell.t === "d" || cell.v instanceof Date) {
        const d = cell.v instanceof Date ? cell.v : new Date(String(cell.v))
        if (!Number.isNaN(d.getTime())) return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
    }
    return String(cell.w ?? cell.v).replace(/\s+/g, " ").trim()
}

export function excelToTextItems(data: Uint8Array, xlsx: XlsxLike, sheetName?: string): PdfText & { sheet: string } {
    const wb = xlsx.read(data, { type: "array", cellDates: true, cellNF: true })
    const sheet = sheetName ?? pickSheet(wb.SheetNames)
    const ws = wb.Sheets[sheet] as Record<string, unknown> & { "!ref"?: string; "!cols"?: { wch?: number; wpx?: number }[]; "!merges"?: Merge[] }
    const items: TextItem[] = []
    if (!ws || !ws["!ref"]) return { items, pages: 0, chars: 0, pageSizes: [], sheet }

    const range = xlsx.utils.decode_range(ws["!ref"])
    const cols = ws["!cols"] ?? []
    const widthOf = (c: number) => {
        const col = cols[c]
        const wch = col?.wch ?? (col?.wpx ? col.wpx / 7 : DEFAULT_WCH)
        return Math.max(2, wch) * PT_PER_CHAR
    }
    const xStart: number[] = []
    let acc = 30
    for (let c = 0; c <= range.e.c + 1; c++) {
        xStart[c] = acc
        acc += widthOf(c)
    }
    const merges = ws["!merges"] ?? []
    const mergeAt = new Map<string, Merge>()
    for (const m of merges) mergeAt.set(`${m.s.r}:${m.s.c}`, m)

    let chars = 0
    for (let r = range.s.r; r <= range.e.r; r++) {
        for (let c = range.s.c; c <= range.e.c; c++) {
            const cell = ws[xlsx.utils.encode_cell({ r, c })] as Cell | undefined
            if (!cell) continue
            const str = cellText(cell)
            if (!str) continue
            const m = mergeAt.get(`${r}:${c}`)
            const lastCol = m ? m.e.c : c
            const x = xStart[c]
            const fullW = xStart[lastCol + 1] - x
            // Text sits left in its cell; numbers sit right, as Excel prints them.
            const textW = Math.min(fullW - 4, str.length * PT_PER_CHAR * 0.95)
            const isNumber = cell.t === "n"
            items.push({
                str,
                x: isNumber ? x + fullW - textW - 2 : x + 2,
                y: 40 + (r - range.s.r) * ROW_H + 10,
                w: textW,
                h: 9,
                page: 1,
                solid: true,
            })
            chars += str.replace(/\s/g, "").length
        }
    }
    const height = 40 + (range.e.r - range.s.r + 1) * ROW_H + 40
    return { items, pages: 1, chars, pageSizes: [{ width: acc + 30, height }], totalPages: 1, sheet }
}

export function isExcelFile(file: { name: string; type?: string }): boolean {
    return /\.(xlsx|xlsm|xls)$/i.test(file.name) || /spreadsheetml|ms-excel/.test(file.type || "")
}
