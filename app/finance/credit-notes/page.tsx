"use client"

import { useState, useMemo } from "react"
import { FileText, Plus, Search, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
import { formatIDR } from "@/lib/utils"
import { toast } from "sonner"
import { useDCNotes } from "@/hooks/use-credit-debit-notes"
import { postDCNote, voidDCNote } from "@/lib/actions/finance-dcnotes"
import { useQueryClient } from "@tanstack/react-query"
import { queryKeys } from "@/lib/query-keys"
import { TablePageSkeleton } from "@/components/ui/page-skeleton"
import { CreateDCNoteDialog } from "@/components/finance/create-dcnote-dialog"
import { DCNoteSettlementDialog } from "@/components/finance/dcnote-settlement-dialog"

// ──────────────────────────────────────────
// Type & Reason Labels (Bahasa Indonesia)
// ──────────────────────────────────────────

const TYPE_LABELS: Record<string, string> = {
    SALES_CN: "NK Penjualan",
    SALES_DN: "ND Penjualan",
    PURCHASE_DN: "ND Pembelian",
    PURCHASE_CN: "NK Pembelian",
}

const TYPE_SHORT: Record<string, string> = {
    SALES_CN: "CN-S",
    SALES_DN: "DN-S",
    PURCHASE_DN: "DN-P",
    PURCHASE_CN: "CN-P",
}

const REASON_LABELS: Record<string, string> = {
    RET_DEFECT: "Barang Cacat/Rusak",
    RET_WRONG: "Barang Tidak Sesuai",
    RET_QUALITY: "Kualitas Tidak Standar",
    RET_EXCESS: "Kelebihan Kirim",
    RET_EXPIRED: "Barang Kadaluarsa",
    ADJ_OVERCHARGE: "Kelebihan Tagih",
    ADJ_DISCOUNT: "Diskon Belum Dipotong",
    ADJ_UNDERCHARGE: "Kekurangan Tagih",
    ADJ_ADDCHARGE: "Biaya Tambahan",
    SVC_CANCEL: "Pembatalan Jasa",
    SVC_SHORT: "Jasa Tidak Lengkap",
    ORD_CANCEL: "Pembatalan Pesanan",
    ADJ_PENALTY: "Penalti / Denda",
    ADJ_REBATE: "Potongan Volume",
    ADJ_GOODWILL: "Penyesuaian Goodwill",
}

const STATUS_LABELS: Record<string, string> = {
    DRAFT: "Draft",
    POSTED: "Diposting",
    PARTIAL: "Sebagian",
    APPLIED: "Diterapkan",
    VOID: "Batal",
    CANCELLED: "Dibatalkan",
}

type TabFilter = "all" | "cn" | "dn"

export default function CreditDebitNotesPage() {
    const { data: notes = [], isLoading } = useDCNotes()
    const queryClient = useQueryClient()

    // UI state
    const [createOpen, setCreateOpen] = useState(false)
    const [settlementNote, setSettlementNote] = useState<any>(null)
    const [tabFilter, setTabFilter] = useState<TabFilter>("all")
    const [search, setSearch] = useState("")
    const [statusFilter, setStatusFilter] = useState("all")
    const [actionLoading, setActionLoading] = useState<string | null>(null)

    // ──────── Filtering ────────
    const filtered = useMemo(() => {
        let result = [...notes]

        // Tab filter
        if (tabFilter === "cn") {
            result = result.filter(n => n.type === "SALES_CN" || n.type === "PURCHASE_CN")
        } else if (tabFilter === "dn") {
            result = result.filter(n => n.type === "SALES_DN" || n.type === "PURCHASE_DN")
        }

        // Status filter
        if (statusFilter !== "all") {
            result = result.filter(n => n.status === statusFilter)
        }

        // Search
        if (search.trim()) {
            const q = search.toLowerCase()
            result = result.filter(n =>
                n.number?.toLowerCase().includes(q) ||
                n.customer?.name?.toLowerCase().includes(q) ||
                n.supplier?.name?.toLowerCase().includes(q)
            )
        }

        return result
    }, [notes, tabFilter, statusFilter, search])

    // ──────── KPI Counts ────────
    const cnCount = notes.filter(n => n.type === "SALES_CN" || n.type === "PURCHASE_CN").length
    const dnCount = notes.filter(n => n.type === "SALES_DN" || n.type === "PURCHASE_DN").length
    const draftCount = notes.filter(n => n.status === "DRAFT").length
    const appliedCount = notes.filter(n => n.status === "APPLIED").length

    // ──────── Actions ────────
    const invalidateAll = () => {
        queryClient.invalidateQueries({ queryKey: queryKeys.dcNotes.all })
        queryClient.invalidateQueries({ queryKey: queryKeys.invoices.all })
        queryClient.invalidateQueries({ queryKey: queryKeys.journal.all })
        queryClient.invalidateQueries({ queryKey: queryKeys.bills.all })
    }

    const handlePost = async (id: string) => {
        setActionLoading(id)
        try {
            const result = await postDCNote(id)
            if (result.success) {
                toast.success("Nota berhasil diposting")
                invalidateAll()
            } else {
                toast.error(result.error || "Gagal memposting nota")
            }
        } catch {
            toast.error("Terjadi kesalahan")
        } finally {
            setActionLoading(null)
        }
    }

    const handleVoid = async (id: string) => {
        if (!confirm("Yakin ingin membatalkan nota ini? Jurnal dan settlement akan di-reverse.")) return
        setActionLoading(id)
        try {
            const result = await voidDCNote(id)
            if (result.success) {
                toast.success("Nota berhasil dibatalkan")
                invalidateAll()
            } else {
                toast.error(result.error || "Gagal membatalkan nota")
            }
        } catch {
            toast.error("Terjadi kesalahan")
        } finally {
            setActionLoading(null)
        }
    }

    // ──────── Helpers ────────
    const getPartyName = (note: any) => note.customer?.name || note.supplier?.name || "-"

    const isTypeCredit = (type: string) => type === "SALES_CN" || type === "PURCHASE_CN"

    const getTypeBadgeClass = (type: string) =>
        isTypeCredit(type)
            ? "bg-blue-50 border-blue-200 text-blue-700"
            : "bg-orange-50 border-orange-200 text-orange-700"

    const getStatusBadgeClass = (status: string) => {
        switch (status) {
            case "DRAFT": return "bg-zinc-100 border-zinc-300 text-zinc-600"
            case "POSTED": return "bg-blue-50 border-blue-200 text-blue-700"
            case "PARTIAL": return "bg-amber-50 border-amber-200 text-amber-700"
            case "APPLIED": return "bg-emerald-50 border-emerald-200 text-emerald-700"
            case "VOID": return "bg-red-50 border-red-200 text-red-600"
            case "CANCELLED": return "bg-red-50 border-red-200 text-red-600"
            default: return "bg-zinc-100 border-zinc-300 text-zinc-600"
        }
    }

    // ──────── Loading ────────
    if (isLoading) return <TablePageSkeleton accentColor="bg-violet-400" />

    return (
        <div className="mf-page">
            {/* ═══ HEADER ═══ */}
            <div className="border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] overflow-hidden bg-white dark:bg-zinc-900">
                <div className="px-6 py-4 flex items-center justify-between border-l-[6px] border-l-violet-400">
                    <div className="flex items-center gap-3">
                        <FileText className="h-5 w-5 text-violet-500" />
                        <div>
                            <h1 className="text-xl font-black uppercase tracking-tight text-zinc-900 dark:text-white">
                                Nota Kredit & Debit
                            </h1>
                            <p className="text-zinc-400 text-xs font-medium mt-0.5">
                                Kelola nota kredit, nota debit, dan retur
                            </p>
                        </div>
                    </div>
                    <Button
                        onClick={() => setCreateOpen(true)}
                        className="bg-black text-white hover:bg-zinc-800 border-2 border-black shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] active:translate-y-[1px] active:shadow-none transition-all text-[10px] font-black uppercase tracking-widest h-9 px-4"
                    >
                        <Plus className="mr-2 h-3.5 w-3.5" /> Buat Nota
                    </Button>
                </div>
            </div>

            {/* ═══ KPI STRIP ═══ */}
            <div className="bg-white dark:bg-zinc-900 border-2 border-black shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] overflow-hidden">
                <div className="grid grid-cols-2 md:grid-cols-4">
                    {/* Total CN */}
                    <div className="relative p-4 border-r-2 border-b-2 md:border-b-0 border-zinc-100">
                        <div className="absolute top-0 left-0 right-0 h-1 bg-blue-400" />
                        <div className="text-[10px] font-black uppercase tracking-widest text-zinc-500 mb-1">Total Nota Kredit</div>
                        <div className="text-2xl font-black text-blue-600">{cnCount}</div>
                    </div>
                    {/* Total DN */}
                    <div className="relative p-4 border-r-2 border-b-2 md:border-b-0 border-zinc-100">
                        <div className="absolute top-0 left-0 right-0 h-1 bg-orange-400" />
                        <div className="text-[10px] font-black uppercase tracking-widest text-zinc-500 mb-1">Total Nota Debit</div>
                        <div className="text-2xl font-black text-orange-600">{dnCount}</div>
                    </div>
                    {/* Draft */}
                    <div className="relative p-4 border-r-2 border-zinc-100">
                        <div className="absolute top-0 left-0 right-0 h-1 bg-zinc-300" />
                        <div className="text-[10px] font-black uppercase tracking-widest text-zinc-500 mb-1">Belum Diposting</div>
                        <div className="text-2xl font-black text-zinc-600">{draftCount}</div>
                    </div>
                    {/* Applied */}
                    <div className="relative p-4">
                        <div className="absolute top-0 left-0 right-0 h-1 bg-emerald-400" />
                        <div className="text-[10px] font-black uppercase tracking-widest text-zinc-500 mb-1">Sudah Diterapkan</div>
                        <div className="text-2xl font-black text-emerald-600">{appliedCount}</div>
                    </div>
                </div>
            </div>

            {/* ═══ FILTER BAR ═══ */}
            <div className="bg-white dark:bg-zinc-900 border-2 border-black shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] overflow-hidden">
                <div className="px-4 py-3 flex flex-col md:flex-row items-start md:items-center gap-3">
                    {/* Tab buttons */}
                    <div className="flex gap-1">
                        {([
                            { key: "all", label: "Semua" },
                            { key: "cn", label: "Nota Kredit" },
                            { key: "dn", label: "Nota Debit" },
                        ] as const).map(tab => (
                            <button
                                key={tab.key}
                                onClick={() => setTabFilter(tab.key)}
                                className={`px-3 py-1.5 text-[10px] font-black uppercase tracking-widest border-2 transition-all ${
                                    tabFilter === tab.key
                                        ? "border-black bg-black text-white"
                                        : "border-zinc-200 text-zinc-400 hover:border-zinc-400"
                                }`}
                            >
                                {tab.label}
                            </button>
                        ))}
                    </div>

                    {/* Search */}
                    <div className="relative flex-1 max-w-lg">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-zinc-400" />
                        <Input
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                            placeholder="Cari..."
                            className="pl-9 border-2 border-black h-9 rounded-none text-sm font-medium placeholder:text-zinc-300 placeholder:font-normal"
                        />
                        {search && (
                            <button onClick={() => setSearch("")} className="absolute right-3 top-1/2 -translate-y-1/2">
                                <X className="h-3.5 w-3.5 text-zinc-400" />
                            </button>
                        )}
                    </div>

                    {/* Status filter */}
                    <Select value={statusFilter} onValueChange={setStatusFilter}>
                        <SelectTrigger className="border-2 border-black h-9 font-bold rounded-none w-[160px] text-xs">
                            <SelectValue placeholder="Status" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">Semua Status</SelectItem>
                            <SelectItem value="DRAFT">Draft</SelectItem>
                            <SelectItem value="POSTED">Diposting</SelectItem>
                            <SelectItem value="PARTIAL">Sebagian</SelectItem>
                            <SelectItem value="APPLIED">Diterapkan</SelectItem>
                            <SelectItem value="VOID">Batal</SelectItem>
                        </SelectContent>
                    </Select>
                </div>
            </div>

            {/* ═══ TABLE ═══ */}
            <div className="bg-white dark:bg-zinc-900 border-2 border-black shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] overflow-hidden">
                <div className="px-4 py-3 border-b-2 border-black bg-zinc-50 flex items-center justify-between">
                    <span className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Daftar Nota</span>
                    <span className="text-[10px] font-black uppercase tracking-widest text-zinc-400">{filtered.length} nota</span>
                </div>

                {/* Table Header */}
                <div className="overflow-x-auto">
                    <div className="min-w-[900px]">
                        <div className="grid grid-cols-12 gap-2 px-4 py-2 border-b border-zinc-200 text-[10px] font-black uppercase tracking-widest text-zinc-500">
                            <div className="col-span-1">No</div>
                            <div className="col-span-1">Tipe</div>
                            <div className="col-span-1">Tanggal</div>
                            <div className="col-span-2">Pihak</div>
                            <div className="col-span-2">Alasan</div>
                            <div className="col-span-1 text-right">Jumlah</div>
                            <div className="col-span-1 text-right">PPN</div>
                            <div className="col-span-1 text-right">Total</div>
                            <div className="col-span-1">Status</div>
                            <div className="col-span-1 text-right">Aksi</div>
                        </div>

                        {/* Table Body */}
                        {filtered.length === 0 ? (
                            <div className="p-12 text-center">
                                <FileText className="h-8 w-8 mx-auto text-zinc-300 mb-2" />
                                <p className="text-[10px] font-black uppercase tracking-widest text-zinc-400">
                                    Belum ada nota kredit/debit
                                </p>
                            </div>
                        ) : (
                            filtered.map((note: any) => (
                                <div
                                    key={note.id}
                                    className="grid grid-cols-12 gap-2 px-4 py-3 border-b border-zinc-100 hover:bg-zinc-50/50 transition-colors items-center"
                                >
                                    {/* Number */}
                                    <div className="col-span-1">
                                        <span className="font-mono text-xs font-bold text-zinc-600">{note.number}</span>
                                    </div>

                                    {/* Type badge */}
                                    <div className="col-span-1">
                                        <span className={`inline-block text-[9px] font-black uppercase px-2 py-0.5 border rounded-sm ${getTypeBadgeClass(note.type)}`}>
                                            {TYPE_SHORT[note.type] || note.type}
                                        </span>
                                    </div>

                                    {/* Date */}
                                    <div className="col-span-1">
                                        <span className="text-xs text-zinc-500">
                                            {new Date(note.issueDate).toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric" })}
                                        </span>
                                    </div>

                                    {/* Party */}
                                    <div className="col-span-2">
                                        <p className="text-sm font-medium truncate">{getPartyName(note)}</p>
                                    </div>

                                    {/* Reason */}
                                    <div className="col-span-2">
                                        <p className="text-xs text-zinc-500 truncate">{REASON_LABELS[note.reasonCode] || note.reasonCode}</p>
                                    </div>

                                    {/* Subtotal */}
                                    <div className="col-span-1 text-right">
                                        <span className="font-mono text-xs font-bold text-zinc-700">{formatIDR(note.subtotal)}</span>
                                    </div>

                                    {/* PPN */}
                                    <div className="col-span-1 text-right">
                                        <span className="font-mono text-xs text-zinc-400">{note.ppnAmount > 0 ? formatIDR(note.ppnAmount) : "-"}</span>
                                    </div>

                                    {/* Total */}
                                    <div className="col-span-1 text-right">
                                        <span className={`font-mono text-xs font-bold ${isTypeCredit(note.type) ? "text-blue-600" : "text-orange-600"}`}>
                                            {formatIDR(note.totalAmount)}
                                        </span>
                                    </div>

                                    {/* Status */}
                                    <div className="col-span-1">
                                        <span className={`inline-block text-[9px] font-black uppercase px-2 py-0.5 border rounded-sm ${getStatusBadgeClass(note.status)}`}>
                                            {STATUS_LABELS[note.status] || note.status}
                                        </span>
                                    </div>

                                    {/* Actions */}
                                    <div className="col-span-1 flex items-center justify-end gap-1">
                                        {note.status === "DRAFT" && (
                                            <>
                                                <button
                                                    onClick={() => handlePost(note.id)}
                                                    disabled={actionLoading === note.id}
                                                    className="text-[9px] font-black uppercase tracking-wider px-2 py-1 border-2 border-blue-300 text-blue-700 bg-blue-50 hover:bg-blue-100 transition-colors disabled:opacity-40"
                                                >
                                                    Posting
                                                </button>
                                                <button
                                                    onClick={() => handleVoid(note.id)}
                                                    disabled={actionLoading === note.id}
                                                    className="text-[9px] font-black uppercase tracking-wider px-2 py-1 border-2 border-red-300 text-red-600 bg-red-50 hover:bg-red-100 transition-colors disabled:opacity-40"
                                                >
                                                    Void
                                                </button>
                                            </>
                                        )}
                                        {note.status === "POSTED" && (
                                            <>
                                                <button
                                                    onClick={() => setSettlementNote(note)}
                                                    className="text-[9px] font-black uppercase tracking-wider px-2 py-1 border-2 border-emerald-300 text-emerald-700 bg-emerald-50 hover:bg-emerald-100 transition-colors"
                                                >
                                                    Terapkan
                                                </button>
                                                <button
                                                    onClick={() => handleVoid(note.id)}
                                                    disabled={actionLoading === note.id}
                                                    className="text-[9px] font-black uppercase tracking-wider px-2 py-1 border-2 border-red-300 text-red-600 bg-red-50 hover:bg-red-100 transition-colors disabled:opacity-40"
                                                >
                                                    Void
                                                </button>
                                            </>
                                        )}
                                        {note.status === "PARTIAL" && (
                                            <button
                                                onClick={() => setSettlementNote(note)}
                                                className="text-[9px] font-black uppercase tracking-wider px-2 py-1 border-2 border-emerald-300 text-emerald-700 bg-emerald-50 hover:bg-emerald-100 transition-colors"
                                            >
                                                Terapkan
                                            </button>
                                        )}
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </div>
            </div>

            {/* ═══ DIALOGS ═══ */}
            <CreateDCNoteDialog open={createOpen} onOpenChange={setCreateOpen} />
            {settlementNote && (
                <DCNoteSettlementDialog
                    open={!!settlementNote}
                    onOpenChange={(open) => { if (!open) setSettlementNote(null) }}
                    note={settlementNote}
                />
            )}
        </div>
    )
}
