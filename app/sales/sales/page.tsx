import Link from "next/link"
import {
    Search,
    Download,
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
import { prisma } from "@/lib/prisma"

export const dynamic = "force-dynamic"

const formatRupiah = (num: number) =>
    new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(num)

const toNumber = (value: unknown, fallback = 0) => {
    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : fallback
}

export default async function SalesStreamPage() {
    const [invoices, paidAgg, unpaidAgg, overdueAgg, totalAgg] = await Promise.all([
        prisma.invoice.findMany({
            where: { type: "INV_OUT" },
            orderBy: { issueDate: "desc" },
            take: 20,
            include: { customer: { select: { name: true } } },
        }),
        prisma.invoice.aggregate({
            _sum: { totalAmount: true },
            _count: { _all: true },
            where: { type: "INV_OUT", status: "PAID" },
        }),
        prisma.invoice.aggregate({
            _sum: { totalAmount: true },
            _count: { _all: true },
            where: { type: "INV_OUT", status: { in: ["ISSUED", "PARTIAL", "DRAFT"] } },
        }),
        prisma.invoice.aggregate({
            _sum: { totalAmount: true },
            _count: { _all: true },
            where: { type: "INV_OUT", status: "OVERDUE" },
        }),
        prisma.invoice.aggregate({
            _sum: { totalAmount: true },
            where: { type: "INV_OUT", status: { notIn: ["CANCELLED", "VOID"] } },
        }),
    ])

    const totalRevenue = toNumber(totalAgg._sum.totalAmount)
    const paidAmount = toNumber(paidAgg._sum.totalAmount)
    const paidCount = paidAgg._count._all
    const unpaidAmount = toNumber(unpaidAgg._sum.totalAmount)
    const unpaidCount = unpaidAgg._count._all
    const overdueAmount = toNumber(overdueAgg._sum.totalAmount)
    const overdueCount = overdueAgg._count._all

    const getDisplayStatus = (status: string) => {
        if (status === "PAID") return "PAID"
        if (status === "OVERDUE") return "OVERDUE"
        return "UNPAID"
    }

    return (
        <div className="p-4 md:p-6 lg:p-8 pt-6 w-full space-y-4 bg-zinc-50 dark:bg-black min-h-screen">

            {/* COMMAND HEADER */}
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
                        <Button asChild className="bg-black text-white border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:translate-y-[2px] hover:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] transition-all font-black uppercase text-xs tracking-wider px-6 h-9 rounded-none">
                            <Link href="/finance/invoices">
                                <Receipt className="mr-2 h-4 w-4" /> Buat Invoice
                            </Link>
                        </Button>
                    </div>
                </div>
            </div>

            {/* KPI PULSE STRIP */}
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
                    </div>

                    {/* Paid */}
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
                                {paidCount} invoice lunas
                            </span>
                        </div>
                    </div>

                    {/* Unpaid */}
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
                                {unpaidCount} invoice terbuka
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
                                {overdueCount} perlu tindakan
                            </span>
                        </div>
                    </div>
                </div>
            </div>

            {/* TRANSACTION TABLE */}
            <div className="bg-white dark:bg-zinc-900 border-2 border-black shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] overflow-hidden">
                {/* Table Header */}
                <div className="px-5 py-3 border-b-2 border-black bg-zinc-50 dark:bg-zinc-800 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <Receipt className="h-4 w-4 text-zinc-400" />
                        <span className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Invoice Penjualan</span>
                    </div>
                    <span className="text-[10px] font-black uppercase tracking-widest text-zinc-400">
                        {invoices.length} transaksi
                    </span>
                </div>

                {/* Table Rows */}
                <div className="divide-y divide-zinc-100 dark:divide-zinc-800">
                    {invoices.map((inv) => {
                        const displayStatus = getDisplayStatus(inv.status)
                        return (
                            <Link
                                key={inv.id}
                                href={`/finance/invoices`}
                                className="px-5 py-4 flex items-center justify-between hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors group cursor-pointer"
                            >
                                <div className="flex items-center gap-4">
                                    <div className={cn(
                                        "h-10 w-10 border-2 border-black flex items-center justify-center font-black text-xs shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]",
                                        displayStatus === 'PAID' ? "bg-emerald-100 text-emerald-700" :
                                            displayStatus === 'OVERDUE' ? "bg-red-100 text-red-700" : "bg-amber-50 text-amber-700"
                                    )}>
                                        {displayStatus === 'PAID' ? 'PD' : displayStatus === 'OVERDUE' ? 'OD' : 'OP'}
                                    </div>
                                    <div>
                                        <div className="font-bold text-sm leading-none text-zinc-900 dark:text-white">
                                            {inv.customer?.name || "—"}
                                        </div>
                                        <div className="text-[10px] text-zinc-400 font-mono mt-1 tracking-wide">
                                            {inv.number} &bull; {new Date(inv.issueDate).toLocaleDateString("id-ID")}
                                        </div>
                                    </div>
                                </div>

                                <div className="flex items-center gap-6">
                                    <div className="text-right">
                                        <div className="font-black text-sm tracking-tight text-zinc-900 dark:text-white">
                                            {formatRupiah(toNumber(inv.totalAmount))}
                                        </div>
                                        <div className={cn(
                                            "text-[10px] font-black uppercase tracking-widest mt-0.5",
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
                        <p className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Belum ada invoice penjualan</p>
                    </div>
                )}

                {/* Footer */}
                <div className="px-5 py-3 bg-zinc-50 dark:bg-zinc-800 border-t-2 border-black text-center">
                    <Button asChild variant="link" className="text-[10px] font-black uppercase tracking-widest text-zinc-400 hover:text-black">
                        <Link href="/finance/invoices">
                            Lihat Semua Transaksi <ArrowRight className="ml-1 h-3 w-3" />
                        </Link>
                    </Button>
                </div>
            </div>
        </div>
    )
}
