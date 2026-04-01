"use client"

import { useState, useMemo, useRef, useEffect } from "react"
import {
    Search,
    Plus,
    BookOpen,
    Loader2,
    Landmark,
    Receipt,
    Wallet,
    PiggyBank,
    CreditCard,
    X,
    Download,
    AlertTriangle,
    Pencil,
    Trash2,
    Layers,
    Lock,
} from "lucide-react"
import { motion } from "framer-motion"
import { Button } from "@/components/ui/button"
import { NB } from "@/lib/dialog-styles"
import {
    NBDialog,
    NBDialogHeader,
    NBDialogBody,
    NBDialogFooter,
    NBSection,
    NBInput,
    NBSelect,
} from "@/components/ui/nb-dialog"
import { createGLAccount, updateGLAccount, deleteGLAccount, type GLAccountNode } from "@/lib/actions/finance-gl"
import { formatIDR } from "@/lib/utils"
import { subTypeLabel, inferSubType } from "@/lib/account-subtype-helpers"
import { toast } from "sonner"
import { useChartOfAccounts, useInvalidateChartAccounts } from "@/hooks/use-chart-accounts"
import { useQueryClient } from "@tanstack/react-query"
import { queryKeys } from "@/lib/query-keys"
import { exportToExcel } from "@/lib/table-export"

// ─── Account type metadata ───
type AccType = "ASSET" | "LIABILITY" | "EQUITY" | "REVENUE" | "EXPENSE"

const ACCOUNT_TYPES = [
    { value: "ASSET" as const, label: "Asset", icon: Landmark, range: "1000–1999" },
    { value: "LIABILITY" as const, label: "Liability", icon: CreditCard, range: "2000–2999" },
    { value: "EQUITY" as const, label: "Equity", icon: PiggyBank, range: "3000–3999" },
    { value: "REVENUE" as const, label: "Revenue", icon: Wallet, range: "4000–4999" },
    { value: "EXPENSE" as const, label: "Expense", icon: Receipt, range: "5000–6999" },
] as const

const TYPE_RANGES: Record<AccType, [number, number]> = {
    ASSET: [1000, 1999],
    LIABILITY: [2000, 2999],
    EQUITY: [3000, 3999],
    REVENUE: [4000, 4999],
    EXPENSE: [5000, 6999],
}

// ─── Name suggestions per sub-type ───
const NAME_SUGGESTIONS: Record<string, string[]> = {
    ASSET_CASH: ["Kas", "Bank BCA", "Bank Mandiri", "Bank BNI", "Bank BRI", "Kas Kecil (Petty Cash)"],
    ASSET_RECEIVABLE: ["Piutang Usaha", "Piutang Lainnya", "Cadangan Kerugian Piutang"],
    ASSET_CURRENT: ["Persediaan Barang Jadi", "Persediaan Bahan Baku", "Persediaan Dalam Proses (WIP)", "Uang Muka", "PPN Masukan"],
    ASSET_PREPAYMENTS: ["Asuransi Dibayar Dimuka", "Sewa Dibayar Dimuka", "PPh Dibayar Dimuka"],
    ASSET_FIXED: ["Tanah", "Bangunan", "Kendaraan", "Mesin & Peralatan", "Peralatan Kantor", "Akumulasi Penyusutan"],
    ASSET_NON_CURRENT: ["Investasi Jangka Panjang", "Goodwill", "Hak Paten"],
    LIABILITY_PAYABLE: ["Hutang Usaha", "Hutang Gaji", "Barang Diterima / Faktur Belum Diterima"],
    LIABILITY_CURRENT: ["Hutang Pajak (PPN/PPh)", "Hutang PPh 21", "Hutang PPh 23", "Hutang BPJS", "Pendapatan Diterima Dimuka"],
    LIABILITY_NON_CURRENT: ["Hutang Bank Jangka Panjang", "Hutang Obligasi"],
    EQUITY: ["Modal Disetor", "Prive Pemilik", "Saldo Awal Ekuitas"],
    EQUITY_UNAFFECTED: ["Laba Ditahan", "Laba Tahun Berjalan"],
    INCOME: ["Pendapatan Penjualan", "Pendapatan Jasa", "Diskon Penjualan", "Retur Penjualan"],
    INCOME_OTHER: ["Pendapatan Bunga", "Pendapatan Lain-lain", "Pendapatan Sewa"],
    EXPENSE_DIRECT_COST: ["Beban Pokok Penjualan (HPP)", "Pembelian Bahan Baku", "Upah Langsung Produksi"],
    EXPENSE: [
        "Beban Gaji", "Beban Gaji Kantor", "Komisi Penjualan",
        "Beban Listrik", "Beban Air", "Beban Telepon", "Beban Internet",
        "Beban Sewa", "Beban Asuransi", "Beban Pemeliharaan",
        "Beban Perjalanan Dinas", "Beban Transportasi",
        "Beban ATK", "Beban Perlengkapan Kantor",
        "Beban Reparasi & Pemeliharaan", "Beban Lain-lain",
    ],
    EXPENSE_DEPRECIATION: ["Beban Penyusutan", "Beban Amortisasi"],
}

