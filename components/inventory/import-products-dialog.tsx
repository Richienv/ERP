"use client"

import { useRef, useState, useCallback } from "react"
import { Upload, FileSpreadsheet, AlertTriangle, CheckCircle2, X, Loader2 } from "lucide-react"
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
    bulkImportProducts,
    type BulkImportProductRow,
} from "@/app/actions/inventory"

// ─── Column mapping ─────────────────────────────────────────────────────────
// Maps Indonesian column header aliases → internal field names.
const COLUMN_ALIASES: Record<string, keyof BulkImportProductRow> = {
    // Nama Produk
    "nama produk": "name",
    "nama": "name",
    "product name": "name",
    "name": "name",
    // Kode Produk
    "kode produk": "code",
    "kode": "code",
    "sku": "code",
    "code": "code",
    "product code": "code",
    // Kategori
    "kategori": "categoryName",
    "category": "categoryName",
    "kategori produk": "categoryName",
    // Satuan
    "satuan": "unit",
    "unit": "unit",
    "uom": "unit",
    // HPP / Cost Price
    "hpp": "costPrice",
    "harga beli": "costPrice",
    "cost price": "costPrice",
    "cost": "costPrice",
    "harga pokok": "costPrice",
    // Harga Jual
    "harga jual": "sellingPrice",
    "selling price": "sellingPrice",
    "price": "sellingPrice",
    "harga": "sellingPrice",
    // Deskripsi
    "deskripsi": "description",
    "description": "description",
    "keterangan": "description",
}

// ─── Types ───────────────────────────────────────────────────────────────────
interface ParsedRow extends BulkImportProductRow {
    _rowIndex: number
    _hasError: boolean
    _errorMsg?: string
}

// ─── Parser ──────────────────────────────────────────────────────────────────
async function parseFileToRows(file: File): Promise<{ rows: ParsedRow[]; parseError?: string }> {
    const XLSX = await import("xlsx")
    return new Promise((resolve) => {
        const reader = new FileReader()
        reader.onload = (e) => {
            try {
                const data = e.target?.result
                const workbook = XLSX.read(data, { type: "array" })
                const sheetName = workbook.SheetNames[0]
                const worksheet = workbook.Sheets[sheetName]

                // Get raw data as array of arrays to detect headers
                const rawData = XLSX.utils.sheet_to_json<string[]>(worksheet, { header: 1 })
                if (rawData.length < 2) {
                    return resolve({ rows: [], parseError: "File kosong atau tidak ada data selain header." })
                }

                // Detect header row (first row)
                const headerRow = rawData[0] as string[]
                const headerMap: Record<number, keyof BulkImportProductRow> = {}

                headerRow.forEach((h, colIdx) => {
                    const normalised = String(h ?? "").toLowerCase().trim()
                    const field = COLUMN_ALIASES[normalised]
                    if (field) headerMap[colIdx] = field
                })

                // Parse data rows
                const parsedRows: ParsedRow[] = []

                for (let i = 1; i < rawData.length; i++) {
                    const row = rawData[i] as any[]
                    // Skip entirely empty rows
                    if (!row || row.every((cell) => cell === undefined || cell === null || cell === "")) {
                        continue
                    }

                    const mapped: any = { _rowIndex: i + 1, _hasError: false }

                    Object.entries(headerMap).forEach(([colStr, field]) => {
                        const colIdx = parseInt(colStr)
                        const rawVal = row[colIdx]

                        if (rawVal === undefined || rawVal === null) return

                        if (field === "costPrice" || field === "sellingPrice") {
                            const num = parseFloat(String(rawVal).replace(/[^\d.]/g, ""))
                            mapped[field] = isNaN(num) ? 0 : num
                        } else {
                            mapped[field] = String(rawVal).trim()
                        }
                    })

                    // Validate required
                    if (!mapped.name) {
                        mapped._hasError = true
                        mapped._errorMsg = "Nama Produk wajib diisi"
                    }

                    parsedRows.push(mapped as ParsedRow)
                }

                resolve({ rows: parsedRows })
            } catch (err: any) {
                resolve({ rows: [], parseError: `Gagal membaca file: ${err.message}` })
            }
        }
        reader.readAsArrayBuffer(file)
    })
}

