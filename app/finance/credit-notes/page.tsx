"use client"

import { useState, useMemo, useEffect } from "react"
import {
    FileText,
    Plus,
    Search,
    X,
    Download,
    Filter,
    RotateCcw,
    ChevronLeft,
    ChevronRight,
    Eye,
    EyeOff,
} from "lucide-react"
import { motion, AnimatePresence } from "framer-motion"
import Link from "next/link"

import { Button } from "@/components/ui/button"
import { CheckboxFilter } from "@/components/ui/checkbox-filter"
import { formatIDR } from "@/lib/utils"
import { toast } from "sonner"
import { useDCNotes } from "@/hooks/use-credit-debit-notes"
import { postDCNote, voidDCNote, fixCNPartialInvoices } from "@/lib/actions/finance-dcnotes"
import { useQueryClient } from "@tanstack/react-query"
import { queryKeys } from "@/lib/query-keys"
import { TablePageSkeleton } from "@/components/ui/page-skeleton"
import { CreateDCNoteDialog } from "@/components/finance/create-dcnote-dialog"
import { DCNoteSettlementDialog } from "@/components/finance/dcnote-settlement-dialog"
import { NB } from "@/lib/dialog-styles"
import { exportToExcel } from "@/lib/table-export"

/* ─── Animation variants ─── */
const stagger = {
    hidden: { opacity: 0 },
    show: { opacity: 1, transition: { staggerChildren: 0.07 } },
}
const fadeUp = {
    hidden: { opacity: 0, y: 14 },
    show: { opacity: 1, y: 0, transition: { type: "spring" as const, stiffness: 320, damping: 26 } },
}
const fadeX = {
    hidden: { opacity: 0, x: -12 },
    show: { opacity: 1, x: 0, transition: { type: "spring" as const, stiffness: 320, damping: 26 } },
}

// ──────────────────────────────────────────
// Type & Reason Labels (Bahasa Indonesia)
// ──────────────────────────────────────────

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

const PAGE_SIZE = 15

