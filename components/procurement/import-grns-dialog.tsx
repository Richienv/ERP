"use client"

/**
 * ImportGRNsDialog
 *
 * Mirror of `components/procurement/import-pos-dialog.tsx` for the
 * Procurement → Surat Jalan Masuk (GRN) module. Adapted for GRN specifics:
 *   • 2-sheet upload (GRN Header + GRN Items linked via Reference)
 *   • PO lookup via existing PO number (GRN must reference an existing PO)
 *   • Optional warehouse code lookup (default = first active warehouse)
 *   • Server-side GRN number generation (SJM-YYYYMM-####)
 *
 * Flow: pick file → parse 2 sheets → preview parsed GRNs + items count
 *       → commit via bulkImportGRNs() → toast partial-success.
 *
 * Use case utama: backlog migration (penerimaan masa lalu dari sistem lama).
 */

import { useRef, useState, useCallback } from "react"
import * as XLSX from "xlsx"
import {
    Upload,
    FileSpreadsheet,
    AlertTriangle,
    CheckCircle2,
    X,
    Loader2,
    Download,
} from "lucide-react"
import { toast } from "sonner"
import { useQueryClient } from "@tanstack/react-query"

import {
    NBDialog,
    NBDialogHeader,
    NBDialogBody,
    NBSection,
} from "@/components/ui/nb-dialog"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { queryKeys } from "@/lib/query-keys"
import {
    bulkImportGRNs,
    type BulkImportGRNRow,
    type BulkImportGRNItemRow,
} from "@/lib/actions/grn"

// ─── Limits ───────────────────────────────────────────────────────────────
const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024 // 5 MB
const MAX_HEADER_ROWS = 500
const MAX_ITEM_ROWS = 5000

// ─── Column mappings ──────────────────────────────────────────────────────
const HEADER_ALIASES: Record<string, keyof BulkImportGRNRow> = {
    "reference": "reference",
    "reference*": "reference",
    "ref": "reference",
    "no po": "poNumber",
    "no po*": "poNumber",
    "nomor po": "poNumber",
    "po number": "poNumber",
    "po": "poNumber",
    "tanggal terima": "receivedDate",
    "tgl terima": "receivedDate",
    "tanggal penerimaan": "receivedDate",
    "received date": "receivedDate",
    "kode gudang": "warehouseCode",
    "warehouse code": "warehouseCode",
    "gudang": "warehouseCode",
    "catatan": "notes",
    "notes": "notes",
    "keterangan": "notes",
}

const ITEM_ALIASES: Record<string, keyof BulkImportGRNItemRow> = {
    "reference": "reference",
    "reference*": "reference",
    "ref": "reference",
    "kode produk": "productCode",
    "kode produk*": "productCode",
    "product code": "productCode",
    "sku": "productCode",
    "qty diterima": "receivedQty",
    "qty diterima*": "receivedQty",
    "qty": "receivedQty",
    "quantity": "receivedQty",
    "jumlah diterima": "receivedQty",
    "received qty": "receivedQty",
    "sesuai pesanan": "matchedOrder",
    "matched order": "matchedOrder",
    "sesuai": "matchedOrder",
    "catatan": "notes",
    "notes": "notes",
    "keterangan": "notes",
}

// ─── Types ────────────────────────────────────────────────────────────────
interface ParsedHeaderRow extends BulkImportGRNRow {
    _rowIndex: number
    _hasError: boolean
    _errorMsg?: string
    _itemCount?: number
}

interface ParsedItemRow extends BulkImportGRNItemRow {
    _rowIndex: number
    _hasError: boolean
    _errorMsg?: string
}

interface ParseResult {
    headers: ParsedHeaderRow[]
    items: ParsedItemRow[]
    parseError?: string
}

// ─── Cell coercion helpers ────────────────────────────────────────────────
function parseNumber(v: unknown): number | undefined {
    if (v === undefined || v === null || v === "") return undefined
    if (typeof v === "number") return v
    const cleaned = String(v).replace(/[^\d.,-]/g, "").replace(/\./g, "").replace(",", ".")
    const n = parseFloat(cleaned)
    return Number.isNaN(n) ? undefined : n
}

