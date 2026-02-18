"use client"

import { useState } from "react"
import {
    Search,
    Plus,
    ChevronRight,
    ChevronDown,
    BookOpen,
    TrendingUp,
    TrendingDown,
    Scale,
    Layers,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { createGLAccount, type GLAccountNode } from "@/lib/actions/finance"
import { formatIDR } from "@/lib/utils"
import { toast } from "sonner"
import { useChartOfAccounts, useInvalidateChartAccounts } from "@/hooks/use-chart-accounts"
import { TablePageSkeleton } from "@/components/ui/page-skeleton"
import { useQueryClient } from "@tanstack/react-query"
import { queryKeys } from "@/lib/query-keys"

const AccountNode = ({ node, level }: { node: GLAccountNode, level: number }) => {
    const [isOpen, setIsOpen] = useState(true)
    const hasChildren = node.children && node.children.length > 0
    const paddingLeft = level * 24

    return (
        <div className="select-none">
            <div
                className={`flex items-center py-2.5 px-4 hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors border-b border-zinc-100 dark:border-zinc-800 ${level === 0 ? "bg-zinc-50 dark:bg-zinc-800 font-black uppercase text-sm border-b-2 border-black" : ""}`}
                style={{ paddingLeft: `${paddingLeft + 16}px` }}
            >
                <div
                    className="w-6 h-6 flex items-center justify-center mr-2 cursor-pointer hover:text-indigo-500 transition-colors"
                    onClick={() => hasChildren && setIsOpen(!isOpen)}
                >
                    {hasChildren ? (isOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />) : <div className="w-4" />}
                </div>
                <div className="flex-1 flex items-center gap-3">
                    <span className={`font-mono ${level === 0 ? "text-black dark:text-white" : "text-zinc-500"} font-bold text-xs`}>{node.code}</span>
                    <span className={`${level === 0 ? "text-sm" : level === 1 ? "font-bold text-sm text-zinc-900 dark:text-white" : "font-medium text-sm text-zinc-700 dark:text-zinc-300"}`}>
                        {node.name}
                    </span>
                    <span className="text-[9px] font-black uppercase tracking-widest px-1.5 py-0.5 border border-zinc-200 dark:border-zinc-700 text-zinc-400 bg-zinc-50 dark:bg-zinc-800">
                        {node.type}
                    </span>
                </div>
                <div className={`text-right font-mono font-bold text-sm tracking-tight w-40 ${node.balance < 0 ? "text-red-500" : "text-zinc-900 dark:text-white"}`}>
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

    const filteredAccounts = accounts.filter((acc) => {
        const matchesSearch = acc.name.toLowerCase().includes(search.toLowerCase()) || acc.code.includes(search)
        if (!matchesSearch) return false
        if (filterType === "ALL") return true
        return acc.type === filterType
    })

    // KPI calculations
    const totalAccounts = accounts.length
    const totalAssets = accounts.filter(a => a.type === "ASSET").reduce((sum, a) => sum + a.balance, 0)
    const totalLiabilities = accounts.filter(a => a.type === "LIABILITY").reduce((sum, a) => sum + a.balance, 0)
    const totalEquity = accounts.filter(a => a.type === "EQUITY").reduce((sum, a) => sum + a.balance, 0)

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

    return (
        <div className="mf-page">

            {/* ═══ COMMAND HEADER ═══ */}
            <div className="border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] overflow-hidden bg-white dark:bg-zinc-900">
                <div className="px-6 py-4 flex items-center justify-between border-l-[6px] border-l-indigo-400">
                    <div className="flex items-center gap-3">
                        <BookOpen className="h-5 w-5 text-indigo-500" />
                        <div>
                            <h1 className="text-xl font-black uppercase tracking-tight text-zinc-900 dark:text-white">
                                Chart of Accounts
                            </h1>
                            <p className="text-zinc-400 text-xs font-medium mt-0.5">
                                Struktur hirarki akun & saldo berjalan
                            </p>
                        </div>
                    </div>
                    <Dialog open={createOpen} onOpenChange={setCreateOpen}>
                        <DialogTrigger asChild>
                            <Button className="bg-black text-white hover:bg-zinc-800 border-2 border-black shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] active:translate-y-[1px] active:shadow-none transition-all text-[10px] font-black uppercase tracking-widest h-9 px-4">
                                <Plus className="mr-2 h-3.5 w-3.5" /> Tambah Akun
                            </Button>
                        </DialogTrigger>
                        <DialogContent>
                            <DialogHeader>
                                <DialogTitle>Tambah Akun COA</DialogTitle>
                                <DialogDescription>Buat akun baru agar langsung masuk ke chart of accounts.</DialogDescription>
                            </DialogHeader>
                            <div className="space-y-3">
                                <div className="grid grid-cols-2 gap-3">
                                    <div className="space-y-1.5">
                                        <Label>Kode Akun</Label>
                                        <Input value={newCode} onChange={(e) => setNewCode(e.target.value)} placeholder="Contoh: 6100" />
                                    </div>
                                    <div className="space-y-1.5">
                                        <Label>Tipe Akun</Label>
                                        <Select value={newType} onValueChange={(v) => setNewType(v as typeof newType)}>
                                            <SelectTrigger><SelectValue /></SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="ASSET">ASSET</SelectItem>
                                                <SelectItem value="LIABILITY">LIABILITY</SelectItem>
                                                <SelectItem value="EQUITY">EQUITY</SelectItem>
                                                <SelectItem value="REVENUE">REVENUE</SelectItem>
                                                <SelectItem value="EXPENSE">EXPENSE</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>
                                </div>
                                <div className="space-y-1.5">
                                    <Label>Nama Akun</Label>
                                    <Input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Contoh: Biaya Listrik" />
                                </div>
                                <Button onClick={handleCreateAccount} disabled={submitting} className="w-full">
                                    {submitting ? "Menyimpan..." : "Simpan Akun"}
                                </Button>
                            </div>
                        </DialogContent>
                    </Dialog>
                </div>
            </div>

            {/* ═══ KPI PULSE STRIP ═══ */}
            <div className="bg-white dark:bg-zinc-900 border-2 border-black shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] overflow-hidden">
                <div className="grid grid-cols-2 md:grid-cols-4">
                    <div className="relative p-4 md:p-5 border-r-2 border-zinc-100 dark:border-zinc-800 border-b-2 md:border-b-0">
                        <div className="absolute top-0 left-0 right-0 h-1 bg-indigo-400" />
                        <div className="flex items-center gap-2 mb-2">
                            <Layers className="h-4 w-4 text-zinc-400" />
                            <span className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Total Akun</span>
                        </div>
                        <div className="text-2xl md:text-3xl font-black tracking-tighter text-zinc-900 dark:text-white">{totalAccounts}</div>
                        <div className="text-[10px] font-bold text-indigo-600 mt-1">Root accounts</div>
                    </div>
                    <div className="relative p-4 md:p-5 border-r-2 border-zinc-100 dark:border-zinc-800 border-b-2 md:border-b-0">
                        <div className="absolute top-0 left-0 right-0 h-1 bg-emerald-400" />
                        <div className="flex items-center gap-2 mb-2">
                            <TrendingUp className="h-4 w-4 text-zinc-400" />
                            <span className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Total Assets</span>
                        </div>
                        <div className="text-2xl md:text-3xl font-black tracking-tighter text-emerald-600">{formatIDR(totalAssets)}</div>
                        <div className="text-[10px] font-bold text-emerald-600 mt-1">Aset bersih</div>
                    </div>
                    <div className="relative p-4 md:p-5 border-r-2 border-zinc-100 dark:border-zinc-800">
                        <div className="absolute top-0 left-0 right-0 h-1 bg-red-400" />
                        <div className="flex items-center gap-2 mb-2">
                            <TrendingDown className="h-4 w-4 text-zinc-400" />
                            <span className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Total Liabilities</span>
                        </div>
                        <div className="text-2xl md:text-3xl font-black tracking-tighter text-red-600">{formatIDR(totalLiabilities)}</div>
                        <div className="text-[10px] font-bold text-red-600 mt-1">Kewajiban</div>
                    </div>
                    <div className="relative p-4 md:p-5">
                        <div className="absolute top-0 left-0 right-0 h-1 bg-blue-400" />
                        <div className="flex items-center gap-2 mb-2">
                            <Scale className="h-4 w-4 text-zinc-400" />
                            <span className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Total Equity</span>
                        </div>
                        <div className="text-2xl md:text-3xl font-black tracking-tighter text-blue-600">{formatIDR(totalEquity)}</div>
                        <div className="text-[10px] font-bold text-blue-600 mt-1">Ekuitas</div>
                    </div>
                </div>
            </div>

            {/* ═══ SEARCH & FILTER BAR ═══ */}
            <div className="bg-white dark:bg-zinc-900 border-2 border-black shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] overflow-hidden">
                <div className="px-4 py-3 flex items-center gap-3 flex-wrap">
                    <div className="relative flex-1 min-w-[200px] max-w-lg">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400" />
                        <Input
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            placeholder="Cari kode atau nama akun..."
                            className="pl-9 border-2 border-black font-bold h-10 placeholder:text-zinc-400 rounded-none"
                        />
                    </div>
                    <div className="flex border-2 border-black">
                        {filterTypes.map((s) => (
                            <button
                                key={s}
                                onClick={() => setFilterType(s)}
                                className={`px-3 py-2 text-[10px] font-black uppercase tracking-widest transition-all border-r border-black last:border-r-0 ${
                                    filterType === s
                                        ? "bg-black text-white"
                                        : "bg-white text-zinc-400 hover:bg-zinc-50"
                                }`}
                            >
                                {filterLabels[s]}
                            </button>
                        ))}
                    </div>
                    <div className="text-[10px] font-black uppercase tracking-widest text-zinc-400 hidden md:block">
                        {filteredAccounts.length} akun
                    </div>
                </div>
            </div>

            {/* ═══ ACCOUNT TREE ═══ */}
            <div className="bg-white dark:bg-zinc-900 border-2 border-black shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] overflow-hidden">
                {/* Tree Header */}
                <div className="flex items-center justify-between px-4 py-3 border-b-2 border-black bg-zinc-50 dark:bg-zinc-800 text-[10px] font-black uppercase tracking-widest text-zinc-500">
                    <span>Struktur Hirarki</span>
                    <span>Saldo (IDR)</span>
                </div>

                {loading ? (
                    <div className="p-12 text-center text-[10px] font-black uppercase tracking-widest text-zinc-400 animate-pulse">
                        Memuat data akun...
                    </div>
                ) : filteredAccounts.length === 0 ? (
                    <div className="p-12 text-center">
                        <BookOpen className="h-8 w-8 mx-auto text-zinc-300 mb-2" />
                        <p className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Tidak ada akun ditemukan</p>
                    </div>
                ) : (
                    filteredAccounts.map((node) => (
                        <AccountNode key={node.id} node={node} level={0} />
                    ))
                )}
            </div>
        </div>
    )
}
