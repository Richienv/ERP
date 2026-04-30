"use client"

/**
 * ImportVendorsDialog
 *
 * Mirror of `components/inventory/import-products-dialog.tsx` for the
 * Procurement → Pemasok module. Uses the NB dialog shell for consistency
 * with the Import Produk pattern (called out as acceptable in the task spec).
 *
 * Flow: pick file → parse XLSX/CSV → preview rows + per-row validation →
 *       commit via bulkImportVendors() → toast partial-success.
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
    bulkImportVendors,
    type BulkImportVendorRow,
} from "@/app/actions/vendor"

// ─── Limits ───────────────────────────────────────────────────────────────
const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024 // 5 MB
const MAX_ROWS_PER_IMPORT = 1000

// ─── Column mapping ───────────────────────────────────────────────────────
// Maps Indonesian (and a few English) header aliases → internal field names.
const COLUMN_ALIASES: Record<string, keyof BulkImportVendorRow> = {
    // Nama
    "nama vendor": "name",
    "nama vendor*": "name",
    "nama pemasok": "name",
    "nama pemasok*": "name",
    "nama": "name",
    "vendor name": "name",
    "supplier name": "name",
    "name": "name",
    // Kode
    "kode": "code",
    "kode*": "code",
    "kode vendor": "code",
    "kode vendor*": "code",
    "kode pemasok": "code",
    "kode pemasok*": "code",
    "supplier code": "code",
    "code": "code",
    // PIC
    "pic": "contactName",
    "kontak": "contactName",
    "kontak (pic)": "contactName",
    "contact": "contactName",
    "contact name": "contactName",
    "nama pic": "contactName",
    // Email
    "email": "email",
    "e-mail": "email",
    // Telepon
    "telepon": "phone",
    "telp": "phone",
    "phone": "phone",
    "no telepon": "phone",
    // NPWP / taxId
    "npwp": "taxId",
    "nomor npwp": "taxId",
    "tax id": "taxId",
    // Alamat
    "alamat": "address",
    "address": "address",
    // Pembayaran
    "pembayaran": "paymentTerm",
    "payment term": "paymentTerm",
    "term pembayaran": "paymentTerm",
    "tempo": "paymentTerm",
    // Rating
    "rating": "rating",
    "rating (1-5)": "rating",
    "nilai": "rating",
    // Status
    "status": "isActive",
    "aktif": "isActive",
    "active": "isActive",
}

// ─── Types ────────────────────────────────────────────────────────────────
interface ParsedRow extends BulkImportVendorRow {
    _rowIndex: number
    _hasError: boolean
    _errorMsg?: string
}

const VALID_PAYMENT_TERMS = ["CASH", "NET_15", "NET_30", "NET_45", "NET_60", "NET_90", "COD"]

// ─── Cell coercion helpers ────────────────────────────────────────────────
function parseBoolean(v: unknown): boolean | undefined {
    if (v === undefined || v === null || v === "") return undefined
    if (typeof v === "boolean") return v
    const s = String(v).trim().toLowerCase()
    if (["ya", "y", "true", "1", "aktif", "active"].includes(s)) return true
    if (["tidak", "t", "false", "0", "nonaktif", "inactive"].includes(s)) return false
    return undefined
}

function parseRating(v: unknown): number | undefined {
    if (v === undefined || v === null || v === "") return undefined
    const n = parseFloat(String(v).replace(/[^\d.]/g, ""))
    return Number.isNaN(n) ? undefined : n
}

// ─── Parser ───────────────────────────────────────────────────────────────
function parseFileToRows(
    file: File,
): Promise<{ rows: ParsedRow[]; parseError?: string }> {
    return new Promise((resolve) => {
        const reader = new FileReader()
        reader.onload = (e) => {
            try {
                const data = e.target?.result
                const workbook = XLSX.read(data, { type: "array" })
                const sheetName = workbook.SheetNames[0]
                const worksheet = workbook.Sheets[sheetName]

                // Read raw rows so we can hunt for the header row anywhere
                // (template has 7 instruction rows above the actual headers).
                const rawData = XLSX.utils.sheet_to_json<unknown[]>(worksheet, { header: 1 })
                if (rawData.length < 2) {
                    return resolve({
                        rows: [],
                        parseError: "File kosong atau tidak ada data selain header.",
                    })
                }

                // ── Header detection: pick the first row whose normalised cells
                //    contain ≥ 2 known column aliases.
                let headerRowIdx = -1
                let bestHeaderMap: Record<number, keyof BulkImportVendorRow> = {}
                for (let r = 0; r < Math.min(rawData.length, 20); r++) {
                    const candidate = (rawData[r] ?? []) as unknown[]
                    const map: Record<number, keyof BulkImportVendorRow> = {}
                    candidate.forEach((cell, colIdx) => {
                        const norm = String(cell ?? "").toLowerCase().trim()
                        const field = COLUMN_ALIASES[norm]
                        if (field) map[colIdx] = field
                    })
                    if (Object.keys(map).length >= 2) {
                        headerRowIdx = r
                        bestHeaderMap = map
                        break
                    }
                }

                if (headerRowIdx < 0) {
                    return resolve({
                        rows: [],
                        parseError:
                            "Header tidak terdeteksi. Pastikan ada kolom 'Nama Vendor' dan 'Kode'. Gunakan template untuk format yang benar.",
                    })
                }

                // Parse data rows below the detected header
                const parsedRows: ParsedRow[] = []

                for (let i = headerRowIdx + 1; i < rawData.length; i++) {
                    const row = (rawData[i] ?? []) as unknown[]
                    // Skip entirely empty rows (separators, trailing blanks)
                    if (
                        !row ||
                        row.every(
                            (cell) => cell === undefined || cell === null || cell === "",
                        )
                    ) {
                        continue
                    }

                    const mapped: ParsedRow = {
                        _rowIndex: i + 1,
                        _hasError: false,
                    }

                    Object.entries(bestHeaderMap).forEach(([colStr, field]) => {
                        const colIdx = parseInt(colStr)
                        const rawVal = row[colIdx]
                        if (rawVal === undefined || rawVal === null || rawVal === "") return

                        if (field === "rating") {
                            mapped.rating = parseRating(rawVal)
                        } else if (field === "isActive") {
                            mapped.isActive = parseBoolean(rawVal)
                        } else {
                            ;(mapped as unknown as Record<string, unknown>)[field] = String(rawVal).trim()
                        }
                    })

                    // ── Inline validation (mirrors the server action so users
                    //    see issues *before* committing).
                    if (!mapped.name) {
                        mapped._hasError = true
                        mapped._errorMsg = "Nama Vendor wajib diisi"
                    } else if (!mapped.code) {
                        mapped._hasError = true
                        mapped._errorMsg = "Kode wajib diisi"
                    } else if (mapped.taxId) {
                        const cleaned = mapped.taxId.replace(/\D/g, "")
                        if (cleaned.length !== 15) {
                            mapped._hasError = true
                            mapped._errorMsg = `NPWP harus 15 digit (${cleaned.length} ditemukan)`
                        }
                    }
                    if (!mapped._hasError && mapped.paymentTerm) {
                        const term = mapped.paymentTerm.toUpperCase().trim()
                        if (!VALID_PAYMENT_TERMS.includes(term)) {
                            mapped._hasError = true
                            mapped._errorMsg = `Pembayaran tidak valid: ${mapped.paymentTerm}`
                        }
                    }
                    if (
                        !mapped._hasError &&
                        mapped.rating !== undefined &&
                        (mapped.rating < 1 || mapped.rating > 5)
                    ) {
                        mapped._hasError = true
                        mapped._errorMsg = `Rating harus 1-5 (${mapped.rating} diberikan)`
                    }

                    parsedRows.push(mapped)

                    if (parsedRows.length >= MAX_ROWS_PER_IMPORT) {
                        return resolve({
                            rows: parsedRows,
                            parseError: `Batas ${MAX_ROWS_PER_IMPORT} baris per import. Sisanya di-skip — silakan import dalam beberapa batch.`,
                        })
                    }
                }

                resolve({ rows: parsedRows })
            } catch (err: unknown) {
                const msg = err instanceof Error ? err.message : "Unknown error"
                resolve({ rows: [], parseError: `Gagal membaca file: ${msg}` })
            }
        }
        reader.readAsArrayBuffer(file)
    })
}

// ─── Main Component ───────────────────────────────────────────────────────
export function ImportVendorsDialog({
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
    const [rows, setRows] = useState<ParsedRow[]>([])
    const [importResult, setImportResult] = useState<
        { imported: number; errors: { row: number; reason: string }[] } | null
    >(null)
    const [progress, setProgress] = useState(0)

    const validRows = rows.filter((r) => !r._hasError)
    const errorRows = rows.filter((r) => r._hasError)

    // ── Reset state on dialog close ──────────────────────────────────────
    const handleOpenChange = useCallback(
        (val: boolean) => {
            setOpen(val)
            if (!val) {
                setTimeout(() => {
                    setStep("idle")
                    setFileName("")
                    setParseError(null)
                    setRows([])
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
            setRows([])
            setStep("preview")

            const { rows: parsed, parseError: err } = await parseFileToRows(file)
            if (err && parsed.length === 0) {
                setParseError(err)
                setStep("idle")
                return
            }
            // Soft warning when row cap was hit but we still parsed data
            if (err) toast.warning(err)
            setRows(parsed)
        },
        [],
    )

    // ── Execute import ───────────────────────────────────────────────────
    const handleImport = useCallback(async () => {
        if (validRows.length === 0) return

        setStep("importing")
        setProgress(10)

        // Strip internal markers before sending to server action
        const payload: BulkImportVendorRow[] = validRows.map((r) => {
            const rest: BulkImportVendorRow = {
                name: r.name,
                code: r.code,
                contactName: r.contactName,
                email: r.email,
                phone: r.phone,
                taxId: r.taxId,
                address: r.address,
                paymentTerm: r.paymentTerm,
                rating: r.rating,
                isActive: r.isActive,
            }
            return rest
        })

        setProgress(40)

        try {
            const result = await bulkImportVendors(payload)
            setProgress(100)
            setImportResult({ imported: result.imported, errors: result.errors })
            setStep("done")

            // Invalidate every consumer of vendor data — list page, dropdowns, etc.
            await queryClient.invalidateQueries({ queryKey: queryKeys.vendors.all })

            if (result.imported > 0) {
                toast.success(`${result.imported} vendor berhasil diimport`, {
                    description:
                        result.errors.length > 0
                            ? `${result.errors.length} baris gagal — lihat detail di dialog.`
                            : "Semua vendor berhasil ditambahkan.",
                })
            } else {
                toast.error("Import gagal — tidak ada vendor yang berhasil diimport.", {
                    description: result.errors[0]?.reason ?? "Periksa format file Anda.",
                })
            }
        } catch (err: unknown) {
            setStep("preview")
            const msg = err instanceof Error ? err.message : "Unknown error"
            toast.error("Terjadi kesalahan saat import", { description: msg })
        }
    }, [validRows, queryClient])

    // ── Template download (server-generated for canonical layout) ────────
    const handleDownloadTemplate = useCallback(() => {
        // Server endpoint streams the latest template — keeps headers in sync
        // with the COLUMN_ALIASES + bulkImportVendors validators above.
        window.open("/api/procurement/vendors/template", "_blank")
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
                    title="Impor Vendor"
                    subtitle="Upload file Excel atau CSV untuk menambahkan banyak vendor sekaligus"
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
                                        Format: .xlsx, .xls, .csv · maks 5 MB · maks {MAX_ROWS_PER_IMPORT} baris
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
                                                <th className="px-3 py-2 text-[10px] font-black uppercase tracking-widest text-zinc-500 text-left">Header Kolom</th>
                                                <th className="px-3 py-2 text-[10px] font-black uppercase tracking-widest text-zinc-500 text-left">Field</th>
                                                <th className="px-3 py-2 text-[10px] font-black uppercase tracking-widest text-zinc-500 text-left">Wajib?</th>
                                                <th className="px-3 py-2 text-[10px] font-black uppercase tracking-widest text-zinc-500 text-left">Keterangan</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {[
                                                ["Nama Vendor", "name", "Ya", "Nama lengkap vendor (PT, CV, dst.)"],
                                                ["Kode", "code", "Ya", "Unik — auto-uppercase saat import"],
                                                ["PIC", "contactName", "Tidak", "Nama kontak utama"],
                                                ["Email", "email", "Tidak", "Email PIC atau perusahaan"],
                                                ["Telepon", "phone", "Tidak", "Nomor telepon utama"],
                                                ["NPWP", "taxId", "Tidak", "15 digit (boleh dengan titik/strip)"],
                                                ["Alamat", "address", "Tidak", "Alamat lengkap"],
                                                ["Pembayaran", "paymentTerm", "Tidak", "CASH, NET_15, NET_30, NET_45, NET_60, NET_90, atau COD"],
                                                ["Rating (1-5)", "rating", "Tidak", "Angka 1-5 (default 0)"],
                                                ["Aktif", "isActive", "Tidak", "'Ya' atau 'Tidak' (default Ya)"],
                                            ].map(([col, field, req, note]) => (
                                                <tr key={field} className="border-b border-zinc-100">
                                                    <td className="px-3 py-2 font-mono text-emerald-700">{col}</td>
                                                    <td className="px-3 py-2 text-zinc-500">{field}</td>
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
                    {step === "preview" && rows.length > 0 && (
                        <>
                            <div className="flex items-center gap-3 flex-wrap">
                                <div className="border border-black bg-emerald-50 px-3 py-1.5 flex items-center gap-1.5">
                                    <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                                    <span className="text-xs font-black text-emerald-700">
                                        {validRows.length} baris siap diimport
                                    </span>
                                </div>
                                {errorRows.length > 0 && (
                                    <div className="border border-red-500 bg-red-50 px-3 py-1.5 flex items-center gap-1.5">
                                        <AlertTriangle className="h-3.5 w-3.5 text-red-600" />
                                        <span className="text-xs font-black text-red-700">
                                            {errorRows.length} baris bermasalah (akan dilewati)
                                        </span>
                                    </div>
                                )}
                            </div>

                            <NBSection icon={FileSpreadsheet} title={`Pratinjau Data — ${fileName}`}>
                                <ScrollArea className="h-64 -mx-3 -mb-3">
                                    <div className="overflow-x-auto">
                                        <table className="w-full text-xs min-w-[850px]">
                                            <thead className="sticky top-0 z-10">
                                                <tr className="bg-zinc-100 dark:bg-zinc-800 border-b border-zinc-200">
                                                    <th className="px-3 py-2 text-[10px] font-black uppercase tracking-widest text-zinc-500 text-left w-8">#</th>
                                                    <th className="px-3 py-2 text-[10px] font-black uppercase tracking-widest text-zinc-500 text-left">Nama Vendor</th>
                                                    <th className="px-3 py-2 text-[10px] font-black uppercase tracking-widest text-zinc-500 text-left">Kode</th>
                                                    <th className="px-3 py-2 text-[10px] font-black uppercase tracking-widest text-zinc-500 text-left">PIC</th>
                                                    <th className="px-3 py-2 text-[10px] font-black uppercase tracking-widest text-zinc-500 text-left">NPWP</th>
                                                    <th className="px-3 py-2 text-[10px] font-black uppercase tracking-widest text-zinc-500 text-left">Pembayaran</th>
                                                    <th className="px-3 py-2 text-[10px] font-black uppercase tracking-widest text-zinc-500 text-right">Rating</th>
                                                    <th className="px-3 py-2 w-8"></th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {rows.map((row) => (
                                                    <tr
                                                        key={row._rowIndex}
                                                        className={`border-b border-zinc-100 ${row._hasError ? "bg-red-50" : "hover:bg-zinc-50"}`}
                                                    >
                                                        <td className="px-3 py-2 text-zinc-400">{row._rowIndex}</td>
                                                        <td className="px-3 py-2 font-bold">
                                                            {row.name || <span className="text-red-500 italic">Kosong!</span>}
                                                        </td>
                                                        <td className="px-3 py-2 font-mono text-zinc-500">
                                                            {row.code || <span className="text-red-500 italic">Kosong!</span>}
                                                        </td>
                                                        <td className="px-3 py-2 text-zinc-600">
                                                            {row.contactName || <span className="text-zinc-300">—</span>}
                                                        </td>
                                                        <td className="px-3 py-2 font-mono text-[11px] text-zinc-500">
                                                            {row.taxId || <span className="text-zinc-300">—</span>}
                                                        </td>
                                                        <td className="px-3 py-2 text-zinc-600">
                                                            {row.paymentTerm || <span className="text-zinc-300">CASH</span>}
                                                        </td>
                                                        <td className="px-3 py-2 text-right tabular-nums">
                                                            {row.rating ? row.rating : <span className="text-zinc-300">0</span>}
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

                            {errorRows.length > 0 && (
                                <div className="border border-amber-400 bg-amber-50 p-3 space-y-1">
                                    <p className="text-xs font-black uppercase tracking-wider text-amber-700 mb-2">
                                        Baris yang akan dilewati:
                                    </p>
                                    {errorRows.map((r) => (
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
                                Mengimport {validRows.length} vendor...
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
                                        {importResult.imported} vendor berhasil diimport
                                    </p>
                                    {importResult.errors.length > 0 && (
                                        <p className="text-xs text-zinc-500 mt-0.5">
                                            {importResult.errors.length} baris gagal
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
                                {step === "preview" && validRows.length > 0 && (
                                    <Button
                                        onClick={handleImport}
                                        className="bg-emerald-600 text-white border border-emerald-600 hover:bg-emerald-700 font-black uppercase text-[10px] tracking-wider px-5 h-8 rounded-none gap-1.5"
                                    >
                                        <Upload className="h-3.5 w-3.5 mr-1.5" />
                                        Mulai Import ({validRows.length} vendor)
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
