"use client"

import { useState } from "react"
import { useQueryClient } from "@tanstack/react-query"
import { queryKeys } from "@/lib/query-keys"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
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
    Wand2,
    CheckCircle2,
    XCircle,
    Link2,
    Unlink,
    Lock,
} from "lucide-react"
import { toast } from "sonner"
import { NB } from "@/lib/dialog-styles"
import type {
    ReconciliationSummary,
    ReconciliationDetail,
    ReconciliationItemData,
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
    onAutoMatch: (reconciliationId: string) => Promise<{ success: boolean; matched?: number; suggestions?: unknown[]; error?: string }>
    onMatchItem: (itemId: string, transactionId: string) => Promise<{ success: boolean; error?: string }>
    onUnmatchItem: (itemId: string) => Promise<{ success: boolean; error?: string }>
    onClose: (reconciliationId: string) => Promise<{ success: boolean; error?: string }>
    onLoadDetail: (reconciliationId: string, skip?: number, take?: number) => Promise<ReconciliationDetail | null>
}

// ==============================================================================
// Status helpers
// ==============================================================================

const STATUS_LABELS: Record<string, string> = {
    REC_DRAFT: 'Draft',
    REC_IN_PROGRESS: 'Dalam Proses',
    REC_COMPLETED: 'Selesai',
}

const STATUS_COLORS: Record<string, string> = {
    REC_DRAFT: 'bg-zinc-100 text-zinc-600',
    REC_IN_PROGRESS: 'bg-amber-100 text-amber-700',
    REC_COMPLETED: 'bg-emerald-100 text-emerald-700',
}

