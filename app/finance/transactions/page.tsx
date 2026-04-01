"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import Link from "next/link"
import {
    BookOpen,
    Search,
    ChevronDown,
    ChevronRight,
    Download,
    Filter,
    RotateCcw,
    X,
    Eye,
    EyeOff,
    ArrowUpDown,
} from "lucide-react"
import { motion, AnimatePresence } from "framer-motion"
import { Button } from "@/components/ui/button"
import { CheckboxFilter } from "@/components/ui/checkbox-filter"
import { NB } from "@/lib/dialog-styles"
import { formatIDR } from "@/lib/utils"
import { useAccountTransactions } from "@/hooks/use-account-transactions"
import { TablePageSkeleton } from "@/components/ui/page-skeleton"

/* ─── Animation variants ─── */
const stagger = {
    hidden: { opacity: 0 },
    show: { opacity: 1, transition: { staggerChildren: 0.07 } },
}
const fadeUp = {
    hidden: { opacity: 0, y: 14 },
    show: { opacity: 1, y: 0, transition: { type: "spring" as const, stiffness: 320, damping: 26 } },
}

// ─── Types ───────────────────────────────────────────────
interface TransactionLine {
    id: string
    accountCode: string
    accountName: string
    accountType: string
    description: string | null
    debit: number
    credit: number
}

interface TransactionEntry {
    id: string
    date: string
    description: string
    reference: string | null
    invoiceId: string | null
    invoiceNumber: string | null
    invoiceType: string | null
    paymentId: string | null
    paymentNumber: string | null
    paymentMethod: string | null
    paymentSupplierId: string | null
    paymentCustomerId: string | null
    lines: TransactionLine[]
}

// ─── Xero-style Source label derivation ──────────────────
function deriveSource(entry: TransactionEntry, line: TransactionLine): string {
    const isPayment = !!entry.paymentNumber || !!entry.paymentMethod
    const isInvoice = !!entry.invoiceNumber
    const isPayable = entry.invoiceType === "INV_IN" || line.accountType === "LIABILITY" || line.accountCode === "2000"
    const isReceivable = entry.invoiceType === "INV_OUT" || (line.accountType === "ASSET" && line.accountCode === "1200")

    if (isPayment && isPayable) return "Pembayaran Hutang"
    if (isPayment && isReceivable) return "Penerimaan Piutang"
    if (isPayment) return `Pembayaran (${entry.paymentMethod === "CASH" ? "Tunai" : entry.paymentMethod === "TRANSFER" ? "Transfer Bank" : entry.paymentMethod === "CHECK" ? "Cek" : entry.paymentMethod === "GIRO" ? "Giro" : entry.paymentMethod === "CREDIT_CARD" ? "Kartu Kredit" : "Lainnya"})`
    if (isInvoice && isPayable) return "Tagihan Masuk"
    if (isInvoice && isReceivable) return "Invoice Piutang"
    if (isInvoice) return entry.invoiceType === "INV_IN" ? "Tagihan Masuk" : "Invoice Piutang"

    const desc = (entry.description || "").toLowerCase()
    if (desc.includes("gaji") || desc.includes("payroll")) return "Penggajian"
    if (desc.includes("sewa") || desc.includes("rent")) return "Beban Operasional"
    if (desc.includes("bahan") || desc.includes("material")) return "Pembelian Bahan"
    if (line.accountType === "EXPENSE") return "Beban Operasional"
    if (line.accountType === "REVENUE") return "Pendapatan"

    return "Jurnal Manual"
}

function sourceColor(source: string): string {
    if (source.includes("Piutang") || source.includes("Invoice")) return "bg-blue-50 border-blue-200 text-blue-600"
    if (source.includes("Hutang") || source.includes("Tagihan")) return "bg-purple-50 border-purple-200 text-purple-600"
    if (source.includes("Penerimaan")) return "bg-emerald-50 border-emerald-200 text-emerald-600"
    if (source.includes("Pembayaran")) return "bg-amber-50 border-amber-200 text-amber-600"
    if (source.includes("Penggajian")) return "bg-pink-50 border-pink-200 text-pink-600"
    if (source.includes("Operasional") || source.includes("Beban")) return "bg-orange-50 border-orange-200 text-orange-600"
    if (source.includes("Pendapatan")) return "bg-green-50 border-green-200 text-green-600"
    if (source.includes("Bahan")) return "bg-cyan-50 border-cyan-200 text-cyan-600"
    return "bg-zinc-50 border-zinc-200 text-zinc-500"
}

// CREDIT-normal accounts: balance increases with credits, decreases with debits
// (Revenue, Liability, Equity follow PSAK/IFRS credit-normal convention)
const CREDIT_NORMAL_TYPES = new Set(["REVENUE", "LIABILITY", "EQUITY"])

function computeRunningBalance(prev: number, debit: number, credit: number, accountType: string): number {
    return CREDIT_NORMAL_TYPES.has(accountType)
        ? prev + credit - debit   // credits increase, debits decrease
        : prev + debit - credit   // debits increase, credits decrease (ASSET, EXPENSE)
}

const ACCOUNT_TYPE_COLORS: Record<string, { bg: string; text: string; border: string }> = {
    ASSET: { bg: "bg-blue-50", text: "text-blue-700", border: "border-l-blue-400" },
    LIABILITY: { bg: "bg-red-50", text: "text-red-700", border: "border-l-red-400" },
    EQUITY: { bg: "bg-purple-50", text: "text-purple-700", border: "border-l-purple-400" },
    REVENUE: { bg: "bg-emerald-50", text: "text-emerald-700", border: "border-l-emerald-400" },
    EXPENSE: { bg: "bg-orange-50", text: "text-orange-700", border: "border-l-orange-400" },
}

const fmtDate = (d: string) =>
    new Date(d).toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric" })