// ─── Main Component ───────────────────────────────────────────────────────────
export function ImportProductsDialog({
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
    const [importResult, setImportResult] = useState<{ imported: number; errors: string[] } | null>(null)
    const [progress, setProgress] = useState(0)

    const validRows = rows.filter((r) => !r._hasError)
    const errorRows = rows.filter((r) => r._hasError)

    // ── Reset state on dialog close ──────────────────────────────────────────
    const handleOpenChange = useCallback((val: boolean) => {
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
    }, [])

    // ── File selected ────────────────────────────────────────────────────────
    const handleFileChange = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (!file) return

        setFileName(file.name)
        setParseError(null)
        setRows([])
        setStep("preview")

        const { rows: parsed, parseError: err } = await parseFileToRows(file)
        if (err) {
            setParseError(err)
            setStep("idle")
            return
        }
        setRows(parsed)
    }, [])

    // ── Execute import ───────────────────────────────────────────────────────
    const handleImport = useCallback(async () => {
        if (validRows.length === 0) return

        setStep("importing")
        setProgress(10)

        // Strip internal fields before sending to server action
        const payload: BulkImportProductRow[] = validRows.map(({ _rowIndex, _hasError, _errorMsg, ...rest }) => rest)

        setProgress(40)

        try {
            const result = await bulkImportProducts(payload)
            setProgress(100)
            setImportResult({ imported: result.imported, errors: result.errors })
            setStep("done")

            // Invalidate all relevant caches
            await Promise.all([
                queryClient.invalidateQueries({ queryKey: queryKeys.products.all }),
                queryClient.invalidateQueries({ queryKey: queryKeys.categories.all }),
                queryClient.invalidateQueries({ queryKey: queryKeys.sidebarActions.all }),
                queryClient.invalidateQueries({ queryKey: queryKeys.inventoryDashboard.all }),
            ])

            if (result.imported > 0) {
                toast.success(`${result.imported} produk berhasil diimport`, {
                    description: result.errors.length > 0
                        ? `${result.errors.length} baris gagal — lihat detail di dialog.`
                        : "Semua produk berhasil ditambahkan.",
                })
            } else {
                toast.error("Import gagal — tidak ada produk yang berhasil diimport.", {
                    description: result.errors[0] ?? "Periksa format file Anda.",
                })
            }
        } catch (err: any) {
            setStep("preview")
            toast.error("Terjadi kesalahan saat import", { description: err.message })
        }
    }, [validRows, queryClient])

    // ── Template download ────────────────────────────────────────────────────
    const handleDownloadTemplate = useCallback(async () => {
        const XLSX = await import("xlsx")
        const ws = XLSX.utils.aoa_to_sheet([
            ["Nama Produk", "Kode Produk", "Kategori", "Satuan", "HPP", "Harga Jual", "Deskripsi"],
            ["Kaos Polos Hitam", "KAO-001", "Pakaian", "PCS", 45000, 75000, "Kaos polos bahan cotton combed 30s"],
            ["Celana Chino", "", "Pakaian", "PCS", 120000, 200000, ""],
        ])
        const wb = XLSX.utils.book_new()
        XLSX.utils.book_append_sheet(wb, ws, "Template Import Produk")
        XLSX.writeFile(wb, "template-import-produk.xlsx")
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
                    Import
                </Button>
            )}

            {/* ── Dialog ── */}
            <NBDialog open={open} onOpenChange={handleOpenChange} size="wide">
                <NBDialogHeader
                    icon={FileSpreadsheet}
                    title="Import Produk"
                    subtitle="Upload file Excel atau CSV untuk menambahkan banyak produk sekaligus"
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
                                        Format yang diterima: .xlsx, .xls, .csv
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
                                                ["Nama Produk", "name", "Ya", "Nama lengkap produk"],
                                                ["Kode Produk", "code", "Tidak", "Auto-generate jika kosong"],
                                                ["Kategori", "categoryName", "Tidak", "Harus cocok dengan nama kategori yang ada"],
                                                ["Satuan", "unit", "Tidak", "Default: PCS"],
                                                ["HPP", "costPrice", "Tidak", "Harga pokok (angka, default 0)"],
                                                ["Harga Jual", "sellingPrice", "Tidak", "Harga jual (angka, default 0)"],
                                                ["Deskripsi", "description", "Tidak", "Keterangan tambahan"],
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
                                className="text-xs font-black text-emerald-700 underline underline-offset-2 hover:text-emerald-900"
                            >
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
                                        <table className="w-full text-xs min-w-[700px]">
                                            <thead className="sticky top-0 z-10">
                                                <tr className="bg-zinc-100 dark:bg-zinc-800 border-b border-zinc-200">
                                                    <th className="px-3 py-2 text-[10px] font-black uppercase tracking-widest text-zinc-500 text-left w-8">#</th>
                                                    <th className="px-3 py-2 text-[10px] font-black uppercase tracking-widest text-zinc-500 text-left">Nama Produk</th>
                                                    <th className="px-3 py-2 text-[10px] font-black uppercase tracking-widest text-zinc-500 text-left">Kode</th>
                                                    <th className="px-3 py-2 text-[10px] font-black uppercase tracking-widest text-zinc-500 text-left">Kategori</th>
                                                    <th className="px-3 py-2 text-[10px] font-black uppercase tracking-widest text-zinc-500 text-left">Satuan</th>
                                                    <th className="px-3 py-2 text-[10px] font-black uppercase tracking-widest text-zinc-500 text-right">HPP</th>
                                                    <th className="px-3 py-2 text-[10px] font-black uppercase tracking-widest text-zinc-500 text-right">Harga Jual</th>
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
                                                            {row.code || <span className="text-zinc-300 italic">auto</span>}
                                                        </td>
                                                        <td className="px-3 py-2 text-zinc-600">
                                                            {row.categoryName || <span className="text-zinc-300">—</span>}
                                                        </td>
                                                        <td className="px-3 py-2">
                                                            {row.unit || "PCS"}
                                                        </td>
                                                        <td className="px-3 py-2 text-right tabular-nums">
                                                            {row.costPrice ? row.costPrice.toLocaleString("id-ID") : "0"}
                                                        </td>
                                                        <td className="px-3 py-2 text-right tabular-nums">
                                                            {row.sellingPrice ? row.sellingPrice.toLocaleString("id-ID") : "0"}
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
                                Mengimport {validRows.length} produk...
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
                                        {importResult.imported} produk berhasil diimport
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
                                                    {err}
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
                                        Mulai Import ({validRows.length} produk)
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
