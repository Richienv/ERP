"use client"

/**
 * ImportPOsDialog
 *
 * Mirror of `components/procurement/import-vendors-dialog.tsx` for the
 * Procurement → Pesanan Pembelian (PO) module. Adapted for PO complexity:
 *   • 2-sheet upload (PO Header + PO Items linked via Reference)
 *   • Supplier lookup via code (not name — code is unique)
 *   • Product lookup via code per line item
 *   • Server-side PPN 11% calculation + PO number generation
 *
 * Flow: pick file → parse 2 sheets → preview parsed POs + items + estimated
 *       total → commit via bulkImportPurchaseOrders() → toast partial-success.
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
    bulkImportPurchaseOrders,
    type BulkImportPORow,
    type BulkImportPOItemRow,
} from "@/lib/actions/procurement"

// ─── Limits ───────────────────────────────────────────────────────────────
const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024 // 5 MB
const MAX_HEADER_ROWS = 500
const MAX_ITEM_ROWS = 5000

// ─── Column mappings ──────────────────────────────────────────────────────
const HEADER_ALIASES: Record<string, keyof BulkImportPORow> = {
    "reference": "reference",
    "reference*": "reference",
    "ref": "reference",
    "kode pemasok": "supplierCode",
    "kode pemasok*": "supplierCode",
    "kode vendor": "supplierCode",
    "kode supplier": "supplierCode",
    "supplier code": "supplierCode",
    "vendor code": "supplierCode",
    "tanggal pesanan": "orderDate",
    "tgl pesanan": "orderDate",
    "tanggal po": "orderDate",
    "order date": "orderDate",
    "tgl diharapkan": "expectedDate",
    "tanggal diharapkan": "expectedDate",
    "tgl dibutuhkan": "expectedDate",
    "expected date": "expectedDate",
    "catatan": "notes",
    "notes": "notes",
    "keterangan": "notes",
}

const ITEM_ALIASES: Record<string, keyof BulkImportPOItemRow> = {
    "reference": "reference",
    "reference*": "reference",
    "ref": "reference",
    "kode produk": "productCode",
    "kode produk*": "productCode",
    "product code": "productCode",
    "sku": "productCode",
    "qty": "quantity",
    "qty*": "quantity",
    "quantity": "quantity",
    "jumlah": "quantity",
    "harga satuan": "unitPrice",
    "harga satuan*": "unitPrice",
    "unit price": "unitPrice",
    "harga": "unitPrice",
    "catatan": "notes",
    "notes": "notes",
    "keterangan": "notes",
}

// ─── Types ────────────────────────────────────────────────────────────────
interface ParsedHeaderRow extends BulkImportPORow {
    _rowIndex: number
    _hasError: boolean
    _errorMsg?: string
    _itemCount?: number
    _estTotal?: number
}

interface ParsedItemRow extends BulkImportPOItemRow {
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
                    findSheet([/po\s*header/i, /^header$/i]) ?? workbook.SheetNames[0]
                const itemSheetName =
                    findSheet([/po\s*item/i, /^items?$/i, /line/i]) ??
                    workbook.SheetNames[1] ??
                    workbook.SheetNames[0]

                if (!headerSheetName || !itemSheetName) {
                    return resolve({
                        headers: [],
                        items: [],
                        parseError:
                            "File harus berisi 2 sheet: 'PO Header' dan 'PO Items'. Gunakan template untuk format yang benar.",
                    })
                }

                if (headerSheetName === itemSheetName) {
                    return resolve({
                        headers: [],
                        items: [],
                        parseError:
                            "File hanya punya 1 sheet — butuh 2 (PO Header + PO Items). Download template Excel.",
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
                    detectHeaderRow<BulkImportPORow>(headerRaw, HEADER_ALIASES)
                if (hIdx < 0) {
                    return resolve({
                        headers: [],
                        items: [],
                        parseError:
                            "Header sheet 'PO Header' tidak terdeteksi. Pastikan ada kolom 'Reference' dan 'Kode Pemasok'.",
                    })
                }

                const { headerRowIdx: iIdx, map: iMap } =
                    detectHeaderRow<BulkImportPOItemRow>(itemsRaw, ITEM_ALIASES)
                if (iIdx < 0) {
                    return resolve({
                        headers: [],
                        items: [],
                        parseError:
                            "Header sheet 'PO Items' tidak terdeteksi. Pastikan ada kolom 'Reference', 'Kode Produk', 'Qty', dan 'Harga Satuan'.",
                    })
                }

                // ── Parse PO Header rows
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
                        if (field === "orderDate" || field === "expectedDate") {
                            sink[field] = coerceDateCell(rawVal)
                        } else {
                            sink[field] = String(rawVal).trim()
                        }
                    })

                    // Inline validation
                    if (!mapped.reference?.trim()) {
                        mapped._hasError = true
                        mapped._errorMsg = "Reference wajib diisi"
                    } else if (!mapped.supplierCode?.trim()) {
                        mapped._hasError = true
                        mapped._errorMsg = "Kode Pemasok wajib diisi"
                    } else if (mapped.orderDate && !isValidDateInput(mapped.orderDate)) {
                        mapped._hasError = true
                        mapped._errorMsg = `Tanggal Pesanan "${mapped.orderDate}" tidak valid (DD/MM/YYYY)`
                    } else if (mapped.expectedDate && !isValidDateInput(mapped.expectedDate)) {
                        mapped._hasError = true
                        mapped._errorMsg = `Tgl Diharapkan "${mapped.expectedDate}" tidak valid (DD/MM/YYYY)`
                    }

                    parsedHeaders.push(mapped)
                    if (parsedHeaders.length >= MAX_HEADER_ROWS) break
                }

                // ── Parse PO Item rows
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
                        if (field === "quantity" || field === "unitPrice") {
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
                    } else if (!mapped.quantity || mapped.quantity <= 0) {
                        mapped._hasError = true
                        mapped._errorMsg = "Qty wajib > 0"
                    } else if (!mapped.unitPrice || mapped.unitPrice <= 0) {
                        mapped._hasError = true
                        mapped._errorMsg = "Harga Satuan wajib > 0"
                    }

                    parsedItems.push(mapped)
                    if (parsedItems.length >= MAX_ITEM_ROWS) break
                }

                // ── Cross-reference: tag headers with item count + estimated total
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
                    h._estTotal = its.reduce(
                        (s, it) => s + (it.quantity ?? 0) * (it.unitPrice ?? 0),
                        0,
                    )
                    if (!h._hasError && its.length === 0) {
                        h._hasError = true
                        h._errorMsg = `PO "${h.reference}" tidak punya item di Sheet 'PO Items'`
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

// ─── IDR formatter ────────────────────────────────────────────────────────
const fmtIDR = (n: number) =>
    new Intl.NumberFormat("id-ID", {
        style: "currency",
        currency: "IDR",
        maximumFractionDigits: 0,
    }).format(n)

// ─── Main Component ───────────────────────────────────────────────────────
export function ImportPOsDialog({
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

    const totalEstAmount = validHeaders.reduce((s, h) => s + (h._estTotal ?? 0), 0)
    // Estimated grand total INCLUDING PPN 11% (server-side calculation)
    const totalEstWithTax = Math.round(totalEstAmount * 1.11)

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
        const headerPayload: BulkImportPORow[] = validHeaders.map((r) => ({
            reference: r.reference,
            supplierCode: r.supplierCode,
            orderDate: r.orderDate,
            expectedDate: r.expectedDate,
            notes: r.notes,
        }))

        // Send all valid items (server re-validates per PO group)
        const itemPayload: BulkImportPOItemRow[] = itemRows
            .filter((r) => !r._hasError)
            .map((r) => ({
                reference: r.reference,
                productCode: r.productCode,
                quantity: r.quantity,
                unitPrice: r.unitPrice,
                notes: r.notes,
            }))

        setProgress(40)

        try {
            const result = await bulkImportPurchaseOrders(headerPayload, itemPayload)
            setProgress(100)
            setImportResult({ imported: result.imported, errors: result.errors })
            setStep("done")

            // Invalidate every consumer of PO data — list page, KPIs, etc.
            await queryClient.invalidateQueries({
                queryKey: queryKeys.purchaseOrders.all,
            })

            if (result.imported > 0) {
                toast.success(`${result.imported} PO berhasil diimport`, {
                    description:
                        result.errors.length > 0
                            ? `${result.errors.length} baris gagal — lihat detail di dialog.`
                            : "Semua PO berhasil ditambahkan dengan status PO_DRAFT.",
                })
            } else {
                toast.error("Import gagal — tidak ada PO yang berhasil diimport.", {
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
        window.open("/api/procurement/orders/template", "_blank")
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
                    title="Impor Pesanan Pembelian"
                    subtitle="Upload file Excel 2-sheet (PO Header + PO Items) untuk import banyak PO sekaligus"
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
                                        Format: .xlsx, .xls · maks 5 MB · maks {MAX_HEADER_ROWS} PO + {MAX_ITEM_ROWS} item
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
                                                ["PO Header", "Reference", "Ya", "ID buatan Anda untuk hubungkan ke items (mis. PO-A)"],
                                                ["PO Header", "Kode Pemasok", "Ya", "Harus ada di master Pemasok (mis. VND-001)"],
                                                ["PO Header", "Tanggal Pesanan", "Tidak", "Format DD/MM/YYYY — default hari ini"],
                                                ["PO Header", "Tgl Diharapkan", "Tidak", "Format DD/MM/YYYY"],
                                                ["PO Header", "Catatan", "Tidak", "Opsional"],
                                                ["PO Items", "Reference", "Ya", "Harus sama persis dengan Reference di PO Header"],
                                                ["PO Items", "Kode Produk", "Ya", "Harus ada di master Produk"],
                                                ["PO Items", "Qty", "Ya", "Wajib > 0"],
                                                ["PO Items", "Harga Satuan", "Ya", "Wajib > 0 (Rupiah)"],
                                                ["PO Items", "Catatan", "Tidak", "Opsional"],
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
                                    <strong className="text-emerald-700">Catatan:</strong> Nomor PO, status (PO_DRAFT), dan PPN 11% dihitung otomatis di server. Tidak perlu diisi.
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
                                        {validHeaders.length} PO siap diimport
                                    </span>
                                </div>
                                <div className="border border-zinc-300 bg-white px-3 py-1.5 flex items-center gap-1.5">
                                    <FileSpreadsheet className="h-3.5 w-3.5 text-zinc-500" />
                                    <span className="text-xs font-bold text-zinc-700">
                                        {itemRows.filter((r) => !r._hasError).length} item line
                                    </span>
                                </div>
                                {validHeaders.length > 0 && (
                                    <div className="border border-emerald-500 bg-emerald-50 px-3 py-1.5 flex items-center gap-1.5">
                                        <span className="text-[10px] font-black uppercase tracking-wider text-emerald-700">Estimasi (incl PPN):</span>
                                        <span className="text-xs font-mono font-black text-emerald-800">
                                            {fmtIDR(totalEstWithTax)}
                                        </span>
                                    </div>
                                )}
                                {(errorHeaders.length > 0 || errorItems.length > 0) && (
                                    <div className="border border-red-500 bg-red-50 px-3 py-1.5 flex items-center gap-1.5">
                                        <AlertTriangle className="h-3.5 w-3.5 text-red-600" />
                                        <span className="text-xs font-black text-red-700">
                                            {errorHeaders.length} PO + {errorItems.length} item bermasalah (akan dilewati)
                                        </span>
                                    </div>
                                )}
                            </div>

                            <NBSection icon={FileSpreadsheet} title={`Pratinjau PO — ${fileName}`}>
                                <ScrollArea className="h-56 -mx-3 -mb-3">
                                    <div className="overflow-x-auto">
                                        <table className="w-full text-xs min-w-[850px]">
                                            <thead className="sticky top-0 z-10">
                                                <tr className="bg-zinc-100 dark:bg-zinc-800 border-b border-zinc-200">
                                                    <th className="px-3 py-2 text-[10px] font-black uppercase tracking-widest text-zinc-500 text-left w-8">#</th>
                                                    <th className="px-3 py-2 text-[10px] font-black uppercase tracking-widest text-zinc-500 text-left">Reference</th>
                                                    <th className="px-3 py-2 text-[10px] font-black uppercase tracking-widest text-zinc-500 text-left">Pemasok</th>
                                                    <th className="px-3 py-2 text-[10px] font-black uppercase tracking-widest text-zinc-500 text-left">Tgl Pesanan</th>
                                                    <th className="px-3 py-2 text-[10px] font-black uppercase tracking-widest text-zinc-500 text-left">Tgl Diharapkan</th>
                                                    <th className="px-3 py-2 text-[10px] font-black uppercase tracking-widest text-zinc-500 text-right">Items</th>
                                                    <th className="px-3 py-2 text-[10px] font-black uppercase tracking-widest text-zinc-500 text-right">Subtotal</th>
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
                                                            {row.supplierCode || <span className="text-red-500 italic">Kosong!</span>}
                                                        </td>
                                                        <td className="px-3 py-2 text-zinc-600">
                                                            {row.orderDate || <span className="text-zinc-300">Hari ini</span>}
                                                        </td>
                                                        <td className="px-3 py-2 text-zinc-600">
                                                            {row.expectedDate || <span className="text-zinc-300">—</span>}
                                                        </td>
                                                        <td className="px-3 py-2 text-right tabular-nums font-bold">
                                                            {row._itemCount ?? 0}
                                                        </td>
                                                        <td className="px-3 py-2 text-right tabular-nums font-mono text-[11px]">
                                                            {row._estTotal && row._estTotal > 0
                                                                ? fmtIDR(row._estTotal)
                                                                : <span className="text-zinc-300">—</span>}
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
                                            <span className="font-bold">PO Header baris {r._rowIndex}:</span> {r._errorMsg}
                                        </p>
                                    ))}
                                    {errorItems.map((r) => (
                                        <p key={`i-${r._rowIndex}`} className="text-xs text-amber-800">
                                            <span className="font-bold">PO Items baris {r._rowIndex}:</span> {r._errorMsg}
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
                                Mengimport {validHeaders.length} PO...
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
                                        {importResult.imported} PO berhasil diimport
                                    </p>
                                    {importResult.errors.length > 0 && (
                                        <p className="text-xs text-zinc-500 mt-0.5">
                                            {importResult.errors.length} baris gagal
                                        </p>
                                    )}
                                    {importResult.imported > 0 && (
                                        <p className="text-xs text-zinc-500 mt-0.5">
                                            Status: PO_DRAFT — perlu disubmit untuk approval.
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
                                        Mulai Import ({validHeaders.length} PO)
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
