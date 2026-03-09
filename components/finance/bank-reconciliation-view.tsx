"use client"

import { useState, useRef, useCallback } from "react"
import { useQueryClient } from "@tanstack/react-query"
import { queryKeys } from "@/lib/query-keys"
import * as XLSX from "xlsx"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Checkbox } from "@/components/ui/checkbox"
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
import { ScrollArea } from "@/components/ui/scroll-area"
import {
    Landmark,
    Plus,
    Upload,
    Download,
    Wand2,
    Lock,
    FileSpreadsheet,
    X,
} from "lucide-react"
import { toast } from "sonner"
import { NB } from "@/lib/dialog-styles"
import type {
    ReconciliationSummary,
    ReconciliationDetail,
    SystemEntryData,
} from "@/lib/actions/finance-reconciliation"
import { createBankAccount } from "@/lib/actions/finance-reconciliation"

// ==============================================================================
// Indonesian Banks
// ==============================================================================

const INDONESIAN_BANKS = [
    "Bank BCA",
    "Bank Mandiri",
    "Bank BNI",
    "Bank BRI",
    "Bank CIMB Niaga",
    "Bank Danamon",
    "Bank Permata",
    "Bank OCBC NISP",
    "Bank Mega",
    "Bank BTN",
    "Bank Panin",
    "Bank Maybank Indonesia",
    "Bank Sinarmas",
    "Bank BTPN",
    "Bank DBS Indonesia",
    "Bank UOB Indonesia",
    "Bank Jago",
    "Bank Digital BCA (Blu)",
    "Bank Syariah Indonesia (BSI)",
    "Bank Muamalat",
    "Jenius (Bank BTPN)",
]

// ==============================================================================
// Types
// ==============================================================================

interface BankAccount {
    id: string
    code: string
    name: string
    balance: number
}

interface BankReconciliationViewProps {
    reconciliations: ReconciliationSummary[]
    bankAccounts: BankAccount[]
    onCreateReconciliation: (data: {
        glAccountId: string
        statementDate: string
        periodStart: string
        periodEnd: string
    }) => Promise<{ success: boolean; reconciliationId?: string; error?: string }>
    onImportRows: (
        reconciliationId: string,
        rows: { date: string; description: string; amount: number; reference?: string }[]
    ) => Promise<{ success: boolean; importedCount?: number; error?: string }>
    onAutoMatch: (reconciliationId: string) => Promise<{ success: boolean; matchedCount?: number; error?: string }>
    onMatchItems: (data: { bankItemIds: string[]; systemEntryIds: string[] }) => Promise<{ success: boolean; error?: string }>
    onUnmatchItem: (itemId: string) => Promise<{ success: boolean; error?: string }>
    onClose: (reconciliationId: string) => Promise<{ success: boolean; error?: string }>
    onLoadDetail: (reconciliationId: string) => Promise<ReconciliationDetail | null>
}

// ==============================================================================
// Status helpers
// ==============================================================================

const STATUS_LABELS: Record<string, string> = {
    REC_DRAFT: "Draft",
    REC_IN_PROGRESS: "Dalam Proses",
    REC_COMPLETED: "Selesai",
}

const STATUS_COLORS: Record<string, string> = {
    REC_DRAFT: "bg-zinc-100 text-zinc-600",
    REC_IN_PROGRESS: "bg-amber-100 text-amber-700",
    REC_COMPLETED: "bg-emerald-100 text-emerald-700",
}

// ==============================================================================
// Helpers
// ==============================================================================

const formatIDR = (n: number) => n.toLocaleString("id-ID")
const formatDate = (iso: string) =>
    new Date(iso).toLocaleDateString("id-ID", {
        day: "2-digit",
        month: "short",
        year: "numeric",
    })

function detectColumns(headers: string[]): {
    dateIdx: number
    descIdx: number
    amountIdx: number
    refIdx: number
} {
    const lower = headers.map((h) => h.toLowerCase().trim())
    const dateIdx = lower.findIndex((h) => /tanggal|date/.test(h))
    const descIdx = lower.findIndex((h) => /deskripsi|description|keterangan/.test(h))
    const amountIdx = lower.findIndex((h) => /jumlah|amount|nominal/.test(h))
    const refIdx = lower.findIndex((h) => /referensi|reference|ref/.test(h))
    return {
        dateIdx: dateIdx >= 0 ? dateIdx : 0,
        descIdx: descIdx >= 0 ? descIdx : 1,
        amountIdx: amountIdx >= 0 ? amountIdx : 2,
        refIdx: refIdx >= 0 ? refIdx : 3,
    }
}

// ==============================================================================
// Component
// ==============================================================================

