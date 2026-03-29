"use client"

import { useState, useMemo, useRef, useEffect } from "react"
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
    AlertTriangle,
    Settings,
    Layers,
    Tag,
} from "lucide-react"
import { motion, AnimatePresence } from "framer-motion"
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
    NBTextarea,
} from "@/components/ui/nb-dialog"
import { SelectItem } from "@/components/ui/select"
import { createGLAccount, type GLAccountNode } from "@/lib/actions/finance"
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

const SALDO_NORMAL: Record<AccType, string> = {
    ASSET: "Debit",
    LIABILITY: "Kredit",
    EQUITY: "Kredit",
    REVENUE: "Kredit",
    EXPENSE: "Debit",
}

// ─── Sub-type options per type ───
const SUB_TYPE_OPTIONS: Record<AccType, { value: string; label: string }[]> = {
    ASSET: [
        { value: "ASSET_CASH", label: "Kas & Bank" },
        { value: "ASSET_RECEIVABLE", label: "Piutang" },
        { value: "ASSET_CURRENT", label: "Aset Lancar" },
        { value: "ASSET_PREPAYMENTS", label: "Biaya Dibayar Dimuka" },
        { value: "ASSET_FIXED", label: "Aset Tetap" },
        { value: "ASSET_NON_CURRENT", label: "Aset Tidak Berwujud" },
    ],
    LIABILITY: [
        { value: "LIABILITY_PAYABLE", label: "Hutang Usaha" },
        { value: "LIABILITY_CURRENT", label: "Kewajiban Lancar" },
        { value: "LIABILITY_NON_CURRENT", label: "Kewajiban Jangka Panjang" },
    ],
    EQUITY: [
        { value: "EQUITY", label: "Modal Disetor" },
        { value: "EQUITY_UNAFFECTED", label: "Laba Ditahan" },
    ],
    REVENUE: [
        { value: "INCOME", label: "Pendapatan Usaha" },
        { value: "INCOME_OTHER", label: "Pendapatan Lain-lain" },
    ],
    EXPENSE: [
        { value: "EXPENSE_DIRECT_COST", label: "Beban Pokok Penjualan" },
        { value: "EXPENSE", label: "Beban Operasional" },
        { value: "EXPENSE_DEPRECIATION", label: "Penyusutan" },
    ],
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
    LIABILITY_CURRENT: ["Hutang Pajak (PPN/PPh)", "Hutang PPh 21", "Hutang PPh 23", "Hutang BPJS", "Pendapatan Diterima Dimuka", "Biaya Yang Masih Harus Dibayar"],
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
        "Beban THR", "Beban BPJS",
        "Beban Perjalanan Dinas", "Beban Transportasi",
        "Beban ATK", "Beban Perlengkapan Kantor",
        "Beban Reparasi & Pemeliharaan", "Beban Lain-lain",
    ],
    EXPENSE_DEPRECIATION: ["Beban Penyusutan", "Beban Amortisasi"],
}