function isValidDateInput(v: string | undefined): boolean {
    if (!v?.trim()) return true // empty = valid (will fall back to default)
    const trimmed = v.trim()
    return (
        /^\d{1,2}[/-]\d{1,2}[/-]\d{4}$/.test(trimmed) ||
        /^\d{4}-\d{2}-\d{2}/.test(trimmed)
    )
}

/**
 * Excel sometimes reads dates as serial numbers or Date objects depending
 * on how the cell was formatted. Convert to a DD/MM/YYYY string for the
 * server-side parser (which handles DD/MM/YYYY + ISO).
 */
function coerceDateCell(raw: unknown): string | undefined {
    if (raw === undefined || raw === null || raw === "") return undefined
    if (raw instanceof Date && !isNaN(raw.getTime())) {
        const d = String(raw.getDate()).padStart(2, "0")
        const m = String(raw.getMonth() + 1).padStart(2, "0")
        const y = raw.getFullYear()
        return `${d}/${m}/${y}`
    }
    // Excel serial number (e.g. 45773 = 25 Apr 2025-ish range)
    if (typeof raw === "number" && raw > 20000 && raw < 60000) {
        const epoch = new Date(Date.UTC(1899, 11, 30))
        const date = new Date(epoch.getTime() + raw * 86400000)
        const d = String(date.getUTCDate()).padStart(2, "0")
        const m = String(date.getUTCMonth() + 1).padStart(2, "0")
        const y = date.getUTCFullYear()
        return `${d}/${m}/${y}`
    }
    return String(raw).trim()
}

// ─── Sheet parser ─────────────────────────────────────────────────────────
function detectHeaderRow<T>(
    rawData: unknown[][],
    aliases: Record<string, keyof T>,
): { headerRowIdx: number; map: Record<number, keyof T> } {
    let headerRowIdx = -1
    let bestMap: Record<number, keyof T> = {}
    for (let r = 0; r < Math.min(rawData.length, 20); r++) {
        const candidate = (rawData[r] ?? []) as unknown[]
        const map: Record<number, keyof T> = {}
        candidate.forEach((cell, colIdx) => {
            const norm = String(cell ?? "").toLowerCase().trim()
            const field = aliases[norm]
            if (field) map[colIdx] = field
        })
        if (Object.keys(map).length >= 2) {
            headerRowIdx = r
            bestMap = map
            break
        }
    }
    return { headerRowIdx, map: bestMap }
}