export default function CreditDebitNotesPage() {
    const { data: notes = [], isLoading } = useDCNotes()
    const queryClient = useQueryClient()

    // UI state
    const [createOpen, setCreateOpen] = useState(false)
    const [settlementNote, setSettlementNote] = useState<any>(null)
    const [search, setSearch] = useState("")
    const [selectedTypes, setSelectedTypes] = useState<string[]>([])
    const [selectedStatuses, setSelectedStatuses] = useState<string[]>([])
    const [actionLoading, setActionLoading] = useState<string | null>(null)
    const [showAmounts, setShowAmounts] = useState(false)
    const [page, setPage] = useState(1)

    // ──────── Filtering ────────
    const filtered = useMemo(() => {
        let result = [...notes]

        // Type filter (checkbox)
        if (selectedTypes.length > 0) {
            result = result.filter(n => selectedTypes.includes(n.type))
        }

        // Status filter (checkbox)
        if (selectedStatuses.length > 0) {
            result = result.filter(n => selectedStatuses.includes(n.status))
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
    }, [notes, selectedTypes, selectedStatuses, search])

    const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
    const pagedNotes = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

    useEffect(() => { setPage(1) }, [selectedTypes, selectedStatuses, search])

    // ──────── KPI Counts ────────
    const cnCount = notes.filter(n => n.type === "SALES_CN" || n.type === "PURCHASE_CN").length
    const dnCount = notes.filter(n => n.type === "SALES_DN" || n.type === "PURCHASE_DN").length
    const draftCount = notes.filter(n => n.status === "DRAFT").length
    const appliedCount = notes.filter(n => n.status === "APPLIED").length

    const cnAmount = useMemo(() => notes.filter(n => n.type === "SALES_CN" || n.type === "PURCHASE_CN").reduce((s, n) => s + (Number(n.totalAmount) || 0), 0), [notes])
    const dnAmount = useMemo(() => notes.filter(n => n.type === "SALES_DN" || n.type === "PURCHASE_DN").reduce((s, n) => s + (Number(n.totalAmount) || 0), 0), [notes])

    // ──────── Actions ────────
    const invalidateAll = async () => {
        // Primary — refetch immediately
        await queryClient.invalidateQueries({ queryKey: queryKeys.dcNotes.all })
        // Secondary — mark stale, refetch on next access
        queryClient.invalidateQueries({ queryKey: queryKeys.invoices.all, refetchType: 'none' })
        queryClient.invalidateQueries({ queryKey: queryKeys.journal.all, refetchType: 'none' })
        queryClient.invalidateQueries({ queryKey: queryKeys.bills.all, refetchType: 'none' })
        queryClient.invalidateQueries({ queryKey: queryKeys.financeDashboard.all, refetchType: 'none' })
        queryClient.invalidateQueries({ queryKey: queryKeys.financeReports.all, refetchType: 'none' })
        queryClient.invalidateQueries({ queryKey: queryKeys.accountTransactions.all, refetchType: 'none' })
        queryClient.invalidateQueries({ queryKey: queryKeys.chartAccounts.all, refetchType: 'none' })
    }

    const handlePost = async (id: string) => {
        setActionLoading(id)
        try {
            const result = await postDCNote(id)
            if (result.success) {
                toast.success("Nota berhasil diposting")
                await invalidateAll()
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
                await invalidateAll()
            } else {
                toast.error(result.error || "Gagal membatalkan nota")
            }
        } catch {
            toast.error("Terjadi kesalahan")
        } finally {
            setActionLoading(null)
        }
    }

    const resetFilters = () => {
        setSearch("")
        setSelectedTypes([])
        setSelectedStatuses([])
    }

    const hasActiveFilters = selectedTypes.length > 0 || selectedStatuses.length > 0 || search.trim().length > 0

    // ──────── Helpers ────────
    const getPartyName = (note: any) => note.customer?.name || note.supplier?.name || "-"
    const isTypeCredit = (type: string) => type === "SALES_CN" || type === "PURCHASE_CN"

    const statusConfig: Record<string, { label: string; bg: string; text: string; dot: string }> = {
        DRAFT: { label: "Draft", bg: "bg-zinc-100 border-zinc-300", text: "text-zinc-700", dot: "bg-zinc-400" },
        POSTED: { label: "Diposting", bg: "bg-blue-50 border-blue-300", text: "text-blue-700", dot: "bg-blue-500" },
        PARTIAL: { label: "Sebagian", bg: "bg-amber-50 border-amber-300", text: "text-amber-700", dot: "bg-amber-500" },
        APPLIED: { label: "Diterapkan", bg: "bg-emerald-50 border-emerald-300", text: "text-emerald-700", dot: "bg-emerald-500" },
        VOID: { label: "Batal", bg: "bg-red-50 border-red-300", text: "text-red-600", dot: "bg-red-500" },
        CANCELLED: { label: "Dibatalkan", bg: "bg-red-50 border-red-300", text: "text-red-600", dot: "bg-red-500" },
    }

    // ──────── Loading ────────
    if (isLoading) return <TablePageSkeleton accentColor="bg-orange-400" />

    return (
        <motion.div
            className="mf-page"
            variants={stagger}
            initial="hidden"
            animate="show"
        >
            {/* ─── Unified Page Header Card ─── */}
            <motion.div
                variants={fadeUp}
                className={NB.pageCard}
            >
                {/* Orange accent bar */}
                <div className={NB.pageAccent} />

                {/* Row 1: Title + Toolbar Actions */}
                <div className={`px-5 py-3.5 flex items-center justify-between ${NB.pageRowBorder}`}>
                    <div className="flex items-center gap-3">
                        <div className="w-9 h-9 bg-orange-500 flex items-center justify-center">
                            <FileText className="h-4.5 w-4.5 text-white" />
                        </div>
                        <div>
                            <h1 className="text-base font-black uppercase tracking-wider text-zinc-900 dark:text-white">
                                Nota Kredit & Debit
                            </h1>
                            <p className="text-zinc-400 text-[11px] font-medium">
                                Kelola nota kredit, nota debit, dan retur
                            </p>
                        </div>
                    </div>
                    <div className="flex items-center gap-0">
                        <Button
                            onClick={() => {
                                const cols = [
                                    { header: "No. Nota", accessorKey: "number" },
                                    { header: "Tipe", accessorKey: "type" },
                                    { header: "Pihak", accessorKey: "_partyName" },
                                    { header: "Alasan", accessorKey: "reasonCode" },
                                    { header: "Subtotal", accessorKey: "subtotal" },
                                    { header: "PPN", accessorKey: "ppnAmount" },
                                    { header: "Total", accessorKey: "totalAmount" },
                                    { header: "Status", accessorKey: "status" },
                                ]
                                const rows = filtered.map(n => ({ ...n, _partyName: getPartyName(n) }))
                                exportToExcel(cols, rows as unknown as Record<string, unknown>[], { filename: "nota-kredit-debit" })
                            }}
                            variant="outline"
                            className={`${NB.toolbarBtn} ${NB.toolbarBtnJoin}`}
                        >
                            <Download className="h-3.5 w-3.5 mr-1.5" /> Export
                        </Button>
                        <Button
                            onClick={() => setCreateOpen(true)}
                            className={NB.toolbarBtnPrimary}
                        >
                            <Plus className="h-3.5 w-3.5 mr-1.5" /> Buat Nota
                        </Button>
                    </div>
                </div>

                {/* Row 2: KPI Summary Strip */}
                <div className={`flex items-center divide-x divide-zinc-200 dark:divide-zinc-800 ${NB.pageRowBorder}`}>
                    {[
                        { label: "Nota Kredit", count: cnCount, amount: cnAmount, color: "blue" },
                        { label: "Nota Debit", count: dnCount, amount: dnAmount, color: "orange" },
                        { label: "Draft", count: draftCount, amount: null, color: "zinc" },
                        { label: "Diterapkan", count: appliedCount, amount: null, color: "emerald" },
                    ].map((kpi) => (
                        <div
                            key={kpi.label}
                            className={NB.kpiCell}
                        >
                            <div className="flex items-center gap-1.5">
                                <span className={`w-2 h-2 ${
                                    kpi.color === "blue" ? "bg-blue-500" :
                                    kpi.color === "orange" ? "bg-orange-500" :
                                    kpi.color === "zinc" ? "bg-zinc-400" : "bg-emerald-500"
                                }`} />
                                <span className={NB.kpiLabel}>{kpi.label}</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <motion.span
                                    key={kpi.count}
                                    initial={{ scale: 0.8, opacity: 0 }}
                                    animate={{ scale: 1, opacity: 1 }}
                                    transition={{ type: "spring" as const, stiffness: 400, damping: 20 }}
                                    className={NB.kpiCount}
                                >
                                    {kpi.count}
                                </motion.span>
                                {kpi.amount !== null && kpi.amount > 0 && (
                                    <AnimatePresence>
                                        {showAmounts && (
                                            <motion.span
                                                initial={{ opacity: 0, x: -8 }}
                                                animate={{ opacity: 1, x: 0 }}
                                                exit={{ opacity: 0, x: -8 }}
                                                transition={{ type: "spring" as const, stiffness: 300, damping: 25 }}
                                                className={NB.kpiAmount}
                                            >
                                                {formatIDR(kpi.amount)}
                                            </motion.span>
                                        )}
                                    </AnimatePresence>
                                )}
                                {kpi.amount !== null && (
                                    <button
                                        onClick={() => setShowAmounts(!showAmounts)}
                                        className="p-0.5 text-zinc-300 hover:text-zinc-500 dark:text-zinc-600 dark:hover:text-zinc-400 transition-colors"
                                        title={showAmounts ? "Sembunyikan nominal" : "Tampilkan nominal"}
                                    >
                                        {showAmounts ? <Eye className="h-3 w-3" /> : <EyeOff className="h-3 w-3" />}
                                    </button>
                                )}
                            </div>
                        </div>
                    ))}
                </div>

                {/* Row 3: Filter Toolbar */}
                <div className={NB.filterBar}>
                    {/* Left: Search + Filters joined */}
                    <div className="flex items-center gap-0">
                        {/* Search input */}
                        <div className="relative">
                            <Search className={`pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 z-10 transition-colors ${search ? NB.inputIconActive : NB.inputIconEmpty}`} />
                            <input
                                className={`${NB.filterInput} w-[280px] border-r-0 ${search ? NB.inputActive : NB.inputEmpty}`}
                                placeholder="Cari nota, customer, vendor..."
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                            />
                            {search && (
                                <button
                                    onClick={() => setSearch("")}
                                    className="absolute right-2 top-1/2 -translate-y-1/2 h-4 w-4 flex items-center justify-center text-zinc-400 hover:text-zinc-600 transition-colors z-10"
                                >
                                    <X className="h-3 w-3" />
                                </button>
                            )}
                        </div>
                        {/* Type filter */}
                        <CheckboxFilter
                            label="Tipe"
                            hideLabel
                            triggerClassName={NB.filterDropdown}
                            triggerActiveClassName={`flex items-center gap-2 border border-orange-400 dark:border-orange-500 border-r-0 h-9 px-3 bg-orange-50/50 dark:bg-orange-950/20 text-xs font-medium min-w-[120px] justify-between transition-all rounded-none`}
                            options={[
                                { value: "SALES_CN", label: "NK Penjualan" },
                                { value: "PURCHASE_CN", label: "NK Pembelian" },
                                { value: "SALES_DN", label: "ND Penjualan" },
                                { value: "PURCHASE_DN", label: "ND Pembelian" },
                            ]}
                            selected={selectedTypes}
                            onChange={setSelectedTypes}
                        />
                        {/* Status filter */}
                        <CheckboxFilter
                            label="Status"
                            hideLabel
                            triggerClassName={NB.filterDropdown}
                            triggerActiveClassName={`flex items-center gap-2 border border-orange-400 dark:border-orange-500 border-r-0 h-9 px-3 bg-orange-50/50 dark:bg-orange-950/20 text-xs font-medium min-w-[120px] justify-between transition-all rounded-none`}
                            options={[
                                { value: "DRAFT", label: "Draft" },
                                { value: "POSTED", label: "Diposting" },
                                { value: "PARTIAL", label: "Sebagian" },
                                { value: "APPLIED", label: "Diterapkan" },
                                { value: "VOID", label: "Batal" },
                            ]}
                            selected={selectedStatuses}
                            onChange={setSelectedStatuses}
                        />
                        {/* Apply */}
                        <Button variant="outline" className={NB.toolbarBtn}>
                            <Filter className="h-3.5 w-3.5 mr-1.5" /> Terapkan
                        </Button>
                        {/* Reset — only when filters active */}
                        {hasActiveFilters && (
                            <Button variant="ghost" onClick={resetFilters} className="text-zinc-400 text-[10px] font-bold uppercase h-9 px-3 rounded-none hover:text-zinc-700 dark:hover:text-zinc-200 ml-1.5">
                                <RotateCcw className="h-3 w-3 mr-1" /> Reset
                            </Button>
                        )}
                    </div>
                    {/* Right: Count */}
                    <span className="hidden md:inline text-[11px] font-medium text-zinc-400">
                        <span className="font-mono font-bold text-zinc-600 dark:text-zinc-300">{filtered.length}</span> nota
                    </span>
                </div>
            </motion.div>

            {/* ─── Nota Table ─── */}
            <motion.div
                variants={fadeUp}
                className="border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] bg-white dark:bg-zinc-900 overflow-hidden flex flex-col"
                style={{ minHeight: 480 }}
            >
                {/* Table Header */}
                <div className="hidden md:grid grid-cols-[1fr_80px_100px_1fr_120px_1fr_110px_90px_100px_100px_120px] gap-2 px-5 py-2.5 bg-black dark:bg-zinc-950 border-b-2 border-black">
                    {["No. Nota", "Tipe", "Tanggal", "Pihak", "Invoice", "Alasan", "Subtotal", "PPN", "Total", "Status", "Aksi"].map((h) => (
                        <span key={h} className="text-[10px] font-black uppercase tracking-widest text-zinc-400">{h}</span>
                    ))}
                </div>

                {/* Table Body */}
                <div className="w-full flex-1 flex flex-col">
                    {pagedNotes.length === 0 ? (
                        <motion.div
                            initial={{ opacity: 0, scale: 0.9 }}
                            animate={{ opacity: 1, scale: 1 }}
                            transition={{ type: "spring" as const, stiffness: 300, damping: 25 }}
                            className="flex-1 flex flex-col items-center justify-center py-16 text-zinc-400"
                        >
                            <div className="w-16 h-16 border-2 border-zinc-200 dark:border-zinc-700 flex items-center justify-center mb-4">
                                <FileText className="h-7 w-7 text-zinc-200 dark:text-zinc-700" />
                            </div>
                            <span className="text-sm font-bold">Belum ada nota kredit/debit</span>
                            <span className="text-xs text-zinc-400 mt-1">Coba ubah filter atau buat nota baru</span>
                        </motion.div>
                    ) : (
                        <div className="divide-y divide-zinc-100 dark:divide-zinc-800">
                            {pagedNotes.map((note: any, idx: number) => {
                                const cfg = statusConfig[note.status] || statusConfig.DRAFT
                                const isDraft = note.status === "DRAFT"
                                const isPosted = note.status === "POSTED"
                                const isPartial = note.status === "PARTIAL"
                                const credit = isTypeCredit(note.type)

                                return (
                                    <motion.div
                                        key={note.id}
                                        custom={idx}
                                        variants={fadeX}
                                        initial="hidden"
                                        animate="show"
                                        transition={{ delay: idx * 0.03 }}
                                        className={`grid grid-cols-1 md:grid-cols-[1fr_80px_100px_1fr_120px_1fr_110px_90px_100px_100px_120px] gap-2 px-5 py-3 items-center transition-all hover:bg-orange-50/50 dark:hover:bg-orange-950/10 ${idx % 2 === 0 ? "bg-white dark:bg-zinc-900" : "bg-zinc-50/60 dark:bg-zinc-800/20"}`}
                                    >
                                        {/* Number */}
                                        <div>
                                            <span className="font-mono text-sm font-black text-zinc-900 dark:text-zinc-100">{note.number}</span>
                                        </div>

                                        {/* Type badge */}
                                        <div>
                                            <span className={`text-[9px] font-black uppercase tracking-wide px-2 py-0.5 border rounded-none ${
                                                credit
                                                    ? "bg-blue-50 dark:bg-blue-950/30 border-blue-200 dark:border-blue-700 text-blue-600 dark:text-blue-400"
                                                    : "bg-orange-50 dark:bg-orange-950/30 border-orange-200 dark:border-orange-700 text-orange-600 dark:text-orange-400"
                                            }`}>
                                                {TYPE_SHORT[note.type] || note.type}
                                            </span>
                                        </div>

                                        {/* Date */}
                                        <div>
                                            <span className="text-xs font-medium text-zinc-500">
                                                {new Date(note.issueDate).toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric" })}
                                            </span>
                                        </div>

                                        {/* Party */}
                                        <div className="truncate">
                                            <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">{getPartyName(note)}</span>
                                        </div>

                                        {/* Invoice Terkait */}
                                        <div className="truncate">
                                            {note.originalInvoice?.number && note.originalInvoiceId ? (
                                                <Link
                                                    href={`/finance/invoices?highlight=${note.originalInvoiceId}`}
                                                    onClick={(e) => e.stopPropagation()}
                                                    className="font-mono text-xs font-bold text-blue-600 dark:text-blue-400 hover:underline"
                                                >
                                                    {note.originalInvoice.number}
                                                </Link>
                                            ) : (
                                                <span className="text-xs text-zinc-300 dark:text-zinc-600">&mdash;</span>
                                            )}
                                        </div>

                                        {/* Reason */}
                                        <div className="truncate">
                                            <span className="text-xs text-zinc-500">{REASON_LABELS[note.reasonCode] || note.reasonCode}</span>
                                        </div>

                                        {/* Subtotal */}
                                        <div>
                                            <span className="font-mono text-xs font-bold text-zinc-700 dark:text-zinc-300">{formatIDR(note.subtotal)}</span>
                                        </div>

                                        {/* PPN */}
                                        <div>
                                            <span className="font-mono text-xs text-zinc-400">{note.ppnAmount > 0 ? formatIDR(note.ppnAmount) : "-"}</span>
                                        </div>

                                        {/* Total */}
                                        <div>
                                            <span className={`font-mono text-sm font-black ${credit ? "text-blue-600 dark:text-blue-400" : "text-orange-600 dark:text-orange-400"}`}>
                                                {formatIDR(note.totalAmount)}
                                            </span>
                                        </div>

                                        {/* Status */}
                                        <div>
                                            <span className={`inline-flex items-center gap-1.5 text-[9px] font-black uppercase tracking-wide px-2 py-1 border rounded-none ${cfg.bg} ${cfg.text}`}>
                                                <span className={`w-1.5 h-1.5 ${cfg.dot}`} />
                                                {cfg.label}
                                            </span>
                                        </div>

                                        {/* Actions */}
                                        <div className="flex items-center gap-1">
                                            {isDraft && (
                                                <>
                                                    <motion.button
                                                        whileHover={{ y: -1 }}
                                                        whileTap={{ scale: 0.92 }}
                                                        onClick={() => handlePost(note.id)}
                                                        disabled={actionLoading === note.id}
                                                        className="h-7 px-2 flex items-center justify-center border border-blue-300 dark:border-blue-600 text-blue-500 text-[9px] font-black uppercase tracking-wider hover:bg-blue-50 dark:hover:bg-blue-950/30 hover:border-blue-500 transition-colors rounded-none disabled:opacity-40"
                                                    >
                                                        Posting
                                                    </motion.button>
                                                    <motion.button
                                                        whileHover={{ y: -1 }}
                                                        whileTap={{ scale: 0.92 }}
                                                        onClick={() => handleVoid(note.id)}
                                                        disabled={actionLoading === note.id}
                                                        className="h-7 px-2 flex items-center justify-center border border-red-300 dark:border-red-600 text-red-500 text-[9px] font-black uppercase tracking-wider hover:bg-red-50 dark:hover:bg-red-950/30 hover:border-red-500 transition-colors rounded-none disabled:opacity-40"
                                                    >
                                                        Void
                                                    </motion.button>
                                                </>
                                            )}
                                            {isPosted && (
                                                <>
                                                    <motion.button
                                                        whileHover={{ y: -1 }}
                                                        whileTap={{ scale: 0.92 }}
                                                        onClick={() => setSettlementNote(note)}
                                                        className="h-7 px-2 flex items-center justify-center border border-emerald-300 dark:border-emerald-600 text-emerald-500 text-[9px] font-black uppercase tracking-wider hover:bg-emerald-50 dark:hover:bg-emerald-950/30 hover:border-emerald-500 transition-colors rounded-none"
                                                    >
                                                        Terapkan
                                                    </motion.button>
                                                    <motion.button
                                                        whileHover={{ y: -1 }}
                                                        whileTap={{ scale: 0.92 }}
                                                        onClick={() => handleVoid(note.id)}
                                                        disabled={actionLoading === note.id}
                                                        className="h-7 px-2 flex items-center justify-center border border-red-300 dark:border-red-600 text-red-500 text-[9px] font-black uppercase tracking-wider hover:bg-red-50 dark:hover:bg-red-950/30 hover:border-red-500 transition-colors rounded-none disabled:opacity-40"
                                                    >
                                                        Void
                                                    </motion.button>
                                                </>
                                            )}
                                            {isPartial && (
                                                <motion.button
                                                    whileHover={{ y: -1 }}
                                                    whileTap={{ scale: 0.92 }}
                                                    onClick={() => setSettlementNote(note)}
                                                    className="h-7 px-2 flex items-center justify-center border border-emerald-300 dark:border-emerald-600 text-emerald-500 text-[9px] font-black uppercase tracking-wider hover:bg-emerald-50 dark:hover:bg-emerald-950/30 hover:border-emerald-500 transition-colors rounded-none"
                                                >
                                                    Terapkan
                                                </motion.button>
                                            )}
                                        </div>
                                    </motion.div>
                                )
                            })}
                        </div>
                    )}
                </div>

                {/* Pagination */}
                <div className="px-5 py-3 border-t border-zinc-200 dark:border-zinc-700 flex items-center justify-between bg-zinc-50 dark:bg-zinc-800/50">
                    <span className={NB.label + " !mb-0 !text-[10px]"}>
                        {filtered.length} nota
                    </span>
                    {filtered.length > PAGE_SIZE ? (
                        <div className="flex items-center gap-2">
                            <Button
                                variant="outline"
                                size="icon"
                                className="h-7 w-7 border border-zinc-300 dark:border-zinc-600 rounded-none"
                                disabled={page <= 1}
                                onClick={() => setPage(p => p - 1)}
                            >
                                <ChevronLeft className="h-3.5 w-3.5" />
                            </Button>
                            <span className="text-xs font-black min-w-[50px] text-center">{page}/{totalPages}</span>
                            <Button
                                variant="outline"
                                size="icon"
                                className="h-7 w-7 border border-zinc-300 dark:border-zinc-600 rounded-none"
                                disabled={page >= totalPages}
                                onClick={() => setPage(p => p + 1)}
                            >
                                <ChevronRight className="h-3.5 w-3.5" />
                            </Button>
                        </div>
                    ) : (
                        <div />
                    )}
                </div>
            </motion.div>

            {/* ─── Dialogs ─── */}
            <CreateDCNoteDialog open={createOpen} onOpenChange={setCreateOpen} />
            {settlementNote && (
                <DCNoteSettlementDialog
                    open={!!settlementNote}
                    onOpenChange={(open) => { if (!open) setSettlementNote(null) }}
                    note={settlementNote}
                />
            )}
        </motion.div>
    )
}
