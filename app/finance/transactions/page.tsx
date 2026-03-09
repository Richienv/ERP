"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import {
    BookOpen, Search, ChevronDown, ChevronRight, Download,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { CheckboxFilter } from "@/components/ui/checkbox-filter"
import { formatIDR } from "@/lib/utils"
import { useAccountTransactions } from "@/hooks/use-account-transactions"
import { TablePageSkeleton } from "@/components/ui/page-skeleton"

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
    invoiceNumber: string | null
    invoiceType: string | null
    paymentNumber: string | null
    paymentMethod: string | null
    lines: TransactionLine[]
}

interface AccountInfo {
    id: string
    code: string
    name: string
    type: string
    balance: number
}

// ─── Xero-style Source label derivation ──────────────────
// Maps entry context → human-readable source like "Payable Invoice", "Receivable Payment", etc.
function deriveSource(entry: TransactionEntry, line: TransactionLine): string {
    const isPayment = !!entry.paymentNumber || !!entry.paymentMethod
    const isInvoice = !!entry.invoiceNumber
    const isPayable = entry.invoiceType === "INV_IN" || line.accountType === "LIABILITY" || line.accountCode === "2000"
    const isReceivable = entry.invoiceType === "INV_OUT" || line.accountType === "ASSET" && line.accountCode === "1200"

    if (isPayment && isPayable) return "Pembayaran Hutang"
    if (isPayment && isReceivable) return "Penerimaan Piutang"
    if (isPayment) return `Pembayaran (${entry.paymentMethod === "CASH" ? "Kas" : entry.paymentMethod === "TRANSFER" ? "Transfer" : entry.paymentMethod === "CHECK" ? "Giro" : "Lainnya"})`
    if (isInvoice && isPayable) return "Tagihan Masuk"
    if (isInvoice && isReceivable) return "Invoice Piutang"
    if (isInvoice) return entry.invoiceType === "INV_IN" ? "Tagihan Masuk" : "Invoice Piutang"

    // Fallback: detect from account type and description
    const desc = (entry.description || "").toLowerCase()
    if (desc.includes("gaji") || desc.includes("payroll")) return "Penggajian"
    if (desc.includes("sewa") || desc.includes("rent")) return "Beban Operasional"
    if (desc.includes("bahan") || desc.includes("material")) return "Pembelian Bahan"
    if (line.accountType === "EXPENSE") return "Beban Operasional"
    if (line.accountType === "REVENUE") return "Pendapatan"

    return "Jurnal Manual"
}

// ─── Source badge color mapping ──────────────────────────
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


// ─── Helpers ─────────────────────────────────────────────
const ACCOUNT_TYPE_LABELS: Record<string, string> = {
    ASSET: "Aset", LIABILITY: "Kewajiban", EQUITY: "Ekuitas", REVENUE: "Pendapatan", EXPENSE: "Beban",
}
const ACCOUNT_TYPE_COLORS: Record<string, { bg: string; text: string; border: string }> = {
    ASSET: { bg: "bg-blue-50", text: "text-blue-700", border: "border-l-blue-400" },
    LIABILITY: { bg: "bg-red-50", text: "text-red-700", border: "border-l-red-400" },
    EQUITY: { bg: "bg-purple-50", text: "text-purple-700", border: "border-l-purple-400" },
    REVENUE: { bg: "bg-emerald-50", text: "text-emerald-700", border: "border-l-emerald-400" },
    EXPENSE: { bg: "bg-orange-50", text: "text-orange-700", border: "border-l-orange-400" },
}

const fmtDate = (d: string) => new Date(d).toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric" })

// ─── Clickable reference helper ─────────────────────────
function ReferenceLink({ reference, invoiceNumber, router }: { reference: string | null; invoiceNumber: string | null; router: ReturnType<typeof useRouter> }) {
    const ref = reference || "—"
    const isInvoice = ref.startsWith("INV-") || ref.startsWith("BILL-")
    const isPayment = ref.startsWith("PAY-")

    if (isInvoice && invoiceNumber) {
        return (
            <button
                onClick={() => router.push(`/finance/invoices?highlight=${invoiceNumber}`)}
                className="text-[11px] font-mono text-blue-600 hover:text-blue-800 hover:underline px-3 py-1.5 truncate text-left cursor-pointer"
                title={`Buka invoice ${ref}`}
            >
                {ref}
            </button>
        )
    }
    if (isPayment) {
        return (
            <button
                onClick={() => router.push(`/finance/payments`)}
                className="text-[11px] font-mono text-blue-600 hover:text-blue-800 hover:underline px-3 py-1.5 truncate text-left cursor-pointer"
                title={`Buka pembayaran ${ref}`}
            >
                {ref}
            </button>
        )
    }
    return <span className="text-[11px] font-mono text-zinc-400 px-3 py-1.5 truncate">{ref}</span>
}