// ─── Clickable reference helper ─────────────────────────
function ReferenceLink({
    reference,
    invoiceId,
    paymentId,
    paymentSupplierId,
    paymentCustomerId: _paymentCustomerId,
    router,
}: {
    reference: string | null
    invoiceId: string | null
    paymentId: string | null
    paymentSupplierId: string | null
    paymentCustomerId: string | null
    router: ReturnType<typeof useRouter>
}) {
    const ref = reference || "\u2014"

    if (invoiceId) {
        return (
            <button
                type="button"
                onClick={() => router.push(`/finance/invoices?highlight=${invoiceId}`)}
                className="text-[11px] font-mono text-blue-600 hover:text-blue-800 hover:underline px-3 py-1.5 truncate text-left cursor-pointer"
                title={`Buka invoice ${ref}`}
            >
                {ref}
            </button>
        )
    }
    if (paymentId) {
        const isAP = !!paymentSupplierId
        const dest = isAP
            ? `/finance/vendor-payments?highlight=${paymentId}`
            : `/finance/payments?highlight=${paymentId}`
        const label = isAP ? "Buka pembayaran vendor" : "Buka pembayaran masuk"
        return (
            <button
                type="button"
                onClick={() => router.push(dest)}
                className="text-[11px] font-mono text-blue-600 hover:text-blue-800 hover:underline px-3 py-1.5 truncate text-left cursor-pointer"
                title={`${label} ${ref}`}
            >
                {ref}
            </button>
        )
    }
    // Fallback: resolve source document from reference pattern
    const sourceLink = getSourceDocumentLink(reference)
    if (sourceLink) {
        return (
            <span className="px-3 py-1.5 flex items-center gap-1.5">
                <span className="text-[11px] font-mono text-zinc-500">{ref}</span>
                <Link
                    href={sourceLink.href}
                    className="text-[10px] text-orange-600 hover:text-orange-800 hover:underline font-bold whitespace-nowrap"
                    title={`Lihat ${sourceLink.label}`}
                >
                    {sourceLink.label} &rarr;
                </Link>
            </span>
        )
    }
    return <span className="text-[11px] font-mono text-zinc-300 px-3 py-1.5">-</span>
}

type GroupMode = "FLAT" | "ACCOUNT"
type DatePreset = "CUSTOM" | "THIS_MONTH" | "LAST_MONTH" | "THIS_QUARTER" | "THIS_YEAR" | "ALL_TIME"

interface AccountRow {
    date: string
    source: string
    description: string
    reference: string | null
    debit: number
    credit: number
    runningBalance: number
    paymentMethod: string | null
    entryId: string
    invoiceId: string | null
    invoiceNumber: string | null
    paymentId: string | null
    paymentSupplierId: string | null
    paymentCustomerId: string | null
}

// ─── Source document link resolver ───────────────────────
function getSourceDocumentLink(reference: string | null): { href: string; label: string } | null {
    if (!reference) return null
    const ref = reference.toUpperCase()
    if (ref.startsWith('INV-')) return { href: `/finance/invoices?highlight=${reference}`, label: 'Invoice' }
    if (ref.startsWith('BILL-') || ref.includes('BILL')) return { href: `/finance/bills?highlight=${reference}`, label: 'Tagihan' }
    if (ref.startsWith('VPAY-')) return { href: `/finance/vendor-payments`, label: 'Pembayaran Vendor' }
    if (ref.startsWith('PAY-')) return { href: `/finance/payments`, label: 'Pembayaran' }
    if (ref.startsWith('PC-')) return { href: `/finance/petty-cash`, label: 'Kas Kecil' }
    if (ref.startsWith('DEP-')) return { href: `/finance/fixed-assets/depreciation`, label: 'Penyusutan' }
    if (ref.startsWith('CN-') || ref.startsWith('DN-')) return { href: `/finance/credit-notes`, label: 'Nota' }
    if (ref.startsWith('JE-')) return null // Jurnal manual — tidak ada dokumen sumber
    return null
}

