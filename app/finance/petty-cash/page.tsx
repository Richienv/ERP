"use client"

import { useState } from "react"
import { useQueryClient } from "@tanstack/react-query"
import { queryKeys } from "@/lib/query-keys"
import { usePettyCash } from "@/hooks/use-petty-cash"
import { topUpPettyCash, disbursePettyCash, getExpenseAccounts, getBankAccounts, createExpenseAccount, createBankAccount } from "@/lib/actions/finance-petty-cash"
import { TablePageSkeleton } from "@/components/ui/page-skeleton"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { ComboboxWithCreate, type ComboboxOption } from "@/components/ui/combobox-with-create"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { toast } from "sonner"
import { Wallet, ArrowUpCircle, ArrowDownCircle, Plus, Minus, Loader2, RefreshCcw } from "lucide-react"

export const dynamic = "force-dynamic"

const formatCurrency = (val: number) =>
    new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(val)

export default function PettyCashPage() {
    const { data, isLoading } = usePettyCash()
    const queryClient = useQueryClient()

    const [topUpOpen, setTopUpOpen] = useState(false)
    const [disburseOpen, setDisburseOpen] = useState(false)

    if (isLoading || !data) return <TablePageSkeleton accentColor="bg-emerald-400" />

    return (
        <div className="mf-page min-h-screen space-y-4">
            {/* HEADER */}
            <div className="border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] overflow-hidden bg-white">
                <div className="px-6 py-4 flex items-center justify-between border-l-[6px] border-l-emerald-500">
                    <div className="flex items-center gap-3">
                        <Wallet className="h-6 w-6 text-emerald-500" />
                        <div>
                            <h1 className="text-xl font-black uppercase tracking-tight text-zinc-900">Peti Kas</h1>
                            <p className="text-zinc-600 text-xs font-bold mt-0.5">Kas kecil untuk pengeluaran operasional harian</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <Button
                            variant="outline"
                            onClick={() => queryClient.invalidateQueries({ queryKey: queryKeys.pettyCash.all })}
                            className="h-9 border-2 border-black font-bold uppercase text-[10px] tracking-wider shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:translate-y-[1px] hover:shadow-none transition-all bg-white"
                        >
                            <RefreshCcw className="mr-2 h-3.5 w-3.5" /> Refresh
                        </Button>
                        <Button
                            onClick={() => setTopUpOpen(true)}
                            className="h-9 bg-emerald-600 text-white hover:bg-emerald-700 border-2 border-emerald-700 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] uppercase font-black text-[10px] tracking-wider hover:translate-y-[1px] hover:shadow-none transition-all px-4"
                        >
                            <Plus className="mr-2 h-3.5 w-3.5" /> Top Up
                        </Button>
                        <Button
                            onClick={() => setDisburseOpen(true)}
                            className="h-9 bg-black text-white hover:bg-zinc-800 border-2 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] uppercase font-black text-[10px] tracking-wider hover:translate-y-[1px] hover:shadow-none transition-all px-4"
                        >
                            <Minus className="mr-2 h-3.5 w-3.5" /> Catat Pengeluaran
                        </Button>
                    </div>
                </div>
            </div>

            {/* KPI STRIP */}
            <div className="bg-white border-2 border-black shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] overflow-hidden">
                <div className="grid grid-cols-3">
                    <div className="relative p-4 border-r-2 border-zinc-100">
                        <div className="absolute top-0 left-0 right-0 h-1 bg-emerald-500" />
                        <div className="text-[10px] font-black uppercase tracking-widest text-zinc-500 mb-1">Saldo Saat Ini</div>
                        <div className="text-2xl font-black text-emerald-600">{formatCurrency(data.currentBalance)}</div>
                    </div>
                    <div className="relative p-4 border-r-2 border-zinc-100">
                        <div className="absolute top-0 left-0 right-0 h-1 bg-blue-500" />
                        <div className="text-[10px] font-black uppercase tracking-widest text-zinc-500 mb-1">Top Up Bulan Ini</div>
                        <div className="text-2xl font-black text-blue-600">{formatCurrency(data.totalTopup)}</div>
                    </div>
                    <div className="relative p-4">
                        <div className="absolute top-0 left-0 right-0 h-1 bg-red-500" />
                        <div className="text-[10px] font-black uppercase tracking-widest text-zinc-500 mb-1">Pengeluaran Bulan Ini</div>
                        <div className="text-2xl font-black text-red-600">{formatCurrency(data.totalDisbursement)}</div>
                    </div>
                </div>
            </div>

            {/* TRANSACTION TABLE */}
            <div className="border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] bg-white flex flex-col min-h-[400px]">
                <div className="p-4 border-b-2 border-black bg-zinc-50">
                    <h2 className="text-lg font-black uppercase tracking-tight">Riwayat Transaksi</h2>
                </div>
                <div className="overflow-x-auto">
                    {data.transactions.length === 0 ? (
                        <div className="text-center py-20 text-zinc-400">
                            <Wallet className="h-12 w-12 mx-auto mb-4 text-zinc-200" />
                            <p className="font-bold text-lg text-zinc-500">Belum ada transaksi</p>
                            <p className="text-sm mt-1">Top up peti kas untuk memulai</p>
                        </div>
                    ) : (
                        <table className="w-full">
                            <thead>
                                <tr className="border-b-2 border-black bg-zinc-50">
                                    <th className="text-left px-4 py-3 text-[10px] font-black uppercase tracking-widest text-zinc-500">Tanggal</th>
                                    <th className="text-left px-4 py-3 text-[10px] font-black uppercase tracking-widest text-zinc-500">Tipe</th>
                                    <th className="text-left px-4 py-3 text-[10px] font-black uppercase tracking-widest text-zinc-500">Nama</th>
                                    <th className="text-left px-4 py-3 text-[10px] font-black uppercase tracking-widest text-zinc-500">Keterangan</th>
                                    <th className="text-right px-4 py-3 text-[10px] font-black uppercase tracking-widest text-zinc-500">Jumlah</th>
                                    <th className="text-right px-4 py-3 text-[10px] font-black uppercase tracking-widest text-zinc-500">Saldo</th>
                                </tr>
                            </thead>
                            <tbody>
                                {data.transactions.map((tx: any) => (
                                    <tr key={tx.id} className="border-b border-zinc-100 hover:bg-zinc-50 transition-colors">
                                        <td className="px-4 py-3 text-xs font-mono text-zinc-600">
                                            {new Date(tx.date).toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric" })}
                                        </td>
                                        <td className="px-4 py-3">
                                            {tx.type === "TOPUP" ? (
                                                <span className="inline-flex items-center gap-1 bg-emerald-100 text-emerald-700 text-[10px] font-black uppercase px-2 py-0.5 border border-emerald-300">
                                                    <ArrowUpCircle className="h-3 w-3" /> Masuk
                                                </span>
                                            ) : (
                                                <span className="inline-flex items-center gap-1 bg-red-100 text-red-700 text-[10px] font-black uppercase px-2 py-0.5 border border-red-300">
                                                    <ArrowDownCircle className="h-3 w-3" /> Keluar
                                                </span>
                                            )}
                                        </td>
                                        <td className="px-4 py-3 text-xs font-bold text-zinc-800">{tx.recipientName || "\u2014"}</td>
                                        <td className="px-4 py-3 text-xs text-zinc-600">{tx.description}</td>
                                        <td className={`px-4 py-3 text-xs font-mono font-bold text-right ${tx.type === "TOPUP" ? "text-emerald-600" : "text-red-600"}`}>
                                            {tx.type === "TOPUP" ? "+" : "\u2212"}{formatCurrency(tx.amount)}
                                        </td>
                                        <td className="px-4 py-3 text-xs font-mono font-bold text-right text-zinc-800">
                                            {formatCurrency(tx.balanceAfter)}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}
                </div>
            </div>

            {/* TOP-UP DIALOG */}
            <TopUpDialog open={topUpOpen} onOpenChange={setTopUpOpen} onSuccess={() => {
                queryClient.invalidateQueries({ queryKey: queryKeys.pettyCash.all })
                queryClient.invalidateQueries({ queryKey: queryKeys.journal.all })
                queryClient.invalidateQueries({ queryKey: queryKeys.financeDashboard.all })
                queryClient.invalidateQueries({ queryKey: queryKeys.financeReports.all })
                queryClient.invalidateQueries({ queryKey: queryKeys.chartAccounts.all })
            }} />

            {/* DISBURSEMENT DIALOG */}
            <DisburseDialog open={disburseOpen} onOpenChange={setDisburseOpen} onSuccess={() => {
                queryClient.invalidateQueries({ queryKey: queryKeys.pettyCash.all })
                queryClient.invalidateQueries({ queryKey: queryKeys.journal.all })
                queryClient.invalidateQueries({ queryKey: queryKeys.financeDashboard.all })
                queryClient.invalidateQueries({ queryKey: queryKeys.financeReports.all })
                queryClient.invalidateQueries({ queryKey: queryKeys.chartAccounts.all })
            }} />
        </div>
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

    return (
        <Dialog open={open} onOpenChange={(v) => { onOpenChange(v); if (v) loadBanks() }}>
            <DialogContent className="border-2 border-black shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] rounded-none max-w-md p-0 bg-white">
                <div className="bg-emerald-600 text-white px-6 py-4 border-b-2 border-black">
                    <DialogHeader>
                        <DialogTitle className="font-black uppercase tracking-tight text-lg text-white flex items-center gap-2">
                            <ArrowUpCircle className="h-5 w-5" /> Top Up Peti Kas
                        </DialogTitle>
                    </DialogHeader>
                </div>
                <div className="p-6 space-y-4">
                    <div>
                        <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500 mb-1.5 block">Jumlah (IDR)</label>
                        <Input
                            type="number"
                            placeholder="500000"
                            value={amount}
                            onChange={(e) => setAmount(e.target.value)}
                            className="border-2 border-black rounded-none h-10 font-mono font-bold w-full placeholder:text-zinc-400 placeholder:font-normal placeholder:font-sans"
                        />
                    </div>
                    <div>
                        <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500 mb-1.5 block">Dari Akun Bank</label>
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
                    <div>
                        <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500 mb-1.5 block">Keterangan</label>
                        <Input
                            placeholder="Top up bulanan..."
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            className="border-2 border-black rounded-none h-10 font-medium w-full placeholder:text-zinc-400 placeholder:font-normal"
                        />
                    </div>
                </div>
                <div className="flex gap-2 justify-end px-6 pb-6">
                    <Button variant="outline" onClick={() => onOpenChange(false)} className="border-2 border-black rounded-none font-black uppercase text-[10px] tracking-widest h-10 px-5 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:translate-y-[1px] hover:shadow-none transition-all">
                        Batal
                    </Button>
                    <Button
                        disabled={!amount || !bankCode || loading}
                        onClick={async () => {
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
                        className="bg-emerald-600 hover:bg-emerald-700 text-white border-2 border-emerald-700 rounded-none font-black uppercase text-[10px] tracking-widest h-10 px-6 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:translate-y-[1px] hover:shadow-none transition-all"
                    >
                        {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Plus className="h-4 w-4 mr-2" />}
                        Top Up
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
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

    return (
        <Dialog open={open} onOpenChange={(v) => { onOpenChange(v); if (v) loadExpenses() }}>
            <DialogContent className="border-2 border-black shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] rounded-none max-w-md p-0 bg-white">
                <div className="bg-black text-white px-6 py-4 border-b-2 border-black">
                    <DialogHeader>
                        <DialogTitle className="font-black uppercase tracking-tight text-lg text-white flex items-center gap-2">
                            <ArrowDownCircle className="h-5 w-5 text-red-400" /> Catat Pengeluaran
                        </DialogTitle>
                    </DialogHeader>
                </div>
                <div className="p-6 space-y-4">
                    <div>
                        <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500 mb-1.5 block">Nama Pemohon</label>
                        <Input
                            placeholder="Nama karyawan..."
                            value={recipientName}
                            onChange={(e) => setRecipientName(e.target.value)}
                            className="border-2 border-black rounded-none h-10 font-bold w-full placeholder:text-zinc-400 placeholder:font-normal"
                        />
                    </div>
                    <div>
                        <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500 mb-1.5 block">Jumlah (IDR)</label>
                        <Input
                            type="number"
                            placeholder="150000"
                            value={amount}
                            onChange={(e) => setAmount(e.target.value)}
                            className="border-2 border-black rounded-none h-10 font-mono font-bold w-full placeholder:text-zinc-400 placeholder:font-normal placeholder:font-sans"
                        />
                    </div>
                    <div>
                        <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500 mb-1.5 block">Kategori Beban</label>
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
                                    // Immediately add to local state (don't rely on refetch timing)
                                    setExpenses(prev => {
                                        if (prev.some(e => e.code === result.code)) return prev
                                        return [...prev, { code: result.code!, name: result.name || name }].sort((a, b) => a.code.localeCompare(b.code))
                                    })
                                    // Also refetch in background for consistency
                                    loadExpenses()
                                    // Invalidate cross-module queries
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
                    <div>
                        <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500 mb-1.5 block">Keterangan</label>
                        <Input
                            placeholder="Transport ke gudang Bandung..."
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            className="border-2 border-black rounded-none h-10 font-medium w-full placeholder:text-zinc-400 placeholder:font-normal"
                        />
                    </div>
                </div>
                <div className="flex gap-2 justify-end px-6 pb-6">
                    <Button variant="outline" onClick={() => onOpenChange(false)} className="border-2 border-black rounded-none font-black uppercase text-[10px] tracking-widest h-10 px-5 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:translate-y-[1px] hover:shadow-none transition-all">
                        Batal
                    </Button>
                    <Button
                        disabled={!amount || !recipientName || !expenseCode || loading}
                        onClick={async () => {
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
                        className="bg-black text-white hover:bg-zinc-800 border-2 border-black rounded-none font-black uppercase text-[10px] tracking-widest h-10 px-6 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:translate-y-[1px] hover:shadow-none transition-all"
                    >
                        {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Minus className="h-4 w-4 mr-2" />}
                        Catat Pengeluaran
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    )
}
