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
    onMatchItem: (itemId: string, transactionId: string) => Promise<{ success: boolean; error?: string }>
    onUnmatchItem: (itemId: string) => Promise<{ success: boolean; error?: string }>
    onClose: (reconciliationId: string) => Promise<{ success: boolean; error?: string }>
    onLoadDetail: (reconciliationId: string) => Promise<ReconciliationDetail | null>
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

    // Import state
    const [importText, setImportText] = useState("")

    const formatIDR = (n: number) => n.toLocaleString('id-ID')
    const formatDate = (iso: string) => new Date(iso).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' })

    const handleCreate = async () => {
        if (!newAccountId || !newStatementDate || !newPeriodStart || !newPeriodEnd) {
            toast.error("Semua field wajib diisi")
            return
        }
        setLoading(true)
        const result = await onCreateReconciliation({
            glAccountId: newAccountId,
            statementDate: newStatementDate,
            periodStart: newPeriodStart,
            periodEnd: newPeriodEnd,
        })
        setLoading(false)
        if (result.success) {
            toast.success("Rekonsiliasi berhasil dibuat")
            setCreateOpen(false)
            queryClient.invalidateQueries({ queryKey: queryKeys.reconciliation.all })
        } else {
            toast.error(result.error || "Gagal membuat rekonsiliasi")
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
        const result = await onImportRows(selectedRec.id, rows)
        setLoading(false)
        if (result.success) {
            toast.success(`${result.importedCount} baris berhasil diimpor`)
            setImportText("")
            queryClient.invalidateQueries({ queryKey: queryKeys.reconciliation.all })
            // Reload detail
            const detail = await onLoadDetail(selectedRec.id)
            if (detail) setSelectedRec(detail)
        } else {
            toast.error(result.error || "Gagal mengimpor")
        }
    }

    const handleAutoMatch = async () => {
        if (!selectedRec) return
        setLoading(true)
        const result = await onAutoMatch(selectedRec.id)
        setLoading(false)
        if (result.success) {
            toast.success(`${result.matchedCount} item berhasil dicocokkan otomatis`)
            queryClient.invalidateQueries({ queryKey: queryKeys.reconciliation.all })
            const detail = await onLoadDetail(selectedRec.id)
            if (detail) setSelectedRec(detail)
        } else {
            toast.error(result.error || "Gagal auto-match")
        }
    }

    const handleClose = async () => {
        if (!selectedRec) return
        setLoading(true)
        const result = await onClose(selectedRec.id)
        setLoading(false)
        if (result.success) {
            toast.success("Rekonsiliasi ditutup")
            setSelectedRec(null)
            queryClient.invalidateQueries({ queryKey: queryKeys.reconciliation.all })
        } else {
            toast.error(result.error || "Gagal menutup")
        }
    }

    const handleSelectRec = async (rec: ReconciliationSummary) => {
        setLoading(true)
        const detail = await onLoadDetail(rec.id)
        setLoading(false)
        setSelectedRec(detail)
    }

    return (
        <div className="space-y-4">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <Landmark className="h-5 w-5" />
                    <h2 className="text-sm font-black uppercase tracking-widest">Rekonsiliasi Bank</h2>
                </div>
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

            <div className="grid grid-cols-3 gap-4">
                {/* Reconciliation list */}
                <div className="col-span-1 space-y-2">
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
                                className={`w-full text-left bg-white border-2 border-black p-3 hover:bg-zinc-50 transition-colors ${
                                    selectedRec?.id === rec.id ? 'bg-zinc-100 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]' : ''
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
                <div className="col-span-2">
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
                                )}
                            </ScrollArea>
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
        const result = await onMatch(item.id, matchInput.trim())
        setLoading(false)
        if (result.success) {
            toast.success("Item berhasil dicocokkan")
            setMatchInput("")
            queryClient.invalidateQueries({ queryKey: queryKeys.reconciliation.all })
        } else {
            toast.error(result.error || "Gagal")
        }
    }

    const handleUnmatch = async () => {
        setLoading(true)
        const result = await onUnmatch(item.id)
        setLoading(false)
        if (result.success) {
            toast.success("Pencocokan dibatalkan")
            queryClient.invalidateQueries({ queryKey: queryKeys.reconciliation.all })
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
                        <div className="flex items-center gap-1">
                            <Input
                                className="border border-zinc-300 font-mono text-[9px] h-6 rounded-none w-20"
                                placeholder="ID Jurnal"
                                value={matchInput}
                                onChange={(e) => setMatchInput(e.target.value)}
                            />
                            <Button
                                variant="ghost"
                                size="sm"
                                className="h-6 px-1.5 text-[8px]"
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