const MATCH_COLORS: Record<string, string> = {
    UNMATCHED: 'bg-red-100 text-red-700',
    MATCHED: 'bg-emerald-100 text-emerald-700',
    PARTIAL: 'bg-amber-100 text-amber-700',
    EXCLUDED: 'bg-zinc-100 text-zinc-500',
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
    onMatchItem,
    onUnmatchItem,
    onClose,
    onLoadDetail,
}: BankReconciliationViewProps) {
    const queryClient = useQueryClient()
    const [createOpen, setCreateOpen] = useState(false)
    const [loading, setLoading] = useState(false)
    const [selectedRec, setSelectedRec] = useState<ReconciliationDetail | null>(null)

    // Create form state
    const [newAccountId, setNewAccountId] = useState("")
    const [newStatementDate, setNewStatementDate] = useState("")
    const [newPeriodStart, setNewPeriodStart] = useState("")
    const [newPeriodEnd, setNewPeriodEnd] = useState("")

    // Pagination state
    const [loadingMore, setLoadingMore] = useState(false)

    // Suggestions state (from auto-match)
    const [suggestions, setSuggestions] = useState<{ bankItemId: string; matches: { transactionId: string; confidence: string; score: number; reason: string }[] }[]>([])

    // Import state
    const [importText, setImportText] = useState("")

    // Add bank state
    const [addBankOpen, setAddBankOpen] = useState(false)
    const [newBankCode, setNewBankCode] = useState("")
    const [newBankName, setNewBankName] = useState("")
    const [newBankBalance, setNewBankBalance] = useState("")
    const [newBankDesc, setNewBankDesc] = useState("")
    const [addingBank, setAddingBank] = useState(false)

    const formatIDR = (n: number) => n.toLocaleString('id-ID')
    const formatDate = (iso: string) => new Date(iso).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' })

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

    const handleImport = async () => {
        if (!selectedRec || !importText.trim()) return
        // Parse CSV: date,description,amount,reference
        const lines = importText.trim().split('\n').filter(Boolean)
        const rows = lines.map((line) => {
            const parts = line.split(',')
            return {
                date: parts[0]?.trim() || '',
                description: parts[1]?.trim() || '',
                amount: parseFloat(parts[2]?.trim() || '0'),
                reference: parts[3]?.trim(),
            }
        }).filter((r) => r.date && r.amount !== 0)

        if (rows.length === 0) {
            toast.error("Tidak ada data valid untuk diimpor")
            return
        }

        setLoading(true)
        try {
            const result = await onImportRows(selectedRec.id, rows)
            if (result.success) {
                toast.success(`${result.importedCount} baris berhasil diimpor`)
                setImportText("")
                queryClient.invalidateQueries({ queryKey: queryKeys.reconciliation.all })
                // Reload detail — fetch at least as many items as currently visible
                const reloadTake = Math.max(100, selectedRec.items.length)
                const detail = await onLoadDetail(selectedRec.id, 0, reloadTake)
                if (detail) setSelectedRec(detail)
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
                const sugArr = Array.isArray(result.suggestions) ? result.suggestions as typeof suggestions : []
                const sugCount = sugArr.length
                toast.success(`${result.matched ?? 0} item cocok otomatis${sugCount > 0 ? `, ${sugCount} saran tersedia` : ''}`)
                setSuggestions(sugArr)
                queryClient.invalidateQueries({ queryKey: queryKeys.reconciliation.all })
                const reloadTake = Math.max(100, selectedRec.items.length)
                const detail = await onLoadDetail(selectedRec.id, 0, reloadTake)
                if (detail) setSelectedRec(detail)
            } else {
                toast.error(result.error || "Gagal auto-match")
            }
        } catch {
            toast.error("Gagal melakukan auto-match")
        } finally {
            setLoading(false)
        }
    }

    const handleApplySuggestion = async (bankItemId: string, transactionId: string) => {
        try {
            const result = await onMatchItem(bankItemId, transactionId)
            if (result.error) {
                toast.error(result.error)
            } else {
                toast.success("Transaksi berhasil dicocokkan")
                setSuggestions(prev => prev.filter(s => s.bankItemId !== bankItemId))
                queryClient.invalidateQueries({ queryKey: queryKeys.reconciliation.all })
                // Reload detail to reflect the new match
                if (selectedRec) {
                    const reloadTake = Math.max(100, selectedRec.items.length)
                    const detail = await onLoadDetail(selectedRec.id, 0, reloadTake)
                    if (detail) setSelectedRec(detail)
                }
            }
        } catch {
            toast.error("Gagal mencocokkan transaksi")
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
        try {
            const detail = await onLoadDetail(rec.id, 0, 100)
            setSelectedRec(detail)
        } catch {
            toast.error("Gagal memuat detail rekonsiliasi")
        } finally {
            setLoading(false)
        }
    }

    const handleLoadMore = async () => {
        if (!selectedRec || !selectedRec.hasMore) return
        setLoadingMore(true)
        try {
            const more = await onLoadDetail(selectedRec.id, selectedRec.nextSkip, 100)
            if (more) {
                setSelectedRec({
                    ...more,
                    items: [...selectedRec.items, ...more.items],
                })
            }
        } catch {
            toast.error("Gagal memuat data berikutnya")
        } finally {
            setLoadingMore(false)
        }
    }

    return (
        <div className="space-y-4">
            {/* Header */}
            <div className="flex items-center justify-between gap-3 flex-wrap">
                <div className="flex items-center gap-2">
                    <Landmark className="h-5 w-5" />
                    <h2 className="text-sm font-black uppercase tracking-widest">Rekonsiliasi Bank</h2>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
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
                                    <Input className={NB.inputMono} placeholder="e.g. 1100" value={newBankCode} onChange={(e) => setNewBankCode(e.target.value)} />
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
                                    <Input className={NB.input} placeholder="e.g. Operasional, Gaji, Tabungan..." value={newBankDesc} onChange={(e) => setNewBankDesc(e.target.value)} />
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
                                        {addingBank ? 'Menyimpan...' : 'Simpan'}
                                    </Button>
                                </div>
                            </div>
                        </DialogContent>
                    </Dialog>
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
                                        {loading ? 'Membuat...' : 'Buat Rekonsiliasi'}
                                    </Button>
                                </div>
                            </div>
                        </DialogContent>
                    </Dialog>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                {/* Reconciliation list */}
                <div className="lg:col-span-1 space-y-2">
                    {reconciliations.length === 0 ? (
                        <div className="bg-white border-2 border-black p-8 text-center">
                            <Landmark className="h-8 w-8 mx-auto text-zinc-300 mb-2" />
                            <span className="text-[10px] font-black uppercase tracking-widest text-zinc-400">
                                Belum ada rekonsiliasi
                            </span>
                        </div>
                    ) : (
                        reconciliations.map((rec) => (
                            <button
                                key={rec.id}
                                className={`w-full text-left bg-white border-2 border-black p-3 hover:bg-zinc-50 transition-colors ${selectedRec?.id === rec.id ? 'bg-zinc-100 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]' : ''
                                    }`}
                                onClick={() => handleSelectRec(rec)}
                            >
                                <div className="flex items-center justify-between mb-1">
                                    <span className="text-xs font-black">{rec.glAccountName}</span>
                                    <span className={`text-[8px] font-black px-1.5 py-0.5 border border-black ${STATUS_COLORS[rec.status] || ''}`}>
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
                        ))
                    )}
                </div>

                {/* Detail panel */}
                <div className="lg:col-span-2">
                    {selectedRec ? (
                        <div className="bg-white border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
                            {/* Detail header */}
                            <div className="flex items-center justify-between px-4 py-2.5 border-b-2 border-black bg-zinc-50">
                                <div>
                                    <span className="text-xs font-black">{selectedRec.glAccountName}</span>
                                    <span className="text-[9px] text-zinc-400 font-mono ml-2">({selectedRec.glAccountCode})</span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <span className="text-[10px] font-bold text-zinc-400">
                                        Saldo buku: Rp {formatIDR(selectedRec.glAccountBalance)}
                                    </span>
                                </div>
                            </div>

                            {/* Actions bar */}
                            {selectedRec.status !== 'REC_COMPLETED' && (
                                <div className="px-4 py-2 border-b border-zinc-200 flex items-center gap-2 flex-wrap min-h-[44px]">
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

                            {/* Import section */}
                            {selectedRec.status !== 'REC_COMPLETED' && (
                                <div className="px-4 py-3 border-b border-zinc-200">
                                    <label className={NB.label}>
                                        <Upload className="h-3 w-3 inline mr-1" />
                                        Import CSV (tanggal,deskripsi,jumlah,referensi)
                                    </label>
                                    <div className="flex gap-2 mt-1">
                                        <Input
                                            className="border-2 border-black font-mono text-[10px] h-7 rounded-none flex-1"
                                            placeholder="2024-01-15,Transfer masuk,5000000,TRF001"
                                            value={importText}
                                            onChange={(e) => setImportText(e.target.value)}
                                        />
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            className="h-7 text-[9px] font-black uppercase border-2 border-black rounded-none"
                                            disabled={loading || !importText.trim()}
                                            onClick={handleImport}
                                        >
                                            Import
                                        </Button>
                                    </div>
                                </div>
                            )}

                            {/* Items table */}
                            <ScrollArea className="max-h-[60vh]">
                                {selectedRec.items.length === 0 ? (
                                    <div className="p-8 text-center">
                                        <Upload className="h-6 w-6 mx-auto text-zinc-300 mb-2" />
                                        <span className="text-[10px] font-black uppercase tracking-widest text-zinc-400">
                                            Import laporan bank untuk mulai
                                        </span>
                                    </div>
                                ) : (
                                    <>
                                        <table className="w-full text-xs">
                                            <thead>
                                                <tr className="bg-zinc-100 border-b-2 border-black">
                                                    <th className="text-[9px] font-black uppercase tracking-widest text-zinc-500 px-3 py-2 text-left">Tanggal</th>
                                                    <th className="text-[9px] font-black uppercase tracking-widest text-zinc-500 px-3 py-2 text-left">Deskripsi</th>
                                                    <th className="text-[9px] font-black uppercase tracking-widest text-zinc-500 px-3 py-2 text-right">Jumlah</th>
                                                    <th className="text-[9px] font-black uppercase tracking-widest text-zinc-500 px-3 py-2 text-center">Status</th>
                                                    <th className="text-[9px] font-black uppercase tracking-widest text-zinc-500 px-3 py-2 text-center">Aksi</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {selectedRec.items.map((item) => (
                                                    <ReconciliationRow
                                                        key={item.id}
                                                        item={item}
                                                        isCompleted={selectedRec.status === 'REC_COMPLETED'}
                                                        onMatch={onMatchItem}
                                                        onUnmatch={onUnmatchItem}
                                                    />
                                                ))}
                                            </tbody>
                                        </table>
                                        {selectedRec.hasMore && (
                                            <div className="flex justify-center py-3">
                                                <Button
                                                    variant="outline"
                                                    size="sm"
                                                    className="border border-dashed border-blue-300 text-blue-600 text-[10px] font-bold h-7 px-4 rounded-none"
                                                    disabled={loadingMore}
                                                    onClick={handleLoadMore}
                                                >
                                                    {loadingMore ? 'Memuat...' : 'Muat Lagi'}
                                                </Button>
                                            </div>
                                        )}
                                    </>
                                )}
                            </ScrollArea>

                            {/* Auto-match suggestions */}
                            {suggestions.length > 0 && (
                                <div className="border-t-2 border-black p-4 space-y-3">
                                    <div className="flex items-center justify-between">
                                        <span className="text-[10px] font-black uppercase tracking-widest text-zinc-500">
                                            Saran Pencocokan ({suggestions.length})
                                        </span>
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            onClick={() => setSuggestions([])}
                                            className="h-6 px-2 text-[9px] font-bold rounded-none border-2 border-black"
                                        >
                                            Tutup
                                        </Button>
                                    </div>
                                    {suggestions.map((s) => (
                                        <div key={s.bankItemId} className="border-2 border-zinc-200 p-3 space-y-2">
                                            <div className="text-xs font-bold text-zinc-700 mb-1">Bank Item: {s.bankItemId.slice(0, 8)}...</div>
                                            {s.matches.map((m) => (
                                                <div key={m.transactionId} className="flex items-center justify-between gap-2">
                                                    <div className="flex items-center gap-2 flex-1 min-w-0">
                                                        <span className={`inline-block px-1.5 py-0.5 text-[9px] font-black border rounded-none ${
                                                            m.confidence === "HIGH" ? "bg-emerald-100 text-emerald-800 border-emerald-300" :
                                                            m.confidence === "MEDIUM" ? "bg-amber-100 text-amber-800 border-amber-300" :
                                                            "bg-zinc-100 text-zinc-600 border-zinc-300"
                                                        }`}>
                                                            {m.confidence}
                                                        </span>
                                                        <span className="text-xs text-zinc-600 truncate">{m.reason}</span>
                                                    </div>
                                                    <Button
                                                        size="sm"
                                                        onClick={() => handleApplySuggestion(s.bankItemId, m.transactionId)}
                                                        className="h-6 px-2 text-[9px] font-bold rounded-none border-2 border-black bg-white hover:bg-zinc-50 shrink-0"
                                                    >
                                                        Terapkan
                                                    </Button>
                                                </div>
                                            ))}
                                        </div>
                                    ))}
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

function ReconciliationRow({
    item,
    isCompleted,
    onMatch,
    onUnmatch,
}: {
    item: ReconciliationItemData
    isCompleted: boolean
    onMatch: (itemId: string, transactionId: string) => Promise<{ success: boolean; error?: string }>
    onUnmatch: (itemId: string) => Promise<{ success: boolean; error?: string }>
}) {
    const queryClient = useQueryClient()
    const [matchInput, setMatchInput] = useState("")
    const [loading, setLoading] = useState(false)

    const formatIDR = (n: number) => n.toLocaleString('id-ID')

    const handleMatch = async () => {
        if (!matchInput.trim()) return
        setLoading(true)
        try {
            const result = await onMatch(item.id, matchInput.trim())
            if (result.success) {
                toast.success("Item berhasil dicocokkan")
                setMatchInput("")
                queryClient.invalidateQueries({ queryKey: queryKeys.reconciliation.all })
            } else {
                toast.error(result.error || "Gagal mencocokkan")
            }
        } catch {
            toast.error("Gagal mencocokkan item")
        } finally {
            setLoading(false)
        }
    }

    const handleUnmatch = async () => {
        setLoading(true)
        try {
            const result = await onUnmatch(item.id)
            if (result.success) {
                toast.success("Pencocokan dibatalkan")
                queryClient.invalidateQueries({ queryKey: queryKeys.reconciliation.all })
            } else {
                toast.error(result.error || "Gagal membatalkan pencocokan")
            }
        } catch {
            toast.error("Gagal membatalkan pencocokan")
        } finally {
            setLoading(false)
        }
    }

    return (
        <tr className="border-b border-zinc-100 hover:bg-zinc-50">
            <td className="px-3 py-2 font-mono text-[10px]">
                {item.bankDate ? new Date(item.bankDate).toLocaleDateString('id-ID') : '-'}
            </td>
            <td className="px-3 py-2">
                <div className="text-xs font-medium">{item.bankDescription || '-'}</div>
                {item.bankRef && (
                    <div className="text-[9px] text-zinc-400 font-mono">Ref: {item.bankRef}</div>
                )}
            </td>
            <td className={`px-3 py-2 text-right font-mono font-bold ${item.bankAmount >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                Rp {formatIDR(Math.abs(item.bankAmount))}
            </td>
            <td className="px-3 py-2 text-center">
                <span className={`text-[8px] font-black px-1.5 py-0.5 border ${MATCH_COLORS[item.matchStatus] || ''}`}>
                    {item.matchStatus === 'MATCHED' ? (
                        <span className="flex items-center gap-0.5 justify-center"><CheckCircle2 className="h-2.5 w-2.5" /> Cocok</span>
                    ) : item.matchStatus === 'UNMATCHED' ? (
                        <span className="flex items-center gap-0.5 justify-center"><XCircle className="h-2.5 w-2.5" /> Belum</span>
                    ) : (
                        item.matchStatus
                    )}
                </span>
            </td>
            <td className="px-3 py-2 text-center">
                {!isCompleted && (
                    item.matchStatus === 'MATCHED' ? (
                        <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 px-1.5 text-[8px]"
                            disabled={loading}
                            onClick={handleUnmatch}
                        >
                            <Unlink className="h-3 w-3" />
                        </Button>
                    ) : (
                        <div className="flex items-center justify-center gap-1">
                            <Input
                                className="border border-zinc-300 font-mono text-[9px] h-6 rounded-none w-20"
                                placeholder="ID Jurnal"
                                value={matchInput}
                                onChange={(e) => setMatchInput(e.target.value)}
                            />
                            <Button
                                variant="ghost"
                                size="sm"
                                className="h-6 px-1.5 text-[8px] shrink-0"
                                disabled={loading || !matchInput.trim()}
                                onClick={handleMatch}
                            >
                                <Link2 className="h-3 w-3" />
                            </Button>
                        </div>
                    )
                )}
            </td>
        </tr>
    )
}