type GroupMode = "FLAT" | "ACCOUNT"
type DatePreset = "CUSTOM" | "THIS_MONTH" | "LAST_MONTH" | "THIS_QUARTER" | "THIS_YEAR" | "ALL_TIME"
type AccountsInclude = "ALL" | "WITH_TRANSACTIONS"

// ─── Row type for grouped view ───────────────────────────
interface AccountRow {
    date: string
    source: string          // "Tagihan Masuk", "Pembayaran Hutang", etc.
    description: string     // contact/vendor name
    reference: string | null
    debit: number
    credit: number
    runningBalance: number
    paymentMethod: string | null
    entryId: string
    invoiceNumber: string | null
}

// ─── Page Component ──────────────────────────────────────
export default function AccountTransactionsPage() {
    const router = useRouter()
    const { data, isLoading } = useAccountTransactions()

    // Filters
    const [searchText, setSearchText] = useState("")
    const [filterAccounts, setFilterAccounts] = useState<string[]>([])
    const [filterTypes, setFilterTypes] = useState<string[]>([])
    const [datePreset, setDatePreset] = useState<DatePreset>("THIS_YEAR")
    const [dateFrom, setDateFrom] = useState("")
    const [dateTo, setDateTo] = useState("")
    const [groupMode, setGroupMode] = useState<GroupMode>("ACCOUNT")
    const [filterAccountsInclude, setFilterAccountsInclude] = useState<string[]>([])
    const [amountMin, setAmountMin] = useState("")
    const [amountMax, setAmountMax] = useState("")

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

    // ─── Filtering ───────────────────────────────────────
    const filtered = useMemo(() => {
        let result = entries
        if (dateFrom) {
            const from = new Date(dateFrom + "T00:00:00")
            result = result.filter(e => new Date(e.date) >= from)
        }
        if (dateTo) {
            const to = new Date(dateTo + "T23:59:59")
            result = result.filter(e => new Date(e.date) <= to)
        }
        if (filterAccounts.length > 0) {
            result = result.filter(e => e.lines.some(l => filterAccounts.includes(l.accountCode)))
        }
        if (filterTypes.length > 0) {
            result = result.filter(e => e.lines.some(l => filterTypes.includes(l.accountType)))
        }
        if (searchText.trim()) {
            const q = searchText.toLowerCase()
            result = result.filter(e =>
                e.description?.toLowerCase().includes(q) ||
                e.reference?.toLowerCase().includes(q) ||
                e.invoiceNumber?.toLowerCase().includes(q) ||
                e.paymentNumber?.toLowerCase().includes(q) ||
                e.lines.some(l => l.accountName.toLowerCase().includes(q) || l.accountCode.includes(q))
            )
        }
        // Amount filter: check if any line's debit or credit falls within range
        const minAmt = amountMin ? parseFloat(amountMin) : null
        const maxAmt = amountMax ? parseFloat(amountMax) : null
        if (minAmt !== null || maxAmt !== null) {
            result = result.filter(e =>
                e.lines.some(l => {
                    const amt = Math.max(l.debit, l.credit)
                    if (minAmt !== null && amt < minAmt) return false
                    if (maxAmt !== null && amt > maxAmt) return false
                    return true
                })
            )
        }
        return result
    }, [entries, dateFrom, dateTo, filterAccounts, filterTypes, searchText, amountMin, amountMax])

    // ─── Group by Account (Xero-style) ──────────────────
    const groupedByAccount = useMemo(() => {
        if (groupMode !== "ACCOUNT") return null

        const accountMap = new Map<string, {
            code: string; name: string; type: string
            rows: AccountRow[]
            openingBalance: number
        }>()

        const sorted = [...filtered].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())

        for (const entry of sorted) {
            for (const line of entry.lines) {
                if (filterTypes.length > 0 && !filterTypes.includes(line.accountType)) continue

                const key = line.accountCode
                if (!accountMap.has(key)) {
                    accountMap.set(key, { code: line.accountCode, name: line.accountName, type: line.accountType, rows: [], openingBalance: 0 })
                }
                const group = accountMap.get(key)!
                const prevBalance = group.rows.length > 0 ? group.rows[group.rows.length - 1].runningBalance : group.openingBalance
                const runningBalance = prevBalance + line.debit - line.credit

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
                    invoiceNumber: entry.invoiceNumber,
                })
            }
        }

        let groups = Array.from(accountMap.entries())
            .sort((a, b) => a[0].localeCompare(b[0]))
            .map(([, v]) => v)

        const showOnlyWithTx = filterAccountsInclude.length === 0 || filterAccountsInclude.includes("WITH_TRANSACTIONS")
        if (showOnlyWithTx && !filterAccountsInclude.includes("ALL")) {
            groups = groups.filter(g => g.rows.length > 0)
        }

        return groups
    }, [filtered, groupMode, filterTypes, filterAccountsInclude])

    const toggleGroup = (code: string) => {
        setCollapsedGroups(prev => {
            const next = new Set(prev)
            next.has(code) ? next.delete(code) : next.add(code)
            return next
        })
    }

    // ─── Export CSV ────────────────────────────
    const handleExport = useCallback(() => {
        const rows: string[][] = [["Tanggal", "Akun", "Kode", "Sumber", "Deskripsi", "Referensi", "Debit", "Kredit", "Saldo"]]
        if (groupedByAccount) {
            for (const group of groupedByAccount) {
                for (const r of group.rows) {
                    rows.push([
                        fmtDate(r.date), group.name, group.code, r.source,
                        `"${(r.description || "").replace(/"/g, '""')}"`, r.reference || "",
                        r.debit > 0 ? r.debit.toString() : "", r.credit > 0 ? r.credit.toString() : "",
                        r.runningBalance.toString(),
                    ])
                }
            }
        }
        const csv = rows.map(r => r.join(",")).join("\n")
        const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" })
        const url = URL.createObjectURL(blob)
        const a = document.createElement("a")
        a.href = url
        a.download = `transaksi-akun-${dateFrom || "all"}-${dateTo || "all"}.csv`
        a.click()
        URL.revokeObjectURL(url)
    }, [groupedByAccount, dateFrom, dateTo])

    // ─── Column grid template ────────────────────────────
    const colTemplate = "grid-cols-[90px_140px_1fr_120px_140px_140px_150px]"

    const headers = ["Tanggal", "Sumber", "Deskripsi", "Referensi", "Debit", "Kredit", "Saldo Berjalan"]

    if (isLoading || !data) {
        return <TablePageSkeleton accentColor="bg-indigo-400" />
    }

    return (
        <div className="mf-page">
            {/* Header */}
            <div className="border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] overflow-hidden bg-white">
                <div className="px-6 py-4 flex items-center justify-between border-l-[6px] border-l-indigo-400">
                    <div className="flex items-center gap-3">
                        <BookOpen className="h-5 w-5 text-indigo-500" />
                        <div>
                            <h1 className="text-xl font-black uppercase tracking-tight">Transaksi Akun</h1>
                            <p className="text-zinc-400 text-xs font-medium mt-0.5">
                                Periode {dateFrom ? fmtDate(dateFrom + "T00:00:00Z") : "—"} s/d {dateTo ? fmtDate(dateTo + "T00:00:00Z") : "—"}
                            </p>
                        </div>
                    </div>
                    <div className="flex gap-2">
                        <Button variant="outline" className="border-2 border-black font-black uppercase text-[10px] h-9 px-3" onClick={handleExport} disabled={!groupedByAccount || groupedByAccount.length === 0}>
                            <Download className="h-3.5 w-3.5 mr-1.5" /> Export
                        </Button>
                    </div>
                </div>
            </div>

            {/* Filter Bar — Xero-style */}
            <div className="border-2 border-black shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] bg-white p-4 space-y-3">
                {/* Row 1: Main filters */}
                <div className="flex flex-wrap gap-3 items-end">
                    <CheckboxFilter
                        label="Akun"
                        options={accounts.map(a => ({ value: a.code, label: `${a.code} — ${a.name}` }))}
                        selected={filterAccounts}
                        onChange={setFilterAccounts}
                    />
                    <div>
                        <label className="text-[9px] font-black uppercase tracking-widest text-zinc-400 mb-1 block">Rentang Tanggal</label>
                        <div className="flex items-center gap-1.5">
                            <CheckboxFilter
                                label=""
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
                            <Input type="date" className="border-2 border-black h-9 font-mono text-[11px] w-[130px]" value={dateFrom} onChange={(e) => { setDateFrom(e.target.value); setDatePreset("CUSTOM") }} />
                            <Input type="date" className="border-2 border-black h-9 font-mono text-[11px] w-[130px]" value={dateTo} onChange={(e) => { setDateTo(e.target.value); setDatePreset("CUSTOM") }} />
                        </div>
                    </div>
                    <div>
                        <label className="text-[9px] font-black uppercase tracking-widest text-zinc-400 mb-1 block">Pengelompokan</label>
                        <div className="flex border-2 border-black overflow-hidden">
                            <button onClick={() => setGroupMode("ACCOUNT")} className={`px-3 py-1.5 text-[10px] font-black uppercase ${groupMode === "ACCOUNT" ? "bg-black text-white" : "bg-white text-zinc-500"}`}>Per Akun</button>
                            <button onClick={() => setGroupMode("FLAT")} className={`px-3 py-1.5 text-[10px] font-black uppercase border-l-2 border-black ${groupMode === "FLAT" ? "bg-black text-white" : "bg-white text-zinc-500"}`}>Kronologis</button>
                        </div>
                    </div>
                </div>

                {/* Row 2: Secondary filters */}
                <div className="flex flex-wrap gap-3 items-end">
                    <CheckboxFilter
                        label="Akun Ditampilkan"
                        options={[
                            { value: "WITH_TRANSACTIONS", label: "Hanya yang ada transaksi" },
                            { value: "ALL", label: "Semua akun" },
                        ]}
                        selected={filterAccountsInclude}
                        onChange={setFilterAccountsInclude}
                    />
                    <CheckboxFilter
                        label="Tipe Akun"
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
                    <div>
                        <label className="text-[9px] font-black uppercase tracking-widest text-zinc-400 mb-1 block">Rentang Nominal</label>
                        <div className="flex items-center gap-1.5">
                            <Input type="number" className="border-2 border-black h-9 font-mono text-[11px] w-[120px]" placeholder="Min..." value={amountMin} onChange={(e) => setAmountMin(e.target.value)} />
                            <span className="text-zinc-400 text-xs">—</span>
                            <Input type="number" className="border-2 border-black h-9 font-mono text-[11px] w-[120px]" placeholder="Max..." value={amountMax} onChange={(e) => setAmountMax(e.target.value)} />
                        </div>
                    </div>
                    <div className="relative flex-1 min-w-[200px]">
                        <label className="text-[9px] font-black uppercase tracking-widest text-zinc-400 mb-1 block">Cari</label>
                        <div className="relative">
                            <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-zinc-400" />
                            <Input className="border-2 border-black h-9 pl-9 font-medium text-xs" placeholder="Cari deskripsi, referensi, nama akun..." value={searchText} onChange={(e) => setSearchText(e.target.value)} />
                        </div>
                    </div>
                </div>
            </div>

            {/* Main Content */}
            {groupMode === "ACCOUNT" && groupedByAccount ? (
                /* ─── GROUPED BY ACCOUNT — Xero-style ─── */
                <div className="border-2 border-black shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] bg-white overflow-x-auto">
                    {groupedByAccount.length === 0 ? (
                        <div className="flex items-center justify-center py-20 text-zinc-400 text-xs font-bold uppercase tracking-widest">
                            Tidak ada transaksi ditemukan
                        </div>
                    ) : (
                        <div className="min-w-[1020px]">
                            {groupedByAccount.map((group) => {
                                const colors = ACCOUNT_TYPE_COLORS[group.type] || ACCOUNT_TYPE_COLORS.ASSET
                                const isCollapsed = collapsedGroups.has(group.code)
                                const groupDebit = group.rows.reduce((s, r) => s + r.debit, 0)
                                const groupCredit = group.rows.reduce((s, r) => s + r.credit, 0)
                                const closingBalance = group.rows.length > 0 ? group.rows[group.rows.length - 1].runningBalance : group.openingBalance

                                return (
                                    <div key={group.code}>
                                        {/* Account Name Header */}
                                        <button
                                            onClick={() => toggleGroup(group.code)}
                                            className={`w-full text-left px-4 py-2.5 border-b-2 border-black border-l-[5px] ${colors.border} ${colors.bg} flex items-center gap-2 hover:brightness-95 transition-all`}
                                        >
                                            {isCollapsed ? <ChevronRight className="h-3.5 w-3.5 text-zinc-400" /> : <ChevronDown className="h-3.5 w-3.5 text-zinc-400" />}
                                            <span className="font-black text-sm text-zinc-900">{group.name}</span>
                                            <span className={`text-[10px] font-black uppercase tracking-wide px-1.5 py-0.5 border ${colors.bg} ${colors.text}`}>
                                                {group.code}
                                            </span>
                                            <span className="text-[10px] font-mono text-zinc-400 ml-auto">{group.rows.length} transaksi</span>
                                        </button>

                                        {!isCollapsed && (
                                            <>
                                                {/* Column Headers */}
                                                <div className={`grid ${colTemplate} bg-zinc-50 border-b border-zinc-200`}>
                                                    {headers.map(h => (
                                                        <span key={h} className="text-[9px] font-black uppercase tracking-widest text-zinc-400 px-3 py-1.5 last:text-right">{h}</span>
                                                    ))}
                                                </div>

                                                {/* Opening Balance */}
                                                <div className={`grid ${colTemplate} border-b border-zinc-100 bg-zinc-50/50`}>
                                                    <span className="px-3 py-1.5" />
                                                    <span className="text-[10px] font-bold text-zinc-500 italic px-3 py-1.5" style={{ gridColumn: "2 / 5" }}>Saldo Awal</span>
                                                    <span className="text-xs font-mono text-right px-3 py-1.5">—</span>
                                                    <span className="text-xs font-mono text-right px-3 py-1.5">—</span>
                                                    <span className="text-xs font-mono text-right px-3 py-1.5">—</span>
                                                </div>

                                                {/* Transaction Rows */}
                                                {group.rows.map((row, idx) => {
                                                    const srcColor = sourceColor(row.source)
                                                    return (
                                                        <div key={`${row.entryId}-${idx}`} className={`grid ${colTemplate} border-b border-zinc-100 items-center hover:bg-indigo-50/20 transition-colors ${idx % 2 !== 0 ? "bg-zinc-50/30" : ""}`}>
                                                            <span className="text-[11px] font-mono text-zinc-500 px-3 py-1.5">{fmtDate(row.date)}</span>
                                                            <span className="px-3 py-1.5">
                                                                <span className={`text-[9px] font-black uppercase px-1.5 py-0.5 border inline-block ${srcColor}`}>
                                                                    {row.source}
                                                                </span>
                                                            </span>
                                                            <span className="text-[11px] font-medium text-zinc-700 px-3 py-1.5 truncate">{row.description}</span>
                                                            <ReferenceLink reference={row.reference} invoiceNumber={row.invoiceNumber} router={router} />
                                                            <span className="text-[11px] font-mono font-bold text-right px-3 py-1.5">
                                                                {row.debit > 0 ? <span className="text-zinc-900">{formatIDR(row.debit)}</span> : <span className="text-zinc-200">{"\u2014"}</span>}
                                                            </span>
                                                            <span className="text-[11px] font-mono font-bold text-right px-3 py-1.5">
                                                                {row.credit > 0 ? <span className="text-zinc-900">({formatIDR(row.credit)})</span> : <span className="text-zinc-200">{"\u2014"}</span>}
                                                            </span>
                                                            <span className={`text-[11px] font-mono font-bold text-right px-3 py-1.5 ${row.runningBalance < 0 ? "text-red-600" : "text-zinc-900"}`}>
                                                                {formatIDR(Math.abs(row.runningBalance))}
                                                            </span>
                                                        </div>
                                                    )
                                                })}

                                                {/* Total Row */}
                                                <div className={`grid ${colTemplate} bg-zinc-100 border-b border-zinc-300 font-black`}>
                                                    <span className="text-[10px] uppercase tracking-widest text-zinc-500 px-3 py-2 truncate" style={{ gridColumn: "1 / 5" }}>
                                                        Total {group.name}
                                                    </span>
                                                    <span className="text-[11px] font-mono text-right px-3 py-2 text-zinc-900 truncate">{formatIDR(groupDebit)}</span>
                                                    <span className="text-[11px] font-mono text-right px-3 py-2 text-zinc-900 truncate">({formatIDR(groupCredit)})</span>
                                                    <span className={`text-[11px] font-mono text-right px-3 py-2 truncate ${closingBalance < 0 ? "text-red-600" : "text-zinc-900"}`}>
                                                        {formatIDR(Math.abs(closingBalance))}
                                                    </span>
                                                </div>

                                                {/* Closing Balance */}
                                                <div className={`grid ${colTemplate} bg-zinc-50/70 border-b-2 border-zinc-300`}>
                                                    <span className="text-[10px] font-bold text-zinc-500 italic px-3 py-1.5" style={{ gridColumn: "1 / 5" }}>
                                                        Saldo Akhir
                                                    </span>
                                                    <span className="text-[11px] font-mono text-right px-3 py-1.5">—</span>
                                                    <span className="text-[11px] font-mono text-right px-3 py-1.5">—</span>
                                                    <span className={`text-[11px] font-mono font-black text-right px-3 py-1.5 ${closingBalance < 0 ? "text-red-600" : "text-zinc-900"}`}>
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
                </div>
            ) : (
                /* ─── FLAT CHRONOLOGICAL VIEW ─── */
                <div className="border-2 border-black shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] bg-white overflow-x-auto">
                    <div className="bg-indigo-50 px-5 py-2.5 border-b-2 border-black flex items-center gap-2 border-l-[5px] border-l-indigo-400">
                        <BookOpen className="h-4 w-4 text-indigo-600" />
                        <h3 className="text-[11px] font-black uppercase tracking-widest text-zinc-700">Jurnal Transaksi</h3>
                        <span className="bg-indigo-500 text-white text-[10px] font-black px-2 py-0.5 min-w-[20px] text-center">{filtered.length}</span>
                    </div>

                    {filtered.length === 0 ? (
                        <div className="flex items-center justify-center py-16 text-zinc-400 text-xs font-bold uppercase tracking-widest">
                            Tidak ada transaksi ditemukan
                        </div>
                    ) : (
                        <div className="min-w-[1020px]">
                            {/* Header */}
                            <div className={`grid ${colTemplate} bg-zinc-50 border-b border-zinc-200`}>
                                {headers.map(h => (
                                    <span key={h} className="text-[9px] font-black uppercase tracking-widest text-zinc-400 px-3 py-1.5">{h}</span>
                                ))}
                            </div>

                            {/* Rows — flatten all lines */}
                            {filtered.flatMap((entry) =>
                                entry.lines.map((line, li) => {
                                    const source = deriveSource(entry, line)
                                    const srcColor = sourceColor(source)
                                    return (
                                        <div key={`${entry.id}-${li}`} className={`grid ${colTemplate} border-b border-zinc-100 items-center hover:bg-indigo-50/20 transition-colors`}>
                                            <span className="text-[11px] font-mono text-zinc-500 px-3 py-1.5">{li === 0 ? fmtDate(entry.date) : ""}</span>
                                            <span className="px-3 py-1.5">
                                                {li === 0 && <span className={`text-[9px] font-black uppercase px-1.5 py-0.5 border ${srcColor}`}>{source}</span>}
                                            </span>
                                            <span className="text-[11px] font-medium text-zinc-700 px-3 py-1.5 truncate">
                                                {line.description || entry.description}
                                                <span className="text-zinc-300 ml-1.5 text-[9px]">({line.accountCode} {line.accountName})</span>
                                            </span>
                                            {li === 0 ? <ReferenceLink reference={entry.reference} invoiceNumber={entry.invoiceNumber} router={router} /> : <span className="px-3 py-1.5" />}
                                            <span className="text-[11px] font-mono font-bold text-right px-3 py-1.5">
                                                {line.debit > 0 ? formatIDR(line.debit) : <span className="text-zinc-200">{"\u2014"}</span>}
                                            </span>
                                            <span className="text-[11px] font-mono font-bold text-right px-3 py-1.5">
                                                {line.credit > 0 ? <span className="text-zinc-900">({formatIDR(line.credit)})</span> : <span className="text-zinc-200">{"\u2014"}</span>}
                                            </span>
                                            <span className="text-[11px] font-mono text-right px-3 py-1.5 text-zinc-300">{"\u2014"}</span>
                                        </div>
                                    )
                                })
                            )}
                        </div>
                    )}
                </div>
            )}
        </div>
    )
}