// ─── Auto-description from name ───
const NAME_DESCRIPTIONS: Record<string, string> = {
    "Kas": "Pencatatan kas tunai perusahaan",
    "Kas Kecil (Petty Cash)": "Dana kas kecil untuk pengeluaran operasional harian",
    "Bank BCA": "Rekening giro Bank BCA untuk operasional",
    "Bank Mandiri": "Rekening giro Bank Mandiri",
    "Bank BNI": "Rekening giro Bank BNI",
    "Bank BRI": "Rekening giro Bank BRI",
    "Piutang Usaha": "Tagihan kepada pelanggan atas penjualan barang/jasa",
    "Piutang Lainnya": "Piutang di luar kegiatan usaha utama",
    "Persediaan Barang Jadi": "Stok barang siap jual",
    "Persediaan Bahan Baku": "Stok bahan baku untuk produksi",
    "Persediaan Dalam Proses (WIP)": "Barang dalam proses produksi",
    "PPN Masukan": "Pajak pertambahan nilai atas pembelian",
    "Tanah": "Tanah milik perusahaan",
    "Bangunan": "Gedung dan bangunan milik perusahaan",
    "Kendaraan": "Kendaraan operasional perusahaan",
    "Mesin & Peralatan": "Mesin dan peralatan produksi",
    "Peralatan Kantor": "Peralatan untuk kegiatan kantor",
    "Akumulasi Penyusutan": "Akumulasi penyusutan atas aset tetap",
    "Hutang Usaha": "Kewajiban kepada supplier atas pembelian barang/jasa",
    "Hutang Gaji": "Kewajiban gaji karyawan yang belum dibayar",
    "Hutang Pajak (PPN/PPh)": "Kewajiban pajak yang belum disetor",
    "Pendapatan Diterima Dimuka": "Penerimaan atas jasa/barang yang belum diserahkan",
    "Modal Disetor": "Modal yang disetorkan oleh pemilik",
    "Laba Ditahan": "Akumulasi laba bersih yang belum dibagikan",
    "Pendapatan Penjualan": "Pendapatan dari penjualan barang/jasa utama",
    "Pendapatan Jasa": "Pendapatan dari jasa yang diberikan",
    "Pendapatan Bunga": "Pendapatan bunga dari simpanan bank",
    "Beban Pokok Penjualan (HPP)": "Harga pokok barang/jasa yang terjual",
    "Beban Gaji": "Beban gaji dan upah karyawan produksi",
    "Beban Gaji Kantor": "Beban gaji karyawan administrasi/kantor",
    "Beban Listrik": "Pencatatan biaya listrik bulanan untuk operasional",
    "Beban Air": "Pencatatan biaya air (PDAM) bulanan",
    "Beban Telepon": "Pencatatan biaya telepon/komunikasi",
    "Beban Internet": "Pencatatan biaya internet bulanan",
    "Beban Sewa": "Beban sewa gedung/kantor/gudang",
    "Beban Asuransi": "Beban premi asuransi",
    "Beban Pemeliharaan": "Biaya pemeliharaan aset dan fasilitas",
    "Beban ATK": "Beban alat tulis kantor",
    "Beban Perlengkapan Kantor": "Beban perlengkapan kantor habis pakai",
    "Beban Perjalanan Dinas": "Biaya perjalanan dinas karyawan",
    "Beban Transportasi": "Biaya transportasi operasional",
    "Beban Penyusutan": "Beban penyusutan atas aset tetap periode berjalan",
    "Beban Lain-lain": "Beban operasional yang tidak terklasifikasi",
    "Beban Reparasi & Pemeliharaan": "Biaya perbaikan dan pemeliharaan aset",
}

/** Find the next available code in a range, given existing codes */
function suggestNextCode(existingCodes: string[], type: AccType): string {
    const [min, max] = TYPE_RANGES[type]
    const usedNums = existingCodes
        .map(c => parseInt(c, 10))
        .filter(n => n >= min && n <= max)
        .sort((a, b) => a - b)

    if (usedNums.length === 0) return String(min)

    // Try to find next round number (increment by 10 or 100)
    const last = usedNums[usedNums.length - 1]
    // Try next 10-increment
    const next10 = Math.ceil((last + 1) / 10) * 10
    if (next10 <= max && !usedNums.includes(next10)) return String(next10)
    // Try next 100-increment
    const next100 = Math.ceil((last + 1) / 100) * 100
    if (next100 <= max && !usedNums.includes(next100)) return String(next100)
    // Fallback: just last + 10
    const fallback = last + 10
    if (fallback <= max && !usedNums.includes(fallback)) return String(fallback)

    return String(last + 1 <= max ? last + 1 : min)
}

/** Find likely parent account from code */
function findParentCode(code: string, existingCodes: string[]): string | null {
    const num = parseInt(code, 10)
    if (isNaN(num) || code.length < 4) return null

    // Try stripping last 2 digits → e.g. 6210 → 6200
    const parent2 = code.substring(0, 2) + "00"
    if (parent2 !== code && existingCodes.includes(parent2)) return parent2

    // Try stripping last 1 digit → e.g. 6200 → 6000 (using first digit + "000")
    const parent1 = code.substring(0, 1) + "000"
    if (parent1 !== code && existingCodes.includes(parent1)) return parent1

    return null
}

