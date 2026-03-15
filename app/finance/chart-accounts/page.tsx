"use client"

import { useState } from "react"
import {
    Search,
    Plus,
    ChevronRight,
    ChevronDown,
    BookOpen,
    Loader2,
    Landmark,
    Receipt,
    Wallet,
    PiggyBank,
    CreditCard,
    X,
    Eye,
    EyeOff,
    Download,
} from "lucide-react"
import { motion, AnimatePresence } from "framer-motion"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { NB } from "@/lib/dialog-styles"
import { createGLAccount, type GLAccountNode } from "@/lib/actions/finance"
import { formatIDR } from "@/lib/utils"
import { toast } from "sonner"
import { useChartOfAccounts, useInvalidateChartAccounts } from "@/hooks/use-chart-accounts"
import { useQueryClient } from "@tanstack/react-query"
import { queryKeys } from "@/lib/query-keys"
import { exportToExcel } from "@/lib/table-export"

/* ─── Animation variants ─── */
const stagger = {
    hidden: { opacity: 0 },
    show: { opacity: 1, transition: { staggerChildren: 0.07 } },
}
const fadeUp = {
    hidden: { opacity: 0, y: 14 },
    show: { opacity: 1, y: 0, transition: { type: "spring", stiffness: 320, damping: 26 } },
}

const AccountNode = ({ node, level }: { node: GLAccountNode; level: number }) => {
    const [isOpen, setIsOpen] = useState(true)
    const hasChildren = node.children && node.children.length > 0
    const paddingLeft = level * 24

    return (
        <div className="select-none">
            <div
                className={`flex items-center py-2.5 px-4 transition-colors border-b border-zinc-100 dark:border-zinc-800 ${
                    level === 0
                        ? "bg-zinc-50 dark:bg-zinc-800 font-black uppercase text-sm border-b-2 border-black hover:bg-zinc-100 dark:hover:bg-zinc-700/50"
                        : "hover:bg-orange-50/50 dark:hover:bg-orange-950/10"
                }`}
                style={{ paddingLeft: `${paddingLeft + 16}px` }}
            >
                <div
                    className="w-6 h-6 flex items-center justify-center mr-2 cursor-pointer hover:text-orange-500 transition-colors"
                    onClick={() => hasChildren && setIsOpen(!isOpen)}
                >
                    {hasChildren ? (
                        isOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />
                    ) : (
                        <div className="w-4" />
                    )}
                </div>
                <div className="flex-1 flex items-center gap-3">
                    <span className={`font-mono ${level === 0 ? "text-black dark:text-white" : "text-zinc-500"} font-bold text-xs`}>
                        {node.code}
                    </span>
                    <span
                        className={`${
                            level === 0
                                ? "text-sm"
                                : level === 1
                                  ? "font-bold text-sm text-zinc-900 dark:text-white"
                                  : "font-medium text-sm text-zinc-700 dark:text-zinc-300"
                        }`}
                    >
                        {node.name}
                    </span>
                    <span className="text-[9px] font-black uppercase tracking-widest px-1.5 py-0.5 border border-zinc-200 dark:border-zinc-700 text-zinc-400 bg-zinc-50 dark:bg-zinc-800">
                        {node.type}
                    </span>
                </div>
                <div
                    className={`text-right font-mono font-bold text-sm tracking-tight w-40 ${
                        node.balance < 0 ? "text-red-500" : "text-zinc-900 dark:text-white"
                    }`}
                >
                    {formatIDR(node.balance)}
                </div>
            </div>
            {isOpen && hasChildren && (
                <div>
                    {node.children.map((child: GLAccountNode) => (
                        <AccountNode key={child.id} node={child} level={level + 1} />
                    ))}
                </div>
            )}
        </div>
    )
}

