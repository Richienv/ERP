"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
    Search,
    Download,
    Receipt,
    TrendingUp,
    ArrowUpRight,
    DollarSign,
    AlertCircle,
    Banknote,
    Filter,
} from "lucide-react"
import Link from "next/link"
import { cn } from "@/lib/utils"
import { toast } from "sonner"

// --- Mock Data ---

const INVOICES = [
    { id: '1', number: 'INV-2411-001', customer: 'PT. Garment Indah Jaya', date: '2024-11-20', due: '2024-12-20', total: 166500000, status: 'UNPAID' },
    { id: '2', number: 'INV-2411-002', customer: 'CV. Tekstil Makmur', date: '2024-11-18', due: '2024-12-03', total: 94350000, status: 'PAID' },
    { id: '3', number: 'INV-2411-003', customer: 'Boutique Fashion A', date: '2024-11-15', due: '2024-11-15', total: 57720000, status: 'PAID' },
    { id: '4', number: 'INV-2411-004', customer: 'PT. Mode Nusantara', date: '2024-10-25', due: '2024-11-25', total: 133200000, status: 'OVERDUE' },
    { id: '5', number: 'INV-2411-005', customer: 'UD. Kain Sejahtera', date: '2024-11-21', due: '2024-12-21', total: 49950000, status: 'UNPAID' },
]