/* ─── Animation variants ─── */
const stagger = {
    hidden: { opacity: 0 },
    show: { opacity: 1, transition: { staggerChildren: 0.07 } },
}
const fadeUp = {
    hidden: { opacity: 0, y: 14 },
    show: { opacity: 1, y: 0, transition: { type: "spring" as const, stiffness: 320, damping: 26 } },
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
                    {node.subType && node.subType !== 'GENERAL' && (
                        <span className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 border border-orange-200 text-orange-500 bg-orange-50">
                            {subTypeLabel(node.subType)}
                        </span>
                    )}
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
    const [newType, setNewType] = useState<AccType>("ASSET")
    const [newSubType, setNewSubType] = useState("")
    const [newDescription, setNewDescription] = useState("")
    const [newPpnRelated, setNewPpnRelated] = useState(false)
    const [showSuggestions, setShowSuggestions] = useState(false)
    const suggestionsRef = useRef<HTMLDivElement>(null)
    const [showAmounts, setShowAmounts] = useState(false)

    // Collect all existing codes for suggestions & duplicate detection
    const allExistingCodes = useMemo(() => {
        const codes: string[] = []
        function walk(nodes: GLAccountNode[]) {
            for (const n of nodes) {
                codes.push(n.code)
                if (n.children) walk(n.children)
            }
        }
        walk(accounts)
        return codes
    }, [accounts])

    // Collect all existing names (lowercase) for duplicate detection
    const allExistingNames = useMemo(() => {
        const names: { code: string; name: string }[] = []
        function walk(nodes: GLAccountNode[]) {
            for (const n of nodes) {
                names.push({ code: n.code, name: n.name })
                if (n.children) walk(n.children)
            }
        }
        walk(accounts)
        return names
    }, [accounts])

    // Auto-suggest code when type changes
    const handleTypeChange = (type: AccType) => {
        setNewType(type)
        // Auto-suggest next code
        const suggested = suggestNextCode(allExistingCodes, type)
        setNewCode(suggested)
        // Auto-suggest sub-type from code
        const autoSub = inferSubType(suggested)
        const options = SUB_TYPE_OPTIONS[type]
        if (options.some(o => o.value === autoSub)) {
            setNewSubType(autoSub)
        } else {
            setNewSubType(options[0]?.value || "")
        }
        // Auto-set PPN default
        setNewPpnRelated(type === "REVENUE" || type === "EXPENSE")
        // Clear name/description for fresh start
        setNewName("")
        setNewDescription("")
    }

    // Auto-detect parent from code
    const detectedParentCode = useMemo(() => {
        if (!newCode.trim()) return null
        return findParentCode(newCode.trim(), allExistingCodes)
    }, [newCode, allExistingCodes])

    const detectedParentName = useMemo(() => {
        if (!detectedParentCode) return null
        const found = allExistingNames.find(n => n.code === detectedParentCode)
        return found ? found.name : null
    }, [detectedParentCode, allExistingNames])

    // Code range validation
    const codeRangeWarning = useMemo(() => {
        const num = parseInt(newCode, 10)
        if (isNaN(num) || !newCode.trim()) return null
        const [min, max] = TYPE_RANGES[newType]
        if (num < min || num > max) {
            return `Kode ${newCode} tidak sesuai dengan tipe ${newType} (${min}–${max})`
        }
        return null
    }, [newCode, newType])

    // Duplicate code detection
    const duplicateCodeWarning = useMemo(() => {
        if (!newCode.trim()) return null
        const match = allExistingNames.find(n => n.code === newCode.trim())
        if (match) return `Kode ${newCode} sudah digunakan oleh: ${match.name}`
        return null
    }, [newCode, allExistingNames])

    // Similar name detection
    const similarNameWarning = useMemo(() => {
        if (!newName.trim() || newName.trim().length < 3) return null
        const lower = newName.trim().toLowerCase()
        const match = allExistingNames.find(n => {
            const nl = n.name.toLowerCase()
            return nl === lower || nl.includes(lower) || lower.includes(nl)
        })
        if (match) return `Akun serupa: ${match.code} ${match.name}`
        return null
    }, [newName, allExistingNames])

    // Auto-update sub-type when code changes
    useEffect(() => {
        if (!newCode.trim()) return
        const autoSub = inferSubType(newCode.trim())
        const options = SUB_TYPE_OPTIONS[newType]
        if (options.some(o => o.value === autoSub)) {
            setNewSubType(autoSub)
        }
    }, [newCode, newType])

    // Name suggestions filtered by what user has typed
    const currentSuggestions = useMemo(() => {
        const pool = NAME_SUGGESTIONS[newSubType] || NAME_SUGGESTIONS[SUB_TYPE_OPTIONS[newType]?.[0]?.value || ""] || []
        if (!newName.trim()) return pool
        const lower = newName.trim().toLowerCase()
        return pool.filter(s => s.toLowerCase().includes(lower))
    }, [newName, newSubType, newType])

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

    function resetCreateForm() {
        setNewCode("")
        setNewName("")
        setNewType("ASSET")
        setNewSubType("")
        setNewDescription("")
        setNewPpnRelated(false)
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
                toast.error(("error" in result ? result.error : null) || "Gagal membuat account")
                return
            }
            toast.success(`Akun ${newCode} — ${newName} berhasil dibuat`)
            resetCreateForm()
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
                                            transition={{ type: "spring" as const, stiffness: 400, damping: 20 }}
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
                                                        transition={{ type: "spring" as const, stiffness: 300, damping: 25 }}
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
                        transition={{ type: "spring" as const, stiffness: 300, damping: 25 }}
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
            <NBDialog open={createOpen} onOpenChange={(open) => { if (!open) resetCreateForm(); setCreateOpen(open) }} size="default">
                <NBDialogHeader
                    icon={BookOpen}
                    title="Tambah Akun COA"
                    subtitle="Buat akun baru langsung masuk ke chart of accounts"
                />

                <NBDialogBody>
                    {/* ── Section 1: Tipe & Klasifikasi ── */}
                    <NBSection icon={Tag} title="Tipe & Klasifikasi">
                        {/* Account Type Selector — visual tile picker with orange active glow */}
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

                        {/* Sub-type dropdown */}
                        <div className="grid grid-cols-2 gap-3">
                            <NBSelect
                                label="Sub-Tipe / Klasifikasi"
                                value={newSubType}
                                onValueChange={setNewSubType}
                                options={SUB_TYPE_OPTIONS[newType]}
                                placeholder="Pilih..."
                            />
                            {/* Saldo normal — read-only info */}
                            <div>
                                <label className="text-[11px] font-bold uppercase tracking-wider text-zinc-600 dark:text-zinc-400 mb-1 block">
                                    Saldo Normal
                                </label>
                                <div className="h-8 flex items-center px-3 border border-zinc-200 bg-zinc-50 text-sm font-bold text-zinc-600">
                                    {SALDO_NORMAL[newType]}
                                    <span className="ml-auto text-[9px] font-medium text-zinc-400 uppercase">otomatis</span>
                                </div>
                            </div>
                        </div>
                    </NBSection>

                    {/* ── Section 2: Detail Akun ── */}
                    <NBSection icon={Layers} title="Detail Akun">
                        <div className="grid grid-cols-3 gap-3">
                            {/* Kode with range hint */}
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

                            {/* Nama Akun with autocomplete */}
                            <div className="col-span-2 relative" ref={suggestionsRef}>
                                <NBInput
                                    label="Nama Akun"
                                    required
                                    value={newName}
                                    onChange={(v) => {
                                        setNewName(v)
                                        setShowSuggestions(true)
                                        // Auto-generate description
                                        if (NAME_DESCRIPTIONS[v]) setNewDescription(NAME_DESCRIPTIONS[v])
                                    }}
                                    placeholder="Biaya Listrik"
                                />
                                {/* Autocomplete dropdown */}
                                {showSuggestions && currentSuggestions.length > 0 && (
                                    <div className="absolute z-50 top-full left-0 right-0 mt-1 border border-zinc-300 bg-white shadow-lg max-h-40 overflow-y-auto">
                                        {currentSuggestions.map((s) => (
                                            <button
                                                key={s}
                                                type="button"
                                                onClick={() => {
                                                    setNewName(s)
                                                    setShowSuggestions(false)
                                                    if (NAME_DESCRIPTIONS[s]) setNewDescription(NAME_DESCRIPTIONS[s])
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

                        {/* Parent account auto-detect */}
                        <div>
                            <label className="text-[11px] font-bold uppercase tracking-wider text-zinc-600 dark:text-zinc-400 mb-1 block">
                                Akun Induk
                            </label>
                            <div className={`h-8 flex items-center px-3 border text-sm font-medium ${
                                detectedParentCode
                                    ? "border-orange-400 bg-orange-50/50 text-zinc-700"
                                    : "border-zinc-200 bg-zinc-50 text-zinc-400"
                            }`}>
                                {detectedParentCode ? (
                                    <>
                                        <span className="font-mono font-bold text-xs mr-2">{detectedParentCode}</span>
                                        {detectedParentName}
                                    </>
                                ) : (
                                    "Akun utama (tanpa induk)"
                                )}
                                <span className="ml-auto text-[9px] font-medium text-zinc-400 uppercase">otomatis</span>
                            </div>
                        </div>

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
                        {similarNameWarning && !duplicateCodeWarning && (
                            <div className="flex items-center gap-2 px-3 py-2 border border-amber-300 bg-amber-50 text-amber-700 text-xs font-bold">
                                <AlertTriangle className="h-3.5 w-3.5 shrink-0" /> {similarNameWarning} — yakin buat baru?
                            </div>
                        )}
                    </NBSection>

                    {/* ── Section 3: Pengaturan ── */}
                    <NBSection icon={Settings} title="Pengaturan" optional>
                        <NBTextarea
                            label="Deskripsi"
                            value={newDescription}
                            onChange={setNewDescription}
                            placeholder="Deskripsi akun..."
                            rows={2}
                        />

                        {/* PPN toggle */}
                        <div className="flex items-center justify-between">
                            <div>
                                <label className="text-[11px] font-bold uppercase tracking-wider text-zinc-600 dark:text-zinc-400 block">
                                    Terkait PPN
                                </label>
                                <p className="text-[9px] text-zinc-400">Akun ini melibatkan transaksi PPN</p>
                            </div>
                            <button
                                type="button"
                                onClick={() => setNewPpnRelated(!newPpnRelated)}
                                className={`relative w-11 h-6 rounded-none border-2 transition-colors cursor-pointer ${
                                    newPpnRelated
                                        ? "bg-emerald-500 border-emerald-600"
                                        : "bg-zinc-200 dark:bg-zinc-700 border-zinc-300 dark:border-zinc-600"
                                }`}
                            >
                                <span className={`absolute top-0.5 w-4 h-4 bg-white rounded-none shadow transition-transform ${
                                    newPpnRelated ? "translate-x-[22px]" : "translate-x-0.5"
                                }`} />
                            </button>
                        </div>

                        {/* Preview strip */}
                        {(newCode.trim() || newName.trim()) && (
                            <div className="border border-dashed border-zinc-300 bg-zinc-50 px-4 py-2.5 flex items-center gap-3">
                                <span className="text-[9px] font-black uppercase tracking-widest text-zinc-400">Preview</span>
                                <span className="font-mono font-bold text-sm text-zinc-900">{newCode || "\u2014"}</span>
                                <span className="text-sm font-bold text-zinc-700">{newName || "\u2014"}</span>
                                <span className="text-[8px] font-black uppercase tracking-widest px-1.5 py-0.5 border border-orange-200 text-orange-500 bg-orange-50 ml-auto">
                                    {newSubType ? subTypeLabel(newSubType) : newType}
                                </span>
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
        </motion.div>
    )
}
