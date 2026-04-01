"use client"

import { useState } from "react"
import {
    Wallet,
    Plus,
    Receipt,
    Calendar,
    Tag,
    ChevronUp,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
import { formatIDR } from "@/lib/utils"
import { toast } from "sonner"
import { useExpenses } from "@/hooks/use-expenses"
import { recordExpense } from "@/lib/actions/finance"
import { useQueryClient } from "@tanstack/react-query"
import { queryKeys } from "@/lib/query-keys"

const CATEGORIES = [
    "Operasional",
    "Transport",
    "Supplies",
    "Utilitas",
    "Gaji & Upah",
    "Sewa",
    "Marketing",
    "Entertainment",
    "Maintenance",
    "Lainnya",
]

export default function ExpensesPage() {
    const { data, isLoading } = useExpenses()
    const queryClient = useQueryClient()
    const expenses = data?.expenses ?? []
    const expenseAccounts = data?.expenseAccounts ?? []
    const cashAccounts = data?.cashAccounts ?? []

    const [showForm, setShowForm] = useState(false)
    const [submitting, setSubmitting] = useState(false)
    const [form, setForm] = useState({
        description: "",
        amount: "",
        date: new Date().toISOString().split("T")[0],
        category: "Operasional",
        expenseAccountId: "",
        cashAccountId: "",
        reference: "",
    })

    const totalExpenses = expenses.reduce((sum, e: any) => sum + (e.amount || 0), 0)
    const thisMonthExpenses = expenses
        .filter((e: any) => {
            const d = new Date(e.date)
            const now = new Date()
            return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear()
        })
        .reduce((sum, e: any) => sum + (e.amount || 0), 0)

    const handleSubmit = async () => {
        const amount = Number(form.amount)
        if (!form.description.trim()) {
            toast.error("Deskripsi wajib diisi")
            return
        }
        if (!amount || amount <= 0) {
            toast.error("Jumlah harus lebih dari 0")
            return
        }
        if (!form.expenseAccountId) {
            toast.error("Pilih akun beban")
            return
        }
        if (!form.cashAccountId) {
            toast.error("Pilih akun kas/bank")
            return
        }

        setSubmitting(true)
        try {
            const result = await recordExpense({
                description: form.description.trim(),
                amount,
                date: new Date(form.date + "T12:00:00"),
                category: form.category,
                expenseAccountId: form.expenseAccountId,
                cashAccountId: form.cashAccountId,
                reference: form.reference.trim() || undefined,
            })

            if (result.success) {
                toast.success(`Pengeluaran ${result.number} berhasil dicatat`)
                setForm({
                    description: "",
                    amount: "",
                    date: new Date().toISOString().split("T")[0],
                    category: "Operasional",
                    expenseAccountId: form.expenseAccountId,
                    cashAccountId: form.cashAccountId,
                    reference: "",
                })
                setShowForm(false)
                queryClient.invalidateQueries({ queryKey: queryKeys.expenses.all })
                queryClient.invalidateQueries({ queryKey: queryKeys.journal.all })
                queryClient.invalidateQueries({ queryKey: queryKeys.financeDashboard.all })
                queryClient.invalidateQueries({ queryKey: queryKeys.financeReports.all })
                queryClient.invalidateQueries({ queryKey: queryKeys.chartAccounts.all })
                queryClient.invalidateQueries({ queryKey: queryKeys.accountTransactions.all })
            } else {
                toast.error(result.error || "Gagal mencatat pengeluaran")
            }
        } catch {
            toast.error("Terjadi kesalahan")
        } finally {
            setSubmitting(false)
        }
    }

    return (
        <div className="mf-page">

            {/* ═══ HEADER ═══ */}
            <div className="border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] overflow-hidden bg-white dark:bg-zinc-900">
                <div className="px-6 py-4 flex items-center justify-between border-l-[6px] border-l-yellow-400">
                    <div className="flex items-center gap-3">
                        <Wallet className="h-5 w-5 text-yellow-500" />
                        <div>
                            <h1 className="text-xl font-black uppercase tracking-tight text-zinc-900 dark:text-white">
                                Buku Kas / Pengeluaran
                            </h1>
                            <p className="text-zinc-400 text-xs font-medium mt-0.5">
                                Catat pengeluaran harian, petty cash, dan biaya operasional
                            </p>
                        </div>
                    </div>
                    <Button
                        onClick={() => setShowForm(!showForm)}
                        className="bg-black text-white hover:bg-zinc-800 border-2 border-black shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] active:translate-y-[1px] active:shadow-none transition-all text-[10px] font-black uppercase tracking-widest h-9 px-4"
                    >
                        {showForm ? <><ChevronUp className="mr-2 h-3.5 w-3.5" /> Tutup</> : <><Plus className="mr-2 h-3.5 w-3.5" /> Catat Pengeluaran</>}
                    </Button>
                </div>
            </div>

            {/* ═══ KPI STRIP ═══ */}
            <div className="bg-white dark:bg-zinc-900 border-2 border-black shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] overflow-hidden">
                <div className="grid grid-cols-2 md:grid-cols-3">
                    <div className="relative p-4 md:p-5 border-r-2 border-zinc-100 dark:border-zinc-800">
                        <div className="absolute top-0 left-0 right-0 h-1 bg-yellow-400" />
                        <div className="flex items-center gap-2 mb-2">
                            <Receipt className="h-4 w-4 text-zinc-400" />
                            <span className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Total Records</span>
                        </div>
                        <div className="text-2xl md:text-3xl font-black tracking-tighter text-zinc-900 dark:text-white">{expenses.length}</div>
                    </div>
                    <div className="relative p-4 md:p-5 border-r-2 border-zinc-100 dark:border-zinc-800">
                        <div className="absolute top-0 left-0 right-0 h-1 bg-red-400" />
                        <div className="flex items-center gap-2 mb-2">
                            <Wallet className="h-4 w-4 text-zinc-400" />
                            <span className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Total Pengeluaran</span>
                        </div>
                        <div className="text-2xl md:text-3xl font-black tracking-tighter text-red-600">{formatIDR(totalExpenses)}</div>
                    </div>
                    <div className="relative p-4 md:p-5">
                        <div className="absolute top-0 left-0 right-0 h-1 bg-amber-400" />
                        <div className="flex items-center gap-2 mb-2">
                            <Calendar className="h-4 w-4 text-zinc-400" />
                            <span className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Bulan Ini</span>
                        </div>
                        <div className="text-2xl md:text-3xl font-black tracking-tighter text-amber-600">{formatIDR(thisMonthExpenses)}</div>
                    </div>
                </div>
            </div>

            {/* ═══ FORM ═══ */}
            {showForm && (
                <div className="bg-white dark:bg-zinc-900 border-2 border-black shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] overflow-hidden">
                    <div className="px-4 py-3 border-b-2 border-black bg-zinc-50 dark:bg-zinc-800">
                        <p className="text-[10px] font-black uppercase tracking-widest text-zinc-500 flex items-center gap-2">
                            <Plus className="h-3.5 w-3.5" /> Catat Pengeluaran Baru
                        </p>
                    </div>
                    <div className="p-4 space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div className="space-y-2">
                                <Label className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Deskripsi <span className="text-red-500">*</span></Label>
                                <Input
                                    value={form.description}
                                    onChange={(e) => setForm(f => ({ ...f, description: e.target.value }))}
                                    placeholder="Beli ATK Kantor"
                                    className="border-2 border-black h-10 font-medium rounded-none"
                                />
                            </div>
                            <div className="space-y-2">
                                <Label className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Jumlah (Rp) <span className="text-red-500">*</span></Label>
                                <Input
                                    type="number"
                                    value={form.amount}
                                    onChange={(e) => setForm(f => ({ ...f, amount: e.target.value }))}
                                    placeholder="0"
                                    className="border-2 border-black font-mono font-black h-10 text-right rounded-none"
                                />
                            </div>
                            <div className="space-y-2">
                                <Label className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Kategori</Label>
                                <Select value={form.category} onValueChange={(v) => setForm(f => ({ ...f, category: v }))}>
                                    <SelectTrigger className="border-2 border-black h-10 font-bold rounded-none">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {CATEGORIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div className="space-y-2">
                                <Label className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Tanggal</Label>
                                <Input
                                    type="date"
                                    value={form.date}
                                    onChange={(e) => setForm(f => ({ ...f, date: e.target.value }))}
                                    className="border-2 border-black h-10 rounded-none"
                                />
                            </div>
                            <div className="space-y-2">
                                <Label className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Akun Beban <span className="text-red-500">*</span></Label>
                                <Select value={form.expenseAccountId} onValueChange={(v) => setForm(f => ({ ...f, expenseAccountId: v }))}>
                                    <SelectTrigger className="border-2 border-black h-10 font-bold rounded-none">
                                        <SelectValue placeholder="Pilih akun beban..." />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {expenseAccounts.map((a: any) => <SelectItem key={a.id} value={a.id}>{a.code} — {a.name}</SelectItem>)}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-2">
                                <Label className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Dibayar dari <span className="text-red-500">*</span></Label>
                                <Select value={form.cashAccountId} onValueChange={(v) => setForm(f => ({ ...f, cashAccountId: v }))}>
                                    <SelectTrigger className="border-2 border-black h-10 font-bold rounded-none">
                                        <SelectValue placeholder="Pilih kas/bank..." />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {cashAccounts.map((a: any) => <SelectItem key={a.id} value={a.id}>{a.code} — {a.name}</SelectItem>)}
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Referensi / No. Kwitansi (Opsional)</Label>
                                <Input
                                    value={form.reference}
                                    onChange={(e) => setForm(f => ({ ...f, reference: e.target.value }))}
                                    placeholder="KWT-001 / Nota #42"
                                    className="border-2 border-black h-10 rounded-none"
                                />
                            </div>
                        </div>

                        <div className="flex justify-end pt-2">
                            <Button
                                onClick={handleSubmit}
                                disabled={submitting}
                                className="bg-yellow-500 text-black hover:bg-yellow-600 border-2 border-black shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] active:translate-y-[1px] active:shadow-none transition-all text-[10px] font-black uppercase tracking-widest h-10 px-8 disabled:opacity-40"
                            >
                                {submitting ? "Menyimpan..." : "Simpan Pengeluaran"}
                            </Button>
                        </div>
                    </div>
                </div>
            )}

            {/* ═══ TABLE ═══ */}
            <div className="bg-white dark:bg-zinc-900 border-2 border-black shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] overflow-hidden">
                <div className="px-4 py-3 border-b-2 border-black bg-zinc-50 dark:bg-zinc-800 flex items-center justify-between">
                    <p className="text-[10px] font-black uppercase tracking-widest text-zinc-500 flex items-center gap-2">
                        <Receipt className="h-3.5 w-3.5" /> Riwayat Pengeluaran
                    </p>
                    <span className="text-[10px] font-black uppercase tracking-widest text-zinc-400">{expenses.length} records</span>
                </div>

                {/* Header */}
                <div className="hidden md:grid grid-cols-12 gap-2 px-4 py-2 border-b border-zinc-200 text-[10px] font-black uppercase tracking-widest text-zinc-500">
                    <div className="col-span-1">Ref</div>
                    <div className="col-span-2">Tanggal</div>
                    <div className="col-span-2">Kategori</div>
                    <div className="col-span-3">Deskripsi</div>
                    <div className="col-span-2">Akun</div>
                    <div className="col-span-2 text-right">Jumlah</div>
                </div>

                {isLoading ? (
                    <div className="p-12 text-center">
                        <p className="text-[10px] font-black uppercase tracking-widest text-zinc-400 animate-pulse">Memuat data...</p>
                    </div>
                ) : expenses.length === 0 ? (
                    <div className="p-12 text-center">
                        <Wallet className="h-8 w-8 mx-auto text-zinc-300 mb-2" />
                        <p className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Belum ada pengeluaran dicatat</p>
                    </div>
                ) : (
                    expenses.map((exp: any) => (
                        <div key={exp.id} className="grid grid-cols-12 gap-2 px-4 py-3 border-b border-zinc-100 hover:bg-zinc-50 transition-colors items-center">
                            <div className="col-span-1">
                                <span className="font-mono text-[10px] font-bold text-zinc-400">{exp.reference || "-"}</span>
                            </div>
                            <div className="col-span-2">
                                <span className="text-xs text-zinc-500">{new Date(exp.date).toLocaleDateString("id-ID")}</span>
                            </div>
                            <div className="col-span-2">
                                <span className="inline-flex items-center gap-1 text-[9px] font-black uppercase px-2 py-0.5 border border-yellow-300 bg-yellow-50 text-yellow-700 rounded-sm">
                                    <Tag className="h-2.5 w-2.5" /> {exp.category}
                                </span>
                            </div>
                            <div className="col-span-3">
                                <p className="text-sm font-medium truncate">{exp.description}</p>
                            </div>
                            <div className="col-span-2">
                                <span className="text-[10px] font-bold text-zinc-400">{exp.expenseAccount?.name ?? "-"}</span>
                            </div>
                            <div className="col-span-2 text-right">
                                <span className="font-mono font-bold text-sm text-red-600">- {formatIDR(exp.amount)}</span>
                            </div>
                        </div>
                    ))
                )}
            </div>
        </div>
    )
}
