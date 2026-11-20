"use client"

import Link from "next/link"
import {
    Receipt,
    TrendingUp,
    ArrowUpRight,
    DollarSign,
    AlertCircle,
    Banknote,
    ArrowRight,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { useSalesDashboard } from "@/hooks/use-sales-dashboard"
import { TablePageSkeleton } from "@/components/ui/page-skeleton"

const formatRupiah = (num: number) =>
    new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(num)

export default function SalesStreamPage() {
    const { data, isLoading } = useSalesDashboard()

    if (isLoading || !data) {
        return <TablePageSkeleton accentColor="bg-green-400" />
    }

    const { invoices, stats } = data

    const getDisplayStatus = (status: string) => {
        if (status === "PAID") return "PAID"
        if (status === "OVERDUE") return "OVERDUE"
        return "UNPAID"
    }

    return (
        <div className="mf-page">

            {/* COMMAND HEADER */}
            <div className="border border-border shadow-sm overflow-hidden bg-white dark:bg-zinc-900">
                <div className="px-6 py-4 flex items-center justify-between border-l-[6px] border-l-green-400">
                    <div className="flex items-center gap-3">
                        <DollarSign className="h-5 w-5 text-green-500" />
                        <div>
                            <h1 className="text-xl font-semibold tracking-tight text-zinc-900 dark:text-white">
                                Penjualan
                            </h1>
                            <p className="text-zinc-400 text-xs font-medium mt-0.5">
                                Performa keuangan & metrik penjualan real-time
                            </p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <Button asChild className="bg-slate-900 text-white border border-border shadow-sm hover:shadow-sm transition-all font-semibold text-xs px-6 h-9 rounded-md">
                            <Link href="/finance/invoices">
                                <Receipt className="mr-2 h-4 w-4" /> Buat Invoice
                            </Link>
                        </Button>
                    </div>
                </div>
            </div>

            {/* KPI PULSE STRIP */}
            <div className="bg-white dark:bg-zinc-900 border border-border shadow-sm overflow-hidden">
                <div className="grid grid-cols-2 md:grid-cols-4">
                    {/* Total Revenue */}
                    <div className="relative p-4 md:p-5 border-r border-zinc-100 dark:border-zinc-800 border-b md:border-b-0">
                        <div className="absolute top-0 left-0 right-0 h-1 bg-green-400" />
                        <div className="flex items-center gap-2 mb-2">
                            <TrendingUp className="h-4 w-4 text-zinc-400" />
                            <span className="text-xs font-semibold text-zinc-500">Total Penjualan</span>
                        </div>
                        <div className="text-2xl md:text-3xl font-semibold tracking-tighter text-zinc-900 dark:text-white">
                            {formatRupiah(stats.totalRevenue)}
                        </div>
                    </div>

                    {/* Paid */}
                    <div className="relative p-4 md:p-5 border-r border-zinc-100 dark:border-zinc-800 border-b md:border-b-0">
                        <div className="absolute top-0 left-0 right-0 h-1 bg-emerald-400" />
                        <div className="flex items-center gap-2 mb-2">
                            <Banknote className="h-4 w-4 text-zinc-400" />
                            <span className="text-xs font-semibold text-zinc-500">Terbayar</span>
                        </div>
                        <div className="text-2xl md:text-3xl font-semibold tracking-tighter text-emerald-600">
                            {formatRupiah(stats.paidAmount)}
                        </div>
                        <div className="flex items-center gap-1 mt-1.5">
                            <span className="text-xs font-bold text-emerald-600">
                                {stats.paidCount} invoice lunas
                            </span>
                        </div>
                    </div>

                    {/* Unpaid */}
                    <div className="relative p-4 md:p-5 border-r border-zinc-100 dark:border-zinc-800">
                        <div className="absolute top-0 left-0 right-0 h-1 bg-amber-400" />
                        <div className="flex items-center gap-2 mb-2">
                            <DollarSign className="h-4 w-4 text-zinc-400" />
                            <span className="text-xs font-semibold text-zinc-500">Belum Bayar (AR)</span>
                        </div>
                        <div className="text-2xl md:text-3xl font-semibold tracking-tighter text-amber-600">
                            {formatRupiah(stats.unpaidAmount)}
                        </div>
                        <div className="flex items-center gap-1 mt-1.5">
                            <span className="text-xs font-bold text-amber-600">
                                {stats.unpaidCount} invoice terbuka
                            </span>
                        </div>
                    </div>

                    {/* Overdue */}
                    <div className="relative p-4 md:p-5">
                        <div className="absolute top-0 left-0 right-0 h-1 bg-red-400" />
                        <div className="flex items-center gap-2 mb-2">
                            <AlertCircle className="h-4 w-4 text-zinc-400" />
                            <span className="text-xs font-semibold text-zinc-500">Jatuh Tempo</span>
                        </div>
                        <div className="text-2xl md:text-3xl font-semibold tracking-tighter text-red-600">
                            {formatRupiah(stats.overdueAmount)}
                        </div>
                        <div className="flex items-center gap-1 mt-1.5">
                            <span className="text-xs font-bold text-red-600">
                                {stats.overdueCount} perlu tindakan
                            </span>
                        </div>
                    </div>
                </div>
            </div>

            {/* TRANSACTION TABLE */}
            <div className="bg-white dark:bg-zinc-900 border border-border shadow-sm overflow-hidden">
                {/* Table Header */}
                <div className="px-5 py-3 border-b border-border bg-zinc-50 dark:bg-zinc-800 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <Receipt className="h-4 w-4 text-zinc-400" />
                        <span className="text-xs font-semibold text-zinc-500">Invoice Penjualan</span>
                    </div>
                    <span className="text-xs font-semibold text-zinc-400">
                        {invoices.length} transaksi
                    </span>
                </div>

                {/* Table Rows */}
                <div className="divide-y divide-zinc-100 dark:divide-zinc-800">
                    {invoices.map((inv: any) => {
                        const displayStatus = getDisplayStatus(inv.status)
                        return (
                            <Link
                                key={inv.id}
                                href={`/finance/invoices`}
                                className="px-5 py-4 flex items-center justify-between hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors group cursor-pointer"
                            >
                                <div className="flex items-center gap-4">
                                    <div className={cn(
                                        "h-10 w-10 border border-border flex items-center justify-center font-semibold text-xs shadow-sm",
                                        displayStatus === 'PAID' ? "bg-emerald-100 text-emerald-700" :
                                            displayStatus === 'OVERDUE' ? "bg-red-100 text-red-700" : "bg-amber-50 text-amber-700"
                                    )}>
                                        {displayStatus === 'PAID' ? 'PD' : displayStatus === 'OVERDUE' ? 'OD' : 'OP'}
                                    </div>
                                    <div>
                                        <div className="font-bold text-sm leading-none text-zinc-900 dark:text-white">
                                            {inv.customerName}
                                        </div>
                                        <div className="text-xs text-zinc-400 font-mono mt-1 ">
                                            {inv.number} &bull; {new Date(inv.issueDate).toLocaleDateString("id-ID")}
                                        </div>
                                    </div>
                                </div>

                                <div className="flex items-center gap-6">
                                    <div className="text-right">
                                        <div className="font-semibold text-sm tracking-tight text-zinc-900 dark:text-white">
                                            {formatRupiah(inv.totalAmount)}
                                        </div>
                                        <div className={cn(
                                            "text-xs font-semibold mt-0.5",
                                            displayStatus === 'PAID' ? "text-emerald-600" :
                                                displayStatus === 'OVERDUE' ? "text-red-600" : "text-amber-600"
                                        )}>
                                            {displayStatus === 'PAID' ? 'Lunas' : displayStatus === 'OVERDUE' ? 'Jatuh Tempo' : 'Belum Bayar'}
                                        </div>
                                    </div>

                                    <ArrowUpRight className="h-4 w-4 text-zinc-300 opacity-0 group-hover:opacity-100 transition-opacity" />
                                </div>
                            </Link>
                        )
                    })}
                </div>

                {invoices.length === 0 && (
                    <div className="p-12 text-center">
                        <Receipt className="h-8 w-8 mx-auto text-zinc-300 mb-2" />
                        <p className="text-xs font-semibold text-zinc-400">Belum ada invoice penjualan</p>
                    </div>
                )}

                {/* Footer */}
                <div className="px-5 py-3 bg-zinc-50 dark:bg-zinc-800 border-t border-border text-center">
                    <Button asChild variant="link" className="text-xs font-semibold text-zinc-400 hover:text-black">
                        <Link href="/finance/invoices">
                            Lihat Semua Transaksi <ArrowRight className="ml-1 h-3 w-3" />
                        </Link>
                    </Button>
                </div>
            </div>
        </div>
    )
}
