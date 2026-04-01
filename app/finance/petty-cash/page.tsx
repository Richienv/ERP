"use client"

import { useState, useEffect } from "react"
import { useQueryClient } from "@tanstack/react-query"
import { queryKeys } from "@/lib/query-keys"
import { usePettyCash } from "@/hooks/use-petty-cash"
import { topUpPettyCash, disbursePettyCash, getExpenseAccounts, getBankAccounts, createExpenseAccount, createBankAccount } from "@/lib/actions/finance-petty-cash"
import { TablePageSkeleton } from "@/components/ui/page-skeleton"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { ComboboxWithCreate } from "@/components/ui/combobox-with-create"
import {
    NBDialog,
    NBDialogHeader,
    NBDialogBody,
    NBDialogFooter,
    NBInput,
    NBCurrencyInput,
} from "@/components/ui/nb-dialog"
import { toast } from "sonner"
import {
    Wallet,
    ArrowUpCircle,
    ArrowDownCircle,
    Plus,
    Minus,
    Loader2,
    RefreshCcw,
    Download,
    Eye,
    EyeOff,
    ChevronLeft,
    ChevronRight,
} from "lucide-react"
import { motion, AnimatePresence } from "framer-motion"
import { NB } from "@/lib/dialog-styles"
import { exportToExcel } from "@/lib/table-export"

export const dynamic = "force-dynamic"

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

const formatCurrency = (val: number) =>
    new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(val)

const PAGE_SIZE = 15