function parseFileToRows(file: File): Promise<ParseResult> {
    return new Promise((resolve) => {
        const reader = new FileReader()
        reader.onload = (e) => {
            try {
                const data = e.target?.result
                const workbook = XLSX.read(data, { type: "array", cellDates: true })

                // ── Locate header & items sheets by name (fallback: first 2)
                const findSheet = (matchers: RegExp[]) =>
                    workbook.SheetNames.find((n) =>
                        matchers.some((rx) => rx.test(n.toLowerCase())),
                    )

                const headerSheetName =
                    findSheet([/grn\s*header/i, /^header$/i]) ?? workbook.SheetNames[0]
                const itemSheetName =
                    findSheet([/grn\s*item/i, /^items?$/i, /line/i]) ??
                    workbook.SheetNames[1] ??
                    workbook.SheetNames[0]

                if (!headerSheetName || !itemSheetName) {
                    return resolve({
                        headers: [],
                        items: [],
                        parseError:
                            "File harus berisi 2 sheet: 'GRN Header' dan 'GRN Items'. Gunakan template untuk format yang benar.",
                    })
                }

                if (headerSheetName === itemSheetName) {
                    return resolve({
                        headers: [],
                        items: [],
                        parseError:
                            "File hanya punya 1 sheet — butuh 2 (GRN Header + GRN Items). Download template Excel.",
                    })
                }

                const headerWS = workbook.Sheets[headerSheetName]
                const itemsWS = workbook.Sheets[itemSheetName]

                const headerRaw = XLSX.utils.sheet_to_json<unknown[]>(headerWS, {
                    header: 1,
                    raw: true,
                })
                const itemsRaw = XLSX.utils.sheet_to_json<unknown[]>(itemsWS, {
                    header: 1,
                    raw: true,
                })

                // ── Detect header rows in each sheet
                const { headerRowIdx: hIdx, map: hMap } =
                    detectHeaderRow<BulkImportGRNRow>(headerRaw, HEADER_ALIASES)
                if (hIdx < 0) {
                    return resolve({
                        headers: [],
                        items: [],
                        parseError:
                            "Header sheet 'GRN Header' tidak terdeteksi. Pastikan ada kolom 'Reference' dan 'No PO'.",
                    })
                }

                const { headerRowIdx: iIdx, map: iMap } =
                    detectHeaderRow<BulkImportGRNItemRow>(itemsRaw, ITEM_ALIASES)
                if (iIdx < 0) {
                    return resolve({
                        headers: [],
                        items: [],
                        parseError:
                            "Header sheet 'GRN Items' tidak terdeteksi. Pastikan ada kolom 'Reference', 'Kode Produk', dan 'Qty Diterima'.",
                    })
                }

                // ── Parse GRN Header rows
                const parsedHeaders: ParsedHeaderRow[] = []
                for (let i = hIdx + 1; i < headerRaw.length; i++) {
                    const row = (headerRaw[i] ?? []) as unknown[]
                    if (
                        !row ||
                        row.every(
                            (c) => c === undefined || c === null || c === "",
                        )
                    ) continue

                    const mapped: ParsedHeaderRow = {
                        _rowIndex: i + 1,
                        _hasError: false,
                    }
                    Object.entries(hMap).forEach(([colStr, field]) => {
                        const colIdx = parseInt(colStr)
                        const rawVal = row[colIdx]
                        if (rawVal === undefined || rawVal === null || rawVal === "") return
                        const sink = mapped as unknown as Record<string, unknown>
                        if (field === "receivedDate") {
                            sink[field] = coerceDateCell(rawVal)
                        } else {
                            sink[field] = String(rawVal).trim()
                        }
                    })

                    // Inline validation
                    if (!mapped.reference?.trim()) {
                        mapped._hasError = true
                        mapped._errorMsg = "Reference wajib diisi"
                    } else if (!mapped.poNumber?.trim()) {
                        mapped._hasError = true
                        mapped._errorMsg = "No PO wajib diisi (untuk link ke PO yang sudah ada)"
                    } else if (mapped.receivedDate && !isValidDateInput(mapped.receivedDate)) {
                        mapped._hasError = true
                        mapped._errorMsg = `Tanggal Terima "${mapped.receivedDate}" tidak valid (DD/MM/YYYY)`
                    }

                    parsedHeaders.push(mapped)
                    if (parsedHeaders.length >= MAX_HEADER_ROWS) break
                }

                // ── Parse GRN Item rows
                const parsedItems: ParsedItemRow[] = []
                for (let i = iIdx + 1; i < itemsRaw.length; i++) {
                    const row = (itemsRaw[i] ?? []) as unknown[]
                    if (
                        !row ||
                        row.every(
                            (c) => c === undefined || c === null || c === "",
                        )
                    ) continue

                    const mapped: ParsedItemRow = {
                        _rowIndex: i + 1,
                        _hasError: false,
                    }
                    Object.entries(iMap).forEach(([colStr, field]) => {
                        const colIdx = parseInt(colStr)
                        const rawVal = row[colIdx]
                        if (rawVal === undefined || rawVal === null || rawVal === "") return
                        const sink = mapped as unknown as Record<string, unknown>
                        if (field === "receivedQty") {
                            const n = parseNumber(rawVal)
                            if (n !== undefined) sink[field] = n
                        } else {
                            sink[field] = String(rawVal).trim()
                        }
                    })

                    if (!mapped.reference?.trim()) {
                        mapped._hasError = true
                        mapped._errorMsg = "Reference wajib diisi"
                    } else if (!mapped.productCode?.trim()) {
                        mapped._hasError = true
                        mapped._errorMsg = "Kode Produk wajib diisi"
                    } else if (!mapped.receivedQty || mapped.receivedQty <= 0) {
                        mapped._hasError = true
                        mapped._errorMsg = "Qty Diterima wajib > 0"
                    }

                    parsedItems.push(mapped)
                    if (parsedItems.length >= MAX_ITEM_ROWS) break
                }

                // ── Cross-reference: tag headers with item count
                const itemsByRef = new Map<string, ParsedItemRow[]>()
                for (const it of parsedItems) {
                    if (it._hasError) continue
                    const key = it.reference?.trim().toLowerCase()
                    if (!key) continue
                    if (!itemsByRef.has(key)) itemsByRef.set(key, [])
                    itemsByRef.get(key)!.push(it)
                }

                for (const h of parsedHeaders) {
                    const key = h.reference?.trim().toLowerCase()
                    if (!key) continue
                    const its = itemsByRef.get(key) ?? []
                    h._itemCount = its.length
                    if (!h._hasError && its.length === 0) {
                        h._hasError = true
                        h._errorMsg = `GRN "${h.reference}" tidak punya item di Sheet 'GRN Items'`
                    }
                }

                resolve({ headers: parsedHeaders, items: parsedItems })
            } catch (err: unknown) {
                const msg = err instanceof Error ? err.message : "Unknown error"
                resolve({
                    headers: [],
                    items: [],
                    parseError: `Gagal membaca file: ${msg}`,
                })
            }
        }
        reader.readAsArrayBuffer(file)
    })
}

