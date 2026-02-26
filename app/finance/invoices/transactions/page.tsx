"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import {
    BookOpen, ArrowLeft, Search, Loader2,
    ArrowUpRight, ArrowDownLeft, Filter,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
    Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select"
import { formatIDR } from "@/lib/utils"
import { getAccountTransactions } from "@/lib/actions/finance-invoices"

interface TransactionLine {
    id: string
    accountCode: string
    accountName: string
    accountType: string
    description: string
    debit: number
    credit: number
}

interface TransactionEntry {
    id: string
    date: Date
    description: string
    reference: string | null
    invoiceNumber: string | null
    invoiceType: string | null
    paymentNumber: string | null
    paymentMethod: string | null
    lines: TransactionLine[]
}

interface AccountSummary {
    id: string
    code: string
    name: string
    type: string
    balance: number
}

export default function AccountTransactionsPage() {
    const router = useRouter()
    const [loading, setLoading] = useState(true)
    const [entries, setEntries] = useState<TransactionEntry[]>([])
    const [accounts, setAccounts] = useState<AccountSummary[]>([])
    const [filterAccount, setFilterAccount] = useState<string>("ALL")
    const [searchText, setSearchText] = useState("")

    useEffect(() => {
        loadData()
    }, [filterAccount])

    const loadData = async () => {
        setLoading(true)
        try {
            const result = await getAccountTransactions({
                accountCode: filterAccount !== "ALL" ? filterAccount : undefined,
                limit: 300,
            }) as any
            if (result.success) {
                setEntries((result.entries || []) as TransactionEntry[])
                setAccounts((result.accounts || []) as AccountSummary[])
            }
        } catch {
            console.error("Failed to load transactions")
        } finally {
            setLoading(false)
        }
    }

    const filtered = searchText.trim()
        ? entries.filter(e =>
            e.description?.toLowerCase().includes(searchText.toLowerCase()) ||
            e.reference?.toLowerCase().includes(searchText.toLowerCase()) ||
            e.invoiceNumber?.toLowerCase().includes(searchText.toLowerCase()) ||
            e.paymentNumber?.toLowerCase().includes(searchText.toLowerCase())
        )
        : entries

    // Calculate balance sheet summary from accounts
    const assets = accounts.filter(a => a.type === 'ASSET')
    const liabilities = accounts.filter(a => a.type === 'LIABILITY')
    const equity = accounts.filter(a => a.type === 'EQUITY')
    const revenue = accounts.filter(a => a.type === 'REVENUE')
    const expense = accounts.filter(a => a.type === 'EXPENSE')

    const totalAssets = assets.reduce((s, a) => s + a.balance, 0)
    const totalLiabilities = liabilities.reduce((s, a) => s + Math.abs(a.balance), 0)
    const totalEquity = equity.reduce((s, a) => s + Math.abs(a.balance), 0)
    const totalRevenue = revenue.reduce((s, a) => s + Math.abs(a.balance), 0)
    const totalExpense = expense.reduce((s, a) => s + a.balance, 0)

    const accountTypeColor: Record<string, string> = {
        ASSET: 'text-blue-600',
        LIABILITY: 'text-red-600',
        EQUITY: 'text-purple-600',
        REVENUE: 'text-emerald-600',
        EXPENSE: 'text-orange-600',
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
                                Catatan jurnal & laporan keuangan dari invoice & pembayaran
                            </p>
                        </div>
                    </div>
                    <Button
                        variant="outline"
                        onClick={() => router.push('/finance/invoices')}
                        className="border-2 border-black font-black uppercase text-[10px] h-10 px-4"
                    >
                        <ArrowLeft className="h-3.5 w-3.5 mr-1.5" /> Kembali
                    </Button>
                </div>
            </div>

            {/* Balance Sheet Summary */}
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                {[
                    { label: 'Total Aset', value: totalAssets, color: 'border-l-blue-400', textColor: 'text-blue-700' },
                    { label: 'Kewajiban', value: totalLiabilities, color: 'border-l-red-400', textColor: 'text-red-700' },
                    { label: 'Ekuitas', value: totalEquity, color: 'border-l-purple-400', textColor: 'text-purple-700' },
                    { label: 'Pendapatan', value: totalRevenue, color: 'border-l-emerald-400', textColor: 'text-emerald-700' },
                    { label: 'Beban', value: totalExpense, color: 'border-l-orange-400', textColor: 'text-orange-700' },
                ].map(kpi => (
                    <div key={kpi.label} className={`border-2 border-black shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] bg-white p-4 border-l-[5px] ${kpi.color}`}>
                        <p className="text-[9px] font-black uppercase tracking-widest text-zinc-400">{kpi.label}</p>
                        <p className={`font-mono font-black text-lg mt-1 ${kpi.textColor}`}>{formatIDR(Math.abs(kpi.value))}</p>
                    </div>
                ))}
            </div>

            {/* Filters */}
            <div className="border-2 border-black shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] bg-white p-4">
                <div className="flex flex-col md:flex-row gap-3">
                    <div className="relative flex-1">
                        <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400" />
                        <Input
                            className="border-2 border-black h-10 pl-9 font-medium"
                            placeholder="Cari deskripsi, referensi, nomor invoice..."
                            value={searchText}
                            onChange={(e) => setSearchText(e.target.value)}
                        />
                    </div>
                    <Select value={filterAccount} onValueChange={setFilterAccount}>
                        <SelectTrigger className="border-2 border-black h-10 font-medium w-full md:w-[280px]">
                            <Filter className="h-3.5 w-3.5 mr-1.5 text-zinc-400" />
                            <SelectValue placeholder="Filter akun" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="ALL">Semua Akun</SelectItem>
                            {accounts.map(a => (
                                <SelectItem key={a.code} value={a.code}>
                                    {a.code} — {a.name}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>
            </div>

            {/* Transaction Journal Table */}
            <div className="border-2 border-black shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] bg-white overflow-hidden">
                <div className="bg-indigo-50 px-5 py-2.5 border-b-2 border-black flex items-center gap-2 border-l-[5px] border-l-indigo-400">
                    <BookOpen className="h-4 w-4 text-indigo-600" />
                    <h3 className="text-[11px] font-black uppercase tracking-widest text-zinc-700">
                        Jurnal Transaksi
                    </h3>
                    <span className="bg-indigo-500 text-white text-[10px] font-black px-2 py-0.5 min-w-[20px] text-center rounded-sm">
                        {filtered.length}
                    </span>
                </div>

                {loading ? (
                    <div className="flex items-center justify-center py-16 text-zinc-400">
                        <Loader2 className="h-5 w-5 animate-spin mr-2" />
                        <span className="text-xs font-bold uppercase tracking-widest">Memuat transaksi...</span>
                    </div>
                ) : filtered.length === 0 ? (
                    <div className="flex items-center justify-center py-16 text-zinc-400 text-xs font-bold uppercase tracking-widest">
                        Belum ada transaksi tercatat
                    </div>
                ) : (
                    <div className="divide-y divide-zinc-100">
                        {filtered.map((entry) => {
                            const totalDebit = entry.lines.reduce((s, l) => s + l.debit, 0)
                            const totalCredit = entry.lines.reduce((s, l) => s + l.credit, 0)
                            return (
                                <div key={entry.id} className="px-5 py-3 hover:bg-indigo-50/30 transition-colors">
                                    {/* Entry header */}
                                    <div className="flex items-center justify-between mb-2">
                                        <div className="flex items-center gap-3">
                                            <span className="text-xs font-mono font-bold text-zinc-400">
                                                {new Date(entry.date).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' })}
                                            </span>
                                            <span className="font-bold text-sm text-zinc-900">{entry.description}</span>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            {entry.invoiceNumber && (
                                                <span className={`text-[10px] font-black uppercase px-2 py-0.5 border rounded-sm ${entry.invoiceType === 'INV_OUT' ? 'bg-blue-50 border-blue-200 text-blue-600' : 'bg-purple-50 border-purple-200 text-purple-600'}`}>
                                                    {entry.invoiceNumber}
                                                </span>
                                            )}
                                            {entry.paymentNumber && (
                                                <span className="text-[10px] font-black uppercase px-2 py-0.5 border bg-emerald-50 border-emerald-200 text-emerald-600 rounded-sm">
                                                    {entry.paymentNumber}
                                                </span>
                                            )}
                                            {entry.reference && !entry.invoiceNumber && !entry.paymentNumber && (
                                                <span className="text-[10px] font-mono text-zinc-400">{entry.reference}</span>
                                            )}
                                        </div>
                                    </div>

                                    {/* Journal lines */}
                                    <div className="ml-4 border-l-2 border-zinc-200 pl-3 space-y-0.5">
                                        {entry.lines.map((line) => (
                                            <div key={line.id} className="flex items-center gap-3 text-xs">
                                                <span className={`font-mono font-bold w-[50px] ${accountTypeColor[line.accountType] || 'text-zinc-600'}`}>
                                                    {line.accountCode}
                                                </span>
                                                <span className="text-zinc-600 flex-1 truncate">{line.accountName}</span>
                                                {line.debit > 0 ? (
                                                    <span className="flex items-center gap-1 font-mono font-bold text-blue-700 w-[130px] text-right justify-end">
                                                        <ArrowUpRight className="h-3 w-3" /> {formatIDR(line.debit)}
                                                    </span>
                                                ) : (
                                                    <span className="w-[130px]" />
                                                )}
                                                {line.credit > 0 ? (
                                                    <span className="flex items-center gap-1 font-mono font-bold text-red-600 w-[130px] text-right justify-end">
                                                        <ArrowDownLeft className="h-3 w-3" /> {formatIDR(line.credit)}
                                                    </span>
                                                ) : (
                                                    <span className="w-[130px]" />
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )
                        })}
                    </div>
                )}
            </div>
        </div>
    )
}