export default function CoALedgerPage() {
    const { data: accounts = [], isLoading: loading } = useChartOfAccounts()
    const invalidateChartAccounts = useInvalidateChartAccounts()
    const queryClient = useQueryClient()
    const [search, setSearch] = useState("")
    const [filterType, setFilterType] = useState<"ALL" | "ASSET" | "LIABILITY" | "EQUITY" | "REVENUE" | "EXPENSE">("ALL")
    const [createOpen, setCreateOpen] = useState(false)
    const [submitting, setSubmitting] = useState(false)
    const [newCode, setNewCode] = useState("")
    const [newName, setNewName] = useState("")
    const [newType, setNewType] = useState<"ASSET" | "LIABILITY" | "EQUITY" | "REVENUE" | "EXPENSE">("ASSET")
    const [showAmounts, setShowAmounts] = useState(false)

    const filteredAccounts = accounts.filter((acc) => {
        const matchesSearch = acc.name.toLowerCase().includes(search.toLowerCase()) || acc.code.includes(search)
        if (!matchesSearch) return false
        if (filterType === "ALL") return true
        return acc.type === filterType
    })

    // KPI calculations — Liabilities, Equity, Revenue are credit-normal (stored negative), so we use Math.abs
    const totalAccounts = accounts.length
    const totalAssets = accounts.filter((a) => a.type === "ASSET").reduce((sum, a) => sum + a.balance, 0)
    const totalLiabilities = Math.abs(accounts.filter((a) => a.type === "LIABILITY").reduce((sum, a) => sum + a.balance, 0))
    const totalEquity = Math.abs(accounts.filter((a) => a.type === "EQUITY").reduce((sum, a) => sum + a.balance, 0))
    const totalRevenue = Math.abs(accounts.filter((a) => a.type === "REVENUE").reduce((sum, a) => sum + a.balance, 0))
    const totalExpense = accounts.filter((a) => a.type === "EXPENSE").reduce((sum, a) => sum + a.balance, 0)
    const retainedEarnings = totalRevenue - totalExpense
    const rightSide = totalLiabilities + totalEquity + retainedEarnings
    const isBalanced = Math.abs(totalAssets - rightSide) < 1

    async function handleCreateAccount() {
        if (!newCode.trim() || !newName.trim()) {
            toast.error("Code dan name akun wajib diisi")
            return
        }
        setSubmitting(true)
        try {
            const result = await createGLAccount({ code: newCode.trim(), name: newName.trim(), type: newType })
            if (!result.success) {
                toast.error(("error" in result ? result.error : null) || "Gagal membuat account")
                return
            }
            toast.success("Account berhasil dibuat")
            setNewCode("")
            setNewName("")
            setNewType("ASSET")
            setCreateOpen(false)
            invalidateChartAccounts()
            queryClient.invalidateQueries({ queryKey: queryKeys.glAccounts.all })
            queryClient.invalidateQueries({ queryKey: queryKeys.financeDashboard.all })
            queryClient.invalidateQueries({ queryKey: queryKeys.journal.all })
            queryClient.invalidateQueries({ queryKey: queryKeys.financeReports.all })
        } finally {
            setSubmitting(false)
        }
    }

    const filterTypes = ["ALL", "ASSET", "LIABILITY", "EQUITY", "REVENUE", "EXPENSE"] as const
    const filterLabels: Record<string, string> = {
        ALL: "Semua",
        ASSET: "Asset",
        LIABILITY: "Liability",
        EQUITY: "Equity",
        REVENUE: "Revenue",
        EXPENSE: "Expense",
    }

    const kpis = [
        { label: "Total Akun", value: String(totalAccounts), amount: null, color: "orange", dot: "bg-orange-500" },
        { label: "Assets", value: formatIDR(totalAssets), amount: totalAssets, color: "emerald", dot: "bg-emerald-500" },
        { label: "Liabilities", value: formatIDR(totalLiabilities), amount: totalLiabilities, color: "red", dot: "bg-red-500" },
        { label: "Equity", value: formatIDR(totalEquity), amount: totalEquity, color: "blue", dot: "bg-blue-500" },
        { label: "Revenue", value: formatIDR(totalRevenue), amount: totalRevenue, color: "purple", dot: "bg-purple-500" },
        { label: "Expense", value: formatIDR(totalExpense), amount: totalExpense, color: "orange", dot: "bg-amber-500" },
    ]

    return (
        <motion.div className="mf-page" variants={stagger} initial="hidden" animate="show">
            {/* ─── Unified Page Header ─── */}
            <motion.div
                variants={fadeUp}
                className="border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] overflow-hidden bg-white dark:bg-zinc-900"
            >
                {/* Orange accent bar */}
                <div className="h-1 bg-gradient-to-r from-orange-500 via-amber-400 to-orange-500" />

                {/* Row 1: Title + Actions */}
                <div className="px-5 py-3.5 flex items-center justify-between border-b border-zinc-200 dark:border-zinc-800">
                    <div className="flex items-center gap-3">
                        <div className="w-9 h-9 bg-orange-500 flex items-center justify-center">
                            <BookOpen className="h-4.5 w-4.5 text-white" />
                        </div>
                        <div>
                            <h1 className="text-base font-black uppercase tracking-wider text-zinc-900 dark:text-white">
                                Chart of Accounts
                            </h1>
                            <p className="text-zinc-400 text-[11px] font-medium">
                                Struktur hirarki akun & saldo berjalan
                            </p>
                        </div>
                    </div>
                    <div className="flex items-center gap-0">
                        <Button
                            onClick={() => {
                                const cols = [
                                    { header: "Kode", accessorKey: "code" },
                                    { header: "Nama Akun", accessorKey: "name" },
                                    { header: "Tipe", accessorKey: "type" },
                                    { header: "Saldo", accessorKey: "balance" },
                                ]
                                const flat = filteredAccounts.flatMap(function flatten(n: GLAccountNode): Record<string, unknown>[] {
                                    const row: Record<string, unknown> = { code: n.code, name: n.name, type: n.type, balance: n.balance }
                                    const childRows = n.children ? n.children.flatMap(flatten) : []
                                    return [row, ...childRows]
                                })
                                exportToExcel(cols, flat, { filename: "chart-of-accounts" })
                            }}
                            variant="outline"
                            className={NB.toolbarBtn}
                        >
                            <Download className="h-3.5 w-3.5 mr-1.5" /> Export
                        </Button>
                        <Button
                            onClick={() => setCreateOpen(true)}
                            className={NB.toolbarBtnPrimary}
                        >
                            <Plus className="h-3.5 w-3.5 mr-1.5" /> Tambah Akun
                        </Button>
                    </div>
                </div>

                {/* Row 2: Accounting Equation Bar + KPI Strip */}
                <div className="border-b border-zinc-200 dark:border-zinc-800">
                    {/* Accounting equation sub-bar */}
                    <div
                        className={`px-5 py-1.5 flex items-center justify-between text-[10px] font-black uppercase tracking-widest border-b border-zinc-200 dark:border-zinc-800 ${
                            isBalanced
                                ? "bg-emerald-50 dark:bg-emerald-950/20 text-emerald-700 dark:text-emerald-400"
                                : "bg-amber-50 dark:bg-amber-950/20 text-amber-700 dark:text-amber-400"
                        }`}
                    >
                        <span>{isBalanced ? "Persamaan Akuntansi Seimbang" : "Persamaan Akuntansi Belum Seimbang"}</span>
                        <span className="font-mono text-[9px] normal-case">
                            Aset ({formatIDR(totalAssets)}) = Kewajiban ({formatIDR(totalLiabilities)}) + Ekuitas ({formatIDR(totalEquity)}) + Laba ({formatIDR(retainedEarnings)})
                        </span>
                    </div>

                    {/* KPI cells — same pattern as Invoice page */}
                    <div className="flex items-center divide-x divide-zinc-200 dark:divide-zinc-800">
                        {kpis.map((kpi, idx) => (
                            <div
                                key={kpi.label}
                                className="flex-1 px-4 py-3 flex items-center justify-between gap-3 cursor-default"
                            >
                                <div className="flex items-center gap-1.5">
                                    <span className={`w-2 h-2 ${kpi.dot}`} />
                                    <span className="text-[11px] font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                                        {kpi.label}
                                    </span>
                                </div>
                                <div className="flex items-center gap-2">
                                    {idx === 0 ? (
                                        <motion.span
                                            key={kpi.value}
                                            initial={{ scale: 0.8, opacity: 0 }}
                                            animate={{ scale: 1, opacity: 1 }}
                                            transition={{ type: "spring", stiffness: 400, damping: 20 }}
                                            className="text-xl font-black text-zinc-900 dark:text-white"
                                        >
                                            {kpi.value}
                                        </motion.span>
                                    ) : (
                                        <>
                                            <AnimatePresence>
                                                {showAmounts && (
                                                    <motion.span
                                                        initial={{ opacity: 0, x: -8 }}
                                                        animate={{ opacity: 1, x: 0 }}
                                                        exit={{ opacity: 0, x: -8 }}
                                                        transition={{ type: "spring", stiffness: 300, damping: 25 }}
                                                        className="text-xs font-mono font-bold text-zinc-500 dark:text-zinc-400"
                                                    >
                                                        {kpi.value}
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
                </div>

                {/* Row 3: Filter Toolbar */}
                <div className="px-5 py-2.5 flex items-center justify-between bg-zinc-50/80 dark:bg-zinc-800/30">
                    <div className="flex items-center gap-0">
                        {/* Search input with active indicator */}
                        <div className="relative">
                            <Search
                                className={`pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 z-10 transition-colors ${
                                    search ? "text-orange-500" : "text-zinc-500 dark:text-zinc-400"
                                }`}
                            />
                            <input
                                className={`border border-r-0 font-medium h-9 w-[260px] text-xs rounded-none pl-9 pr-8 outline-none placeholder:text-zinc-400 transition-all ${
                                    search
                                        ? "border-orange-400 dark:border-orange-500 bg-orange-50/50 dark:bg-orange-950/20 text-zinc-900 dark:text-white"
                                        : "border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900"
                                }`}
                                placeholder="Cari kode atau nama akun..."
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
                        {/* Type filter buttons — joined strip */}
                        {filterTypes.map((s) => (
                            <button
                                key={s}
                                onClick={() => setFilterType(s)}
                                className={`h-9 px-3 text-[10px] font-black uppercase tracking-widest transition-all border border-r-0 last:border-r rounded-none ${
                                    filterType === s
                                        ? "bg-black dark:bg-white text-white dark:text-black border-black dark:border-white"
                                        : "bg-white dark:bg-zinc-900 text-zinc-400 border-zinc-300 dark:border-zinc-700 hover:bg-zinc-50 dark:hover:bg-zinc-800 hover:text-zinc-600 dark:hover:text-zinc-300"
                                }`}
                            >
                                {filterLabels[s]}
                            </button>
                        ))}
                    </div>
                    <span className="hidden md:inline text-[11px] font-medium text-zinc-400">
                        <span className="font-mono font-bold text-zinc-600 dark:text-zinc-300">{filteredAccounts.length}</span> akun
                    </span>
                </div>
            </motion.div>

            {/* ─── Account Tree ─── */}
            <motion.div
                variants={fadeUp}
                className="border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] bg-white dark:bg-zinc-900 overflow-hidden"
            >
                {/* Black header */}
                <div className="flex items-center justify-between px-5 py-2.5 bg-black dark:bg-zinc-950 border-b-2 border-black">
                    <span className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Struktur Hirarki</span>
                    <span className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Saldo (IDR)</span>
                </div>

                {loading ? (
                    <div className="divide-y divide-zinc-100 dark:divide-zinc-800">
                        {Array.from({ length: 6 }).map((_, i) => (
                            <div key={i} className="flex items-center gap-3 px-5 py-3.5 animate-pulse">
                                <div className="h-4 w-16 bg-zinc-200 dark:bg-zinc-700 rounded-sm" />
                                <div className="h-4 w-40 bg-zinc-200 dark:bg-zinc-700 rounded-sm" />
                                <div className="h-4 w-14 bg-zinc-100 dark:bg-zinc-800 rounded-sm" />
                                <div className="flex-1" />
                                <div className="h-4 w-28 bg-zinc-200 dark:bg-zinc-700 rounded-sm" />
                            </div>
                        ))}
                    </div>
                ) : filteredAccounts.length === 0 ? (
                    <motion.div
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ type: "spring", stiffness: 300, damping: 25 }}
                        className="flex flex-col items-center justify-center py-16 text-zinc-400"
                    >
                        <div className="w-16 h-16 border-2 border-zinc-200 dark:border-zinc-700 flex items-center justify-center mb-4">
                            <BookOpen className="h-7 w-7 text-zinc-200 dark:text-zinc-700" />
                        </div>
                        <span className="text-sm font-bold">Tidak ada akun ditemukan</span>
                        <span className="text-xs text-zinc-400 mt-1">Coba ubah filter atau tambah akun baru</span>
                    </motion.div>
                ) : (
                    filteredAccounts.map((node) => <AccountNode key={node.id} node={node} level={0} />)
                )}

                {/* Footer */}
                <div className="px-5 py-3 border-t border-zinc-200 dark:border-zinc-700 flex items-center justify-between bg-zinc-50 dark:bg-zinc-800/50">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                        {filteredAccounts.length} akun
                    </span>
                    <div />
                </div>
            </motion.div>

            {/* ─── Create Account Dialog ─── */}
            <Dialog open={createOpen} onOpenChange={setCreateOpen}>
                <DialogContent className={NB.contentNarrow}>
                    <DialogHeader className={NB.header}>
                        <DialogTitle className={NB.title}>
                            <BookOpen className="h-5 w-5" /> Tambah Akun COA
                        </DialogTitle>
                        <p className="text-zinc-400 text-[11px] font-bold mt-0.5">
                            Buat akun baru langsung masuk ke chart of accounts
                        </p>
                    </DialogHeader>

                    <div className="p-6 space-y-5">
                        {/* Account Type Selector — visual tile picker */}
                        <div>
                            <label className={NB.label}>
                                Tipe Akun <span className={NB.labelRequired}>*</span>
                            </label>
                            <div className="grid grid-cols-5 gap-1.5 mt-1">
                                {([
                                    { value: "ASSET" as const, label: "Asset", icon: Landmark, activeBg: "bg-emerald-50", activeIcon: "text-emerald-600" },
                                    { value: "LIABILITY" as const, label: "Liability", icon: CreditCard, activeBg: "bg-red-50", activeIcon: "text-red-600" },
                                    { value: "EQUITY" as const, label: "Equity", icon: PiggyBank, activeBg: "bg-blue-50", activeIcon: "text-blue-600" },
                                    { value: "REVENUE" as const, label: "Revenue", icon: Wallet, activeBg: "bg-purple-50", activeIcon: "text-purple-600" },
                                    { value: "EXPENSE" as const, label: "Expense", icon: Receipt, activeBg: "bg-orange-50", activeIcon: "text-orange-600" },
                                ]).map(({ value, label, icon: Icon, activeBg, activeIcon }) => (
                                    <button
                                        key={value}
                                        type="button"
                                        onClick={() => setNewType(value)}
                                        className={`flex flex-col items-center gap-1.5 p-2.5 border-2 transition-all ${
                                            newType === value
                                                ? `border-black ${activeBg} shadow-[3px_3px_0px_0px_rgba(0,0,0,1)]`
                                                : "border-zinc-200 bg-white hover:border-zinc-400 hover:bg-zinc-50"
                                        }`}
                                    >
                                        <Icon className={`h-4 w-4 ${newType === value ? activeIcon : "text-zinc-400"}`} />
                                        <span className={`text-[8px] font-black uppercase tracking-widest ${newType === value ? "text-black" : "text-zinc-400"}`}>
                                            {label}
                                        </span>
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Code + Name fields */}
                        <div className="grid grid-cols-3 gap-3">
                            <div>
                                <label className={NB.label}>
                                    Kode <span className={NB.labelRequired}>*</span>
                                </label>
                                <Input value={newCode} onChange={(e) => setNewCode(e.target.value)} placeholder="6100" className={NB.inputMono} />
                            </div>
                            <div className="col-span-2">
                                <label className={NB.label}>
                                    Nama Akun <span className={NB.labelRequired}>*</span>
                                </label>
                                <Input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Biaya Listrik" className={NB.input} />
                            </div>
                        </div>

                        {/* Preview strip */}
                        {(newCode.trim() || newName.trim()) && (
                            <div className="border-2 border-dashed border-zinc-300 bg-zinc-50 px-4 py-2.5 flex items-center gap-3">
                                <span className="text-[9px] font-black uppercase tracking-widest text-zinc-400">Preview</span>
                                <span className="font-mono font-bold text-sm text-zinc-900">{newCode || "\u2014"}</span>
                                <span className="text-sm font-bold text-zinc-700">{newName || "\u2014"}</span>
                                <span className="text-[8px] font-black uppercase tracking-widest px-1.5 py-0.5 border border-zinc-300 text-zinc-500 ml-auto">
                                    {newType}
                                </span>
                            </div>
                        )}

                        {/* Actions */}
                        <div className={NB.footer}>
                            <Button variant="outline" className={NB.cancelBtn} onClick={() => setCreateOpen(false)}>
                                Batal
                            </Button>
                            <Button className={NB.submitBtn} onClick={handleCreateAccount} disabled={submitting || !newCode.trim() || !newName.trim()}>
                                {submitting ? (
                                    <>
                                        <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" /> Menyimpan...
                                    </>
                                ) : (
                                    <>
                                        <Plus className="h-3.5 w-3.5 mr-1.5" /> Simpan Akun
                                    </>
                                )}
                            </Button>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>
        </motion.div>
    )
}
