"use client"

import { useRef, useState, useCallback } from "react"
import * as XLSX from "xlsx"
import { Upload, FileSpreadsheet, AlertTriangle, CheckCircle2, X, Loader2 } from "lucide-react"
import { toast } from "sonner"
import { useQueryClient } from "@tanstack/react-query"

import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { NB } from "@/lib/dialog-styles"
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
function parseFileToRows(file: File): Promise<{ rows: ParsedRow[]; parseError?: string }> {
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
export function ImportProductsDialog() {
    const queryClient = useQueryClient()
    const fileInputRef = useRef<HTMLInputElement>(null)

    const [open, setOpen] = useState(false)
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
    const handleDownloadTemplate = useCallback(() => {
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
            {/* ── Trigger Button ── */}
            <Button
                variant="outline"
                onClick={() => setOpen(true)}
                className="border-2 border-black font-black uppercase text-xs tracking-wider rounded-none shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:translate-y-[2px] hover:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] transition-all bg-white text-black"
            >
                <Upload className="h-3.5 w-3.5 mr-1.5" />
                Import
            </Button>

            {/* ── Dialog ── */}
            <Dialog open={open} onOpenChange={handleOpenChange}>
                <DialogContent className={NB.contentWide}>
                    {/* Header */}
                    <DialogHeader className={NB.header}>
                        <DialogTitle className={NB.title}>
                            <FileSpreadsheet className="h-5 w-5 text-emerald-400" />
                            Import Produk
                        </DialogTitle>
                        <p className={NB.subtitle}>
                            Upload file Excel atau CSV untuk menambahkan banyak produk sekaligus
                        </p>
                    </DialogHeader>

                    <div className="p-6 space-y-5">

                        {/* ── Step: Idle / File picker ── */}
                        {(step === "idle" || step === "preview") && (
                            <div className="space-y-4">
                                {/* Drop zone */}
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
                                    <div className="flex items-start gap-2 border-2 border-red-500 bg-red-50 p-3">
                                        <AlertTriangle className="h-4 w-4 text-red-600 mt-0.5 shrink-0" />
                                        <p className="text-xs font-bold text-red-600">{parseError}</p>
                                    </div>
                                )}

                                {/* Column mapping guide */}
                                <div className={NB.section}>
                                    <div className={NB.sectionHead}>
                                        <span className={NB.sectionTitle}>Panduan Kolom</span>
                                    </div>
                                    <div className="overflow-x-auto">
                                        <table className="w-full text-xs">
                                            <thead>
                                                <tr className={NB.tableHead}>
                                                    <th className={NB.tableHeadCell + " text-left"}>Header Kolom</th>
                                                    <th className={NB.tableHeadCell + " text-left"}>Field</th>
                                                    <th className={NB.tableHeadCell + " text-left"}>Wajib?</th>
                                                    <th className={NB.tableHeadCell + " text-left"}>Keterangan</th>
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
                                                    <tr key={field} className={NB.tableRow}>
                                                        <td className={NB.tableCell + " font-mono text-emerald-700"}>{col}</td>
                                                        <td className={NB.tableCell + " text-zinc-500"}>{field}</td>
                                                        <td className={NB.tableCell}>
                                                            {req === "Ya"
                                                                ? <span className="text-red-600 font-black">Wajib</span>
                                                                : <span className="text-zinc-400">Opsional</span>}
                                                        </td>
                                                        <td className={NB.tableCell + " text-zinc-500"}>{note}</td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>

                                {/* Download template */}
                                <button
                                    onClick={handleDownloadTemplate}
                                    className="text-xs font-black text-emerald-700 underline underline-offset-2 hover:text-emerald-900"
                                >
                                    Download template Excel
                                </button>
                            </div>
                        )}

                        {/* ── Step: Preview ── */}
                        {step === "preview" && rows.length > 0 && (
                            <div className="space-y-4">
                                {/* Summary bar */}
                                <div className="flex items-center gap-3 flex-wrap">
                                    <div className="border-2 border-black bg-emerald-50 px-3 py-1.5 flex items-center gap-1.5">
                                        <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                                        <span className="text-xs font-black text-emerald-700">
                                            {validRows.length} baris siap diimport
                                        </span>
                                    </div>
                                    {errorRows.length > 0 && (
                                        <div className="border-2 border-red-500 bg-red-50 px-3 py-1.5 flex items-center gap-1.5">
                                            <AlertTriangle className="h-3.5 w-3.5 text-red-600" />
                                            <span className="text-xs font-black text-red-700">
                                                {errorRows.length} baris bermasalah (akan dilewati)
                                            </span>
                                        </div>
                                    )}
                                </div>

                                {/* Preview table */}
                                <div className={NB.section}>
                                    <div className={NB.sectionHead}>
                                        <span className={NB.sectionTitle}>Pratinjau Data — {fileName}</span>
                                    </div>
                                    <ScrollArea className="h-64">
                                        <div className="overflow-x-auto">
                                            <table className="w-full text-xs min-w-[700px]">
                                                <thead className="sticky top-0 z-10">
                                                    <tr className={NB.tableHead}>
                                                        <th className={NB.tableHeadCell + " text-left w-8"}>#</th>
                                                        <th className={NB.tableHeadCell + " text-left"}>Nama Produk</th>
                                                        <th className={NB.tableHeadCell + " text-left"}>Kode</th>
                                                        <th className={NB.tableHeadCell + " text-left"}>Kategori</th>
                                                        <th className={NB.tableHeadCell + " text-left"}>Satuan</th>
                                                        <th className={NB.tableHeadCell + " text-right"}>HPP</th>
                                                        <th className={NB.tableHeadCell + " text-right"}>Harga Jual</th>
                                                        <th className={NB.tableHeadCell + " text-left w-8"}></th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {rows.map((row) => (
                                                        <tr
                                                            key={row._rowIndex}
                                                            className={`${NB.tableRow} ${row._hasError ? "bg-red-50" : "hover:bg-zinc-50"}`}
                                                        >
                                                            <td className={NB.tableCell + " text-zinc-400"}>{row._rowIndex}</td>
                                                            <td className={NB.tableCell + " font-bold"}>
                                                                {row.name || <span className="text-red-500 italic">Kosong!</span>}
                                                            </td>
                                                            <td className={NB.tableCell + " font-mono text-zinc-500"}>
                                                                {row.code || <span className="text-zinc-300 italic">auto</span>}
                                                            </td>
                                                            <td className={NB.tableCell + " text-zinc-600"}>
                                                                {row.categoryName || <span className="text-zinc-300">—</span>}
                                                            </td>
                                                            <td className={NB.tableCell}>
                                                                {row.unit || "PCS"}
                                                            </td>
                                                            <td className={NB.tableCell + " text-right tabular-nums"}>
                                                                {row.costPrice ? row.costPrice.toLocaleString("id-ID") : "0"}
                                                            </td>
                                                            <td className={NB.tableCell + " text-right tabular-nums"}>
                                                                {row.sellingPrice ? row.sellingPrice.toLocaleString("id-ID") : "0"}
                                                            </td>
                                                            <td className={NB.tableCell}>
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
                                </div>

                                {/* Error list */}
                                {errorRows.length > 0 && (
                                    <div className="border-2 border-amber-400 bg-amber-50 p-3 space-y-1">
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
                            </div>
                        )}

                        {/* ── Step: Importing ── */}
                        {step === "importing" && (
                            <div className="py-8 flex flex-col items-center gap-4">
                                <Loader2 className="h-10 w-10 animate-spin text-emerald-500" />
                                <p className="text-sm font-black uppercase tracking-wider">
                                    Mengimport {validRows.length} produk...
                                </p>
                                {/* Progress bar */}
                                <div className="w-full border-2 border-black bg-zinc-100 h-3 overflow-hidden">
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
                            <div className="space-y-4">
                                {/* Result summary */}
                                <div className="border-2 border-black p-5 flex items-center gap-4 bg-zinc-50">
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

                                {/* Error details */}
                                {importResult.errors.length > 0 && (
                                    <div className={NB.section}>
                                        <div className={NB.sectionHead}>
                                            <AlertTriangle className="h-3.5 w-3.5 text-red-500" />
                                            <span className={NB.sectionTitle + " text-red-700"}>
                                                Detail Error ({importResult.errors.length})
                                            </span>
                                        </div>
                                        <ScrollArea className="h-40">
                                            <div className="p-3 space-y-1">
                                                {importResult.errors.map((err, i) => (
                                                    <p key={i} className="text-xs text-red-700 font-medium">
                                                        {err}
                                                    </p>
                                                ))}
                                            </div>
                                        </ScrollArea>
                                    </div>
                                )}
                            </div>
                        )}

                        {/* ── Footer actions ── */}
                        <div className={NB.footer}>
                            {step === "idle" || step === "preview" ? (
                                <>
                                    <Button
                                        variant="outline"
                                        onClick={() => handleOpenChange(false)}
                                        className={NB.cancelBtn}
                                    >
                                        Batal
                                    </Button>
                                    {step === "preview" && validRows.length > 0 && (
                                        <Button
                                            onClick={handleImport}
                                            className={NB.submitBtn + " bg-emerald-600 border-emerald-600 hover:bg-emerald-700"}
                                        >
                                            <Upload className="h-3.5 w-3.5 mr-1.5" />
                                            Mulai Import ({validRows.length} produk)
                                        </Button>
                                    )}
                                </>
                            ) : step === "done" ? (
                                <Button
                                    onClick={() => handleOpenChange(false)}
                                    className={NB.submitBtn}
                                >
                                    Selesai
                                </Button>
                            ) : null}
                        </div>
                    </div>
                </DialogContent>
            </Dialog>
        </>
    )
}
