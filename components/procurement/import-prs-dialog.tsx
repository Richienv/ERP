"use client"

/**
 * ImportPRsDialog
 *
 * Mirror of `components/procurement/import-vendors-dialog.tsx` (commit 3b41595)
 * adapted untuk PR dengan template 2 sheet:
 *   • "PR Header" — satu baris per PR
 *   • "PR Items"  — baris per item, di-match ke header via Reference (kolom 1)
 *
 * Flow: pick file → parse 2 sheets → preview rows + per-row validation →
 *       commit via bulkImportPurchaseRequests() → toast partial-success.
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
    bulkImportPurchaseRequests,
    type BulkImportPRRow,
    type BulkImportPRItemRow,
} from "@/lib/actions/procurement"

// ─── Limits ───────────────────────────────────────────────────────────────
const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024 // 5 MB
const MAX_HEADER_ROWS = 500
const MAX_ITEM_ROWS = 5000

// ─── Column mapping ───────────────────────────────────────────────────────
const HEADER_ALIASES: Record<string, keyof BulkImportPRRow> = {
    "reference": "reference",
    "reference*": "reference",
    "ref": "reference",
    "kode pr": "reference",
    "no pr": "reference",
    "email pemohon": "requesterEmail",
    "email pemohon*": "requesterEmail",
    "email": "requesterEmail",
    "pemohon": "requesterEmail",
    "requester email": "requesterEmail",
    "departemen": "department",
    "departemen*": "department",
    "department": "department",
    "dept": "department",
    "prioritas": "priority",
    "priority": "priority",
    "catatan": "notes",
    "notes": "notes",
    "keterangan": "notes",
}

const ITEM_ALIASES: Record<string, keyof BulkImportPRItemRow> = {
    "reference": "reference",
    "reference*": "reference",
    "ref": "reference",
    "kode produk": "productCode",
    "kode produk*": "productCode",
    "sku": "productCode",
    "kode": "productCode",
    "product code": "productCode",
    "qty": "quantity",
    "qty*": "quantity",
    "quantity": "quantity",
    "kuantitas": "quantity",
    "jumlah": "quantity",
    "catatan": "notes",
    "notes": "notes",
    "keterangan": "notes",
}

const VALID_PRIORITIES = ["LOW", "NORMAL", "MEDIUM", "HIGH", "URGENT"]

// ─── Types ────────────────────────────────────────────────────────────────
interface ParsedHeaderRow extends BulkImportPRRow {
    _rowIndex: number
    _hasError: boolean
    _errorMsg?: string
    _itemCount: number
}
interface ParsedItemRow extends BulkImportPRItemRow {
    _rowIndex: number
    _hasError: boolean
    _errorMsg?: string
}

interface ParseResult {
    headerRows: ParsedHeaderRow[]
    itemRows: ParsedItemRow[]
    parseError?: string
}

// ─── Cell coercion helpers ────────────────────────────────────────────────
function parseQuantity(v: unknown): number | undefined {
    if (v === undefined || v === null || v === "") return undefined
    if (typeof v === "number") return Number.isFinite(v) ? v : undefined
    const n = parseFloat(String(v).replace(/[^\d.,-]/g, "").replace(",", "."))
    return Number.isNaN(n) ? undefined : n
}

// ─── Sheet parser ─────────────────────────────────────────────────────────
function detectHeader<T extends string>(
    raw: unknown[][],
    aliases: Record<string, T>,
): { headerRowIdx: number; map: Record<number, T> } {
    let headerRowIdx = -1
    let bestMap: Record<number, T> = {}
    for (let r = 0; r < Math.min(raw.length, 20); r++) {
        const candidate = (raw[r] ?? []) as unknown[]
        const map: Record<number, T> = {}
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

function findSheet(workbook: XLSX.WorkBook, candidates: string[]): XLSX.WorkSheet | null {
    for (const name of workbook.SheetNames) {
        const norm = name.toLowerCase().trim()
        if (candidates.some((c) => norm === c.toLowerCase() || norm.includes(c.toLowerCase()))) {
            return workbook.Sheets[name]
        }
    }
    return null
}

function parseFileToRows(file: File): Promise<ParseResult> {
    return new Promise((resolve) => {
        const reader = new FileReader()
        reader.onload = (e) => {
            try {
                const data = e.target?.result
                const workbook = XLSX.read(data, { type: "array" })

                if (workbook.SheetNames.length < 2) {
                    return resolve({
                        headerRows: [],
                        itemRows: [],
                        parseError:
                            "File harus berisi 2 sheet: 'PR Header' dan 'PR Items'. Gunakan template untuk format yang benar.",
                    })
                }

                // ── Locate sheets (fallback to position if names differ)
                const headerSheet =
                    findSheet(workbook, ["pr header", "header"]) ??
                    workbook.Sheets[workbook.SheetNames[0]]
                const itemsSheet =
                    findSheet(workbook, ["pr items", "items", "item"]) ??
                    workbook.Sheets[workbook.SheetNames[1]]

                if (!headerSheet || !itemsSheet) {
                    return resolve({
                        headerRows: [],
                        itemRows: [],
                        parseError: "Tidak bisa menemukan sheet 'PR Header' atau 'PR Items'.",
                    })
                }

                // ── Parse header sheet
                const rawHeader = XLSX.utils.sheet_to_json<unknown[]>(headerSheet, { header: 1 })
                const headerDetect = detectHeader(rawHeader, HEADER_ALIASES)
                if (headerDetect.headerRowIdx < 0) {
                    return resolve({
                        headerRows: [],
                        itemRows: [],
                        parseError:
                            "Header tidak terdeteksi di sheet 'PR Header'. Pastikan ada kolom 'Reference' dan 'Email Pemohon'.",
                    })
                }

                const headerRows: ParsedHeaderRow[] = []
                for (let i = headerDetect.headerRowIdx + 1; i < rawHeader.length; i++) {
                    const row = (rawHeader[i] ?? []) as unknown[]
                    if (
                        !row ||
                        row.every((c) => c === undefined || c === null || c === "")
                    ) {
                        continue
                    }

                    const mapped: ParsedHeaderRow = {
                        _rowIndex: i + 1,
                        _hasError: false,
                        _itemCount: 0,
                    }
                    Object.entries(headerDetect.map).forEach(([colStr, field]) => {
                        const colIdx = parseInt(colStr)
                        const rawVal = row[colIdx]
                        if (rawVal === undefined || rawVal === null || rawVal === "") return
                        ;(mapped as unknown as Record<string, unknown>)[field] = String(rawVal).trim()
                    })

                    // Inline validation
                    if (!mapped.reference) {
                        mapped._hasError = true
                        mapped._errorMsg = "Reference wajib diisi"
                    } else if (!mapped.requesterEmail) {
                        mapped._hasError = true
                        mapped._errorMsg = "Email Pemohon wajib diisi"
                    } else if (
                        mapped.priority &&
                        !VALID_PRIORITIES.includes(mapped.priority.toUpperCase())
                    ) {
                        mapped._hasError = true
                        mapped._errorMsg = `Prioritas tidak valid: ${mapped.priority}`
                    }

                    headerRows.push(mapped)
                    if (headerRows.length >= MAX_HEADER_ROWS) break
                }

                // ── Parse items sheet
                const rawItems = XLSX.utils.sheet_to_json<unknown[]>(itemsSheet, { header: 1 })
                const itemDetect = detectHeader(rawItems, ITEM_ALIASES)
                if (itemDetect.headerRowIdx < 0) {
                    return resolve({
                        headerRows: [],
                        itemRows: [],
                        parseError:
                            "Header tidak terdeteksi di sheet 'PR Items'. Pastikan ada kolom 'Reference', 'Kode Produk', 'Qty'.",
                    })
                }

                const itemRows: ParsedItemRow[] = []
                for (let i = itemDetect.headerRowIdx + 1; i < rawItems.length; i++) {
                    const row = (rawItems[i] ?? []) as unknown[]
                    if (
                        !row ||
                        row.every((c) => c === undefined || c === null || c === "")
                    ) {
                        continue
                    }

                    const mapped: ParsedItemRow = {
                        _rowIndex: i + 1,
                        _hasError: false,
                    }
                    Object.entries(itemDetect.map).forEach(([colStr, field]) => {
                        const colIdx = parseInt(colStr)
                        const rawVal = row[colIdx]
                        if (rawVal === undefined || rawVal === null || rawVal === "") return
                        if (field === "quantity") {
                            mapped.quantity = parseQuantity(rawVal)
                        } else {
                            ;(mapped as unknown as Record<string, unknown>)[field] = String(rawVal).trim()
                        }
                    })

                    if (!mapped.reference) {
                        mapped._hasError = true
                        mapped._errorMsg = "Reference wajib diisi"
                    } else if (!mapped.productCode) {
                        mapped._hasError = true
                        mapped._errorMsg = "Kode Produk wajib diisi"
                    } else if (!mapped.quantity || mapped.quantity <= 0) {
                        mapped._hasError = true
                        mapped._errorMsg = "Qty wajib > 0"
                    }

                    itemRows.push(mapped)
                    if (itemRows.length >= MAX_ITEM_ROWS) break
                }

                // ── Cross-link: count items per header reference + flag headers
                //    yang tidak punya item sama sekali.
                const itemsByRef = new Map<string, number>()
                for (const it of itemRows) {
                    if (it._hasError) continue
                    const ref = it.reference?.toLowerCase().trim()
                    if (!ref) continue
                    itemsByRef.set(ref, (itemsByRef.get(ref) ?? 0) + 1)
                }
                for (const h of headerRows) {
                    if (h._hasError) continue
                    const ref = h.reference?.toLowerCase().trim()
                    const count = (ref && itemsByRef.get(ref)) || 0
                    h._itemCount = count
                    if (count === 0) {
                        h._hasError = true
                        h._errorMsg = `Tidak ada item di Sheet 'PR Items' dengan Reference "${h.reference}"`
                    }
                }

                resolve({ headerRows, itemRows })
            } catch (err: unknown) {
                const msg = err instanceof Error ? err.message : "Unknown error"
                resolve({
                    headerRows: [],
                    itemRows: [],
                    parseError: `Gagal membaca file: ${msg}`,
                })
            }
        }
        reader.readAsArrayBuffer(file)
    })
}

// ─── Main Component ───────────────────────────────────────────────────────
export function ImportPRsDialog({
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
    const validItemCount = validHeaders.reduce((sum, h) => sum + h._itemCount, 0)

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

            const { headerRows: hRows, itemRows: iRows, parseError: err } =
                await parseFileToRows(file)
            if (err && hRows.length === 0) {
                setParseError(err)
                setStep("idle")
                return
            }
            if (err) toast.warning(err)
            setHeaderRows(hRows)
            setItemRows(iRows)
        },
        [],
    )

    // ── Execute import ───────────────────────────────────────────────────
    const handleImport = useCallback(async () => {
        if (validHeaders.length === 0) return

        setStep("importing")
        setProgress(10)

        // Strip internal markers before sending to server action.
        // Hanya kirim header & item yang valid (server akan re-validate juga).
        const headerPayload: BulkImportPRRow[] = validHeaders.map((r) => ({
            reference: r.reference,
            requesterEmail: r.requesterEmail,
            department: r.department,
            priority: r.priority,
            notes: r.notes,
        }))
        const validRefs = new Set(
            validHeaders
                .map((h) => h.reference?.toLowerCase().trim())
                .filter(Boolean) as string[],
        )
        const itemPayload: BulkImportPRItemRow[] = itemRows
            .filter(
                (it) =>
                    !it._hasError &&
                    it.reference &&
                    validRefs.has(it.reference.toLowerCase().trim()),
            )
            .map((it) => ({
                reference: it.reference,
                productCode: it.productCode,
                quantity: it.quantity,
                notes: it.notes,
            }))

        setProgress(40)

        try {
            const result = await bulkImportPurchaseRequests(headerPayload, itemPayload)
            setProgress(100)
            setImportResult({ imported: result.imported, errors: result.errors })
            setStep("done")

            // Invalidate every consumer of PR data — list page, dashboard, etc.
            await queryClient.invalidateQueries({ queryKey: queryKeys.purchaseRequests.all })
            await queryClient.invalidateQueries({ queryKey: queryKeys.procurementDashboard.all })

            if (result.imported > 0) {
                toast.success(`${result.imported} PR berhasil diimport`, {
                    description:
                        result.errors.length > 0
                            ? `${result.errors.length} PR gagal — lihat detail di dialog.`
                            : "Semua PR berhasil ditambahkan.",
                })
            } else {
                toast.error("Import gagal — tidak ada PR yang berhasil diimport.", {
                    description: result.errors[0]?.reason ?? "Periksa format file Anda.",
                })
            }
        } catch (err: unknown) {
            setStep("preview")
            const msg = err instanceof Error ? err.message : "Unknown error"
            toast.error("Terjadi kesalahan saat import", { description: msg })
        }
    }, [validHeaders, itemRows, queryClient])

    // ── Template download ────────────────────────────────────────────────
    const handleDownloadTemplate = useCallback(() => {
        window.open("/api/procurement/requests/template", "_blank")
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
                    title="Impor Permintaan Pembelian"
                    subtitle="Upload file Excel 2-sheet (PR Header + PR Items) untuk menambahkan banyak PR sekaligus"
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
                                        {fileName ? fileName : "Pilih File Excel atau CSV"}
                                    </p>
                                    <p className="text-xs text-zinc-400 mt-1">
                                        Format: .xlsx, .xls · maks 5 MB · maks {MAX_HEADER_ROWS} PR · {MAX_ITEM_ROWS} item
                                    </p>
                                </div>
                                <input
                                    ref={fileInputRef}
                                    type="file"
                                    accept=".xlsx,.xls,.csv"
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

                            <NBSection icon={FileSpreadsheet} title="Panduan Kolom">
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
                                                ["PR Header", "Reference", "Ya", "ID bebas (e.g. PR-001) untuk match dengan items"],
                                                ["PR Header", "Email Pemohon", "Ya", "Harus terdaftar di master karyawan (status ACTIVE)"],
                                                ["PR Header", "Departemen", "Ya", "Bisa kosong → otomatis ambil dept karyawan"],
                                                ["PR Header", "Prioritas", "Tidak", "LOW, NORMAL, MEDIUM, HIGH, atau URGENT"],
                                                ["PR Header", "Catatan", "Tidak", "Catatan untuk PR (opsional)"],
                                                ["PR Items", "Reference", "Ya", "Harus match dengan Reference di sheet PR Header"],
                                                ["PR Items", "Kode Produk", "Ya", "SKU produk (cek di /inventory/products)"],
                                                ["PR Items", "Qty", "Ya", "Angka, harus > 0"],
                                                ["PR Items", "Catatan", "Tidak", "Catatan untuk item (opsional)"],
                                            ].map(([sheet, col, req, note], idx) => (
                                                <tr key={idx} className="border-b border-zinc-100">
                                                    <td className="px-3 py-2 text-zinc-500 font-mono text-[10px]">{sheet}</td>
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
                                        {validHeaders.length} PR siap diimport ({validItemCount} item)
                                    </span>
                                </div>
                                {errorHeaders.length > 0 && (
                                    <div className="border border-red-500 bg-red-50 px-3 py-1.5 flex items-center gap-1.5">
                                        <AlertTriangle className="h-3.5 w-3.5 text-red-600" />
                                        <span className="text-xs font-black text-red-700">
                                            {errorHeaders.length} PR bermasalah (akan dilewati)
                                        </span>
                                    </div>
                                )}
                            </div>

                            <NBSection icon={FileSpreadsheet} title={`Pratinjau Data — ${fileName}`}>
                                <ScrollArea className="h-64 -mx-3 -mb-3">
                                    <div className="overflow-x-auto">
                                        <table className="w-full text-xs min-w-[800px]">
                                            <thead className="sticky top-0 z-10">
                                                <tr className="bg-zinc-100 dark:bg-zinc-800 border-b border-zinc-200">
                                                    <th className="px-3 py-2 text-[10px] font-black uppercase tracking-widest text-zinc-500 text-left w-8">#</th>
                                                    <th className="px-3 py-2 text-[10px] font-black uppercase tracking-widest text-zinc-500 text-left">Reference</th>
                                                    <th className="px-3 py-2 text-[10px] font-black uppercase tracking-widest text-zinc-500 text-left">Email Pemohon</th>
                                                    <th className="px-3 py-2 text-[10px] font-black uppercase tracking-widest text-zinc-500 text-left">Departemen</th>
                                                    <th className="px-3 py-2 text-[10px] font-black uppercase tracking-widest text-zinc-500 text-left">Prioritas</th>
                                                    <th className="px-3 py-2 text-[10px] font-black uppercase tracking-widest text-zinc-500 text-right">Item</th>
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
                                                        <td className="px-3 py-2 font-mono font-bold">
                                                            {row.reference || <span className="text-red-500 italic">Kosong!</span>}
                                                        </td>
                                                        <td className="px-3 py-2 text-zinc-600">
                                                            {row.requesterEmail || <span className="text-red-500 italic">Kosong!</span>}
                                                        </td>
                                                        <td className="px-3 py-2 text-zinc-600">
                                                            {row.department || <span className="text-zinc-300">—</span>}
                                                        </td>
                                                        <td className="px-3 py-2 text-zinc-600">
                                                            {row.priority || <span className="text-zinc-300">NORMAL</span>}
                                                        </td>
                                                        <td className="px-3 py-2 text-right tabular-nums font-mono">
                                                            {row._itemCount > 0
                                                                ? row._itemCount
                                                                : <span className="text-red-500">0</span>}
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

                            {errorHeaders.length > 0 && (
                                <div className="border border-amber-400 bg-amber-50 p-3 space-y-1">
                                    <p className="text-xs font-black uppercase tracking-wider text-amber-700 mb-2">
                                        PR yang akan dilewati:
                                    </p>
                                    {errorHeaders.map((r) => (
                                        <p key={r._rowIndex} className="text-xs text-amber-800">
                                            <span className="font-bold">Baris {r._rowIndex}:</span> {r._errorMsg}
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
                                Mengimport {validHeaders.length} PR ({validItemCount} item)...
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
                                        {importResult.imported} PR berhasil diimport
                                    </p>
                                    {importResult.errors.length > 0 && (
                                        <p className="text-xs text-zinc-500 mt-0.5">
                                            {importResult.errors.length} PR gagal
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
                                        Mulai Import ({validHeaders.length} PR)
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
