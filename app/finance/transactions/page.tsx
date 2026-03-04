"use client"

import { useEffect, useMemo, useState } from "react"
import {
    BookOpen, Search, Loader2, Filter, ChevronDown, ChevronRight,
    Download, CalendarDays, Columns3, Settings2,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
    Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select"
import { formatIDR } from "@/lib/utils"
import { getAccountTransactions } from "@/lib/actions/finance-invoices"
import { CheckboxFilter } from "@/components/ui/checkbox-filter"

export const dynamic = "force-dynamic"

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

// ─── Dummy data — comprehensive demo entries ──────
const DUMMY_ENTRIES: TransactionEntry[] = [
    // ── Accounts Payable (Hutang Usaha) cycle ──
    {
        id: "d-ap-1", date: "2025-12-24T00:00:00Z", description: "Xero",
        reference: "AP", invoiceNumber: "BILL-AP-001", invoiceType: "INV_IN", paymentNumber: null, paymentMethod: null,
        lines: [
            { id: "d-ap-1a", accountCode: "2000", accountName: "Hutang Usaha", accountType: "LIABILITY", description: "Xero", debit: 0, credit: 313900 },
            { id: "d-ap-1b", accountCode: "6400", accountName: "Beban Software", accountType: "EXPENSE", description: "Langganan Xero", debit: 313900, credit: 0 },
        ],
    },
    {
        id: "d-ap-2", date: "2025-12-24T00:00:00Z", description: "Payment: Xero",
        reference: "AP", invoiceNumber: null, invoiceType: null, paymentNumber: "PAY-AP-001", paymentMethod: "TRANSFER",
        lines: [
            { id: "d-ap-2a", accountCode: "2000", accountName: "Hutang Usaha", accountType: "LIABILITY", description: "Payment: Xero", debit: 313900, credit: 0 },
            { id: "d-ap-2b", accountCode: "1010", accountName: "Bank BCA", accountType: "ASSET", description: "Transfer bayar Xero", debit: 0, credit: 313900 },
        ],
    },
    {
        id: "d-ap-3", date: "2026-01-01T00:00:00Z", description: "PowerDirect",
        reference: "Rpt", invoiceNumber: "BILL-PD-002", invoiceType: "INV_IN", paymentNumber: null, paymentMethod: null,
        lines: [
            { id: "d-ap-3a", accountCode: "2000", accountName: "Hutang Usaha", accountType: "LIABILITY", description: "PowerDirect", debit: 0, credit: 1190800 },
            { id: "d-ap-3b", accountCode: "6100", accountName: "Beban Listrik", accountType: "EXPENSE", description: "Listrik Jan 2026", debit: 1190800, credit: 0 },
        ],
    },
    {
        id: "d-ap-4", date: "2026-01-01T00:00:00Z", description: "Central Copiers",
        reference: "INS-OCon", invoiceNumber: "BILL-CC-003", invoiceType: "INV_IN", paymentNumber: null, paymentMethod: null,
        lines: [
            { id: "d-ap-4a", accountCode: "2000", accountName: "Hutang Usaha", accountType: "LIABILITY", description: "Central Copiers", debit: 0, credit: 10635600 },
            { id: "d-ap-4b", accountCode: "6200", accountName: "Beban Sewa Mesin", accountType: "EXPENSE", description: "Sewa mesin fotocopy", debit: 10635600, credit: 0 },
        ],
    },
    {
        id: "d-ap-5", date: "2026-01-02T00:00:00Z", description: "Net Connect",
        reference: "S781", invoiceNumber: "BILL-NC-004", invoiceType: "INV_IN", paymentNumber: null, paymentMethod: null,
        lines: [
            { id: "d-ap-5a", accountCode: "2000", accountName: "Hutang Usaha", accountType: "LIABILITY", description: "Net Connect", debit: 0, credit: 14638800 },
            { id: "d-ap-5b", accountCode: "6200", accountName: "Beban Internet", accountType: "EXPENSE", description: "Internet Januari", debit: 14638800, credit: 0 },
        ],
    },
    {
        id: "d-ap-6", date: "2026-02-24T00:00:00Z", description: "Net Connect",
        reference: "Rpt", invoiceNumber: "BILL-NC-010", invoiceType: "INV_IN", paymentNumber: null, paymentMethod: null,
        lines: [
            { id: "d-ap-6a", accountCode: "2000", accountName: "Hutang Usaha", accountType: "LIABILITY", description: "Net Connect", debit: 0, credit: 541300 },
            { id: "d-ap-6b", accountCode: "6200", accountName: "Beban Internet", accountType: "EXPENSE", description: "Internet Feb", debit: 541300, credit: 0 },
        ],
    },
    {
        id: "d-ap-7", date: "2026-02-24T00:00:00Z", description: "Capital Cab Co",
        reference: "CS815", invoiceNumber: "BILL-CAB-011", invoiceType: "INV_IN", paymentNumber: null, paymentMethod: null,
        lines: [
            { id: "d-ap-7a", accountCode: "2000", accountName: "Hutang Usaha", accountType: "LIABILITY", description: "Capital Cab Co", debit: 0, credit: 2420000 },
            { id: "d-ap-7b", accountCode: "6300", accountName: "Beban Transportasi", accountType: "EXPENSE", description: "Travel National", debit: 2420000, credit: 0 },
        ],
    },
    {
        id: "d-ap-8", date: "2026-02-24T00:00:00Z", description: "Payment: Net Connect",
        reference: "Rpt", invoiceNumber: null, invoiceType: null, paymentNumber: "PAY-NC-012", paymentMethod: "TRANSFER",
        lines: [
            { id: "d-ap-8a", accountCode: "2000", accountName: "Hutang Usaha", accountType: "LIABILITY", description: "Payment: Net Connect", debit: 541300, credit: 0 },
            { id: "d-ap-8b", accountCode: "1010", accountName: "Bank BCA", accountType: "ASSET", description: "Transfer Net Connect", debit: 0, credit: 541300 },
        ],
    },
    // ── Accounts Receivable (Piutang Usaha) cycle ──
    {
        id: "d-ar-1", date: "2025-12-25T00:00:00Z", description: "City Limousines",
        reference: "P/O 6711", invoiceNumber: "INV-2025-0010", invoiceType: "INV_OUT", paymentNumber: null, paymentMethod: null,
        lines: [
            { id: "d-ar-1a", accountCode: "1200", accountName: "Piutang Usaha", accountType: "ASSET", description: "City Limousines", debit: 2500000, credit: 0 },
            { id: "d-ar-1b", accountCode: "4000", accountName: "Pendapatan Jasa", accountType: "REVENUE", description: "Jasa konsultasi", debit: 0, credit: 2252250 },
            { id: "d-ar-1c", accountCode: "2100", accountName: "PPN Keluaran", accountType: "LIABILITY", description: "PPN 11%", debit: 0, credit: 247750 },
        ],
    },
    {
        id: "d-ar-2", date: "2025-12-24T00:00:00Z", description: "Rex Media Group",
        reference: "Monthly Support", invoiceNumber: "INV-2025-0011", invoiceType: "INV_OUT", paymentNumber: null, paymentMethod: null,
        lines: [
            { id: "d-ar-2a", accountCode: "1200", accountName: "Piutang Usaha", accountType: "ASSET", description: "Rex Media Group", debit: 5412500, credit: 0 },
            { id: "d-ar-2b", accountCode: "4000", accountName: "Pendapatan Jasa", accountType: "REVENUE", description: "Monthly Support", debit: 0, credit: 4877930 },
            { id: "d-ar-2c", accountCode: "2100", accountName: "PPN Keluaran", accountType: "LIABILITY", description: "PPN 11%", debit: 0, credit: 534570 },
        ],
    },
    {
        id: "d-ar-3", date: "2025-12-24T00:00:00Z", description: "Hamilton Smith Ltd",
        reference: "Monthly Support", invoiceNumber: "INV-2025-0012", invoiceType: "INV_OUT", paymentNumber: null, paymentMethod: null,
        lines: [
            { id: "d-ar-3a", accountCode: "1200", accountName: "Piutang Usaha", accountType: "ASSET", description: "Hamilton Smith Ltd", debit: 5412500, credit: 0 },
            { id: "d-ar-3b", accountCode: "4000", accountName: "Pendapatan Jasa", accountType: "REVENUE", description: "Monthly Support", debit: 0, credit: 4877930 },
            { id: "d-ar-3c", accountCode: "2100", accountName: "PPN Keluaran", accountType: "LIABILITY", description: "PPN 11%", debit: 0, credit: 534570 },
        ],
    },
    {
        id: "d-ar-4", date: "2025-12-24T00:00:00Z", description: "Young Bros Transport",
        reference: "Monthly Support", invoiceNumber: "INV-2025-0013", invoiceType: "INV_OUT", paymentNumber: null, paymentMethod: null,
        lines: [
            { id: "d-ar-4a", accountCode: "1200", accountName: "Piutang Usaha", accountType: "ASSET", description: "Young Bros Transport", debit: 5412500, credit: 0 },
            { id: "d-ar-4b", accountCode: "4000", accountName: "Pendapatan Jasa", accountType: "REVENUE", description: "Monthly Support", debit: 0, credit: 4877930 },
            { id: "d-ar-4c", accountCode: "2100", accountName: "PPN Keluaran", accountType: "LIABILITY", description: "PPN 11%", debit: 0, credit: 534570 },
        ],
    },
    {
        id: "d-ar-5", date: "2026-01-02T00:00:00Z", description: "Payment: Port & Philip Freight",
        reference: "Monthly Support", invoiceNumber: null, invoiceType: "INV_OUT", paymentNumber: "PAY-2026-0001", paymentMethod: "TRANSFER",
        lines: [
            { id: "d-ar-5a", accountCode: "1200", accountName: "Piutang Usaha", accountType: "ASSET", description: "Payment: Port & Philip Freight", debit: 0, credit: 5412500 },
            { id: "d-ar-5b", accountCode: "1010", accountName: "Bank BCA", accountType: "ASSET", description: "Transfer masuk BCA", debit: 5412500, credit: 0 },
        ],
    },
    {
        id: "d-ar-6", date: "2026-01-02T00:00:00Z", description: "Payment: Hamilton Smith Ltd",
        reference: "Monthly Support", invoiceNumber: null, invoiceType: "INV_OUT", paymentNumber: "PAY-2026-0002", paymentMethod: "TRANSFER",
        lines: [
            { id: "d-ar-6a", accountCode: "1200", accountName: "Piutang Usaha", accountType: "ASSET", description: "Payment: Hamilton Smith Ltd", debit: 0, credit: 5412500 },
            { id: "d-ar-6b", accountCode: "1010", accountName: "Bank BCA", accountType: "ASSET", description: "Transfer masuk BCA", debit: 5412500, credit: 0 },
        ],
    },
    {
        id: "d-ar-7", date: "2026-01-02T00:00:00Z", description: "Ridgeway University",
        reference: "P/O CRM08-12", invoiceNumber: "INV-2026-0025", invoiceType: "INV_OUT", paymentNumber: null, paymentMethod: null,
        lines: [
            { id: "d-ar-7a", accountCode: "1200", accountName: "Piutang Usaha", accountType: "ASSET", description: "Ridgeway University", debit: 61875000, credit: 0 },
            { id: "d-ar-7b", accountCode: "4000", accountName: "Pendapatan Jasa", accountType: "REVENUE", description: "CRM Project 3", debit: 0, credit: 55742000 },
            { id: "d-ar-7c", accountCode: "2100", accountName: "PPN Keluaran", accountType: "LIABILITY", description: "PPN 11%", debit: 0, credit: 6133000 },
        ],
    },
    {
        id: "d-ar-8", date: "2026-01-02T00:00:00Z", description: "Payment: Rex Media Group",
        reference: "Monthly Support", invoiceNumber: null, invoiceType: "INV_OUT", paymentNumber: "PAY-2026-0003", paymentMethod: "TRANSFER",
        lines: [
            { id: "d-ar-8a", accountCode: "1200", accountName: "Piutang Usaha", accountType: "ASSET", description: "Payment: Rex Media Group", debit: 0, credit: 5412500 },
            { id: "d-ar-8b", accountCode: "1010", accountName: "Bank BCA", accountType: "ASSET", description: "Transfer masuk BCA", debit: 5412500, credit: 0 },
        ],
    },
    // ── Payroll ──
    {
        id: "d-pay-1", date: "2026-02-05T00:00:00Z", description: "Gaji karyawan Februari 2026",
        reference: "PAYROLL-FEB-2026", invoiceNumber: null, invoiceType: null, paymentNumber: null, paymentMethod: null,
        lines: [
            { id: "d-pay-1a", accountCode: "6000", accountName: "Beban Gaji & Upah", accountType: "EXPENSE", description: "Gaji pokok + tunjangan", debit: 45000000, credit: 0 },
            { id: "d-pay-1b", accountCode: "6010", accountName: "Beban BPJS", accountType: "EXPENSE", description: "BPJS Kesehatan + TK", debit: 3150000, credit: 0 },
            { id: "d-pay-1c", accountCode: "1010", accountName: "Bank BCA", accountType: "ASSET", description: "Transfer gaji", debit: 0, credit: 42750000 },
            { id: "d-pay-1d", accountCode: "2300", accountName: "Hutang PPh 21", accountType: "LIABILITY", description: "PPh 21 karyawan", debit: 0, credit: 2250000 },
            { id: "d-pay-1e", accountCode: "2200", accountName: "Hutang BPJS", accountType: "LIABILITY", description: "BPJS yg harus dibayar", debit: 0, credit: 3150000 },
        ],
    },
    // ── Rent ──
    {
        id: "d-rent-1", date: "2026-01-28T00:00:00Z", description: "Sewa gudang Cibitung Januari",
        reference: "RENT-JAN-2026", invoiceNumber: null, invoiceType: null, paymentNumber: null, paymentMethod: "TRANSFER",
        lines: [
            { id: "d-rent-1a", accountCode: "6500", accountName: "Beban Sewa", accountType: "EXPENSE", description: "Sewa gudang Cibitung", debit: 12000000, credit: 0 },
            { id: "d-rent-1b", accountCode: "1010", accountName: "Bank BCA", accountType: "ASSET", description: "Transfer sewa", debit: 0, credit: 12000000 },
        ],
    },
    // ── Cash payment ──
    {
        id: "d-cash-1", date: "2026-02-12T00:00:00Z", description: "Pembelian ATK kantor",
        reference: "PETTY-012", invoiceNumber: null, invoiceType: null, paymentNumber: null, paymentMethod: "CASH",
        lines: [
            { id: "d-cash-1a", accountCode: "6600", accountName: "Beban ATK & Perlengkapan", accountType: "EXPENSE", description: "Kertas, tinta, alat tulis", debit: 450000, credit: 0 },
            { id: "d-cash-1b", accountCode: "1000", accountName: "Kas Kecil", accountType: "ASSET", description: "Kas keluar", debit: 0, credit: 450000 },
        ],
    },
]

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
const fmtMoney = (v: number) => v === 0 ? "—" : formatIDR(Math.abs(v))
const fmtMoneyOrDash = (v: number) => v === 0 ? "—" : formatIDR(v)

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
    gross: number           // abs(debit - credit) of original entry line
    tax: number             // PPN portion if applicable
    paymentMethod: string | null
    entryId: string
    invoiceNumber: string | null
}

