"use client"

import Link from "next/link"
import {
    DollarSign, Wallet, CreditCard, Activity, FileText,
    PiggyBank, Scale, AlertCircle, TrendingUp, ArrowUpRight,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { useFinanceDashboard } from "@/hooks/use-finance-dashboard"
import { TablePageSkeleton } from "@/components/ui/page-skeleton"
import { AccountingModuleActions } from "@/components/finance/accounting-module-actions"
import { CashFlowChart } from "@/components/finance/cash-flow-chart"
import { ActionItemsWidget } from "@/components/finance/action-items-widget"
import { formatCompactNumber, formatIDR } from "@/lib/utils"

export default function FinanceDashboardPage() {
    const { data, isLoading } = useFinanceDashboard()

    if (isLoading || !data) {
        return <TablePageSkeleton accentColor="bg-indigo-400" />
    }

    const { metrics, dashboardData } = data

    return (
        <div className="mf-page">

            {/* COMMAND HEADER */}
            <div className="border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] overflow-hidden bg-white dark:bg-zinc-900">
                <div className="px-6 py-4 flex items-center justify-between border-l-[6px] border-l-indigo-400">
                    <div className="flex items-center gap-3">
                        <Wallet className="h-5 w-5 text-indigo-500" />
                        <div>
                            <h1 className="text-xl font-black uppercase tracking-tight text-zinc-900 dark:text-white">
                                Keuangan & Akuntansi
                            </h1>
                            <p className="text-zinc-400 text-xs font-medium mt-0.5">
                                Gambaran umum posisi keuangan, arus kas, dan tugas akuntansi
                            </p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <Button variant="outline" asChild className="border-2 border-black font-black uppercase text-[10px] tracking-wider h-9 px-4 rounded-none">
                            <Link href="/finance/reports">
                                <Activity className="mr-2 h-3.5 w-3.5" /> Laporan Cepat
                            </Link>
                        </Button>
                        <Button asChild className="bg-black text-white border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:translate-y-[2px] hover:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] transition-all font-black uppercase text-xs tracking-wider px-6 h-9 rounded-none">
                            <Link href="/finance/journal">
                                <Scale className="mr-2 h-4 w-4" /> Entri Jurnal Baru
                            </Link>
                        </Button>
                    </div>
                </div>
            </div>

            {/* KPI PULSE STRIP */}
            <div className="bg-white dark:bg-zinc-900 border-2 border-black shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] overflow-hidden">
                <div className="grid grid-cols-2 md:grid-cols-4">
                    {/* Cash Balance */}
                    <div className="relative p-4 md:p-5 border-r-2 border-zinc-100 dark:border-zinc-800 border-b-2 md:border-b-0">
                        <div className="absolute top-0 left-0 right-0 h-1 bg-emerald-400" />
                        <div className="flex items-center gap-2 mb-2">
                            <Wallet className="h-4 w-4 text-zinc-400" />
                            <span className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Posisi Kas</span>
                        </div>
                        <div className="text-2xl md:text-3xl font-black tracking-tighter text-emerald-600">
                            Rp {formatCompactNumber(metrics.cashBalance)}
                        </div>
                        <div className="flex items-center gap-1 mt-1.5">
                            <span className="text-[10px] font-bold text-emerald-600">Cash on Hand</span>
                        </div>
                    </div>

                    {/* Receivables (AR) */}
                    <div className="relative p-4 md:p-5 border-r-2 border-zinc-100 dark:border-zinc-800 border-b-2 md:border-b-0">
                        <div className="absolute top-0 left-0 right-0 h-1 bg-blue-400" />
                        <div className="flex items-center gap-2 mb-2">
                            <FileText className="h-4 w-4 text-zinc-400" />
                            <span className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Piutang (AR)</span>
                        </div>
                        <div className="text-2xl md:text-3xl font-black tracking-tighter text-blue-600">
                            Rp {formatCompactNumber(metrics.receivables)}
                        </div>
                        <div className="flex items-center gap-1 mt-1.5">
                            <span className="text-[10px] font-bold text-blue-600">Invoice terbuka</span>
                        </div>
                    </div>

                    {/* Payables (AP) */}
                    <div className="relative p-4 md:p-5 border-r-2 border-zinc-100 dark:border-zinc-800">
                        <div className="absolute top-0 left-0 right-0 h-1 bg-rose-400" />
                        <div className="flex items-center gap-2 mb-2">
                            <CreditCard className="h-4 w-4 text-zinc-400" />
                            <span className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Utang (AP)</span>
                        </div>
                        <div className="text-2xl md:text-3xl font-black tracking-tighter text-rose-600">
                            Rp {formatCompactNumber(metrics.payables)}
                        </div>
                        <div className="flex items-center gap-1 mt-1.5">
                            <span className="text-[10px] font-bold text-rose-600">Bill belum lunas</span>
                        </div>
                    </div>

                    {/* Net Margin */}
                    <div className="relative p-4 md:p-5">
                        <div className="absolute top-0 left-0 right-0 h-1 bg-amber-400" />
                        <div className="flex items-center gap-2 mb-2">
                            <PiggyBank className="h-4 w-4 text-zinc-400" />
                            <span className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Laba Bersih (YTD)</span>
                        </div>
                        <div className="text-2xl md:text-3xl font-black tracking-tighter text-amber-600">
                            {metrics.netMargin}%
                        </div>
                        <div className="flex items-center gap-1 mt-1.5">
                            <span className="text-[10px] font-bold text-amber-600">Net Margin</span>
                        </div>
                    </div>
                </div>
            </div>

            {/* FINANCE MODULE ACTIONS */}
            <AccountingModuleActions />

            {/* MAIN CONTENT: CHART + TRANSACTIONS | ACTION ITEMS */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">

                {/* Left: Cash Flow + Recent Transactions */}
                <div className="lg:col-span-2 space-y-5">
                    {/* Cash Flow Chart — neo-brutalist wrapper */}
                    <div className="border-2 border-black shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] overflow-hidden bg-white dark:bg-zinc-900">
                        <div className="bg-indigo-50 dark:bg-indigo-950/20 px-4 py-2.5 border-b-2 border-black flex items-center gap-2 border-l-[5px] border-l-indigo-400">
                            <TrendingUp className="h-4 w-4 text-indigo-600" />
                            <span className="text-xs font-black uppercase tracking-widest text-indigo-800">Cash Flow (7 Hari)</span>
                        </div>
                        <div className="p-4">
                            <CashFlowChart data={dashboardData.cashFlow} className="border-0 shadow-none p-0 rounded-none" />
                        </div>
                    </div>

                    {/* Recent Transactions */}
                    <div className="border-2 border-black shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] overflow-hidden bg-white dark:bg-zinc-900">
                        <div className="bg-zinc-50 dark:bg-zinc-800 px-4 py-2.5 border-b-2 border-black flex items-center justify-between border-l-[5px] border-l-zinc-400">
                            <div className="flex items-center gap-2">
                                <DollarSign className="h-4 w-4 text-zinc-600" />
                                <span className="text-xs font-black uppercase tracking-widest text-zinc-700">Transaksi Terakhir</span>
                            </div>
                            <Button asChild variant="link" className="text-[10px] font-black uppercase tracking-widest text-zinc-400 hover:text-black p-0 h-auto">
                                <Link href="/finance/journal">Lihat Jurnal Umum</Link>
                            </Button>
                        </div>
                        <div className="divide-y divide-zinc-100 dark:divide-zinc-800">
                            {dashboardData.recentTransactions.length === 0 ? (
                                <div className="p-12 text-center">
                                    <DollarSign className="h-8 w-8 mx-auto text-zinc-300 mb-2" />
                                    <p className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Belum ada transaksi terbaru</p>
                                </div>
                            ) : dashboardData.recentTransactions.map((item: any) => (
                                <Link key={item.id} href={item.href} className="px-5 py-4 flex items-center justify-between hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors group cursor-pointer">
                                    <div className="flex items-center gap-4">
                                        <div className={cn(
                                            "h-10 w-10 border-2 border-black flex items-center justify-center font-black text-xs shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]",
                                            item.direction === 'in' ? "bg-emerald-100 text-emerald-700" : "bg-rose-100 text-rose-700"
                                        )}>
                                            {item.direction === 'in' ? 'IN' : 'OUT'}
                                        </div>
                                        <div>
                                            <div className="font-bold text-sm leading-none text-zinc-900 dark:text-white">{item.title}</div>
                                            <div className="text-[10px] text-zinc-400 font-mono mt-1 tracking-wide">
                                                {item.subtitle} &bull; {new Date(item.date).toLocaleDateString('id-ID')}
                                            </div>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-4">
                                        <span className={cn(
                                            "font-mono font-black text-sm",
                                            item.direction === 'in' ? 'text-emerald-600' : 'text-rose-600'
                                        )}>
                                            {item.direction === 'in' ? '+' : '-'} {formatIDR(item.amount)}
                                        </span>
                                        <ArrowUpRight className="h-4 w-4 text-zinc-300 opacity-0 group-hover:opacity-100 transition-opacity" />
                                    </div>
                                </Link>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Right: Action Items + Quick Access */}
                <div className="space-y-5">
                    {/* Action Items — neo-brutalist */}
                    <div className="border-2 border-black shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] overflow-hidden bg-white dark:bg-zinc-900">
                        <div className="bg-amber-50 dark:bg-amber-950/20 px-4 py-2.5 border-b-2 border-black flex items-center justify-between border-l-[5px] border-l-amber-400">
                            <div className="flex items-center gap-2">
                                <AlertCircle className="h-4 w-4 text-amber-600" />
                                <span className="text-xs font-black uppercase tracking-widest text-amber-800">To-Do Accounting</span>
                            </div>
                            <span className="text-[10px] font-black bg-amber-200 text-amber-800 border border-amber-300 px-2 py-0.5">
                                {dashboardData.actionItems.length}
                            </span>
                        </div>
                        <div className="divide-y divide-zinc-100 dark:divide-zinc-800">
                            {dashboardData.actionItems.length === 0 ? (
                                <div className="p-8 text-center">
                                    <AlertCircle className="h-6 w-6 mx-auto text-zinc-300 mb-2" />
                                    <p className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Tidak ada action item</p>
                                </div>
                            ) : dashboardData.actionItems.map((action: any) => (
                                <Link key={action.id} href={action.href} className="px-4 py-3 flex items-center gap-3 hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors group">
                                    <div className={cn(
                                        "h-8 w-8 border-2 border-black flex items-center justify-center shrink-0 shadow-[1px_1px_0px_0px_rgba(0,0,0,1)]",
                                        action.type === 'urgent' && "bg-red-100 text-red-600",
                                        action.type === 'pending' && "bg-amber-100 text-amber-600",
                                        action.type === 'warning' && "bg-blue-100 text-blue-600",
                                        action.type === 'info' && "bg-zinc-100 text-zinc-600",
                                    )}>
                                        {action.type === 'urgent' ? <AlertCircle className="h-3.5 w-3.5" /> :
                                         action.type === 'pending' ? <Activity className="h-3.5 w-3.5" /> :
                                         <FileText className="h-3.5 w-3.5" />}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="text-xs font-bold text-zinc-900 dark:text-white truncate">{action.title}</p>
                                        <p className="text-[10px] font-bold text-zinc-400 mt-0.5">Jatuh tempo: {action.due}</p>
                                    </div>
                                </Link>
                            ))}
                        </div>
                    </div>

                    {/* Quick Access */}
                    <div className="border-2 border-black shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] overflow-hidden bg-white dark:bg-zinc-900">
                        <div className="bg-zinc-50 dark:bg-zinc-800 px-4 py-2.5 border-b-2 border-black flex items-center gap-2 border-l-[5px] border-l-zinc-400">
                            <Activity className="h-4 w-4 text-zinc-600" />
                            <span className="text-xs font-black uppercase tracking-widest text-zinc-700">Akses Cepat</span>
                        </div>
                        <div className="grid grid-cols-2 gap-0">
                            {[
                                { href: "/finance/invoices", icon: FileText, label: "Buat Invoice", color: "text-blue-500 bg-blue-50" },
                                { href: "/finance/bills", icon: CreditCard, label: "Catat Bill", color: "text-rose-500 bg-rose-50" },
                                { href: "/finance/reports", icon: Activity, label: "Rekonsiliasi", color: "text-amber-500 bg-amber-50" },
                                { href: "/finance/vendor-payments", icon: ArrowUpRight, label: "Transfer Kas", color: "text-emerald-500 bg-emerald-50" },
                            ].map((item, idx) => (
                                <Link
                                    key={item.href}
                                    href={item.href}
                                    className={cn(
                                        "p-4 flex flex-col gap-2 hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors group",
                                        idx % 2 === 0 && "border-r border-zinc-100",
                                        idx < 2 && "border-b border-zinc-100",
                                    )}
                                >
                                    <div className={cn("h-8 w-8 flex items-center justify-center border-2 border-black shadow-[1px_1px_0px_0px_rgba(0,0,0,1)]", item.color)}>
                                        <item.icon className="h-4 w-4" />
                                    </div>
                                    <span className="text-[10px] font-black uppercase tracking-widest text-zinc-600">{item.label}</span>
                                </Link>
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}