export default function PettyCashPage() {
    const { data, isLoading } = usePettyCash()
    const queryClient = useQueryClient()

    const [topUpOpen, setTopUpOpen] = useState(false)
    const [disburseOpen, setDisburseOpen] = useState(false)
    const [showAmounts, setShowAmounts] = useState(true)
    const [page, setPage] = useState(1)

    // Filters
    const [dateFrom, setDateFrom] = useState("")
    const [dateTo, setDateTo] = useState("")
    const [typeFilter, setTypeFilter] = useState<"ALL" | "TOPUP" | "DISBURSEMENT">("ALL")

    if (isLoading || !data) return <TablePageSkeleton accentColor="bg-orange-400" />

    const allTransactions = data.transactions || []

    // Apply filters
    const transactions = allTransactions.filter((tx: any) => {
        if (typeFilter !== "ALL" && tx.type !== typeFilter) return false
        if (dateFrom) {
            const txDate = new Date(tx.date).toISOString().slice(0, 10)
            if (txDate < dateFrom) return false
        }
        if (dateTo) {
            const txDate = new Date(tx.date).toISOString().slice(0, 10)
            if (txDate > dateTo) return false
        }
        return true
    })

    const totalPages = Math.max(1, Math.ceil(transactions.length / PAGE_SIZE))
    const pagedTransactions = transactions.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)
    const hasActiveFilter = typeFilter !== "ALL" || dateFrom || dateTo

    const invalidateAll = () => {
        queryClient.invalidateQueries({ queryKey: queryKeys.pettyCash.all })
        queryClient.invalidateQueries({ queryKey: queryKeys.journal.all })
        queryClient.invalidateQueries({ queryKey: queryKeys.financeDashboard.all })
        queryClient.invalidateQueries({ queryKey: queryKeys.financeReports.all })
        queryClient.invalidateQueries({ queryKey: queryKeys.chartAccounts.all })
        queryClient.invalidateQueries({ queryKey: queryKeys.accountTransactions.all })
        queryClient.invalidateQueries({ queryKey: queryKeys.cashflowPlan.all })
    }

    const topUpCount = allTransactions.filter((tx: any) => tx.type === "TOPUP").length
    const disburseCount = allTransactions.filter((tx: any) => tx.type !== "TOPUP").length

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
                            <Wallet className="h-4.5 w-4.5 text-white" />
                        </div>
                        <div>
                            <h1 className="text-base font-black uppercase tracking-wider text-zinc-900 dark:text-white">
                                Peti Kas
                            </h1>
                            <p className="text-zinc-400 text-[11px] font-medium">
                                Kas kecil untuk pengeluaran operasional harian
                            </p>
                        </div>
                    </div>
                    <div className="flex items-center gap-0">
                        <Button
                            variant="outline"
                            onClick={() => {
                                const cols = [
                                    { header: "Tanggal", accessorKey: "_date" },
                                    { header: "Tipe", accessorKey: "type" },
                                    { header: "Nama", accessorKey: "recipientName" },
                                    { header: "Keterangan", accessorKey: "description" },
                                    { header: "Jumlah", accessorKey: "amount" },
                                    { header: "Saldo", accessorKey: "balanceAfter" },
                                ]
                                const rows = transactions.map((tx: any) => ({
                                    ...tx,
                                    _date: new Date(tx.date).toLocaleDateString("id-ID"),
                                }))
                                exportToExcel(cols, rows as unknown as Record<string, unknown>[], { filename: "peti-kas" })
                            }}
                            className={`${NB.toolbarBtn} ${NB.toolbarBtnJoin}`}
                        >
                            <Download className="h-3.5 w-3.5 mr-1.5" /> Export
                        </Button>
                        <Button
                            variant="outline"
                            onClick={() => queryClient.invalidateQueries({ queryKey: queryKeys.pettyCash.all })}
                            className={`${NB.toolbarBtn} ${NB.toolbarBtnJoin}`}
                        >
                            <RefreshCcw className="h-3.5 w-3.5 mr-1.5" /> Refresh
                        </Button>
                        <Button
                            variant="outline"
                            onClick={() => setTopUpOpen(true)}
                            className={NB.toolbarBtn}
                        >
                            <Plus className="h-3.5 w-3.5 mr-1.5" /> Top Up
                        </Button>
                        <Button
                            onClick={() => setDisburseOpen(true)}
                            className={NB.toolbarBtnPrimary}
                        >
                            <Minus className="h-3.5 w-3.5 mr-1.5" /> Catat Pengeluaran
                        </Button>
                    </div>
                </div>

                {/* Row 2: KPI Summary Strip */}
                <div className="flex items-center divide-x divide-zinc-200 dark:divide-zinc-800">
                    {[
                        { label: "Saldo Saat Ini", value: data.currentBalance, color: "emerald" },
                        { label: "Top Up Bulan Ini", value: data.totalTopup, color: "blue" },
                        { label: "Pengeluaran Bulan Ini", value: data.totalDisbursement, color: "red" },
                        { label: "Transaksi Masuk", count: topUpCount, color: "zinc" },
                        { label: "Transaksi Keluar", count: disburseCount, color: "zinc" },
                    ].map((kpi) => (
                        <div
                            key={kpi.label}
                            className={NB.kpiCell}
                        >
                            <div className="flex items-center gap-1.5">
                                <span className={`w-2 h-2 ${
                                    kpi.color === "emerald" ? "bg-emerald-500" :
                                    kpi.color === "blue" ? "bg-blue-500" :
                                    kpi.color === "red" ? "bg-red-500" : "bg-zinc-400"
                                }`} />
                                <span className={NB.kpiLabel}>{kpi.label}</span>
                            </div>
                            <div className="flex items-center gap-2">
                                {"count" in kpi ? (
                                    <motion.span
                                        key={kpi.count}
                                        initial={{ scale: 0.8, opacity: 0 }}
                                        animate={{ scale: 1, opacity: 1 }}
                                        transition={{ type: "spring" as const, stiffness: 400, damping: 20 }}
                                        className={NB.kpiCount}
                                    >
                                        {kpi.count}
                                    </motion.span>
                                ) : (
                                    <>
                                        <AnimatePresence>
                                            {showAmounts ? (
                                                <motion.span
                                                    key="amount"
                                                    initial={{ opacity: 0, x: -8 }}
                                                    animate={{ opacity: 1, x: 0 }}
                                                    exit={{ opacity: 0, x: -8 }}
                                                    transition={{ type: "spring" as const, stiffness: 300, damping: 25 }}
                                                    className={`text-lg font-black ${
                                                        kpi.color === "emerald" ? "text-emerald-600 dark:text-emerald-400" :
                                                        kpi.color === "blue" ? "text-blue-600 dark:text-blue-400" :
                                                        "text-red-600 dark:text-red-400"
                                                    }`}
                                                >
                                                    {formatCurrency(kpi.value!)}
                                                </motion.span>
                                            ) : (
                                                <motion.span
                                                    key="hidden"
                                                    initial={{ opacity: 0 }}
                                                    animate={{ opacity: 1 }}
                                                    className="text-lg font-black text-zinc-300 dark:text-zinc-600"
                                                >
                                                    *** ***
                                                </motion.span>
                                            )}
                                        </AnimatePresence>
                                        <button
                                            onClick={() => setShowAmounts(!showAmounts)}
                                            className="p-0.5 text-zinc-300 hover:text-zinc-500 dark:text-zinc-600 dark:hover:text-zinc-400 transition-colors"
                                            title={showAmounts ? "Sembunyikan nominal" : "Tampilkan nominal"}
                                        >
                                            {showAmounts ? <Eye className="h-3 w-3" /> : <EyeOff className="h-3 w-3" />}
                                        </button>
                                    </>
                                )}
                            </div>
                        </div>
                    ))}
                </div>

                {/* Row 3: Filter Toolbar */}
                <div className={`px-5 py-2 flex items-center gap-2 bg-zinc-50/80 dark:bg-zinc-800/30 ${NB.pageRowBorder}`}>
                    <div className="flex items-center gap-1.5">
                        <label className="text-[10px] font-bold uppercase tracking-widest text-zinc-400">Dari</label>
                        <input
                            type="date"
                            value={dateFrom}
                            onChange={(e) => { setDateFrom(e.target.value); setPage(1) }}
                            className={`border h-8 px-2 text-xs font-mono rounded-none outline-none transition-colors ${dateFrom ? "border-orange-400 bg-orange-50/50 dark:bg-orange-950/20" : "border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900"}`}
                        />
                    </div>
                    <div className="flex items-center gap-1.5">
                        <label className="text-[10px] font-bold uppercase tracking-widest text-zinc-400">s/d</label>
                        <input
                            type="date"
                            value={dateTo}
                            onChange={(e) => { setDateTo(e.target.value); setPage(1) }}
                            className={`border h-8 px-2 text-xs font-mono rounded-none outline-none transition-colors ${dateTo ? "border-orange-400 bg-orange-50/50 dark:bg-orange-950/20" : "border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900"}`}
                        />
                    </div>
                    <select
                        value={typeFilter}
                        onChange={(e) => { setTypeFilter(e.target.value as "ALL" | "TOPUP" | "DISBURSEMENT"); setPage(1) }}
                        className={`border h-8 px-2 text-[10px] font-bold uppercase tracking-wider rounded-none outline-none transition-colors ${typeFilter !== "ALL" ? "border-orange-400 bg-orange-50/50 dark:bg-orange-950/20 text-orange-700" : "border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-zinc-600"}`}
                    >
                        <option value="ALL">Semua Tipe</option>
                        <option value="TOPUP">Top Up</option>
                        <option value="DISBURSEMENT">Pengeluaran</option>
                    </select>
                    {hasActiveFilter && (
                        <button
                            onClick={() => { setDateFrom(""); setDateTo(""); setTypeFilter("ALL"); setPage(1) }}
                            className="text-[10px] font-bold text-zinc-400 hover:text-zinc-600 transition-colors ml-1"
                        >
                            Reset
                        </button>
                    )}
                    <span className="ml-auto text-[10px] font-bold text-zinc-400">
                        {transactions.length} transaksi{hasActiveFilter ? ` (dari ${allTransactions.length})` : ""}
                    </span>
                </div>
            </motion.div>

            {/* ─── Transaction Table ─── */}
            <motion.div
                variants={fadeUp}
                className="border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] bg-white dark:bg-zinc-900 overflow-hidden flex flex-col"
                style={{ minHeight: 480 }}
            >
                {/* Table Header */}
                <div className="hidden md:grid grid-cols-[120px_90px_1fr_1.5fr_130px_130px] gap-2 px-5 py-2.5 bg-black dark:bg-zinc-950 border-b-2 border-black">
                    {["Tanggal", "Tipe", "Nama", "Keterangan", "Jumlah", "Saldo"].map((h) => (
                        <span key={h} className="text-[10px] font-black uppercase tracking-widest text-zinc-400">{h}</span>
                    ))}
                </div>

                {/* Table Body */}
                <div className="w-full flex-1 flex flex-col">
                    {transactions.length === 0 ? (
                        <motion.div
                            initial={{ opacity: 0, scale: 0.9 }}
                            animate={{ opacity: 1, scale: 1 }}
                            transition={{ type: "spring" as const, stiffness: 300, damping: 25 }}
                            className="flex-1 flex flex-col items-center justify-center py-16 text-zinc-400"
                        >
                            <div className="w-16 h-16 border-2 border-zinc-200 dark:border-zinc-700 flex items-center justify-center mb-4">
                                <Wallet className="h-7 w-7 text-zinc-200 dark:text-zinc-700" />
                            </div>
                            <span className="text-sm font-bold">Belum ada transaksi</span>
                            <span className="text-xs text-zinc-400 mt-1">Top up peti kas untuk memulai</span>
                        </motion.div>
                    ) : (
                        <div className="divide-y divide-zinc-100 dark:divide-zinc-800">
                            {pagedTransactions.map((tx: any, idx: number) => {
                                const isTopUp = tx.type === "TOPUP"

                                return (
                                    <motion.div
                                        key={tx.id}
                                        custom={idx}
                                        variants={fadeX}
                                        initial="hidden"
                                        animate="show"
                                        transition={{ delay: idx * 0.03 }}
                                        className={`grid grid-cols-1 md:grid-cols-[120px_90px_1fr_1.5fr_130px_130px] gap-2 px-5 py-3 items-center transition-all hover:bg-orange-50/50 dark:hover:bg-orange-950/10 ${idx % 2 === 0 ? "bg-white dark:bg-zinc-900" : "bg-zinc-50/60 dark:bg-zinc-800/20"}`}
                                    >
                                        {/* Date */}
                                        <div>
                                            <span className="text-xs font-mono font-medium text-zinc-600 dark:text-zinc-400">
                                                {new Date(tx.date).toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric" })}
                                            </span>
                                        </div>

                                        {/* Type badge */}
                                        <div>
                                            {isTopUp ? (
                                                <span className="inline-flex items-center gap-1 text-[9px] font-black uppercase tracking-wide px-2 py-0.5 border rounded-none bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-700 text-emerald-600 dark:text-emerald-400">
                                                    <ArrowUpCircle className="h-3 w-3" /> Masuk
                                                </span>
                                            ) : (
                                                <span className="inline-flex items-center gap-1 text-[9px] font-black uppercase tracking-wide px-2 py-0.5 border rounded-none bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-700 text-red-600 dark:text-red-400">
                                                    <ArrowDownCircle className="h-3 w-3" /> Keluar
                                                </span>
                                            )}
                                        </div>

                                        {/* Recipient */}
                                        <div className="truncate">
                                            <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">{tx.recipientName || "\u2014"}</span>
                                        </div>

                                        {/* Description */}
                                        <div className="truncate">
                                            <span className="text-xs text-zinc-500">{tx.description}</span>
                                        </div>

                                        {/* Amount */}
                                        <div>
                                            <span className={`font-mono text-sm font-black ${isTopUp ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"}`}>
                                                {isTopUp ? "+" : "\u2212"}{formatCurrency(tx.amount)}
                                            </span>
                                        </div>

                                        {/* Balance */}
                                        <div>
                                            <span className="font-mono text-sm font-bold text-zinc-900 dark:text-zinc-100">
                                                {formatCurrency(tx.balanceAfter)}
                                            </span>
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
                        {transactions.length} transaksi
                    </span>
                    {transactions.length > PAGE_SIZE ? (
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

            {/* ─── Top-Up Dialog ─── */}
            <TopUpDialog open={topUpOpen} onOpenChange={setTopUpOpen} onSuccess={invalidateAll} />

            {/* ─── Disbursement Dialog ─── */}
            <DisburseDialog open={disburseOpen} onOpenChange={setDisburseOpen} onSuccess={invalidateAll} />
        </motion.div>
    )
}

// ─── Top Up Dialog ─────────────────────────────────────────
function TopUpDialog({ open, onOpenChange, onSuccess }: { open: boolean; onOpenChange: (v: boolean) => void; onSuccess: () => void }) {
    const queryClient = useQueryClient()
    const [amount, setAmount] = useState("")
    const [bankCode, setBankCode] = useState("")
    const [description, setDescription] = useState("")
    const [loading, setLoading] = useState(false)
    const [banks, setBanks] = useState<{ code: string; name: string }[]>([])
    const [loadingBanks, setLoadingBanks] = useState(false)

    const loadBanks = async () => {
        setLoadingBanks(true)
        try {
            const result = await getBankAccounts()
            if (Array.isArray(result)) setBanks(result)
        } finally {
            setLoadingBanks(false)
        }
    }

    useEffect(() => {
        if (open) loadBanks()
    }, [open])

    return (
        <NBDialog open={open} onOpenChange={onOpenChange} size="narrow">
            <NBDialogHeader icon={ArrowUpCircle} title="Top Up Peti Kas" />
            <NBDialogBody>
                <NBCurrencyInput
                    label="Jumlah (IDR)"
                    required
                    value={amount}
                    onChange={setAmount}
                />
                <div>
                    <label className="text-[11px] font-bold uppercase tracking-wider text-zinc-600 dark:text-zinc-400 mb-1 block">
                        Dari Akun Bank
                    </label>
                    <ComboboxWithCreate
                        options={banks.map(b => ({ value: b.code, label: b.name, subtitle: b.code }))}
                        value={bankCode}
                        onChange={setBankCode}
                        placeholder={loadingBanks ? "Memuat..." : "Pilih akun bank..."}
                        searchPlaceholder="Cari akun bank..."
                        emptyMessage="Tidak ada akun bank"
                        createLabel="+ Buat Akun Bank Baru"
                        isLoading={loadingBanks}
                        className="h-10"
                        onCreate={async (name) => {
                            const result = await createBankAccount(name)
                            if (result.success && result.code) {
                                await loadBanks()
                                queryClient.invalidateQueries({ queryKey: queryKeys.financeDashboard.all })
                                queryClient.invalidateQueries({ queryKey: queryKeys.financeReports.all })
                                toast.success(`Akun "${name}" berhasil dibuat`)
                                return result.code
                            }
                            toast.error(result.error || "Gagal membuat akun bank")
                            throw new Error(result.error || "Gagal")
                        }}
                    />
                </div>
                <NBInput
                    label="Keterangan"
                    value={description}
                    onChange={setDescription}
                    placeholder="Top up bulanan..."
                />
            </NBDialogBody>
            <NBDialogFooter
                onCancel={() => onOpenChange(false)}
                onSubmit={async () => {
                    setLoading(true)
                    try {
                        const result = await topUpPettyCash({ amount: Number(amount), bankAccountCode: bankCode, description })
                        if (result && 'success' in result && result.success) {
                            toast.success("Top up berhasil!")
                            onSuccess()
                            onOpenChange(false)
                            setAmount(""); setBankCode(""); setDescription("")
                        } else {
                            toast.error("Gagal top up")
                        }
                    } catch (e: any) {
                        toast.error(e.message || "Gagal top up")
                    } finally {
                        setLoading(false)
                    }
                }}
                submitting={loading}
                submitLabel="Top Up"
                disabled={!amount || !bankCode}
            />
        </NBDialog>
    )
}

// ─── Disbursement Dialog ────────────────────────────────────
function DisburseDialog({ open, onOpenChange, onSuccess }: { open: boolean; onOpenChange: (v: boolean) => void; onSuccess: () => void }) {
    const queryClient = useQueryClient()
    const [amount, setAmount] = useState("")
    const [recipientName, setRecipientName] = useState("")
    const [description, setDescription] = useState("")
    const [expenseCode, setExpenseCode] = useState("")
    const [loading, setLoading] = useState(false)
    const [expenses, setExpenses] = useState<{ code: string; name: string }[]>([])
    const [loadingExpenses, setLoadingExpenses] = useState(false)

    const loadExpenses = async () => {
        setLoadingExpenses(true)
        try {
            const result = await getExpenseAccounts()
            if (Array.isArray(result)) setExpenses(result)
        } finally {
            setLoadingExpenses(false)
        }
    }

    useEffect(() => {
        if (open) loadExpenses()
    }, [open])

    return (
        <NBDialog open={open} onOpenChange={onOpenChange} size="narrow">
            <NBDialogHeader icon={ArrowDownCircle} title="Catat Pengeluaran" />
            <NBDialogBody>
                <NBInput
                    label="Nama Pemohon"
                    required
                    value={recipientName}
                    onChange={setRecipientName}
                    placeholder="Nama..."
                />
                <NBCurrencyInput
                    label="Jumlah (IDR)"
                    required
                    value={amount}
                    onChange={setAmount}
                />
                <div>
                    <label className="text-[11px] font-bold uppercase tracking-wider text-zinc-600 dark:text-zinc-400 mb-1 block">
                        Kategori Beban
                    </label>
                    <ComboboxWithCreate
                        options={expenses.map(e => ({ value: e.code, label: e.name, subtitle: e.code }))}
                        value={expenseCode}
                        onChange={setExpenseCode}
                        placeholder={loadingExpenses ? "Memuat..." : "Pilih kategori beban..."}
                        searchPlaceholder="Cari akun beban..."
                        emptyMessage="Tidak ada akun beban"
                        createLabel="+ Buat Akun Beban Baru"
                        isLoading={loadingExpenses}
                        className="h-10"
                        onCreate={async (name) => {
                            const result = await createExpenseAccount(name)
                            if (result.success && result.code) {
                                setExpenses(prev => {
                                    if (prev.some(e => e.code === result.code)) return prev
                                    return [...prev, { code: result.code!, name: result.name || name }].sort((a, b) => a.code.localeCompare(b.code))
                                })
                                loadExpenses()
                                queryClient.invalidateQueries({ queryKey: queryKeys.chartAccounts.all })
                                queryClient.invalidateQueries({ queryKey: queryKeys.glAccounts.all })
                                queryClient.invalidateQueries({ queryKey: queryKeys.financeDashboard.all })
                                queryClient.invalidateQueries({ queryKey: queryKeys.financeReports.all })
                                toast.success(`Akun "${name}" berhasil dibuat (${result.code})`)
                                return result.code
                            }
                            toast.error(result.error || "Gagal membuat akun beban")
                            throw new Error(result.error || "Gagal")
                        }}
                    />
                </div>
                <NBInput
                    label="Keterangan"
                    value={description}
                    onChange={setDescription}
                    placeholder="Keterangan..."
                />
            </NBDialogBody>
            <NBDialogFooter
                onCancel={() => onOpenChange(false)}
                onSubmit={async () => {
                    setLoading(true)
                    try {
                        const result = await disbursePettyCash({
                            amount: Number(amount),
                            recipientName,
                            description,
                            expenseAccountCode: expenseCode,
                        })
                        if (result && 'success' in result && result.success) {
                            toast.success("Pengeluaran tercatat!")
                            onSuccess()
                            onOpenChange(false)
                            setAmount(""); setRecipientName(""); setDescription(""); setExpenseCode("")
                        } else {
                            toast.error((result as any)?.error || "Gagal mencatat pengeluaran")
                        }
                    } catch (e: any) {
                        toast.error(e.message || "Gagal mencatat pengeluaran")
                    } finally {
                        setLoading(false)
                    }
                }}
                submitting={loading}
                submitLabel="Catat Pengeluaran"
                disabled={!amount || !recipientName || !expenseCode}
            />
        </NBDialog>
    )
}