export function BankReconciliationView({
    reconciliations,
    bankAccounts,
    onCreateReconciliation,
    onImportRows,
    onAutoMatch,
    onMatchItems,
    onUnmatchItem,
    onClose,
    onLoadDetail,
}: BankReconciliationViewProps) {
    const queryClient = useQueryClient()
    const fileInputRef = useRef<HTMLInputElement>(null)

    // UI state
    const [loading, setLoading] = useState(false)
    const [createOpen, setCreateOpen] = useState(false)
    const [addBankOpen, setAddBankOpen] = useState(false)
    const [selectedRec, setSelectedRec] = useState<ReconciliationDetail | null>(null)
    const [dragging, setDragging] = useState(false)
    const [parsedRows, setParsedRows] = useState<
        { date: string; description: string; amount: number; reference?: string }[] | null
    >(null)

    // Create form state
    const [newAccountId, setNewAccountId] = useState("")
    const [newStatementDate, setNewStatementDate] = useState("")
    const [newPeriodStart, setNewPeriodStart] = useState("")
    const [newPeriodEnd, setNewPeriodEnd] = useState("")

    // Add bank state
    const [newBankCode, setNewBankCode] = useState("")
    const [newBankName, setNewBankName] = useState("")
    const [newBankBalance, setNewBankBalance] = useState("")
    const [newBankDesc, setNewBankDesc] = useState("")
    const [addingBank, setAddingBank] = useState(false)

    // Selection state
    const [selectedBankIds, setSelectedBankIds] = useState<Set<string>>(new Set())
    const [selectedSystemIds, setSelectedSystemIds] = useState<Set<string>>(new Set())

    // ── Derived data ──────────────────────────────────────────────────────────
    const unmatchedBankItems = selectedRec?.items.filter((i) => i.matchStatus !== "MATCHED") ?? []
    const matchedBankItems = selectedRec?.items.filter((i) => i.matchStatus === "MATCHED") ?? []
    const unmatchedSystemEntries: SystemEntryData[] =
        selectedRec?.systemEntries.filter((e) => e.alreadyMatchedItemId === null) ?? []

    const selectedBankTotal = unmatchedBankItems
        .filter((i) => selectedBankIds.has(i.id))
        .reduce((s, i) => s + i.bankAmount, 0)
    const selectedSystemTotal = unmatchedSystemEntries
        .filter((e) => selectedSystemIds.has(e.entryId))
        .reduce((s, e) => s + e.amount, 0)

    const hasSelection = selectedBankIds.size > 0 || selectedSystemIds.size > 0
    const totalsMatch =
        selectedBankIds.size > 0 &&
        selectedSystemIds.size > 0 &&
        Math.abs(selectedBankTotal - selectedSystemTotal) < 1

    const isCompleted = selectedRec?.status === "REC_COMPLETED"

    // ── File parsing ──────────────────────────────────────────────────────────
    const parseFile = useCallback(async (file: File) => {
        const ext = file.name.split(".").pop()?.toLowerCase()
        try {
            if (ext === "csv") {
                const text = await file.text()
                const lines = text.trim().split("\n").filter(Boolean)
                if (lines.length < 2) {
                    toast.error("File CSV kosong atau hanya berisi header")
                    return
                }
                const headers = lines[0].split(",")
                const { dateIdx, descIdx, amountIdx, refIdx } = detectColumns(headers)
                const rows = lines.slice(1).map((line) => {
                    const parts = line.split(",").map((p) => p.trim())
                    return {
                        date: parts[dateIdx] || "",
                        description: parts[descIdx] || "",
                        amount: parseFloat(parts[amountIdx] || "0"),
                        reference: parts[refIdx] || undefined,
                    }
                }).filter((r) => r.date && r.amount !== 0)
                setParsedRows(rows)
            } else if (ext === "xlsx" || ext === "xls") {
                const buf = await file.arrayBuffer()
                const wb = XLSX.read(buf, { type: "array" })
                const ws = wb.Sheets[wb.SheetNames[0]]
                const json = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, { header: 1 }) as unknown as unknown[][]
                if (json.length < 2) {
                    toast.error("File Excel kosong atau hanya berisi header")
                    return
                }
                const headers = (json[0] as unknown[]).map(String)
                const { dateIdx, descIdx, amountIdx, refIdx } = detectColumns(headers)
                const rows = json.slice(1).map((row) => {
                    const arr = row as unknown[]
                    return {
                        date: String(arr[dateIdx] || ""),
                        description: String(arr[descIdx] || ""),
                        amount: parseFloat(String(arr[amountIdx] || "0")),
                        reference: arr[refIdx] ? String(arr[refIdx]) : undefined,
                    }
                }).filter((r) => r.date && r.amount !== 0)
                setParsedRows(rows)
            } else {
                toast.error("Format file tidak didukung. Gunakan .csv atau .xlsx")
            }
        } catch {
            toast.error("Gagal membaca file")
        }
    }, [])

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (file) parseFile(file)
        e.target.value = ""
    }

    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault()
        setDragging(true)
    }
    const handleDragLeave = () => setDragging(false)
    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault()
        setDragging(false)
        const file = e.dataTransfer.files[0]
        if (file) parseFile(file)
    }

    const downloadTemplateCSV = () => {
        const header = "TANGGAL,DESKRIPSI,JUMLAH,REFERENSI"
        const example1 = "2024-01-15,Transfer masuk,5000000,TRF001"
        const example2 = "2024-01-16,Bayar supplier,-2500000,INV-2024-001"
        const example3 = "2024-01-17,Pendapatan jasa,3750000,REF002"
        const csv = [header, example1, example2, example3].join("\n")
        const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" })
        const url = URL.createObjectURL(blob)
        const a = document.createElement("a")
        a.href = url
        a.download = "template-rekonsiliasi-bank.csv"
        a.click()
        URL.revokeObjectURL(url)
    }

    // ── Handlers ──────────────────────────────────────────────────────────────
    const reloadDetail = async (recId: string) => {
        const detail = await onLoadDetail(recId)
        if (detail) setSelectedRec(detail)
        queryClient.invalidateQueries({ queryKey: queryKeys.reconciliation.all })
    }

    const handleCreate = async () => {
        if (!newAccountId || !newStatementDate || !newPeriodStart || !newPeriodEnd) {
            toast.error("Semua field wajib diisi")
            return
        }
        setLoading(true)
        try {
            const result = await onCreateReconciliation({
                glAccountId: newAccountId,
                statementDate: newStatementDate,
                periodStart: newPeriodStart,
                periodEnd: newPeriodEnd,
            })
            if (result.success) {
                toast.success("Rekonsiliasi berhasil dibuat")
                setCreateOpen(false)
                setNewAccountId("")
                setNewStatementDate("")
                setNewPeriodStart("")
                setNewPeriodEnd("")
                queryClient.invalidateQueries({ queryKey: queryKeys.reconciliation.all })
            } else {
                toast.error(result.error || "Gagal membuat rekonsiliasi")
            }
        } catch {
            toast.error("Gagal membuat rekonsiliasi")
        } finally {
            setLoading(false)
        }
    }

    const handleImportParsed = async () => {
        if (!selectedRec || !parsedRows || parsedRows.length === 0) return
        setLoading(true)
        try {
            const result = await onImportRows(selectedRec.id, parsedRows)
            if (result.success) {
                toast.success(`${result.importedCount} baris berhasil diimpor`)
                setParsedRows(null)
                await reloadDetail(selectedRec.id)
            } else {
                toast.error(result.error || "Gagal mengimpor")
            }
        } catch {
            toast.error("Gagal mengimpor data")
        } finally {
            setLoading(false)
        }
    }

    const handleAutoMatch = async () => {
        if (!selectedRec) return
        setLoading(true)
        try {
            const result = await onAutoMatch(selectedRec.id)
            if (result.success) {
                toast.success(`${result.matchedCount} item berhasil dicocokkan otomatis`)
                setSelectedBankIds(new Set())
                setSelectedSystemIds(new Set())
                await reloadDetail(selectedRec.id)
            } else {
                toast.error(result.error || "Gagal auto-match")
            }
        } catch {
            toast.error("Gagal melakukan auto-match")
        } finally {
            setLoading(false)
        }
    }

    const handleMatchSelected = async () => {
        if (selectedBankIds.size === 0 || selectedSystemIds.size === 0) {
            toast.error("Pilih minimal 1 item bank dan 1 jurnal sistem")
            return
        }
        setLoading(true)
        try {
            const result = await onMatchItems({
                bankItemIds: Array.from(selectedBankIds),
                systemEntryIds: Array.from(selectedSystemIds),
            })
            if (result.success) {
                toast.success("Item berhasil dicocokkan")
                setSelectedBankIds(new Set())
                setSelectedSystemIds(new Set())
                await reloadDetail(selectedRec!.id)
            } else {
                toast.error(result.error || "Gagal mencocokkan")
            }
        } catch {
            toast.error("Gagal mencocokkan item")
        } finally {
            setLoading(false)
        }
    }

    const handleUnmatch = async (itemId: string) => {
        setLoading(true)
        try {
            const result = await onUnmatchItem(itemId)
            if (result.success) {
                toast.success("Pencocokan dibatalkan")
                await reloadDetail(selectedRec!.id)
            } else {
                toast.error(result.error || "Gagal membatalkan pencocokan")
            }
        } catch {
            toast.error("Gagal membatalkan pencocokan")
        } finally {
            setLoading(false)
        }
    }

    const handleClose = async () => {
        if (!selectedRec) return
        const confirmed = window.confirm("Tutup rekonsiliasi ini? Setelah ditutup, tidak bisa diubah lagi.")
        if (!confirmed) return
        setLoading(true)
        try {
            const result = await onClose(selectedRec.id)
            if (result.success) {
                toast.success("Rekonsiliasi ditutup")
                setSelectedRec(null)
                queryClient.invalidateQueries({ queryKey: queryKeys.reconciliation.all })
            } else {
                toast.error(result.error || "Gagal menutup")
            }
        } catch {
            toast.error("Gagal menutup rekonsiliasi")
        } finally {
            setLoading(false)
        }
    }

    const handleSelectRec = async (rec: ReconciliationSummary) => {
        setLoading(true)
        setSelectedBankIds(new Set())
        setSelectedSystemIds(new Set())
        setParsedRows(null)
        try {
            const detail = await onLoadDetail(rec.id)
            setSelectedRec(detail)
        } catch {
            toast.error("Gagal memuat detail rekonsiliasi")
        } finally {
            setLoading(false)
        }
    }

    // ── Toggle helpers ────────────────────────────────────────────────────────
    const toggleBankId = (id: string) => {
        setSelectedBankIds((prev) => {
            const next = new Set(prev)
            if (next.has(id)) next.delete(id)
            else next.add(id)
            return next
        })
    }

    const toggleSystemId = (id: string) => {
        setSelectedSystemIds((prev) => {
            const next = new Set(prev)
            if (next.has(id)) next.delete(id)
            else next.add(id)
            return next
        })
    }

    // ── Render ────────────────────────────────────────────────────────────────
    return (
        <div className="space-y-4">
            {/* Header */}
            <div className="flex items-center justify-between gap-3 flex-wrap">
                <div className="flex items-center gap-2">
                    <Landmark className="h-5 w-5" />
                    <h2 className="text-sm font-black uppercase tracking-widest">Rekonsiliasi Bank</h2>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                    {/* Tambah Bank Dialog */}
                    <Dialog open={addBankOpen} onOpenChange={setAddBankOpen}>
                        <DialogTrigger asChild>
                            <Button variant="outline" className="border-2 border-black text-[10px] font-black uppercase tracking-widest h-9 px-3 rounded-none">
                                <Landmark className="h-3.5 w-3.5 mr-1" /> Tambah Bank
                            </Button>
                        </DialogTrigger>
                        <DialogContent className={NB.contentNarrow}>
                            <DialogHeader className={NB.header}>
                                <DialogTitle className={NB.title}>
                                    <Landmark className="h-5 w-5" /> Tambah Akun Bank
                                </DialogTitle>
                            </DialogHeader>
                            <div className="p-6 space-y-4">
                                <div>
                                    <label className={NB.label}>Kode Akun <span className={NB.labelRequired}>*</span></label>
                                    <Input className={NB.inputMono} placeholder="1100" value={newBankCode} onChange={(e) => setNewBankCode(e.target.value)} />
                                </div>
                                <div>
                                    <label className={NB.label}>Nama Bank <span className={NB.labelRequired}>*</span></label>
                                    <Select value={newBankName} onValueChange={setNewBankName}>
                                        <SelectTrigger className={NB.select}>
                                            <SelectValue placeholder="Pilih bank..." />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {INDONESIAN_BANKS.map((bank) => (
                                                <SelectItem key={bank} value={bank}>{bank}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div>
                                    <label className={NB.label}>Keterangan (opsional)</label>
                                    <Input className={NB.input} placeholder="Operasional..." value={newBankDesc} onChange={(e) => setNewBankDesc(e.target.value)} />
                                </div>
                                <div>
                                    <label className={NB.label}>Saldo Awal (Rp)</label>
                                    <Input className={NB.inputMono} type="number" placeholder="0" value={newBankBalance} onChange={(e) => setNewBankBalance(e.target.value)} />
                                </div>
                                <div className={NB.footer}>
                                    <Button variant="outline" className={NB.cancelBtn} onClick={() => setAddBankOpen(false)}>Batal</Button>
                                    <Button className={NB.submitBtn} disabled={addingBank} onClick={async () => {
                                        if (!newBankCode.trim() || !newBankName.trim()) {
                                            toast.error("Kode dan nama bank wajib diisi")
                                            return
                                        }
                                        setAddingBank(true)
                                        try {
                                            const fullName = newBankDesc.trim()
                                                ? `${newBankName} — ${newBankDesc.trim()}`
                                                : newBankName
                                            const result = await createBankAccount({
                                                code: newBankCode.trim(),
                                                name: fullName,
                                                initialBalance: Number(newBankBalance) || 0,
                                            })
                                            if (result.success) {
                                                toast.success("Akun bank berhasil dibuat")
                                                setAddBankOpen(false)
                                                setNewBankCode("")
                                                setNewBankName("")
                                                setNewBankDesc("")
                                                setNewBankBalance("")
                                                queryClient.invalidateQueries({ queryKey: queryKeys.reconciliation.all })
                                            } else {
                                                toast.error(result.error || "Gagal membuat akun bank")
                                            }
                                        } catch {
                                            toast.error("Terjadi kesalahan")
                                        } finally {
                                            setAddingBank(false)
                                        }
                                    }}>
                                        {addingBank ? "Menyimpan..." : "Simpan"}
                                    </Button>
                                </div>
                            </div>
                        </DialogContent>
                    </Dialog>

                    {/* Rekonsiliasi Baru Dialog */}
                    <Dialog open={createOpen} onOpenChange={setCreateOpen}>
                        <DialogTrigger asChild>
                            <Button className={NB.triggerBtn}>
                                <Plus className="h-4 w-4 mr-1" /> Rekonsiliasi Baru
                            </Button>
                        </DialogTrigger>
                        <DialogContent className={NB.contentNarrow}>
                            <DialogHeader className={NB.header}>
                                <DialogTitle className={NB.title}>
                                    <Landmark className="h-5 w-5" /> Rekonsiliasi Baru
                                </DialogTitle>
                            </DialogHeader>
                            <div className="p-6 space-y-4">
                                <div>
                                    <label className={NB.label}>Akun Bank <span className={NB.labelRequired}>*</span></label>
                                    <Select value={newAccountId} onValueChange={setNewAccountId}>
                                        <SelectTrigger className={NB.select}>
                                            <SelectValue placeholder="Pilih akun bank" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {bankAccounts.map((a) => (
                                                <SelectItem key={a.id} value={a.id}>
                                                    {a.code} — {a.name}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div>
                                    <label className={NB.label}>Tanggal Statement <span className={NB.labelRequired}>*</span></label>
                                    <Input className={NB.input} type="date" value={newStatementDate} onChange={(e) => setNewStatementDate(e.target.value)} />
                                </div>
                                <div className="grid grid-cols-2 gap-3">
                                    <div>
                                        <label className={NB.label}>Periode Awal <span className={NB.labelRequired}>*</span></label>
                                        <Input className={NB.input} type="date" value={newPeriodStart} onChange={(e) => setNewPeriodStart(e.target.value)} />
                                    </div>
                                    <div>
                                        <label className={NB.label}>Periode Akhir <span className={NB.labelRequired}>*</span></label>
                                        <Input className={NB.input} type="date" value={newPeriodEnd} onChange={(e) => setNewPeriodEnd(e.target.value)} />
                                    </div>
                                </div>
                                <div className={NB.footer}>
                                    <Button variant="outline" className={NB.cancelBtn} onClick={() => setCreateOpen(false)}>Batal</Button>
                                    <Button className={NB.submitBtn} disabled={loading} onClick={handleCreate}>
                                        {loading ? "Membuat..." : "Buat Rekonsiliasi"}
                                    </Button>
                                </div>
                            </div>
                        </DialogContent>
                    </Dialog>
                </div>
            </div>

            {/* Main layout: sidebar + detail */}
            <div className="flex gap-4">
                {/* ── Sidebar: reconciliation list ─────────────────────────────── */}
                <div className="w-72 shrink-0 space-y-2">
                    {reconciliations.length === 0 ? (
                        <div className="bg-white border-2 border-black p-8 text-center">
                            <Landmark className="h-8 w-8 mx-auto text-zinc-300 mb-2" />
                            <span className="text-[10px] font-black uppercase tracking-widest text-zinc-400">
                                Belum ada rekonsiliasi
                            </span>
                        </div>
                    ) : (
                        <ScrollArea className="max-h-[80vh]">
                            <div className="space-y-2 pr-2">
                                {reconciliations.map((rec) => (
                                    <button
                                        key={rec.id}
                                        className={`w-full text-left bg-white border-2 border-black p-3 hover:bg-zinc-50 transition-colors ${
                                            selectedRec?.id === rec.id
                                                ? "bg-zinc-100 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]"
                                                : ""
                                        }`}
                                        onClick={() => handleSelectRec(rec)}
                                    >
                                        <div className="flex items-center justify-between mb-1">
                                            <span className="text-xs font-black truncate">{rec.glAccountName}</span>
                                            <span
                                                className={`text-[8px] font-black px-1.5 py-0.5 border border-black shrink-0 ml-1 ${
                                                    STATUS_COLORS[rec.status] || ""
                                                }`}
                                            >
                                                {STATUS_LABELS[rec.status] || rec.status}
                                            </span>
                                        </div>
                                        <div className="text-[9px] text-zinc-400 font-bold">
                                            {formatDate(rec.periodStart)} — {formatDate(rec.periodEnd)}
                                        </div>
                                        <div className="flex items-center gap-2 mt-1 text-[9px] font-bold">
                                            <span className="text-emerald-600">{rec.matchedCount} cocok</span>
                                            <span className="text-red-500">{rec.unmatchedCount} belum</span>
                                        </div>
                                    </button>
                                ))}
                            </div>
                        </ScrollArea>
                    )}
                </div>

                {/* ── Detail panel ─────────────────────────────────────────────── */}
                <div className="flex-1 min-w-0">
                    {selectedRec ? (
                        <div className="bg-white border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
                            {/* Account header */}
                            <div className="flex items-center justify-between px-4 py-2.5 border-b-2 border-black bg-zinc-50">
                                <div>
                                    <span className="text-xs font-black">{selectedRec.glAccountName}</span>
                                    <span className="text-[9px] text-zinc-400 font-mono ml-2">
                                        ({selectedRec.glAccountCode})
                                    </span>
                                </div>
                                <div className="text-[10px] font-bold text-zinc-400">
                                    Saldo: <span className="font-mono">Rp {formatIDR(selectedRec.glAccountBalance)}</span>
                                </div>
                            </div>

                            {/* Action bar */}
                            {!isCompleted && (
                                <div className="px-4 py-2 border-b border-zinc-200 flex items-center gap-2 flex-wrap">
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        className="h-7 text-[9px] font-black uppercase border-2 border-black rounded-none gap-1"
                                        disabled={loading}
                                        onClick={handleAutoMatch}
                                    >
                                        <Wand2 className="h-3 w-3" /> Auto-Match
                                    </Button>
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        className="h-7 text-[9px] font-black uppercase border-2 border-black rounded-none gap-1"
                                        disabled={loading}
                                        onClick={handleClose}
                                    >
                                        <Lock className="h-3 w-3" /> Tutup Rekonsiliasi
                                    </Button>
                                </div>
                            )}

                            {/* File upload zone */}
                            {!isCompleted && (
                                <div className="px-4 py-3 border-b border-zinc-200">
                                    {parsedRows ? (
                                        /* Preview of parsed rows */
                                        <div className="border-2 border-dashed border-emerald-400 bg-emerald-50 p-3">
                                            <div className="flex items-center justify-between mb-2">
                                                <span className="text-[10px] font-black uppercase tracking-widest text-emerald-700">
                                                    <FileSpreadsheet className="h-3.5 w-3.5 inline mr-1" />
                                                    {parsedRows.length} baris siap diimpor
                                                </span>
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    className="h-6 w-6 p-0"
                                                    onClick={() => setParsedRows(null)}
                                                >
                                                    <X className="h-3.5 w-3.5" />
                                                </Button>
                                            </div>
                                            <div className="max-h-24 overflow-y-auto text-[9px] font-mono text-zinc-600 space-y-0.5 mb-2">
                                                {parsedRows.slice(0, 5).map((r, i) => (
                                                    <div key={i}>
                                                        {r.date} | {r.description} | Rp {formatIDR(r.amount)}
                                                        {r.reference ? ` | ${r.reference}` : ""}
                                                    </div>
                                                ))}
                                                {parsedRows.length > 5 && (
                                                    <div className="text-zinc-400">...dan {parsedRows.length - 5} baris lainnya</div>
                                                )}
                                            </div>
                                            <Button
                                                className={NB.submitBtn + " w-full"}
                                                disabled={loading}
                                                onClick={handleImportParsed}
                                            >
                                                {loading ? "Mengimpor..." : `Import ${parsedRows.length} Baris`}
                                            </Button>
                                        </div>
                                    ) : (
                                        /* Drop zone */
                                        <div
                                            className={`border-2 border-dashed p-4 text-center cursor-pointer transition-colors ${
                                                dragging
                                                    ? "border-blue-500 bg-blue-50"
                                                    : "border-zinc-300 hover:border-zinc-400 hover:bg-zinc-50"
                                            }`}
                                            onClick={() => fileInputRef.current?.click()}
                                            onDragOver={handleDragOver}
                                            onDragLeave={handleDragLeave}
                                            onDrop={handleDrop}
                                        >
                                            <input
                                                ref={fileInputRef}
                                                type="file"
                                                accept=".csv,.xlsx,.xls"
                                                className="hidden"
                                                onChange={handleFileChange}
                                            />
                                            <Upload className="h-5 w-5 mx-auto text-zinc-400 mb-1" />
                                            <div className="text-[10px] font-black uppercase tracking-widest text-zinc-500">
                                                Seret file atau klik untuk upload
                                            </div>
                                            <div className="text-[9px] text-zinc-400 mt-0.5">CSV atau Excel (.xlsx)</div>
                                        </div>
                                    )}
                                    <div className="flex justify-end mt-1.5">
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            className="h-6 text-[9px] font-black uppercase tracking-widest text-blue-600 hover:text-blue-800 hover:bg-blue-50 gap-1 px-2"
                                            onClick={downloadTemplateCSV}
                                        >
                                            <Download className="h-3 w-3" /> Download Template CSV
                                        </Button>
                                    </div>
                                </div>
                            )}

                            {/* Side-by-side panels */}
                            <ScrollArea className="max-h-[50vh]">
                                <div className="grid grid-cols-2 divide-x-2 divide-black">
                                    {/* Left: LAPORAN BANK */}
                                    <div>
                                        <div className="bg-zinc-100 px-3 py-2 border-b-2 border-black">
                                            <span className="text-[10px] font-black uppercase tracking-widest text-zinc-600">
                                                Laporan Bank ({unmatchedBankItems.length})
                                            </span>
                                        </div>
                                        {unmatchedBankItems.length === 0 ? (
                                            <div className="p-6 text-center">
                                                <span className="text-[10px] font-bold text-zinc-400">
                                                    Tidak ada item belum dicocokkan
                                                </span>
                                            </div>
                                        ) : (
                                            <div className="divide-y divide-zinc-100">
                                                {unmatchedBankItems.map((item) => {
                                                    const isSelected = selectedBankIds.has(item.id)
                                                    return (
                                                        <div
                                                            key={item.id}
                                                            className={`flex items-start gap-2 px-3 py-2 cursor-pointer transition-colors ${
                                                                isSelected ? "bg-blue-50" : "hover:bg-zinc-50"
                                                            }`}
                                                            onClick={() => !isCompleted && toggleBankId(item.id)}
                                                        >
                                                            {!isCompleted && (
                                                                <Checkbox
                                                                    checked={isSelected}
                                                                    onCheckedChange={() => toggleBankId(item.id)}
                                                                    className="mt-0.5 border-2 border-black rounded-none"
                                                                />
                                                            )}
                                                            <div className="flex-1 min-w-0">
                                                                <div className="flex items-center justify-between gap-1">
                                                                    <span className="text-[9px] font-mono text-zinc-400">
                                                                        {item.bankDate
                                                                            ? formatDate(item.bankDate)
                                                                            : "-"}
                                                                    </span>
                                                                    <span
                                                                        className={`text-xs font-mono font-bold shrink-0 ${
                                                                            item.bankAmount >= 0
                                                                                ? "text-emerald-600"
                                                                                : "text-red-600"
                                                                        }`}
                                                                    >
                                                                        Rp {formatIDR(Math.abs(item.bankAmount))}
                                                                    </span>
                                                                </div>
                                                                <div className="text-xs font-medium truncate">
                                                                    {item.bankDescription || "-"}
                                                                </div>
                                                                {item.bankRef && (
                                                                    <div className="text-[9px] text-zinc-400 font-mono truncate">
                                                                        Ref: {item.bankRef}
                                                                    </div>
                                                                )}
                                                            </div>
                                                        </div>
                                                    )
                                                })}
                                            </div>
                                        )}
                                    </div>

                                    {/* Right: JURNAL SISTEM */}
                                    <div>
                                        <div className="bg-zinc-100 px-3 py-2 border-b-2 border-black">
                                            <span className="text-[10px] font-black uppercase tracking-widest text-zinc-600">
                                                Jurnal Sistem ({unmatchedSystemEntries.length})
                                            </span>
                                        </div>
                                        {unmatchedSystemEntries.length === 0 ? (
                                            <div className="p-6 text-center">
                                                <span className="text-[10px] font-bold text-zinc-400">
                                                    Tidak ada jurnal belum dicocokkan
                                                </span>
                                            </div>
                                        ) : (
                                            <div className="divide-y divide-zinc-100">
                                                {unmatchedSystemEntries.map((entry) => {
                                                    const isSelected = selectedSystemIds.has(entry.entryId)
                                                    return (
                                                        <div
                                                            key={entry.entryId}
                                                            className={`flex items-start gap-2 px-3 py-2 cursor-pointer transition-colors ${
                                                                isSelected ? "bg-blue-50" : "hover:bg-zinc-50"
                                                            }`}
                                                            onClick={() => !isCompleted && toggleSystemId(entry.entryId)}
                                                        >
                                                            {!isCompleted && (
                                                                <Checkbox
                                                                    checked={isSelected}
                                                                    onCheckedChange={() => toggleSystemId(entry.entryId)}
                                                                    className="mt-0.5 border-2 border-black rounded-none"
                                                                />
                                                            )}
                                                            <div className="flex-1 min-w-0">
                                                                <div className="flex items-center justify-between gap-1">
                                                                    <span className="text-[9px] font-mono text-zinc-400">
                                                                        {formatDate(entry.date)}
                                                                    </span>
                                                                    <span
                                                                        className={`text-xs font-mono font-bold shrink-0 ${
                                                                            entry.amount >= 0
                                                                                ? "text-emerald-600"
                                                                                : "text-red-600"
                                                                        }`}
                                                                    >
                                                                        Rp {formatIDR(Math.abs(entry.amount))}
                                                                    </span>
                                                                </div>
                                                                <div className="text-xs font-medium truncate">
                                                                    {entry.lineDescription || entry.description || "-"}
                                                                </div>
                                                                {entry.reference && (
                                                                    <div className="text-[9px] text-zinc-400 font-mono truncate">
                                                                        Ref: {entry.reference}
                                                                    </div>
                                                                )}
                                                            </div>
                                                        </div>
                                                    )
                                                })}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </ScrollArea>

                            {/* Match action bar */}
                            {hasSelection && !isCompleted && (
                                <div className="px-4 py-2.5 border-t-2 border-black bg-zinc-50 flex items-center justify-between gap-3 flex-wrap">
                                    <div className="flex items-center gap-3 text-[10px] font-bold">
                                        <span>
                                            Bank:{" "}
                                            <span className="font-mono">
                                                Rp {formatIDR(Math.abs(selectedBankTotal))}
                                            </span>
                                        </span>
                                        <span className="text-zinc-300">|</span>
                                        <span>
                                            Sistem:{" "}
                                            <span className="font-mono">
                                                Rp {formatIDR(Math.abs(selectedSystemTotal))}
                                            </span>
                                        </span>
                                        {selectedBankIds.size > 0 && selectedSystemIds.size > 0 && !totalsMatch && (
                                            <span className="text-amber-600 font-black uppercase text-[9px]">
                                                Total tidak cocok!
                                            </span>
                                        )}
                                    </div>
                                    <Button
                                        className={NB.submitBtn}
                                        disabled={loading || selectedBankIds.size === 0 || selectedSystemIds.size === 0}
                                        onClick={handleMatchSelected}
                                    >
                                        {loading ? "Mencocokkan..." : "Cocokkan Terpilih"}
                                    </Button>
                                </div>
                            )}

                            {/* Matched pairs section */}
                            {matchedBankItems.length > 0 && (
                                <div className="border-t-2 border-black">
                                    <div className="bg-emerald-50 px-4 py-2 border-b border-emerald-200">
                                        <span className="text-[10px] font-black uppercase tracking-widest text-emerald-700">
                                            Sudah Dicocokkan ({matchedBankItems.length} pasang)
                                        </span>
                                    </div>
                                    <div className="divide-y divide-emerald-100 bg-emerald-50/50">
                                        {matchedBankItems.map((item) => {
                                            const matchedEntry = selectedRec?.systemEntries.find(
                                                (e) => e.alreadyMatchedItemId === item.id
                                            )
                                            return (
                                                <div
                                                    key={item.id}
                                                    className="flex items-center justify-between px-4 py-2 gap-3"
                                                >
                                                    <div className="flex-1 min-w-0">
                                                        <div className="flex items-center gap-2">
                                                            <span className="text-xs font-medium truncate">
                                                                {item.bankDescription || "-"}
                                                            </span>
                                                            <span
                                                                className={`text-xs font-mono font-bold shrink-0 ${
                                                                    item.bankAmount >= 0
                                                                        ? "text-emerald-600"
                                                                        : "text-red-600"
                                                                }`}
                                                            >
                                                                Rp {formatIDR(Math.abs(item.bankAmount))}
                                                            </span>
                                                        </div>
                                                        {matchedEntry && (
                                                            <div className="text-[9px] text-zinc-500 truncate">
                                                                Jurnal: {matchedEntry.lineDescription || matchedEntry.description}
                                                                {matchedEntry.reference ? ` (${matchedEntry.reference})` : ""}
                                                            </div>
                                                        )}
                                                        {!matchedEntry && item.systemDescription && (
                                                            <div className="text-[9px] text-zinc-500 truncate">
                                                                Jurnal: {item.systemDescription}
                                                            </div>
                                                        )}
                                                    </div>
                                                    {!isCompleted && (
                                                        <Button
                                                            variant="outline"
                                                            size="sm"
                                                            className="h-6 text-[9px] font-black uppercase border border-black rounded-none px-2 shrink-0"
                                                            disabled={loading}
                                                            onClick={() => handleUnmatch(item.id)}
                                                        >
                                                            Batalkan
                                                        </Button>
                                                    )}
                                                </div>
                                            )
                                        })}
                                    </div>
                                </div>
                            )}
                        </div>
                    ) : (
                        <div className="bg-white border-2 border-black p-12 text-center">
                            <Landmark className="h-10 w-10 mx-auto text-zinc-200 mb-3" />
                            <span className="text-[10px] font-black uppercase tracking-widest text-zinc-400">
                                Pilih rekonsiliasi untuk melihat detail
                            </span>
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}