// ─── Page Component ──────────────────────────────────────
export default function AccountTransactionsPage() {
    const [loading, setLoading] = useState(true)
    const [entries, setEntries] = useState<TransactionEntry[]>([])
    const [accounts, setAccounts] = useState<AccountInfo[]>([])

    // Filters
    const [searchText, setSearchText] = useState("")
    const [filterAccount, setFilterAccount] = useState("ALL")
    const [filterTypes, setFilterTypes] = useState<string[]>([])
    const [datePreset, setDatePreset] = useState<DatePreset>("THIS_YEAR")
    const [dateFrom, setDateFrom] = useState("")
    const [dateTo, setDateTo] = useState("")
    const [groupMode, setGroupMode] = useState<GroupMode>("ACCOUNT")
    const [accountsInclude, setAccountsInclude] = useState<AccountsInclude>("WITH_TRANSACTIONS")

    // Visible columns
    const [showGross, setShowGross] = useState(true)
    const [showTax, setShowTax] = useState(true)

    // Collapsible groups
    const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set())

    useEffect(() => { loadData() }, [filterAccount])

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

    const loadData = async () => {
        setLoading(true)
        try {
            const result = await getAccountTransactions({
                accountCode: filterAccount !== "ALL" ? filterAccount : undefined,
                limit: 500,
            }) as any
            if (result.success) {
                const dbEntries = (result.entries || []) as TransactionEntry[]
                const merged = [...dbEntries, ...DUMMY_ENTRIES.filter(d => !dbEntries.some(e => e.id === d.id))]
                merged.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
                setEntries(merged)
                setAccounts((result.accounts || []) as AccountInfo[])
            }
        } catch {
            setEntries(DUMMY_ENTRIES)
        } finally {
            setLoading(false)
        }
    }

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
        return result
    }, [entries, dateFrom, dateTo, filterTypes, searchText])

    // ─── Group by Account (Xero-style) ──────────────────
    const groupedByAccount = useMemo(() => {
        if (groupMode !== "ACCOUNT") return null

        const accountMap = new Map<string, {
            code: string; name: string; type: string
            rows: AccountRow[]
            openingBalance: number
        }>()

        const sorted = [...filtered].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())

        // Calculate tax portion per entry (PPN lines)
        const entryTaxMap = new Map<string, number>()
        for (const entry of sorted) {
            const taxLines = entry.lines.filter(l => l.accountCode.startsWith("21") || l.accountName.toLowerCase().includes("ppn"))
            const taxTotal = taxLines.reduce((s, l) => s + l.debit + l.credit, 0)
            entryTaxMap.set(entry.id, taxTotal)
        }

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
                const gross = line.debit > 0 ? line.debit : line.credit
                const entryTax = entryTaxMap.get(entry.id) || 0
                // Distribute tax proportionally or show on tax account lines only
                const isTaxLine = line.accountCode.startsWith("21") || line.accountName.toLowerCase().includes("ppn")
                const tax = isTaxLine ? gross : 0

                group.rows.push({
                    date: entry.date,
                    source,
                    description: line.description || entry.description,
                    reference: entry.reference,
                    debit: line.debit,
                    credit: line.credit,
                    runningBalance,
                    gross,
                    tax: isTaxLine ? 0 : (entryTax > 0 && !isTaxLine ? -Math.round(entryTax * (gross / (entry.lines.reduce((s, l) => s + l.debit + l.credit, 0) - entryTax || 1))) : 0),
                    paymentMethod: entry.paymentMethod,
                    entryId: entry.id,
                    invoiceNumber: entry.invoiceNumber,
                })
            }
        }

        let groups = Array.from(accountMap.entries())
            .sort((a, b) => a[0].localeCompare(b[0]))
            .map(([, v]) => v)

        if (accountsInclude === "WITH_TRANSACTIONS") {
            groups = groups.filter(g => g.rows.length > 0)
        }

        return groups
    }, [filtered, groupMode, filterTypes, accountsInclude])

    const toggleGroup = (code: string) => {
        setCollapsedGroups(prev => {
            const next = new Set(prev)
            next.has(code) ? next.delete(code) : next.add(code)
            return next
        })
    }

    // ─── Column grid template ────────────────────────────
    const colTemplate = showGross && showTax
        ? "grid-cols-[90px_140px_1fr_120px_100px_100px_120px_100px_80px]"
        : showGross
            ? "grid-cols-[90px_140px_1fr_120px_100px_100px_120px_100px]"
            : "grid-cols-[90px_140px_1fr_120px_100px_100px_120px]"

    const headers = ["Tanggal", "Sumber", "Deskripsi", "Referensi", "Debit", "Kredit", "Saldo Berjalan"]
    if (showGross) headers.push("Gross")
    if (showTax) headers.push("Pajak")

    return (
        <div className="mf-page">
            {/* Header */}
            <div className="border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] overflow-hidden bg-white">
                <div className="px-6 py-4 flex items-center justify-between border-l-[6px] border-l-indigo-400">
                    <div className="flex items-center gap-3">
                        <BookOpen className="h-5 w-5 text-indigo-500" />
                        <div>
                            <h1 className="text-xl font-black uppercase tracking-tight">Account Transactions</h1>
                            <p className="text-zinc-400 text-xs font-medium mt-0.5">
                                Periode {dateFrom ? fmtDate(dateFrom + "T00:00:00Z") : "—"} s/d {dateTo ? fmtDate(dateTo + "T00:00:00Z") : "—"}
                            </p>
                        </div>
                    </div>
                    <div className="flex gap-2">
                        <Button variant="outline" className="border-2 border-black font-black uppercase text-[10px] h-9 px-3">
                            <Download className="h-3.5 w-3.5 mr-1.5" /> Export
                        </Button>
                    </div>
                </div>
            </div>

            {/* Filter Bar — Xero-style */}
            <div className="border-2 border-black shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] bg-white p-4 space-y-3">
                {/* Row 1: Main filters */}
                <div className="flex flex-wrap gap-3 items-end">
                    <div>
                        <label className="text-[9px] font-black uppercase tracking-widest text-zinc-400 mb-1 block">Akun</label>
                        <Select value={filterAccount} onValueChange={setFilterAccount}>
                            <SelectTrigger className="border-2 border-black h-9 font-medium w-[220px] text-xs">
                                <SelectValue placeholder="Semua Akun" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="ALL">{accounts.length > 0 ? `${accounts.length} akun dipilih` : "Semua Akun"}</SelectItem>
                                {accounts.map(a => (
                                    <SelectItem key={a.code} value={a.code}>{a.code} — {a.name}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                    <div>
                        <label className="text-[9px] font-black uppercase tracking-widest text-zinc-400 mb-1 block">Rentang Tanggal</label>
                        <div className="flex items-center gap-1.5">
                            <Select value={datePreset} onValueChange={(v: any) => setDatePreset(v)}>
                                <SelectTrigger className="border-2 border-black h-9 font-medium w-[130px] text-xs">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="THIS_MONTH">Bulan Ini</SelectItem>
                                    <SelectItem value="LAST_MONTH">Bulan Lalu</SelectItem>
                                    <SelectItem value="THIS_QUARTER">Kuartal Ini</SelectItem>
                                    <SelectItem value="THIS_YEAR">Tahun Ini</SelectItem>
                                    <SelectItem value="ALL_TIME">Semua</SelectItem>
                                    <SelectItem value="CUSTOM">Custom</SelectItem>
                                </SelectContent>
                            </Select>
                            <Input type="date" className="border-2 border-black h-9 font-mono text-[11px] w-[130px]" value={dateFrom} onChange={(e) => { setDateFrom(e.target.value); setDatePreset("CUSTOM") }} />
                            <Input type="date" className="border-2 border-black h-9 font-mono text-[11px] w-[130px]" value={dateTo} onChange={(e) => { setDateTo(e.target.value); setDatePreset("CUSTOM") }} />
                        </div>
                    </div>
                    <div>
                        <label className="text-[9px] font-black uppercase tracking-widest text-zinc-400 mb-1 block">Kolom</label>
                        <div className="flex gap-1">
                            {[
                                { key: "gross", label: "Gross", active: showGross, toggle: () => setShowGross(!showGross) },
                                { key: "tax", label: "Pajak", active: showTax, toggle: () => setShowTax(!showTax) },
                            ].map(col => (
                                <button key={col.key} onClick={col.toggle} className={`px-2.5 py-1.5 text-[10px] font-black uppercase border-2 transition-all ${col.active ? "border-black bg-black text-white" : "border-zinc-200 text-zinc-400 hover:border-zinc-400"}`}>
                                    {col.label}
                                </button>
                            ))}
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
                    <div>
                        <label className="text-[9px] font-black uppercase tracking-widest text-zinc-400 mb-1 block">Akun ditampilkan</label>
                        <Select value={accountsInclude} onValueChange={(v: any) => setAccountsInclude(v)}>
                            <SelectTrigger className="border-2 border-black h-9 font-medium w-[200px] text-xs">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="WITH_TRANSACTIONS">Hanya yang ada transaksi</SelectItem>
                                <SelectItem value="ALL">Semua akun</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
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
                    <div className="relative flex-1 min-w-[200px]">
                        <label className="text-[9px] font-black uppercase tracking-widest text-zinc-400 mb-1 block">Cari</label>
                        <div className="relative">
                            <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-zinc-400" />
                            <Input className="border-2 border-black h-9 pl-9 font-medium text-xs" placeholder="Cari deskripsi, referensi, nama akun..." value={searchText} onChange={(e) => setSearchText(e.target.value)} />
                        </div>
                    </div>
                    <Button onClick={loadData} className="bg-indigo-600 hover:bg-indigo-700 border-2 border-indigo-700 text-white font-black uppercase text-[10px] h-9 px-5 shadow-[3px_3px_0px_0px_rgba(0,0,0,0.2)] active:shadow-none active:translate-y-[1px]">
                        Update
                    </Button>
                </div>
            </div>

            {/* Main Content */}
            {loading ? (
                <div className="border-2 border-black shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] bg-white flex items-center justify-center py-20 text-zinc-400">
                    <Loader2 className="h-5 w-5 animate-spin mr-2" />
                    <span className="text-xs font-bold uppercase tracking-widest">Memuat transaksi akun...</span>
                </div>
            ) : groupMode === "ACCOUNT" && groupedByAccount ? (
                /* ─── GROUPED BY ACCOUNT — Xero-style ─── */
                <div className="border-2 border-black shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] bg-white overflow-x-auto">
                    {groupedByAccount.length === 0 ? (
                        <div className="flex items-center justify-center py-20 text-zinc-400 text-xs font-bold uppercase tracking-widest">
                            Tidak ada transaksi ditemukan
                        </div>
                    ) : (
                        <div className="min-w-[900px]">
                            {groupedByAccount.map((group) => {
                                const colors = ACCOUNT_TYPE_COLORS[group.type] || ACCOUNT_TYPE_COLORS.ASSET
                                const isCollapsed = collapsedGroups.has(group.code)
                                const groupDebit = group.rows.reduce((s, r) => s + r.debit, 0)
                                const groupCredit = group.rows.reduce((s, r) => s + r.credit, 0)
                                const closingBalance = group.rows.length > 0 ? group.rows[group.rows.length - 1].runningBalance : group.openingBalance
                                const groupGross = group.rows.reduce((s, r) => s + r.gross, 0)

                                return (
                                    <div key={group.code}>
                                        {/* Account Name Header */}
                                        <button
                                            onClick={() => toggleGroup(group.code)}
                                            className={`w-full text-left px-4 py-2.5 border-b-2 border-black border-l-[5px] ${colors.border} ${colors.bg} flex items-center gap-2 hover:brightness-95 transition-all`}
                                        >
                                            {isCollapsed ? <ChevronRight className="h-3.5 w-3.5 text-zinc-400" /> : <ChevronDown className="h-3.5 w-3.5 text-zinc-400" />}
                                            <span className="font-black text-sm text-zinc-900">{group.name}</span>
                                            <span className={`text-[10px] font-black uppercase tracking-wide px-1.5 py-0.5 border rounded-sm ${colors.bg} ${colors.text}`}>
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
                                                    <span className="text-[10px] font-bold text-zinc-500 italic px-3 py-1.5" style={{ gridColumn: "2 / 5" }}>Opening Balance</span>
                                                    <span className="text-xs font-mono text-right px-3 py-1.5">—</span>
                                                    <span className="text-xs font-mono text-right px-3 py-1.5">—</span>
                                                    <span className="text-xs font-mono text-right px-3 py-1.5">—</span>
                                                    {showGross && <span className="text-xs font-mono text-right px-3 py-1.5">—</span>}
                                                    {showTax && <span className="text-xs font-mono text-right px-3 py-1.5">—</span>}
                                                </div>

                                                {/* Transaction Rows */}
                                                {group.rows.map((row, idx) => {
                                                    const srcColor = sourceColor(row.source)
                                                    return (
                                                        <div key={`${row.entryId}-${idx}`} className={`grid ${colTemplate} border-b border-zinc-100 items-center hover:bg-indigo-50/20 transition-colors ${idx % 2 !== 0 ? "bg-zinc-50/30" : ""}`}>
                                                            <span className="text-[11px] font-mono text-zinc-500 px-3 py-1.5">{fmtDate(row.date)}</span>
                                                            <span className="px-3 py-1.5">
                                                                <span className={`text-[9px] font-black uppercase px-1.5 py-0.5 border rounded-sm inline-block ${srcColor}`}>
                                                                    {row.source}
                                                                </span>
                                                            </span>
                                                            <span className="text-[11px] font-medium text-zinc-700 px-3 py-1.5 truncate">{row.description}</span>
                                                            <span className="text-[11px] font-mono text-zinc-400 px-3 py-1.5 truncate">{row.reference || "—"}</span>
                                                            <span className="text-[11px] font-mono font-bold text-right px-3 py-1.5">
                                                                {row.debit > 0 ? <span className="text-zinc-900">{formatIDR(row.debit)}</span> : <span className="text-zinc-200">—</span>}
                                                            </span>
                                                            <span className="text-[11px] font-mono font-bold text-right px-3 py-1.5">
                                                                {row.credit > 0 ? <span className="text-zinc-900">{formatIDR(row.credit)}</span> : <span className="text-zinc-200">—</span>}
                                                            </span>
                                                            <span className={`text-[11px] font-mono font-bold text-right px-3 py-1.5 ${row.runningBalance < 0 ? "text-red-600" : "text-zinc-900"}`}>
                                                                {formatIDR(Math.abs(row.runningBalance))}
                                                            </span>
                                                            {showGross && (
                                                                <span className="text-[11px] font-mono text-right px-3 py-1.5 text-zinc-600">{formatIDR(row.gross)}</span>
                                                            )}
                                                            {showTax && (
                                                                <span className="text-[11px] font-mono text-right px-3 py-1.5 text-zinc-400">
                                                                    {row.tax !== 0 ? (
                                                                        <span className={row.tax < 0 ? "" : ""}>{row.tax < 0 ? `(${formatIDR(Math.abs(row.tax))})` : formatIDR(row.tax)}</span>
                                                                    ) : "—"}
                                                                </span>
                                                            )}
                                                        </div>
                                                    )
                                                })}

                                                {/* Total Row */}
                                                <div className={`grid ${colTemplate} bg-zinc-100 border-b border-zinc-300 font-black`}>
                                                    <span className="text-[10px] uppercase tracking-widest text-zinc-500 px-3 py-2" style={{ gridColumn: "1 / 5" }}>
                                                        Total {group.name}
                                                    </span>
                                                    <span className="text-[11px] font-mono text-right px-3 py-2 text-zinc-900">{formatIDR(groupDebit)}</span>
                                                    <span className="text-[11px] font-mono text-right px-3 py-2 text-zinc-900">{formatIDR(groupCredit)}</span>
                                                    <span className={`text-[11px] font-mono text-right px-3 py-2 ${closingBalance < 0 ? "text-red-600" : "text-zinc-900"}`}>
                                                        {formatIDR(Math.abs(closingBalance))}
                                                    </span>
                                                    {showGross && <span className="text-[11px] font-mono text-right px-3 py-2 text-zinc-600">{formatIDR(groupGross)}</span>}
                                                    {showTax && <span className="px-3 py-2" />}
                                                </div>

                                                {/* Closing Balance */}
                                                <div className={`grid ${colTemplate} bg-zinc-50/70 border-b-2 border-zinc-300`}>
                                                    <span className="text-[10px] font-bold text-zinc-500 italic px-3 py-1.5" style={{ gridColumn: "1 / 5" }}>
                                                        Closing Balance
                                                    </span>
                                                    <span className="text-[11px] font-mono text-right px-3 py-1.5">—</span>
                                                    <span className="text-[11px] font-mono text-right px-3 py-1.5">—</span>
                                                    <span className={`text-[11px] font-mono font-black text-right px-3 py-1.5 ${closingBalance < 0 ? "text-red-600" : "text-zinc-900"}`}>
                                                        {formatIDR(Math.abs(closingBalance))}
                                                    </span>
                                                    {showGross && <span className="px-3 py-1.5" />}
                                                    {showTax && <span className="px-3 py-1.5">—</span>}
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
                        <span className="bg-indigo-500 text-white text-[10px] font-black px-2 py-0.5 min-w-[20px] text-center rounded-sm">{filtered.length}</span>
                    </div>

                    {filtered.length === 0 ? (
                        <div className="flex items-center justify-center py-16 text-zinc-400 text-xs font-bold uppercase tracking-widest">
                            Tidak ada transaksi ditemukan
                        </div>
                    ) : (
                        <div className="min-w-[900px]">
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
                                    const gross = line.debit > 0 ? line.debit : line.credit
                                    const isTaxLine = line.accountCode.startsWith("21") || line.accountName.toLowerCase().includes("ppn")
                                    return (
                                        <div key={`${entry.id}-${li}`} className={`grid ${colTemplate} border-b border-zinc-100 items-center hover:bg-indigo-50/20 transition-colors`}>
                                            <span className="text-[11px] font-mono text-zinc-500 px-3 py-1.5">{li === 0 ? fmtDate(entry.date) : ""}</span>
                                            <span className="px-3 py-1.5">
                                                {li === 0 && <span className={`text-[9px] font-black uppercase px-1.5 py-0.5 border rounded-sm ${srcColor}`}>{source}</span>}
                                            </span>
                                            <span className="text-[11px] font-medium text-zinc-700 px-3 py-1.5 truncate">
                                                {line.description || entry.description}
                                                <span className="text-zinc-300 ml-1.5 text-[9px]">({line.accountCode} {line.accountName})</span>
                                            </span>
                                            <span className="text-[11px] font-mono text-zinc-400 px-3 py-1.5">{li === 0 ? (entry.reference || "—") : ""}</span>
                                            <span className="text-[11px] font-mono font-bold text-right px-3 py-1.5">
                                                {line.debit > 0 ? formatIDR(line.debit) : <span className="text-zinc-200">—</span>}
                                            </span>
                                            <span className="text-[11px] font-mono font-bold text-right px-3 py-1.5">
                                                {line.credit > 0 ? formatIDR(line.credit) : <span className="text-zinc-200">—</span>}
                                            </span>
                                            <span className="text-[11px] font-mono text-right px-3 py-1.5 text-zinc-300">—</span>
                                            {showGross && <span className="text-[11px] font-mono text-right px-3 py-1.5 text-zinc-600">{formatIDR(gross)}</span>}
                                            {showTax && <span className="text-[11px] font-mono text-right px-3 py-1.5 text-zinc-400">{isTaxLine ? formatIDR(gross) : "—"}</span>}
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