// ─── Main Component ───────────────────────────────────────────────────────
export function ImportGRNsDialog({
    open: controlledOpen,
    onOpenChange,
    hideTrigger,
}: {
    open?: boolean
    onOpenChange?: (open: boolean) => void
    hideTrigger?: boolean
} = {}) {
    const queryClient = useQueryClient()
    const fileInputRef = useRef<HTMLInputElement>(null)

    const [internalOpen, setInternalOpen] = useState(false)
    const open = controlledOpen ?? internalOpen
    const setOpen = (v: boolean) => {
        if (onOpenChange) onOpenChange(v)
        else setInternalOpen(v)
    }
    const [step, setStep] = useState<"idle" | "preview" | "importing" | "done">("idle")
    const [fileName, setFileName] = useState("")
    const [parseError, setParseError] = useState<string | null>(null)
    const [headerRows, setHeaderRows] = useState<ParsedHeaderRow[]>([])
    const [itemRows, setItemRows] = useState<ParsedItemRow[]>([])
    const [importResult, setImportResult] = useState<
        { imported: number; errors: { row: number; reason: string }[] } | null
    >(null)
    const [progress, setProgress] = useState(0)

    const validHeaders = headerRows.filter((r) => !r._hasError)
    const errorHeaders = headerRows.filter((r) => r._hasError)
    const errorItems = itemRows.filter((r) => r._hasError)
    const totalValidItems = itemRows.filter((r) => !r._hasError).length

    // ── Reset state on dialog close ──────────────────────────────────────
    const handleOpenChange = useCallback(
        (val: boolean) => {
            setOpen(val)
            if (!val) {
                setTimeout(() => {
                    setStep("idle")
                    setFileName("")
                    setParseError(null)
                    setHeaderRows([])
                    setItemRows([])
                    setImportResult(null)
                    setProgress(0)
                    if (fileInputRef.current) fileInputRef.current.value = ""
                }, 300)
            }
        },
        [],
    )

    // ── File selected ────────────────────────────────────────────────────
    const handleFileChange = useCallback(
        async (e: React.ChangeEvent<HTMLInputElement>) => {
            const file = e.target.files?.[0]
            if (!file) return

            if (file.size > MAX_FILE_SIZE_BYTES) {
                setParseError(
                    `Ukuran file ${(file.size / 1024 / 1024).toFixed(1)} MB melebihi batas 5 MB. Silakan pecah menjadi beberapa file.`,
                )
                return
            }

            setFileName(file.name)
            setParseError(null)
            setHeaderRows([])
            setItemRows([])
            setStep("preview")

            const { headers, items, parseError: err } = await parseFileToRows(file)
            if (err && headers.length === 0) {
                setParseError(err)
                setStep("idle")
                return
            }
            if (err) toast.warning(err)
            setHeaderRows(headers)
            setItemRows(items)
        },
        [],
    )

    // ── Execute import ───────────────────────────────────────────────────
    const handleImport = useCallback(async () => {
        if (validHeaders.length === 0) return

        setStep("importing")
        setProgress(10)

        // Strip internal markers — only send the raw payload to server
        const headerPayload: BulkImportGRNRow[] = validHeaders.map((r) => ({
            reference: r.reference,
            poNumber: r.poNumber,
            receivedDate: r.receivedDate,
            warehouseCode: r.warehouseCode,
            notes: r.notes,
        }))

        // Send all valid items (server re-validates per GRN group)
        const itemPayload: BulkImportGRNItemRow[] = itemRows
            .filter((r) => !r._hasError)
            .map((r) => ({
                reference: r.reference,
                productCode: r.productCode,
                receivedQty: r.receivedQty,
                matchedOrder: r.matchedOrder,
                notes: r.notes,
            }))

        setProgress(40)

        try {
            const result = await bulkImportGRNs(headerPayload, itemPayload)
            setProgress(100)
            setImportResult({ imported: result.imported, errors: result.errors })
            setStep("done")

            // Invalidate every consumer of GRN data — list page, KPIs, etc.
            await queryClient.invalidateQueries({
                queryKey: queryKeys.receiving.all,
            })
            // Also invalidate PO data (PO partial-receive status may shift on accept)
            await queryClient.invalidateQueries({
                queryKey: queryKeys.purchaseOrders.all,
            })

            if (result.imported > 0) {
                toast.success(`${result.imported} GRN berhasil diimport`, {
                    description:
                        result.errors.length > 0
                            ? `${result.errors.length} baris gagal — lihat detail di dialog.`
                            : "Semua GRN berhasil ditambahkan dengan status DRAFT — terima manual via UI agar stok bertambah.",
                })
            } else {
                toast.error("Import gagal — tidak ada GRN yang berhasil diimport.", {
                    description: result.errors[0]?.reason ?? "Periksa format file Anda.",
                })
            }
        } catch (err: unknown) {
            setStep("preview")
            const msg = err instanceof Error ? err.message : "Unknown error"
            toast.error("Terjadi kesalahan saat import", { description: msg })
        }
    }, [validHeaders, itemRows, queryClient])

    // ── Template download (server-generated for canonical layout) ────────
    const handleDownloadTemplate = useCallback(() => {
        window.open("/api/procurement/receiving/template", "_blank")
    }, [])

    return (
        <>
            {/* ── Trigger Button (hidden when controlled externally) ── */}
            {!hideTrigger && (
                <Button
                    variant="outline"
                    onClick={() => setOpen(true)}
                    className="border-2 border-black font-black uppercase text-xs tracking-wider rounded-none shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:translate-y-[2px] hover:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] transition-all bg-white text-black"
                >
                    <Upload className="h-3.5 w-3.5 mr-1.5" />
                    Impor Excel
                </Button>
            )}

            {/* ── Dialog ── */}
            <NBDialog open={open} onOpenChange={handleOpenChange} size="wide">
                <NBDialogHeader
                    icon={FileSpreadsheet}
                    title="Impor Surat Jalan Masuk"
                    subtitle="Upload file Excel 2-sheet (GRN Header + GRN Items) untuk import banyak GRN sekaligus — backlog migration"
                />

                <NBDialogBody>
                    {/* ── Step: Idle / File picker ── */}
                    {(step === "idle" || step === "preview") && (
                        <>
                            <div
                                onClick={() => fileInputRef.current?.click()}
                                className="border-2 border-dashed border-black bg-zinc-50 hover:bg-emerald-50 transition-colors cursor-pointer p-8 flex flex-col items-center gap-3 rounded-none"
                            >
                                <Upload className="h-8 w-8 text-zinc-400" />
                                <div className="text-center">
                                    <p className="text-sm font-black uppercase tracking-wider text-zinc-700">
                                        {fileName ? fileName : "Pilih File Excel"}
                                    </p>
                                    <p className="text-xs text-zinc-400 mt-1">
                                        Format: .xlsx, .xls · maks 5 MB · maks {MAX_HEADER_ROWS} GRN + {MAX_ITEM_ROWS} item
                                    </p>
                                </div>
                                <input
                                    ref={fileInputRef}
                                    type="file"
                                    accept=".xlsx,.xls"
                                    className="hidden"
                                    onChange={handleFileChange}
                                />
                            </div>

                            {parseError && (
                                <div className="flex items-start gap-2 border border-red-500 bg-red-50 p-3">
                                    <AlertTriangle className="h-4 w-4 text-red-600 mt-0.5 shrink-0" />
                                    <p className="text-xs font-bold text-red-600">{parseError}</p>
                                </div>
                            )}

                            <NBSection icon={FileSpreadsheet} title="Panduan Kolom — 2 Sheet">
                                <div className="overflow-x-auto -mx-3 -mb-3">
                                    <table className="w-full text-xs">
                                        <thead>
                                            <tr className="bg-zinc-100 dark:bg-zinc-800 border-b border-zinc-200">
                                                <th className="px-3 py-2 text-[10px] font-black uppercase tracking-widest text-zinc-500 text-left">Sheet</th>
                                                <th className="px-3 py-2 text-[10px] font-black uppercase tracking-widest text-zinc-500 text-left">Header Kolom</th>
                                                <th className="px-3 py-2 text-[10px] font-black uppercase tracking-widest text-zinc-500 text-left">Wajib?</th>
                                                <th className="px-3 py-2 text-[10px] font-black uppercase tracking-widest text-zinc-500 text-left">Keterangan</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {[
                                                ["GRN Header", "Reference", "Ya", "ID buatan Anda untuk hubungkan ke items (mis. GRN-A)"],
                                                ["GRN Header", "No PO", "Ya", "Nomor PO yang SUDAH ADA di sistem (mis. PO-202604-0001)"],
                                                ["GRN Header", "Tanggal Terima", "Tidak", "Format DD/MM/YYYY — default hari ini"],
                                                ["GRN Header", "Kode Gudang", "Tidak", "Kode dari master Gudang. Kosong = pakai gudang utama"],
                                                ["GRN Header", "Catatan", "Tidak", "Opsional"],
                                                ["GRN Items", "Reference", "Ya", "Harus sama persis dengan Reference di GRN Header"],
                                                ["GRN Items", "Kode Produk", "Ya", "Harus terdaftar di PO yang di-reference"],
                                                ["GRN Items", "Qty Diterima", "Ya", "Wajib > 0"],
                                                ["GRN Items", "Sesuai Pesanan", "Tidak", "Ya/Tidak (default Ya)"],
                                                ["GRN Items", "Catatan", "Tidak", "Opsional"],
                                            ].map(([sheet, col, req, note], idx) => (
                                                <tr key={idx} className="border-b border-zinc-100">
                                                    <td className="px-3 py-2 font-mono text-[11px] text-zinc-500">{sheet}</td>
                                                    <td className="px-3 py-2 font-mono text-emerald-700">{col}</td>
                                                    <td className="px-3 py-2">
                                                        {req === "Ya"
                                                            ? <span className="text-red-600 font-black">Wajib</span>
                                                            : <span className="text-zinc-400">Opsional</span>}
                                                    </td>
                                                    <td className="px-3 py-2 text-zinc-500">{note}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                                <div className="px-3 py-2 border-t border-zinc-200 bg-emerald-50/50 text-[11px] text-zinc-600">
                                    <strong className="text-emerald-700">Catatan:</strong> Nomor GRN (SJM-YYYYMM-####) digenerate otomatis. Status awal DRAFT — terima manual via UI agar stok bertambah & jurnal inventory terbentuk.
                                </div>
                            </NBSection>

                            <button
                                onClick={handleDownloadTemplate}
                                className="text-xs font-black text-emerald-700 underline underline-offset-2 hover:text-emerald-900 inline-flex items-center gap-1.5"
                            >
                                <Download className="h-3 w-3" />
                                Download template Excel
                            </button>
                        </>
                    )}

                    {/* ── Step: Preview ── */}
                    {step === "preview" && headerRows.length > 0 && (
                        <>
                            <div className="flex items-center gap-3 flex-wrap">
                                <div className="border border-black bg-emerald-50 px-3 py-1.5 flex items-center gap-1.5">
                                    <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                                    <span className="text-xs font-black text-emerald-700">
                                        {validHeaders.length} GRN siap diimport
                                    </span>
                                </div>
                                <div className="border border-zinc-300 bg-white px-3 py-1.5 flex items-center gap-1.5">
                                    <FileSpreadsheet className="h-3.5 w-3.5 text-zinc-500" />
                                    <span className="text-xs font-bold text-zinc-700">
                                        {totalValidItems} item line
                                    </span>
                                </div>
                                {(errorHeaders.length > 0 || errorItems.length > 0) && (
                                    <div className="border border-red-500 bg-red-50 px-3 py-1.5 flex items-center gap-1.5">
                                        <AlertTriangle className="h-3.5 w-3.5 text-red-600" />
                                        <span className="text-xs font-black text-red-700">
                                            {errorHeaders.length} GRN + {errorItems.length} item bermasalah (akan dilewati)
                                        </span>
                                    </div>
                                )}
                            </div>

                            <NBSection icon={FileSpreadsheet} title={`Pratinjau GRN — ${fileName}`}>
                                <ScrollArea className="h-56 -mx-3 -mb-3">
                                    <div className="overflow-x-auto">
                                        <table className="w-full text-xs min-w-[850px]">
                                            <thead className="sticky top-0 z-10">
                                                <tr className="bg-zinc-100 dark:bg-zinc-800 border-b border-zinc-200">
                                                    <th className="px-3 py-2 text-[10px] font-black uppercase tracking-widest text-zinc-500 text-left w-8">#</th>
                                                    <th className="px-3 py-2 text-[10px] font-black uppercase tracking-widest text-zinc-500 text-left">Reference</th>
                                                    <th className="px-3 py-2 text-[10px] font-black uppercase tracking-widest text-zinc-500 text-left">No PO</th>
                                                    <th className="px-3 py-2 text-[10px] font-black uppercase tracking-widest text-zinc-500 text-left">Tgl Terima</th>
                                                    <th className="px-3 py-2 text-[10px] font-black uppercase tracking-widest text-zinc-500 text-left">Gudang</th>
                                                    <th className="px-3 py-2 text-[10px] font-black uppercase tracking-widest text-zinc-500 text-right">Items</th>
                                                    <th className="px-3 py-2 w-8"></th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {headerRows.map((row) => (
                                                    <tr
                                                        key={row._rowIndex}
                                                        className={`border-b border-zinc-100 ${row._hasError ? "bg-red-50" : "hover:bg-zinc-50"}`}
                                                    >
                                                        <td className="px-3 py-2 text-zinc-400">{row._rowIndex}</td>
                                                        <td className="px-3 py-2 font-bold font-mono">
                                                            {row.reference || <span className="text-red-500 italic">Kosong!</span>}
                                                        </td>
                                                        <td className="px-3 py-2 font-mono text-zinc-600">
                                                            {row.poNumber || <span className="text-red-500 italic">Kosong!</span>}
                                                        </td>
                                                        <td className="px-3 py-2 text-zinc-600">
                                                            {row.receivedDate || <span className="text-zinc-300">Hari ini</span>}
                                                        </td>
                                                        <td className="px-3 py-2 font-mono text-zinc-600">
                                                            {row.warehouseCode || <span className="text-zinc-300">Default</span>}
                                                        </td>
                                                        <td className="px-3 py-2 text-right tabular-nums font-bold">
                                                            {row._itemCount ?? 0}
                                                        </td>
                                                        <td className="px-3 py-2">
                                                            {row._hasError && (
                                                                <span title={row._errorMsg}>
                                                                    <AlertTriangle className="h-3.5 w-3.5 text-red-500" />
                                                                </span>
                                                            )}
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                </ScrollArea>
                            </NBSection>

                            {(errorHeaders.length > 0 || errorItems.length > 0) && (
                                <div className="border border-amber-400 bg-amber-50 p-3 space-y-1 max-h-40 overflow-y-auto">
                                    <p className="text-xs font-black uppercase tracking-wider text-amber-700 mb-2">
                                        Baris yang akan dilewati:
                                    </p>
                                    {errorHeaders.map((r) => (
                                        <p key={`h-${r._rowIndex}`} className="text-xs text-amber-800">
                                            <span className="font-bold">GRN Header baris {r._rowIndex}:</span> {r._errorMsg}
                                        </p>
                                    ))}
                                    {errorItems.map((r) => (
                                        <p key={`i-${r._rowIndex}`} className="text-xs text-amber-800">
                                            <span className="font-bold">GRN Items baris {r._rowIndex}:</span> {r._errorMsg}
                                        </p>
                                    ))}
                                </div>
                            )}
                        </>
                    )}

                    {/* ── Step: Importing ── */}
                    {step === "importing" && (
                        <div className="py-8 flex flex-col items-center gap-4">
                            <Loader2 className="h-10 w-10 animate-spin text-emerald-500" />
                            <p className="text-sm font-black uppercase tracking-wider">
                                Mengimport {validHeaders.length} GRN...
                            </p>
                            <div className="w-full border border-black bg-zinc-100 h-3 overflow-hidden">
                                <div
                                    className="h-full bg-emerald-400 transition-all duration-500"
                                    style={{ width: `${progress}%` }}
                                />
                            </div>
                            <p className="text-xs text-zinc-400">Mohon tunggu, jangan tutup halaman ini.</p>
                        </div>
                    )}

                    {/* ── Step: Done ── */}
                    {step === "done" && importResult && (
                        <>
                            <div className="border border-black p-5 flex items-center gap-4 bg-zinc-50">
                                {importResult.imported > 0
                                    ? <CheckCircle2 className="h-10 w-10 text-emerald-500 shrink-0" />
                                    : <X className="h-10 w-10 text-red-500 shrink-0" />
                                }
                                <div>
                                    <p className="text-xl font-black">
                                        {importResult.imported} GRN berhasil diimport
                                    </p>
                                    {importResult.errors.length > 0 && (
                                        <p className="text-xs text-zinc-500 mt-0.5">
                                            {importResult.errors.length} baris gagal
                                        </p>
                                    )}
                                    {importResult.imported > 0 && (
                                        <p className="text-xs text-zinc-500 mt-0.5">
                                            Status: DRAFT — perlu diterima manual via UI agar stok bertambah.
                                        </p>
                                    )}
                                </div>
                            </div>

                            {importResult.errors.length > 0 && (
                                <NBSection icon={AlertTriangle} title={`Detail Error (${importResult.errors.length})`}>
                                    <ScrollArea className="h-40 -mx-3 -mb-3">
                                        <div className="p-3 space-y-1">
                                            {importResult.errors.map((err, i) => (
                                                <p key={i} className="text-xs text-red-700 font-medium">
                                                    <span className="font-bold">Baris {err.row}:</span> {err.reason}
                                                </p>
                                            ))}
                                        </div>
                                    </ScrollArea>
                                </NBSection>
                            )}
                        </>
                    )}

                    {/* ── Footer actions ── */}
                    <div className="border-t border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800/50 px-4 py-2.5 flex items-center justify-end gap-2 -mx-4 -mb-4 mt-1">
                        {step === "idle" || step === "preview" ? (
                            <>
                                <Button
                                    variant="outline"
                                    onClick={() => handleOpenChange(false)}
                                    className="border border-zinc-300 text-zinc-500 font-bold uppercase text-[10px] tracking-wider px-4 h-8 rounded-none"
                                >
                                    Batal
                                </Button>
                                {step === "preview" && validHeaders.length > 0 && (
                                    <Button
                                        onClick={handleImport}
                                        className="bg-emerald-600 text-white border border-emerald-600 hover:bg-emerald-700 font-black uppercase text-[10px] tracking-wider px-5 h-8 rounded-none gap-1.5"
                                    >
                                        <Upload className="h-3.5 w-3.5 mr-1.5" />
                                        Mulai Import ({validHeaders.length} GRN)
                                    </Button>
                                )}
                            </>
                        ) : step === "done" ? (
                            <Button
                                onClick={() => handleOpenChange(false)}
                                className="bg-black text-white border border-black hover:bg-zinc-800 font-black uppercase text-[10px] tracking-wider px-5 h-8 rounded-none"
                            >
                                Selesai
                            </Button>
                        ) : null}
                    </div>
                </NBDialogBody>
            </NBDialog>
        </>
    )
}