/** Find the next available code in a range, given existing codes */
function suggestNextCode(existingCodes: string[], type: AccType): string {
    const [min, max] = TYPE_RANGES[type]
    const usedNums = existingCodes
        .map(c => parseInt(c, 10))
        .filter(n => n >= min && n <= max)
        .sort((a, b) => a - b)

    if (usedNums.length === 0) return String(min)

    const last = usedNums[usedNums.length - 1]
    const next10 = Math.ceil((last + 1) / 10) * 10
    if (next10 <= max && !usedNums.includes(next10)) return String(next10)
    const next100 = Math.ceil((last + 1) / 100) * 100
    if (next100 <= max && !usedNums.includes(next100)) return String(next100)
    const fallback = last + 10
    if (fallback <= max && !usedNums.includes(fallback)) return String(fallback)

    return String(last + 1 <= max ? last + 1 : min)
}

/** Flatten tree to array */
function flattenTree(nodes: GLAccountNode[]): GLAccountNode[] {
    const result: GLAccountNode[] = []
    function walk(list: GLAccountNode[]) {
        for (const n of list) {
            result.push(n)
            if (n.children?.length) walk(n.children)
        }
    }
    walk(nodes)
    return result
}

const fadeUp = {
    hidden: { opacity: 0, y: 14 },
    show: { opacity: 1, y: 0, transition: { type: "spring" as const, stiffness: 320, damping: 26 } },
}