export default function SalesStreamPage() {
    const [searchTerm, setSearchTerm] = useState("")
    const [filterStatus, setFilterStatus] = useState<string>("ALL")

    const formatRupiah = (num: number) =>
        new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(num)

    const filteredInvoices = INVOICES.filter(inv => {
        const matchesSearch = !searchTerm.trim() ||
            inv.number.toLowerCase().includes(searchTerm.toLowerCase()) ||
            inv.customer.toLowerCase().includes(searchTerm.toLowerCase())
        const matchesStatus = filterStatus === "ALL" || inv.status === filterStatus
        return matchesSearch && matchesStatus
    })

    // Stats
    const totalRevenue = INVOICES.reduce((sum, inv) => sum + inv.total, 0)
    const paidAmount = INVOICES.filter(inv => inv.status === 'PAID').reduce((sum, inv) => sum + inv.total, 0)
    const unpaidAmount = INVOICES.filter(inv => inv.status === 'UNPAID').reduce((sum, inv) => sum + inv.total, 0)
    const overdueAmount = INVOICES.filter(inv => inv.status === 'OVERDUE').reduce((sum, inv) => sum + inv.total, 0)

    const handleExport = () => {
        const headers = ["No", "Number", "Customer", "Date", "Due", "Total", "Status"]
        const rows = INVOICES.map((inv, i) => [
            i + 1, inv.number, inv.customer, inv.date, inv.due, inv.total, inv.status,
        ])
        const csv = [headers.join(","), ...rows.map(r => r.join(","))].join("\n")
        const blob = new Blob([csv], { type: "text/csv" })
        const url = URL.createObjectURL(blob)
        const a = document.createElement("a")
        a.href = url
        a.download = `penjualan-${new Date().toISOString().slice(0, 10)}.csv`
        a.click()
        URL.revokeObjectURL(url)
        toast.success("Data berhasil di-export")
    }

    return (
        <div className="p-4 md:p-8 pt-6 max-w-[1600px] mx-auto space-y-4 bg-zinc-50 dark:bg-black min-h-screen">

            {/* ═══════════════════════════════════════════ */}
            {/* COMMAND HEADER                              */}
            {/* ═══════════════════════════════════════════ */}
            <div className="border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] overflow-hidden bg-white dark:bg-zinc-900">
                <div className="px-6 py-4 flex items-center justify-between border-l-[6px] border-l-green-400">
                    <div className="flex items-center gap-3">
                        <DollarSign className="h-5 w-5 text-green-500" />
                        <div>
                            <h1 className="text-xl font-black uppercase tracking-tight text-zinc-900 dark:text-white">
                                Penjualan
                            </h1>
                            <p className="text-zinc-400 text-xs font-medium mt-0.5">
                                Performa keuangan & metrik penjualan real-time
                            </p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <Button
                            variant="outline"
                            className="border-2 border-black font-black uppercase text-[10px] tracking-wider h-9 px-4 rounded-none"
                            onClick={handleExport}
                        >
                            <Download className="mr-2 h-3.5 w-3.5" /> Export
                        </Button>
                        <Button asChild className="bg-black text-white border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:translate-y-[2px] hover:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] transition-all font-black uppercase text-xs tracking-wider px-6 h-9 rounded-none">
                            <Link href="/finance/invoices">
                                <Receipt className="mr-2 h-4 w-4" /> Buat Invoice
                            </Link>
                        </Button>
                    </div>
                </div>
            </div>

            {/* ═══════════════════════════════════════════ */}
            {/* KPI PULSE STRIP                            */}
            {/* ═══════════════════════════════════════════ */}
            <div className="bg-white dark:bg-zinc-900 border-2 border-black shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] overflow-hidden">
                <div className="grid grid-cols-2 md:grid-cols-4">
                    {/* Total Revenue */}
                    <div className="relative p-4 md:p-5 border-r-2 border-zinc-100 dark:border-zinc-800 border-b-2 md:border-b-0">
                        <div className="absolute top-0 left-0 right-0 h-1 bg-green-400" />
                        <div className="flex items-center gap-2 mb-2">
                            <TrendingUp className="h-4 w-4 text-zinc-400" />
                            <span className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Total Penjualan</span>
                        </div>
                        <div className="text-2xl md:text-3xl font-black tracking-tighter text-zinc-900 dark:text-white">
                            {formatRupiah(totalRevenue)}
                        </div>
                        <div className="flex items-center gap-1 mt-1.5">
                            <ArrowUpRight className="h-3 w-3 text-green-600" />
                            <span className="text-[10px] font-bold text-green-600">+12.5% vs bulan lalu</span>
                        </div>
                    </div>

                    {/* Paid / Cash In */}
                    <div className="relative p-4 md:p-5 border-r-2 border-zinc-100 dark:border-zinc-800 border-b-2 md:border-b-0">
                        <div className="absolute top-0 left-0 right-0 h-1 bg-emerald-400" />
                        <div className="flex items-center gap-2 mb-2">
                            <Banknote className="h-4 w-4 text-zinc-400" />
                            <span className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Terbayar</span>
                        </div>
                        <div className="text-2xl md:text-3xl font-black tracking-tighter text-emerald-600">
                            {formatRupiah(paidAmount)}
                        </div>
                        <div className="flex items-center gap-1 mt-1.5">
                            <span className="text-[10px] font-bold text-emerald-600">
                                {INVOICES.filter(i => i.status === 'PAID').length} invoice lunas
                            </span>
                        </div>
                    </div>

                    {/* Unpaid / AR */}
                    <div className="relative p-4 md:p-5 border-r-2 border-zinc-100 dark:border-zinc-800">
                        <div className="absolute top-0 left-0 right-0 h-1 bg-amber-400" />
                        <div className="flex items-center gap-2 mb-2">
                            <DollarSign className="h-4 w-4 text-zinc-400" />
                            <span className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Belum Bayar (AR)</span>
                        </div>
                        <div className="text-2xl md:text-3xl font-black tracking-tighter text-amber-600">
                            {formatRupiah(unpaidAmount)}
                        </div>
                        <div className="flex items-center gap-1 mt-1.5">
                            <span className="text-[10px] font-bold text-amber-600">
                                {INVOICES.filter(i => i.status === 'UNPAID').length} invoice terbuka
                            </span>
                        </div>
                    </div>

                    {/* Overdue */}
                    <div className="relative p-4 md:p-5">
                        <div className="absolute top-0 left-0 right-0 h-1 bg-red-400" />
                        <div className="flex items-center gap-2 mb-2">
                            <AlertCircle className="h-4 w-4 text-zinc-400" />
                            <span className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Jatuh Tempo</span>
                        </div>
                        <div className="text-2xl md:text-3xl font-black tracking-tighter text-red-600">
                            {formatRupiah(overdueAmount)}
                        </div>
                        <div className="flex items-center gap-1 mt-1.5">
                            <span className="text-[10px] font-bold text-red-600">
                                {INVOICES.filter(i => i.status === 'OVERDUE').length} perlu tindakan
                            </span>
                        </div>
                    </div>
                </div>
            </div>

            {/* ═══════════════════════════════════════════ */}
            {/* SEARCH & FILTER BAR                        */}
            {/* ═══════════════════════════════════════════ */}
            <div className="bg-white dark:bg-zinc-900 border-2 border-black shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] overflow-hidden">
                <div className="px-4 py-3 flex items-center gap-3">
                    <div className="relative flex-1 max-w-md">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400" />
                        <Input
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            placeholder="Cari nomor invoice, pelanggan..."
                            className="pl-9 border-2 border-black font-bold h-10 placeholder:text-zinc-400 rounded-none"
                        />
                    </div>
                    <div className="flex border-2 border-black">
                        {(["ALL", "PAID", "UNPAID", "OVERDUE"] as const).map((s) => (
                            <button
                                key={s}
                                onClick={() => setFilterStatus(s)}
                                className={`px-3 py-2 text-[10px] font-black uppercase tracking-widest transition-all border-r border-black last:border-r-0 ${
                                    filterStatus === s
                                        ? "bg-black text-white"
                                        : "bg-white text-zinc-400 hover:bg-zinc-50"
                                }`}
                            >
                                {s === "ALL" ? "Semua" : s === "PAID" ? "Lunas" : s === "UNPAID" ? "Belum" : "Jatuh Tempo"}
                            </button>
                        ))}
                    </div>
                    <div className="text-[10px] font-black uppercase tracking-widest text-zinc-400 hidden md:block">
                        {filteredInvoices.length} transaksi
                    </div>
                </div>
            </div>

            {/* ═══════════════════════════════════════════ */}
            {/* TRANSACTION TABLE                          */}
            {/* ═══════════════════════════════════════════ */}
            <div className="bg-white dark:bg-zinc-900 border-2 border-black shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] overflow-hidden">
                {/* Table Header */}
                <div className="px-5 py-3 border-b-2 border-black bg-zinc-50 dark:bg-zinc-800 flex items-center gap-2">
                    <Filter className="h-4 w-4 text-zinc-400" />
                    <span className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Transaction Log</span>
                </div>

                {/* Table Rows */}
                <div className="divide-y divide-zinc-100 dark:divide-zinc-800">
                    {filteredInvoices.map((inv) => (
                        <div key={inv.id} className="px-5 py-4 flex items-center justify-between hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors group cursor-pointer">
                            <div className="flex items-center gap-4">
                                <div className={cn(
                                    "h-10 w-10 border-2 border-black flex items-center justify-center font-black text-xs shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]",
                                    inv.status === 'PAID' ? "bg-emerald-100 text-emerald-700" :
                                        inv.status === 'OVERDUE' ? "bg-red-100 text-red-700" : "bg-amber-50 text-amber-700"
                                )}>
                                    {inv.status === 'PAID' ? 'PD' : inv.status === 'OVERDUE' ? 'OD' : 'OP'}
                                </div>
                                <div>
                                    <div className="font-bold text-sm leading-none text-zinc-900 dark:text-white">{inv.customer}</div>
                                    <div className="text-[10px] text-zinc-400 font-mono mt-1 tracking-wide">{inv.number} &bull; {inv.date}</div>
                                </div>
                            </div>

                            <div className="flex items-center gap-6">
                                <div className="text-right">
                                    <div className="font-black text-sm tracking-tight text-zinc-900 dark:text-white">{formatRupiah(inv.total)}</div>
                                    <div className={cn(
                                        "text-[10px] font-black uppercase tracking-widest mt-0.5",
                                        inv.status === 'PAID' ? "text-emerald-600" :
                                            inv.status === 'OVERDUE' ? "text-red-600" : "text-amber-600"
                                    )}>
                                        {inv.status === 'PAID' ? 'Lunas' : inv.status === 'OVERDUE' ? 'Jatuh Tempo' : 'Belum Bayar'}
                                    </div>
                                </div>

                                <ArrowUpRight className="h-4 w-4 text-zinc-300 opacity-0 group-hover:opacity-100 transition-opacity" />
                            </div>
                        </div>
                    ))}
                </div>

                {filteredInvoices.length === 0 && (
                    <div className="p-12 text-center">
                        <Receipt className="h-8 w-8 mx-auto text-zinc-300 mb-2" />
                        <p className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Tidak ada transaksi yang cocok</p>
                    </div>
                )}

                {/* Footer */}
                <div className="px-5 py-3 bg-zinc-50 dark:bg-zinc-800 border-t-2 border-black text-center">
                    <Button variant="link" className="text-[10px] font-black uppercase tracking-widest text-zinc-400 hover:text-black">
                        Lihat Semua Transaksi
                    </Button>
                </div>
            </div>
        </div>
    )
}