// ─── Page Component ──────────────────────────────────────
export default function AccountTransactionsPage() {
    const router = useRouter()
    const searchParams = useSearchParams()
    const { data, isLoading } = useAccountTransactions()

    // URL params for drill-down navigation (from reports, COA, etc.)
    const initialAccount = searchParams.get('account') || ''
    const initialFrom = searchParams.get('from') || ''
    const initialTo = searchParams.get('to') || ''
    const initialSearch = searchParams.get('search') || ''

    // Filters — initialized from URL params when present
    const [searchText, setSearchText] = useState(initialSearch)
    const [filterAccounts, setFilterAccounts] = useState<string[]>(initialAccount ? [initialAccount] : [])
    const [filterTypes, setFilterTypes] = useState<string[]>([])
    const [datePreset, setDatePreset] = useState<DatePreset>(initialFrom || initialTo ? "CUSTOM" : "THIS_YEAR")
    const [dateFrom, setDateFrom] = useState(initialFrom)
    const [dateTo, setDateTo] = useState(initialTo)
    const [groupMode, setGroupMode] = useState<GroupMode>("ACCOUNT")
    const [filterAccountsInclude, setFilterAccountsInclude] = useState<string[]>([])
    const [amountMin, setAmountMin] = useState("")
    const [amountMax, setAmountMax] = useState("")
    const [showAmounts, setShowAmounts] = useState(true)

    // Collapsible groups
    const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set())

    // Date preset handler
    useEffect(() => {
        const now = new Date()
        if (datePreset === "THIS_MONTH") {
            setDateFrom(`${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`)
            setDateTo(now.toISOString().split("T")[0])
        } else if (datePreset === "LAST_MONTH") {
            const last = new Date(now.getFullYear(), now.getMonth() - 1, 1)
            const end = new Date(now.getFullYear(), now.getMonth(), 0)
            setDateFrom(last.toISOString().split("T")[0])
            setDateTo(end.toISOString().split("T")[0])
        } else if (datePreset === "THIS_QUARTER") {
            const qStart = new Date(now.getFullYear(), Math.floor(now.getMonth() / 3) * 3, 1)
            setDateFrom(qStart.toISOString().split("T")[0])
            setDateTo(now.toISOString().split("T")[0])
        } else if (datePreset === "THIS_YEAR") {
            setDateFrom(`${now.getFullYear()}-01-01`)
            setDateTo(now.toISOString().split("T")[0])
        } else if (datePreset === "ALL_TIME") {
            setDateFrom("2023-01-01")
            setDateTo(now.toISOString().split("T")[0])
        }
    }, [datePreset])

    const entries = data?.entries ?? []
    const accounts = data?.accounts ?? []

    // ─── Filtering ───
    const filtered = useMemo(() => {
        let result = entries
        if (dateFrom) {
            const from = new Date(dateFrom + "T00:00:00")
            result = result.filter((e) => new Date(e.date) >= from)
        }
        if (dateTo) {
            const to = new Date(dateTo + "T23:59:59")
            result = result.filter((e) => new Date(e.date) <= to)
        }
        if (filterAccounts.length > 0) {
            result = result.filter((e) => e.lines.some((l) => filterAccounts.includes(l.accountCode)))
        }
        if (filterTypes.length > 0) {
            result = result.filter((e) => e.lines.some((l) => filterTypes.includes(l.accountType)))
        }
        if (searchText.trim()) {
            const q = searchText.toLowerCase()
            const qNum = parseFloat(searchText.replace(/[^0-9.]/g, ""))
            result = result.filter(
                (e) =>
                    e.description?.toLowerCase().includes(q) ||
                    e.reference?.toLowerCase().includes(q) ||
                    e.invoiceNumber?.toLowerCase().includes(q) ||
                    e.paymentNumber?.toLowerCase().includes(q) ||
                    e.lines.some(
                        (l) =>
                            l.accountName.toLowerCase().includes(q) ||
                            l.accountCode.includes(q) ||
                            (!isNaN(qNum) &&
                                (l.debit === qNum ||
                                    l.credit === qNum ||
                                    formatIDR(l.debit).includes(searchText) ||
                                    formatIDR(l.credit).includes(searchText)))
                    )
            )
        }
        const minAmt = amountMin ? parseFloat(amountMin) : null
        const maxAmt = amountMax ? parseFloat(amountMax) : null
        if (minAmt !== null || maxAmt !== null) {
            result = result.filter((e) =>
                e.lines.some((l) => {
                    const amt = Math.max(l.debit, l.credit)
                    if (minAmt !== null && amt < minAmt) return false
                    if (maxAmt !== null && amt > maxAmt) return false
                    return true
                })
            )
        }
        return result
    }, [entries, dateFrom, dateTo, filterAccounts, filterTypes, searchText, amountMin, amountMax])

    // ─── KPIs ───
    const totalTransactions = filtered.length
    const totalDebit = useMemo(
        () => filtered.reduce((s, e) => s + e.lines.reduce((ls, l) => ls + l.debit, 0), 0),
        [filtered]
    )
    const totalCredit = useMemo(
        () => filtered.reduce((s, e) => s + e.lines.reduce((ls, l) => ls + l.credit, 0), 0),
        [filtered]
    )
    const uniqueAccounts = useMemo(
        () => new Set(filtered.flatMap((e) => e.lines.map((l) => l.accountCode))).size,
        [filtered]
    )

    // ─── Group by Account (Xero-style) ──────────────────
    const groupedByAccount = useMemo(() => {
        if (groupMode !== "ACCOUNT") return null

        const accountMap = new Map<
            string,
            {
                code: string
                name: string
                type: string
                rows: AccountRow[]
                openingBalance: number
            }
        >()

        const sorted = [...filtered].sort(
            (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
        )

        for (const entry of sorted) {
            for (const line of entry.lines) {
                if (filterTypes.length > 0 && !filterTypes.includes(line.accountType)) continue

                const key = line.accountCode
                if (!accountMap.has(key)) {
                    accountMap.set(key, {
                        code: line.accountCode,
                        name: line.accountName,
                        type: line.accountType,
                        rows: [],
                        openingBalance: 0,
                    })
                }
                const group = accountMap.get(key)!
                const prevBalance =
                    group.rows.length > 0
                        ? group.rows[group.rows.length - 1].runningBalance
                        : group.openingBalance
                const runningBalance = computeRunningBalance(prevBalance, line.debit, line.credit, line.accountType)

                const source = deriveSource(entry, line)

                group.rows.push({
                    date: entry.date,
                    source,
                    description: line.description || entry.description,
                    reference: entry.reference,
                    debit: line.debit,
                    credit: line.credit,
                    runningBalance,
                    paymentMethod: entry.paymentMethod,
                    entryId: entry.id,
                    invoiceId: entry.invoiceId,
                    invoiceNumber: entry.invoiceNumber,
                    paymentId: entry.paymentId,
                    paymentSupplierId: entry.paymentSupplierId ?? null,
                    paymentCustomerId: entry.paymentCustomerId ?? null,
                })
            }
        }

        let groups = Array.from(accountMap.entries())
            .sort((a, b) => a[0].localeCompare(b[0]))
            .map(([, v]) => v)

        const showOnlyWithTx =
            filterAccountsInclude.length === 0 || filterAccountsInclude.includes("WITH_TRANSACTIONS")
        if (showOnlyWithTx && !filterAccountsInclude.includes("ALL")) {
            groups = groups.filter((g) => g.rows.length > 0)
        }

        return groups
    }, [filtered, groupMode, filterTypes, filterAccountsInclude])

    const toggleGroup = (code: string) => {
        setCollapsedGroups((prev) => {
            const next = new Set(prev)
            if (next.has(code)) { next.delete(code) } else { next.add(code) }
            return next
        })
    }

    // ─── Export CSV ────────────────────────
    const handleExport = useCallback(() => {
        const rows: string[][] = [
            ["Tanggal", "Akun", "Kode", "Sumber", "Deskripsi", "Referensi", "Debit", "Kredit", "Saldo"],
        ]
        if (groupedByAccount) {
            for (const group of groupedByAccount) {
                for (const r of group.rows) {
                    rows.push([
                        fmtDate(r.date),
                        group.name,
                        group.code,
                        r.source,
                        `"${(r.description || "").replace(/"/g, '""')}"`,
                        r.reference || "",
                        r.debit > 0 ? r.debit.toString() : "",
                        r.credit > 0 ? r.credit.toString() : "",
                        r.runningBalance.toString(),
                    ])
                }
            }
        }
        const csv = rows.map((r) => r.join(",")).join("\n")
        const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" })
        const url = URL.createObjectURL(blob)
        const a = document.createElement("a")
        a.href = url
        a.download = `transaksi-akun-${dateFrom || "all"}-${dateTo || "all"}.csv`
        a.click()
        URL.revokeObjectURL(url)
    }, [groupedByAccount, dateFrom, dateTo])

    const resetFilters = () => {
        setSearchText("")
        setFilterAccounts([])
        setFilterTypes([])
        setFilterAccountsInclude([])
        setAmountMin("")
        setAmountMax("")
        setDatePreset("THIS_YEAR")
    }

    const hasActiveFilters =
        searchText || filterAccounts.length > 0 || filterTypes.length > 0 || filterAccountsInclude.length > 0 || amountMin || amountMax

    const colTemplate = "grid-cols-[90px_140px_1fr_120px_140px_140px_150px]"
    const headers = ["Tanggal", "Sumber", "Deskripsi", "Referensi", "Debit", "Kredit", "Saldo Berjalan"]

    if (isLoading || !data) {
        return <TablePageSkeleton accentColor="bg-orange-400" />
    }

    return (
        <motion.div className="mf-page" variants={stagger} initial="hidden" animate="show">
            {/* ─── Unified Page Header ─── */}
            <motion.div variants={fadeUp} className={NB.pageCard}>
                {/* Orange accent bar */}
                <div className={NB.pageAccent} />

                {/* Row 1: Title + Actions */}
                <div className={`px-5 py-3.5 flex items-center justify-between ${NB.pageRowBorder}`}>
                    <div className="flex items-center gap-3">
                        <div className="w-9 h-9 bg-orange-500 flex items-center justify-center">
                            <BookOpen className="h-4.5 w-4.5 text-white" />
                        </div>
                        <div>
                            <h1 className="text-base font-black uppercase tracking-wider text-zinc-900 dark:text-white">
                                Transaksi Akun
                            </h1>
                            <p className="text-zinc-400 text-[11px] font-medium">
                                Periode {dateFrom ? fmtDate(dateFrom + "T00:00:00Z") : "\u2014"} s/d{" "}
                                {dateTo ? fmtDate(dateTo + "T00:00:00Z") : "\u2014"}
                            </p>
                        </div>
                    </div>
                    <div className="flex items-center gap-0">
                        {/* Group mode toggle */}
                        <div className="flex mr-2">
                            <button
                                onClick={() => setGroupMode("ACCOUNT")}
                                className={`${NB.toolbarBtn} ${NB.toolbarBtnJoin} ${
                                    groupMode === "ACCOUNT"
                                        ? "!bg-black !text-white !border-black"
                                        : ""
                                }`}
                            >
                                <ArrowUpDown className="h-3 w-3 mr-1" /> Per Akun
                            </button>
                            <button
                                onClick={() => setGroupMode("FLAT")}
                                className={`${NB.toolbarBtn} ${
                                    groupMode === "FLAT"
                                        ? "!bg-black !text-white !border-black"
                                        : ""
                                }`}
                            >
                                Kronologis
                            </button>
                        </div>
                        <Button
                            variant="outline"
                            className={NB.toolbarBtn}
                            onClick={handleExport}
                            disabled={!groupedByAccount || groupedByAccount.length === 0}
                        >
                            <Download className="h-3.5 w-3.5 mr-1.5" /> Export
                        </Button>
                    </div>
                </div>

                {/* Row 2: KPI Summary Strip */}
                <div
                    className={`flex items-center divide-x divide-zinc-200 dark:divide-zinc-800 ${NB.pageRowBorder}`}
                >
                    {[
                        { label: "Transaksi", count: totalTransactions, amount: null, color: "orange" },
                        { label: "Akun Aktif", count: uniqueAccounts, amount: null, color: "blue" },
                        { label: "Total Debit", count: null, amount: totalDebit, color: "emerald" },
                        { label: "Total Kredit", count: null, amount: totalCredit, color: "red" },
                    ].map((kpi) => (
                        <div
                            key={kpi.label}
                            className="flex-1 px-4 py-3 flex items-center justify-between gap-3 cursor-default"
                        >
                            <div className="flex items-center gap-1.5">
                                <span
                                    className={`w-2 h-2 ${
                                        kpi.color === "orange"
                                            ? "bg-orange-500"
                                            : kpi.color === "blue"
                                              ? "bg-blue-500"
                                              : kpi.color === "emerald"
                                                ? "bg-emerald-500"
                                                : "bg-red-500"
                                    }`}
                                />
                                <span className={NB.kpiLabel}>{kpi.label}</span>
                            </div>
                            <div className="flex items-center gap-2">
                                {kpi.count !== null && (
                                    <motion.span
                                        key={kpi.count}
                                        initial={{ scale: 0.8, opacity: 0 }}
                                        animate={{ scale: 1, opacity: 1 }}
                                        transition={{ type: "spring" as const, stiffness: 400, damping: 20 }}
                                        className={NB.kpiCount}
                                    >
                                        {kpi.count}
                                    </motion.span>
                                )}
                                {kpi.amount !== null && (
                                    <AnimatePresence>
                                        {showAmounts && (
                                            <motion.span
                                                initial={{ opacity: 0, x: -8 }}
                                                animate={{ opacity: 1, x: 0 }}
                                                exit={{ opacity: 0, x: -8 }}
                                                transition={{ type: "spring" as const, stiffness: 300, damping: 25 }}
                                                className={`text-xs font-mono font-bold ${
                                                    kpi.color === "red"
                                                        ? "text-red-600 dark:text-red-400"
                                                        : kpi.color === "emerald"
                                                          ? "text-emerald-600 dark:text-emerald-400"
                                                          : "text-zinc-500 dark:text-zinc-400"
                                                }`}
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
                                        {showAmounts ? (
                                            <Eye className="h-3 w-3" />
                                        ) : (
                                            <EyeOff className="h-3 w-3" />
                                        )}
                                    </button>
                                )}
                            </div>
                        </div>
                    ))}
                </div>

                {/* Row 3: Filter Toolbar — Primary filters */}
                <div className={`${NB.filterBar} flex-col !items-stretch gap-2.5`}>
                    {/* Row 3a: Search + account/type filters */}
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-0">
                            {/* Search input */}
                            <div className="relative">
                                <Search
                                    className={`pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 z-10 transition-colors ${
                                        searchText ? NB.inputIconActive : NB.inputIconEmpty
                                    }`}
                                />
                                <input
                                    className={`border border-r-0 font-medium h-9 w-[280px] text-xs rounded-none pl-9 pr-8 outline-none placeholder:text-zinc-400 transition-all ${
                                        searchText ? NB.inputActive : NB.inputEmpty
                                    }`}
                                    placeholder="Cari deskripsi, referensi, akun, nominal..."
                                    value={searchText}
                                    onChange={(e) => setSearchText(e.target.value)}
                                />
                                {searchText && (
                                    <button
                                        onClick={() => setSearchText("")}
                                        className="absolute right-2 top-1/2 -translate-y-1/2 h-4 w-4 flex items-center justify-center text-zinc-400 hover:text-zinc-600 transition-colors z-10"
                                    >
                                        <X className="h-3 w-3" />
                                    </button>
                                )}
                            </div>
                            {/* Account filter */}
                            <CheckboxFilter
                                label="Akun"
                                hideLabel
                                triggerClassName={NB.filterDropdown}
                                triggerActiveClassName="flex items-center gap-2 border border-orange-400 dark:border-orange-500 border-r-0 h-9 px-3 bg-orange-50/50 dark:bg-orange-950/20 text-xs font-medium min-w-[120px] justify-between transition-all rounded-none"
                                options={accounts.map((a) => ({
                                    value: a.code,
                                    label: `${a.code} \u2014 ${a.name}`,
                                }))}
                                selected={filterAccounts}
                                onChange={setFilterAccounts}
                            />
                            {/* Type filter */}
                            <CheckboxFilter
                                label="Tipe"
                                hideLabel
                                triggerClassName={NB.filterDropdown}
                                triggerActiveClassName="flex items-center gap-2 border border-orange-400 dark:border-orange-500 border-r-0 h-9 px-3 bg-orange-50/50 dark:bg-orange-950/20 text-xs font-medium min-w-[120px] justify-between transition-all rounded-none"
                                options={[
                                    { value: "ASSET", label: "Aset" },
                                    { value: "LIABILITY", label: "Kewajiban" },
                                    { value: "EQUITY", label: "Ekuitas" },
                                    { value: "REVENUE", label: "Pendapatan" },
                                    { value: "EXPENSE", label: "Beban" },
                                ]}
                                selected={filterTypes}
                                onChange={setFilterTypes}
                            />
                            {/* Date preset */}
                            <CheckboxFilter
                                label="Periode"
                                hideLabel
                                triggerClassName={NB.filterDropdown}
                                triggerActiveClassName="flex items-center gap-2 border border-orange-400 dark:border-orange-500 border-r-0 h-9 px-3 bg-orange-50/50 dark:bg-orange-950/20 text-xs font-medium min-w-[120px] justify-between transition-all rounded-none"
                                options={[
                                    { value: "THIS_MONTH", label: "Bulan Ini" },
                                    { value: "LAST_MONTH", label: "Bulan Lalu" },
                                    { value: "THIS_QUARTER", label: "Kuartal Ini" },
                                    { value: "THIS_YEAR", label: "Tahun Ini" },
                                    { value: "ALL_TIME", label: "Semua Waktu" },
                                ]}
                                selected={[datePreset === "CUSTOM" ? "" : datePreset].filter(Boolean)}
                                onChange={(vals) => {
                                    const last = vals[vals.length - 1]
                                    if (last) setDatePreset(last as DatePreset)
                                }}
                            />
                            {/* Apply */}
                            <Button variant="outline" className={NB.toolbarBtn}>
                                <Filter className="h-3.5 w-3.5 mr-1.5" /> Terapkan
                            </Button>
                            {/* Reset */}
                            {hasActiveFilters && (
                                <Button
                                    variant="ghost"
                                    onClick={resetFilters}
                                    className="text-zinc-400 text-[10px] font-bold uppercase h-9 px-3 rounded-none hover:text-zinc-700 dark:hover:text-zinc-200 ml-1.5"
                                >
                                    <RotateCcw className="h-3 w-3 mr-1" /> Reset
                                </Button>
                            )}
                        </div>
                        <span className="hidden md:inline text-[11px] font-medium text-zinc-400">
                            <span className="font-mono font-bold text-zinc-600 dark:text-zinc-300">
                                {filtered.length}
                            </span>{" "}
                            transaksi
                        </span>
                    </div>

                    {/* Row 3b: Secondary filters (date range, amount range, account include) */}
                    <div className="flex items-center gap-3 flex-wrap">
                        {/* Custom date inputs */}
                        <div className="flex items-center gap-1.5">
                            <span className="text-[9px] font-black uppercase tracking-widest text-zinc-400">
                                Dari
                            </span>
                            <input
                                type="date"
                                className={`border font-mono text-[11px] h-8 px-2 rounded-none outline-none transition-all ${
                                    dateFrom && datePreset === "CUSTOM"
                                        ? NB.inputActive
                                        : NB.inputEmpty
                                }`}
                                value={dateFrom}
                                onChange={(e) => {
                                    setDateFrom(e.target.value)
                                    setDatePreset("CUSTOM")
                                }}
                            />
                            <span className="text-[9px] font-black uppercase tracking-widest text-zinc-400">
                                s/d
                            </span>
                            <input
                                type="date"
                                className={`border font-mono text-[11px] h-8 px-2 rounded-none outline-none transition-all ${
                                    dateTo && datePreset === "CUSTOM"
                                        ? NB.inputActive
                                        : NB.inputEmpty
                                }`}
                                value={dateTo}
                                onChange={(e) => {
                                    setDateTo(e.target.value)
                                    setDatePreset("CUSTOM")
                                }}
                            />
                        </div>
                        {/* Amount range */}
                        <div className="flex items-center gap-1.5">
                            <span className="text-[9px] font-black uppercase tracking-widest text-zinc-400">
                                Nominal
                            </span>
                            <input
                                type="number"
                                className={`border font-mono text-[11px] h-8 w-[100px] px-2 rounded-none outline-none placeholder:text-zinc-300 transition-all ${
                                    amountMin ? NB.inputActive : NB.inputEmpty
                                }`}
                                placeholder="Min..."
                                value={amountMin}
                                onChange={(e) => setAmountMin(e.target.value)}
                            />
                            <span className="text-zinc-400 text-xs">\u2014</span>
                            <input
                                type="number"
                                className={`border font-mono text-[11px] h-8 w-[100px] px-2 rounded-none outline-none placeholder:text-zinc-300 transition-all ${
                                    amountMax ? NB.inputActive : NB.inputEmpty
                                }`}
                                placeholder="Max..."
                                value={amountMax}
                                onChange={(e) => setAmountMax(e.target.value)}
                            />
                        </div>
                        {/* Accounts include */}
                        <CheckboxFilter
                            label="Tampilkan"
                            hideLabel
                            triggerClassName="flex items-center gap-2 border border-zinc-300 dark:border-zinc-700 h-8 px-2.5 bg-white dark:bg-zinc-900 text-[11px] font-medium min-w-[100px] justify-between hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors rounded-none"
                            triggerActiveClassName="flex items-center gap-2 border border-orange-400 dark:border-orange-500 h-8 px-2.5 bg-orange-50/50 dark:bg-orange-950/20 text-[11px] font-medium min-w-[100px] justify-between transition-all rounded-none"
                            options={[
                                { value: "WITH_TRANSACTIONS", label: "Hanya yang ada transaksi" },
                                { value: "ALL", label: "Semua akun" },
                            ]}
                            selected={filterAccountsInclude}
                            onChange={setFilterAccountsInclude}
                        />
                    </div>
                </div>
            </motion.div>

            {/* ─── Main Content ─── */}
            {groupMode === "ACCOUNT" && groupedByAccount ? (
                /* ─── GROUPED BY ACCOUNT ─── */
                <motion.div
                    variants={fadeUp}
                    className="border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] bg-white dark:bg-zinc-900 overflow-x-auto"
                >
                    {groupedByAccount.length === 0 ? (
                        <motion.div
                            initial={{ opacity: 0, scale: 0.9 }}
                            animate={{ opacity: 1, scale: 1 }}
                            className="flex flex-col items-center justify-center py-20 text-zinc-400"
                        >
                            <div className="w-16 h-16 border-2 border-zinc-200 dark:border-zinc-700 flex items-center justify-center mb-4">
                                <BookOpen className="h-7 w-7 text-zinc-200 dark:text-zinc-700" />
                            </div>
                            <span className="text-sm font-bold">Tidak ada transaksi ditemukan</span>
                            <span className="text-xs text-zinc-400 mt-1">
                                Ubah filter atau perluas rentang tanggal
                            </span>
                        </motion.div>
                    ) : (
                        <div className="min-w-[1020px]">
                            {groupedByAccount.map((group, _gIdx) => {
                                const colors =
                                    ACCOUNT_TYPE_COLORS[group.type] || ACCOUNT_TYPE_COLORS.ASSET
                                const isCollapsed = collapsedGroups.has(group.code)
                                const groupDebit = group.rows.reduce((s, r) => s + r.debit, 0)
                                const groupCredit = group.rows.reduce((s, r) => s + r.credit, 0)
                                const closingBalance =
                                    group.rows.length > 0
                                        ? group.rows[group.rows.length - 1].runningBalance
                                        : group.openingBalance

                                return (
                                    <div key={group.code}>
                                        {/* Account Name Header */}
                                        <button
                                            onClick={() => toggleGroup(group.code)}
                                            className={`w-full text-left px-4 py-2.5 border-b-2 border-black dark:border-zinc-700 border-l-[5px] ${colors.border} ${colors.bg} dark:bg-zinc-800/50 flex items-center gap-2 hover:brightness-95 dark:hover:brightness-110 transition-all`}
                                        >
                                            {isCollapsed ? (
                                                <ChevronRight className="h-3.5 w-3.5 text-zinc-400" />
                                            ) : (
                                                <ChevronDown className="h-3.5 w-3.5 text-zinc-400" />
                                            )}
                                            <span className="font-black text-sm text-zinc-900 dark:text-white">
                                                {group.name}
                                            </span>
                                            <span
                                                className={`text-[10px] font-black uppercase tracking-wide px-1.5 py-0.5 border ${colors.bg} ${colors.text} dark:bg-transparent`}
                                            >
                                                {group.code}
                                            </span>
                                            <span className="text-[10px] font-mono text-zinc-400 ml-auto">
                                                {group.rows.length} transaksi
                                            </span>
                                        </button>

                                        {!isCollapsed && (
                                            <>
                                                {/* Column Headers */}
                                                <div
                                                    className={`grid ${colTemplate} bg-zinc-50 dark:bg-zinc-800/50 border-b border-zinc-200 dark:border-zinc-700`}
                                                >
                                                    {headers.map((h) => (
                                                        <span
                                                            key={h}
                                                            className="text-[9px] font-black uppercase tracking-widest text-zinc-400 px-3 py-1.5 last:text-right"
                                                        >
                                                            {h}
                                                        </span>
                                                    ))}
                                                </div>

                                                {/* Opening Balance */}
                                                <div
                                                    className={`grid ${colTemplate} border-b border-zinc-100 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-800/20`}
                                                >
                                                    <span className="px-3 py-1.5" />
                                                    <span
                                                        className="text-[10px] font-bold text-zinc-500 italic px-3 py-1.5"
                                                        style={{ gridColumn: "2 / 5" }}
                                                    >
                                                        Saldo Awal
                                                    </span>
                                                    <span className="text-xs font-mono text-right px-3 py-1.5">
                                                        {"\u2014"}
                                                    </span>
                                                    <span className="text-xs font-mono text-right px-3 py-1.5">
                                                        {"\u2014"}
                                                    </span>
                                                    <span className="text-xs font-mono text-right px-3 py-1.5">
                                                        {"\u2014"}
                                                    </span>
                                                </div>

                                                {/* Transaction Rows */}
                                                {group.rows.map((row, idx) => {
                                                    const srcColor = sourceColor(row.source)
                                                    return (
                                                        <div
                                                            key={`${row.entryId}-${idx}`}
                                                            className={`grid ${colTemplate} border-b border-zinc-100 dark:border-zinc-800 items-center hover:bg-orange-50/30 dark:hover:bg-orange-950/10 transition-colors ${
                                                                idx % 2 !== 0
                                                                    ? "bg-zinc-50/30 dark:bg-zinc-800/20"
                                                                    : ""
                                                            }`}
                                                        >
                                                            <span className="text-[11px] font-mono text-zinc-500 px-3 py-1.5">
                                                                {fmtDate(row.date)}
                                                            </span>
                                                            <span className="px-3 py-1.5">
                                                                <span
                                                                    className={`text-[9px] font-black uppercase px-1.5 py-0.5 border inline-block ${srcColor}`}
                                                                >
                                                                    {row.source}
                                                                </span>
                                                            </span>
                                                            <span className="text-[11px] font-medium text-zinc-700 dark:text-zinc-300 px-3 py-1.5 truncate">
                                                                {row.description}
                                                            </span>
                                                            <ReferenceLink
                                                                reference={row.reference}
                                                                invoiceId={row.invoiceId}
                                                                paymentId={row.paymentId}
                                                                paymentSupplierId={
                                                                    row.paymentSupplierId
                                                                }
                                                                paymentCustomerId={
                                                                    row.paymentCustomerId
                                                                }
                                                                router={router}
                                                            />
                                                            <span className="text-[11px] font-mono font-bold text-right px-3 py-1.5">
                                                                {row.debit > 0 ? (
                                                                    <span className="text-zinc-900 dark:text-zinc-100">
                                                                        {formatIDR(row.debit)}
                                                                    </span>
                                                                ) : (
                                                                    <span className="text-zinc-200 dark:text-zinc-700">
                                                                        {"\u2014"}
                                                                    </span>
                                                                )}
                                                            </span>
                                                            <span className="text-[11px] font-mono font-bold text-right px-3 py-1.5">
                                                                {row.credit > 0 ? (
                                                                    <span className="text-zinc-900 dark:text-zinc-100">
                                                                        ({formatIDR(row.credit)})
                                                                    </span>
                                                                ) : (
                                                                    <span className="text-zinc-200 dark:text-zinc-700">
                                                                        {"\u2014"}
                                                                    </span>
                                                                )}
                                                            </span>
                                                            <span
                                                                className={`text-[11px] font-mono font-bold text-right px-3 py-1.5 ${
                                                                    row.runningBalance < 0
                                                                        ? "text-amber-600 dark:text-amber-400"
                                                                        : "text-zinc-900 dark:text-zinc-100"
                                                                }`}
                                                            >
                                                                {formatIDR(
                                                                    Math.abs(row.runningBalance)
                                                                )}
                                                            </span>
                                                        </div>
                                                    )
                                                })}

                                                {/* Total Row */}
                                                <div
                                                    className={`grid ${colTemplate} bg-zinc-100 dark:bg-zinc-800 border-b border-zinc-300 dark:border-zinc-700 font-black`}
                                                >
                                                    <span
                                                        className="text-[10px] uppercase tracking-widest text-zinc-500 px-3 py-2 truncate"
                                                        style={{ gridColumn: "1 / 5" }}
                                                    >
                                                        Total {group.name}
                                                    </span>
                                                    <span className="text-[11px] font-mono text-right px-3 py-2 text-zinc-900 dark:text-zinc-100 truncate">
                                                        {formatIDR(groupDebit)}
                                                    </span>
                                                    <span className="text-[11px] font-mono text-right px-3 py-2 text-zinc-900 dark:text-zinc-100 truncate">
                                                        ({formatIDR(groupCredit)})
                                                    </span>
                                                    <span
                                                        className={`text-[11px] font-mono text-right px-3 py-2 truncate ${
                                                            closingBalance < 0
                                                                ? "text-amber-600 dark:text-amber-400"
                                                                : "text-zinc-900 dark:text-zinc-100"
                                                        }`}
                                                    >
                                                        {formatIDR(Math.abs(closingBalance))}
                                                    </span>
                                                </div>

                                                {/* Closing Balance */}
                                                <div
                                                    className={`grid ${colTemplate} bg-zinc-50/70 dark:bg-zinc-800/30 border-b-2 border-zinc-300 dark:border-zinc-700`}
                                                >
                                                    <span
                                                        className="text-[10px] font-bold text-zinc-500 italic px-3 py-1.5"
                                                        style={{ gridColumn: "1 / 5" }}
                                                    >
                                                        Saldo Akhir
                                                    </span>
                                                    <span className="text-[11px] font-mono text-right px-3 py-1.5">
                                                        {"\u2014"}
                                                    </span>
                                                    <span className="text-[11px] font-mono text-right px-3 py-1.5">
                                                        {"\u2014"}
                                                    </span>
                                                    <span
                                                        className={`text-[11px] font-mono font-black text-right px-3 py-1.5 ${
                                                            closingBalance < 0
                                                                ? "text-amber-600 dark:text-amber-400"
                                                                : "text-zinc-900 dark:text-zinc-100"
                                                        }`}
                                                    >
                                                        {formatIDR(Math.abs(closingBalance))}
                                                    </span>
                                                </div>
                                            </>
                                        )}
                                    </div>
                                )
                            })}
                        </div>
                    )}
                </motion.div>
            ) : (
                /* ─── FLAT CHRONOLOGICAL VIEW ─── */
                <motion.div
                    variants={fadeUp}
                    className="border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] bg-white dark:bg-zinc-900 overflow-x-auto"
                >
                    {/* Black header bar */}
                    <div className="px-5 py-2.5 bg-black dark:bg-zinc-950 border-b-2 border-black flex items-center gap-2">
                        <BookOpen className="h-4 w-4 text-zinc-400" />
                        <h3 className="text-[10px] font-black uppercase tracking-widest text-zinc-400">
                            Jurnal Transaksi
                        </h3>
                        <span className="bg-orange-500 text-white text-[10px] font-black px-2 py-0.5 min-w-[20px] text-center">
                            {filtered.length}
                        </span>
                    </div>

                    {filtered.length === 0 ? (
                        <motion.div
                            initial={{ opacity: 0, scale: 0.9 }}
                            animate={{ opacity: 1, scale: 1 }}
                            className="flex flex-col items-center justify-center py-16 text-zinc-400"
                        >
                            <div className="w-16 h-16 border-2 border-zinc-200 dark:border-zinc-700 flex items-center justify-center mb-4">
                                <BookOpen className="h-7 w-7 text-zinc-200 dark:text-zinc-700" />
                            </div>
                            <span className="text-sm font-bold">Tidak ada transaksi ditemukan</span>
                        </motion.div>
                    ) : (
                        <div className="min-w-[1020px]">
                            {/* Column Header */}
                            <div
                                className={`grid ${colTemplate} bg-zinc-50 dark:bg-zinc-800/50 border-b border-zinc-200 dark:border-zinc-700`}
                            >
                                {headers.map((h) => (
                                    <span
                                        key={h}
                                        className="text-[9px] font-black uppercase tracking-widest text-zinc-400 px-3 py-1.5"
                                    >
                                        {h}
                                    </span>
                                ))}
                            </div>

                            {/* Rows */}
                            {filtered.flatMap((entry) =>
                                entry.lines.map((line, li) => {
                                    const source = deriveSource(entry, line)
                                    const srcColor = sourceColor(source)
                                    return (
                                        <div
                                            key={`${entry.id}-${li}`}
                                            className={`grid ${colTemplate} border-b border-zinc-100 dark:border-zinc-800 items-center hover:bg-orange-50/30 dark:hover:bg-orange-950/10 transition-colors`}
                                        >
                                            <span className="text-[11px] font-mono text-zinc-500 px-3 py-1.5">
                                                {li === 0 ? fmtDate(entry.date) : ""}
                                            </span>
                                            <span className="px-3 py-1.5">
                                                {li === 0 && (
                                                    <span
                                                        className={`text-[9px] font-black uppercase px-1.5 py-0.5 border ${srcColor}`}
                                                    >
                                                        {source}
                                                    </span>
                                                )}
                                            </span>
                                            <span className="text-[11px] font-medium text-zinc-700 dark:text-zinc-300 px-3 py-1.5 truncate">
                                                {line.description || entry.description}
                                                <span className="text-zinc-300 dark:text-zinc-600 ml-1.5 text-[9px]">
                                                    ({line.accountCode} {line.accountName})
                                                </span>
                                            </span>
                                            {li === 0 ? (
                                                <ReferenceLink
                                                    reference={entry.reference}
                                                    invoiceId={entry.invoiceId}
                                                    paymentId={entry.paymentId}
                                                    paymentSupplierId={
                                                        entry.paymentSupplierId ?? null
                                                    }
                                                    paymentCustomerId={
                                                        entry.paymentCustomerId ?? null
                                                    }
                                                    router={router}
                                                />
                                            ) : (
                                                <span className="px-3 py-1.5" />
                                            )}
                                            <span className="text-[11px] font-mono font-bold text-right px-3 py-1.5">
                                                {line.debit > 0 ? (
                                                    formatIDR(line.debit)
                                                ) : (
                                                    <span className="text-zinc-200 dark:text-zinc-700">
                                                        {"\u2014"}
                                                    </span>
                                                )}
                                            </span>
                                            <span className="text-[11px] font-mono font-bold text-right px-3 py-1.5">
                                                {line.credit > 0 ? (
                                                    <span className="text-zinc-900 dark:text-zinc-100">
                                                        ({formatIDR(line.credit)})
                                                    </span>
                                                ) : (
                                                    <span className="text-zinc-200 dark:text-zinc-700">
                                                        {"\u2014"}
                                                    </span>
                                                )}
                                            </span>
                                            <span className="text-[11px] font-mono text-right px-3 py-1.5 text-zinc-300 dark:text-zinc-600">
                                                {"\u2014"}
                                            </span>
                                        </div>
                                    )
                                })
                            )}
                        </div>
                    )}
                </motion.div>
            )}
        </motion.div>
    )
}