export default function CoALedgerPage() {
    const { data: accounts = [], isLoading: loading } = useChartOfAccounts()
    const invalidateChartAccounts = useInvalidateChartAccounts()
    const queryClient = useQueryClient()
    const [search, setSearch] = useState("")
    const [filterType, setFilterType] = useState<"ALL" | AccType>("ALL")

    // Create dialog
    const [createOpen, setCreateOpen] = useState(false)
    const [submitting, setSubmitting] = useState(false)
    const [newCode, setNewCode] = useState("")
    const [newName, setNewName] = useState("")
    const [newType, setNewType] = useState<AccType>("ASSET")
    const [showSuggestions, setShowSuggestions] = useState(false)
    const suggestionsRef = useRef<HTMLDivElement>(null)

    // Edit dialog
    const [editOpen, setEditOpen] = useState(false)
    const [editId, setEditId] = useState("")
    const [editCode, setEditCode] = useState("")
    const [editName, setEditName] = useState("")
    const [editType, setEditType] = useState<AccType>("ASSET")
    const [editSubmitting, setEditSubmitting] = useState(false)

    // Delete dialog
    const [deleteOpen, setDeleteOpen] = useState(false)
    const [deleteTarget, setDeleteTarget] = useState<GLAccountNode | null>(null)
    const [deleteSubmitting, setDeleteSubmitting] = useState(false)

    // Flatten tree for table display
    const allFlat = useMemo(() => flattenTree(accounts), [accounts])
    const allExistingCodes = useMemo(() => allFlat.map(n => n.code), [allFlat])
    const allExistingNames = useMemo(() => allFlat.map(n => ({ code: n.code, name: n.name })), [allFlat])

    // Filtered list
    const filteredAccounts = useMemo(() => {
        return allFlat.filter((acc) => {
            const matchesSearch = acc.name.toLowerCase().includes(search.toLowerCase()) || acc.code.includes(search)
            if (!matchesSearch) return false
            if (filterType === "ALL") return true
            return acc.type === filterType
        })
    }, [allFlat, search, filterType])

    // Auto-suggest code when type changes in create form
    const handleTypeChange = (type: AccType) => {
        setNewType(type)
        setNewCode(suggestNextCode(allExistingCodes, type))
        setNewName("")
    }

    // Code validations
    const codeRangeWarning = useMemo(() => {
        const num = parseInt(newCode, 10)
        if (isNaN(num) || !newCode.trim()) return null
        const [min, max] = TYPE_RANGES[newType]
        if (num < min || num > max) return `Kode ${newCode} tidak sesuai dengan tipe ${newType} (${min}–${max})`
        return null
    }, [newCode, newType])

    const duplicateCodeWarning = useMemo(() => {
        if (!newCode.trim()) return null
        const match = allExistingNames.find(n => n.code === newCode.trim())
        if (match) return `Kode ${newCode} sudah digunakan oleh: ${match.name}`
        return null
    }, [newCode, allExistingNames])

    // Name suggestions
    const currentSubType = useMemo(() => newCode.trim() ? inferSubType(newCode.trim()) : "", [newCode])
    const currentSuggestions = useMemo(() => {
        const pool = NAME_SUGGESTIONS[currentSubType] || []
        if (!newName.trim()) return pool
        const lower = newName.trim().toLowerCase()
        return pool.filter(s => s.toLowerCase().includes(lower))
    }, [newName, currentSubType])

    // Close suggestions on outside click
    useEffect(() => {
        function handleClick(e: MouseEvent) {
            if (suggestionsRef.current && !suggestionsRef.current.contains(e.target as Node)) {
                setShowSuggestions(false)
            }
        }
        document.addEventListener("mousedown", handleClick)
        return () => document.removeEventListener("mousedown", handleClick)
    }, [])

    function invalidateAll() {
        invalidateChartAccounts()
        queryClient.invalidateQueries({ queryKey: queryKeys.glAccounts.all })
        queryClient.invalidateQueries({ queryKey: queryKeys.financeDashboard.all })
        queryClient.invalidateQueries({ queryKey: queryKeys.journal.all })
        queryClient.invalidateQueries({ queryKey: queryKeys.financeReports.all })
    }

    function resetCreateForm() {
        setNewCode("")
        setNewName("")
        setNewType("ASSET")
        setShowSuggestions(false)
    }

    async function handleCreateAccount() {
        if (!newCode.trim() || !newName.trim()) {
            toast.error("Kode dan nama akun wajib diisi")
            return
        }
        if (duplicateCodeWarning) {
            toast.error(duplicateCodeWarning)
            return
        }
        setSubmitting(true)
        try {
            const result = await createGLAccount({ code: newCode.trim(), name: newName.trim(), type: newType })
            if (!result.success) {
                toast.error(("error" in result ? result.error : null) || "Gagal membuat akun")
                return
            }
            toast.success(`Akun ${newCode} — ${newName} berhasil dibuat`)
            resetCreateForm()
            setCreateOpen(false)
            invalidateAll()
        } finally {
            setSubmitting(false)
        }
    }

    function openEdit(acc: GLAccountNode) {
        setEditId(acc.id)
        setEditCode(acc.code)
        setEditName(acc.name)
        setEditType(acc.type as AccType)
        setEditOpen(true)
    }

    async function handleEditAccount() {
        if (!editName.trim()) {
            toast.error("Nama akun wajib diisi")
            return
        }
        setEditSubmitting(true)
        try {
            const result = await updateGLAccount({ id: editId, name: editName.trim(), type: editType })
            if (!result.success) {
                toast.error(("error" in result ? result.error : null) || "Gagal mengubah akun")
                return
            }
            toast.success(`Akun ${editCode} berhasil diubah`)
            setEditOpen(false)
            invalidateAll()
        } finally {
            setEditSubmitting(false)
        }
    }

    function openDelete(acc: GLAccountNode) {
        setDeleteTarget(acc)
        setDeleteOpen(true)
    }

    async function handleDeleteAccount() {
        if (!deleteTarget) return
        setDeleteSubmitting(true)
        try {
            const result = await deleteGLAccount(deleteTarget.id)
            if (!result.success) {
                toast.error(("error" in result ? result.error : null) || "Gagal menghapus akun")
                return
            }
            toast.success(`Akun ${deleteTarget.code} — ${deleteTarget.name} berhasil dihapus`)
            setDeleteOpen(false)
            setDeleteTarget(null)
            invalidateAll()
        } finally {
            setDeleteSubmitting(false)
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

    const typeBadgeColor: Record<string, string> = {
        ASSET: "border-blue-200 bg-blue-50 text-blue-600",
        LIABILITY: "border-red-200 bg-red-50 text-red-600",
        EQUITY: "border-purple-200 bg-purple-50 text-purple-600",
        REVENUE: "border-emerald-200 bg-emerald-50 text-emerald-600",
        EXPENSE: "border-amber-200 bg-amber-50 text-amber-600",
    }

    return (
        <motion.div className="mf-page" initial="hidden" animate="show" variants={{ hidden: { opacity: 0 }, show: { opacity: 1, transition: { staggerChildren: 0.07 } } }}>
            {/* ─── Page Header Card ─── */}
            <motion.div variants={fadeUp} className={NB.pageCard}>
                <div className={NB.pageAccent} />

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
                                Daftar akun & saldo berjalan
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
                                    { header: "Sub-Tipe", accessorKey: "subTypeLabel" },
                                    { header: "Saldo", accessorKey: "balance" },
                                ]
                                const rows = filteredAccounts.map(n => ({
                                    code: n.code,
                                    name: n.name,
                                    type: n.type,
                                    subTypeLabel: subTypeLabel(n.subType),
                                    balance: n.balance,
                                }))
                                exportToExcel(cols, rows, { filename: "chart-of-accounts" })
                            }}
                            variant="outline"
                            className={NB.toolbarBtn}
                        >
                            <Download className="h-3.5 w-3.5 mr-1.5" /> Export
                        </Button>
                        <Button
                            onClick={() => setCreateOpen(true)}
                            className={`${NB.toolbarBtnPrimary} ml-2`}
                        >
                            <Plus className="h-3.5 w-3.5 mr-1.5" /> Tambah Akun
                        </Button>
                    </div>
                </div>

                {/* Row 2: Filter Toolbar */}
                <div className="px-5 py-2.5 flex items-center justify-between bg-zinc-50/80 dark:bg-zinc-800/30">
                    <div className="flex items-center gap-0">
                        {/* Search input */}
                        <div className="relative">
                            <Search
                                className={`pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 z-10 transition-colors ${
                                    search ? NB.inputIconActive : NB.inputIconEmpty
                                }`}
                            />
                            <input
                                className={`border border-r-0 font-medium h-9 w-[260px] text-xs rounded-none pl-9 pr-8 outline-none placeholder:text-zinc-300 transition-all ${
                                    search ? NB.inputActive : NB.inputEmpty
                                }`}
                                placeholder="Cari kode atau nama..."
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
                        {/* Type filter buttons */}
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

            {/* ─── Account Table ─── */}
            <motion.div
                variants={fadeUp}
                className="border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] bg-white dark:bg-zinc-900 overflow-hidden"
            >
                {/* Table header */}
                <div className="grid grid-cols-[100px_1fr_120px_120px_160px_80px] items-center px-5 py-2.5 bg-black dark:bg-zinc-950 border-b-2 border-black">
                    <span className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Kode</span>
                    <span className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Nama Akun</span>
                    <span className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Tipe</span>
                    <span className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Klasifikasi</span>
                    <span className="text-[10px] font-black uppercase tracking-widest text-zinc-400 text-right">Saldo (IDR)</span>
                    <span className="text-[10px] font-black uppercase tracking-widest text-zinc-400 text-center">Aksi</span>
                </div>

                {loading ? (
                    <div className="divide-y divide-zinc-100 dark:divide-zinc-800">
                        {Array.from({ length: 8 }).map((_, i) => (
                            <div key={i} className="grid grid-cols-[100px_1fr_120px_120px_160px_80px] items-center px-5 py-3 animate-pulse">
                                <div className="h-4 w-14 bg-zinc-200 dark:bg-zinc-700 rounded-sm" />
                                <div className="h-4 w-40 bg-zinc-200 dark:bg-zinc-700 rounded-sm" />
                                <div className="h-4 w-16 bg-zinc-100 dark:bg-zinc-800 rounded-sm" />
                                <div className="h-4 w-20 bg-zinc-100 dark:bg-zinc-800 rounded-sm" />
                                <div className="h-4 w-28 bg-zinc-200 dark:bg-zinc-700 rounded-sm ml-auto" />
                                <div className="h-4 w-12 bg-zinc-100 dark:bg-zinc-800 rounded-sm mx-auto" />
                            </div>
                        ))}
                    </div>
                ) : filteredAccounts.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-16 text-zinc-400">
                        <div className="w-16 h-16 border-2 border-zinc-200 dark:border-zinc-700 flex items-center justify-center mb-4">
                            <BookOpen className="h-7 w-7 text-zinc-200 dark:text-zinc-700" />
                        </div>
                        <span className="text-sm font-bold">Tidak ada akun ditemukan</span>
                        <span className="text-xs text-zinc-400 mt-1">Coba ubah filter atau tambah akun baru</span>
                    </div>
                ) : (
                    <div className="divide-y divide-zinc-100 dark:divide-zinc-800 overflow-x-auto">
                        {filteredAccounts.map((acc) => (
                            <div
                                key={acc.id}
                                className="grid grid-cols-[100px_1fr_120px_120px_160px_80px] items-center px-5 py-2.5 hover:bg-orange-50/50 dark:hover:bg-orange-950/10 transition-colors"
                            >
                                <span className="font-mono font-bold text-xs text-zinc-500">{acc.code}</span>
                                <div className="flex items-center gap-2">
                                    <span className="font-medium text-sm text-zinc-900 dark:text-white truncate">{acc.name}</span>
                                    {acc.isSystem && (
                                        <span title="Akun sistem"><Lock className="h-3 w-3 text-zinc-300 shrink-0" /></span>
                                    )}
                                </div>
                                <span className={`text-[9px] font-black uppercase tracking-widest px-1.5 py-0.5 border w-fit ${typeBadgeColor[acc.type] || "border-zinc-200 bg-zinc-50 text-zinc-400"}`}>
                                    {acc.type}
                                </span>
                                <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">
                                    {acc.subType && acc.subType !== "GENERAL" ? subTypeLabel(acc.subType) : "—"}
                                </span>
                                <span className={`text-right font-mono font-bold text-sm tracking-tight ${
                                    acc.balance < 0 ? "text-red-500" : "text-zinc-900 dark:text-white"
                                }`}>
                                    {formatIDR(acc.balance)}
                                </span>
                                <div className="flex items-center justify-center gap-1">
                                    <button
                                        onClick={() => openEdit(acc)}
                                        className="p-1.5 text-zinc-400 hover:text-orange-500 transition-colors"
                                        title="Edit akun"
                                    >
                                        <Pencil className="h-3.5 w-3.5" />
                                    </button>
                                    <button
                                        onClick={() => openDelete(acc)}
                                        disabled={acc.isSystem}
                                        className={`p-1.5 transition-colors ${
                                            acc.isSystem
                                                ? "text-zinc-200 cursor-not-allowed"
                                                : "text-zinc-400 hover:text-red-500"
                                        }`}
                                        title={acc.isSystem ? "Akun sistem tidak bisa dihapus" : "Hapus akun"}
                                    >
                                        <Trash2 className="h-3.5 w-3.5" />
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
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
            <NBDialog open={createOpen} onOpenChange={(open) => { if (!open) resetCreateForm(); setCreateOpen(open) }} size="default">
                <NBDialogHeader
                    icon={BookOpen}
                    title="Tambah Akun COA"
                    subtitle="Buat akun baru di chart of accounts"
                />
                <NBDialogBody>
                    <NBSection icon={Layers} title="Detail Akun">
                        {/* Account Type Selector */}
                        <div>
                            <label className="text-[11px] font-bold uppercase tracking-wider text-zinc-600 dark:text-zinc-400 mb-1.5 block">
                                Tipe Akun <span className="text-red-500">*</span>
                            </label>
                            <div className="grid grid-cols-5 gap-2">
                                {ACCOUNT_TYPES.map(({ value, label, icon: Icon, range }) => (
                                    <button
                                        key={value}
                                        type="button"
                                        onClick={() => handleTypeChange(value)}
                                        className={`flex flex-col items-center gap-1.5 p-3 border transition-all ${
                                            newType === value
                                                ? "border-orange-400 bg-orange-50/50 shadow-[2px_2px_0px_0px_rgba(0,0,0,0.1)]"
                                                : "border-zinc-200 bg-white hover:border-zinc-400 hover:bg-zinc-50"
                                        }`}
                                    >
                                        <Icon className={`h-4 w-4 ${newType === value ? "text-orange-500" : "text-zinc-400"}`} />
                                        <span className={`text-[9px] font-black uppercase tracking-widest ${newType === value ? "text-orange-600" : "text-zinc-400"}`}>
                                            {label}
                                        </span>
                                        <span className={`text-[8px] font-mono ${newType === value ? "text-orange-400" : "text-zinc-300"}`}>
                                            {range}
                                        </span>
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Code + Name */}
                        <div className="grid grid-cols-3 gap-3">
                            <div>
                                <NBInput
                                    label="Kode"
                                    required
                                    value={newCode}
                                    onChange={setNewCode}
                                    placeholder={String(TYPE_RANGES[newType][0])}
                                />
                                <p className="text-[9px] text-zinc-400 mt-0.5">Range: {TYPE_RANGES[newType][0]}–{TYPE_RANGES[newType][1]}</p>
                            </div>

                            <div className="col-span-2 relative" ref={suggestionsRef}>
                                <NBInput
                                    label="Nama Akun"
                                    required
                                    value={newName}
                                    onChange={(v) => {
                                        setNewName(v)
                                        setShowSuggestions(true)
                                    }}
                                    placeholder="Nama akun..."
                                />
                                {showSuggestions && currentSuggestions.length > 0 && (
                                    <div className="absolute z-50 top-full left-0 right-0 mt-1 border border-zinc-300 bg-white shadow-lg max-h-40 overflow-y-auto">
                                        {currentSuggestions.map((s) => (
                                            <button
                                                key={s}
                                                type="button"
                                                onClick={() => {
                                                    setNewName(s)
                                                    setShowSuggestions(false)
                                                }}
                                                className="w-full text-left px-3 py-1.5 text-sm hover:bg-orange-50 transition-colors border-b border-zinc-100 last:border-b-0"
                                            >
                                                {s}
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Auto-detected classification preview */}
                        {newCode.trim() && (
                            <div className="flex items-center gap-2 px-3 py-2 border border-dashed border-zinc-300 bg-zinc-50 text-xs">
                                <span className="text-zinc-400 font-bold uppercase text-[9px]">Klasifikasi otomatis:</span>
                                <span className="font-bold text-zinc-600">
                                    {currentSubType && currentSubType !== "GENERAL" ? subTypeLabel(currentSubType) : newType}
                                </span>
                            </div>
                        )}

                        {/* Warnings */}
                        {codeRangeWarning && (
                            <div className="flex items-center gap-2 px-3 py-2 border border-amber-300 bg-amber-50 text-amber-700 text-xs font-bold">
                                <AlertTriangle className="h-3.5 w-3.5 shrink-0" /> {codeRangeWarning}
                            </div>
                        )}
                        {duplicateCodeWarning && (
                            <div className="flex items-center gap-2 px-3 py-2 border border-red-300 bg-red-50 text-red-700 text-xs font-bold">
                                <AlertTriangle className="h-3.5 w-3.5 shrink-0" /> {duplicateCodeWarning}
                            </div>
                        )}
                    </NBSection>
                </NBDialogBody>
                <NBDialogFooter
                    onCancel={() => { resetCreateForm(); setCreateOpen(false) }}
                    onSubmit={handleCreateAccount}
                    submitting={submitting}
                    submitLabel="Simpan Akun"
                    disabled={!newCode.trim() || !newName.trim() || !!duplicateCodeWarning}
                />
            </NBDialog>

            {/* ─── Edit Account Dialog ─── */}
            <NBDialog open={editOpen} onOpenChange={setEditOpen} size="narrow">
                <NBDialogHeader
                    icon={Pencil}
                    title="Edit Akun"
                    subtitle={`Kode: ${editCode} (tidak bisa diubah)`}
                />
                <NBDialogBody>
                    <NBSection icon={Layers} title="Detail Akun">
                        <div className="space-y-3">
                            <div>
                                <label className="text-[11px] font-bold uppercase tracking-wider text-zinc-600 dark:text-zinc-400 mb-1 block">
                                    Kode Akun
                                </label>
                                <div className="h-8 flex items-center px-3 border border-zinc-200 bg-zinc-100 text-sm font-mono font-bold text-zinc-500">
                                    {editCode}
                                    <Lock className="h-3 w-3 ml-auto text-zinc-300" />
                                </div>
                            </div>
                            <NBInput
                                label="Nama Akun"
                                required
                                value={editName}
                                onChange={setEditName}
                                placeholder="Nama akun..."
                            />
                            <NBSelect
                                label="Tipe Akun"
                                required
                                value={editType}
                                onValueChange={(v) => setEditType(v as AccType)}
                                options={ACCOUNT_TYPES.map(t => ({ value: t.value, label: t.label }))}
                            />
                        </div>
                    </NBSection>
                </NBDialogBody>
                <NBDialogFooter
                    onCancel={() => setEditOpen(false)}
                    onSubmit={handleEditAccount}
                    submitting={editSubmitting}
                    submitLabel="Simpan Perubahan"
                    disabled={!editName.trim()}
                />
            </NBDialog>

            {/* ─── Delete Confirmation Dialog ─── */}
            <NBDialog open={deleteOpen} onOpenChange={setDeleteOpen} size="narrow">
                <NBDialogHeader
                    icon={Trash2}
                    title="Hapus Akun"
                    subtitle="Tindakan ini tidak bisa dibatalkan"
                />
                <NBDialogBody>
                    {deleteTarget && (
                        <div className="space-y-3">
                            <div className="flex items-center gap-3 p-4 border-2 border-red-200 bg-red-50">
                                <AlertTriangle className="h-5 w-5 text-red-500 shrink-0" />
                                <div>
                                    <p className="text-sm font-bold text-red-700">
                                        Hapus akun {deleteTarget.code} — {deleteTarget.name}?
                                    </p>
                                    <p className="text-xs text-red-500 mt-1">
                                        Akun akan dihapus permanen dari chart of accounts.
                                    </p>
                                </div>
                            </div>
                        </div>
                    )}
                </NBDialogBody>
                <NBDialogFooter
                    onCancel={() => { setDeleteOpen(false); setDeleteTarget(null) }}
                    onSubmit={handleDeleteAccount}
                    submitting={deleteSubmitting}
                    submitLabel="Hapus Akun"
                />
            </NBDialog>
        </motion.div>
    )
}
