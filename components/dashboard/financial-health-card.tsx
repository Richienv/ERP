"use client"

import { AreaChart, Area, ResponsiveContainer, Tooltip } from "recharts"
import { ArrowRight, TrendingUp, TrendingDown, AlertCircle } from "lucide-react"
import Link from "next/link"
import { formatIDR } from "@/lib/utils"

interface FinancialHealthCardProps {
    cashFlowData: Array<{ date: string; balance: number }>
    accountsReceivable: number
    accountsPayable: number
    overdueInvoices: Array<{ id: string; number: string; customer: string; amount: number; daysOverdue: number }>
    upcomingPayables: Array<{ id: string; number: string; vendor: string; amount: number; dueDate: string }>
}

function formatCompact(value: number): string {
    if (value === 0) return "Rp 0"
    const abs = Math.abs(value)
    if (abs >= 1_000_000_000) return `Rp ${(value / 1_000_000_000).toFixed(1)}M`
    if (abs >= 1_000_000) return `Rp ${(value / 1_000_000).toFixed(1)}jt`
    if (abs >= 1_000) return `Rp ${(value / 1_000).toFixed(0)}rb`
    return `Rp ${value.toFixed(0)}`
}

export function FinancialHealthCard({
    cashFlowData,
    accountsReceivable,
    accountsPayable,
    overdueInvoices,
    upcomingPayables
}: FinancialHealthCardProps) {
    const hasChartData = cashFlowData && cashFlowData.length > 0
    const arTrend = overdueInvoices.length > 0 ? "warning" : "good"
    const apTrend = upcomingPayables.length > 0 ? "warning" : "good"

    return (
        <div className="h-full flex flex-col bg-white dark:bg-zinc-900 border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] overflow-hidden">
            {/* Header */}
            <div className="flex-none flex items-center justify-between px-4 py-3 border-b-2 border-black">
                <h3 className="text-xs font-black uppercase tracking-widest text-zinc-500 dark:text-zinc-400">
                    Arus Kas (7 Hari)
                </h3>
                <Link href="/finance" className="text-[10px] font-black uppercase tracking-wider text-zinc-400 hover:text-black dark:hover:text-white transition-colors flex items-center gap-1">
                    Detail <ArrowRight className="h-3 w-3" />
                </Link>
            </div>

            {/* Chart Area */}
            <div className="flex-none h-[120px] px-2 pt-2">
                {hasChartData ? (
                    <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={cashFlowData} margin={{ top: 5, right: 5, bottom: 5, left: 5 }}>
                            <defs>
                                <linearGradient id="cashGradient" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="0%" stopColor="#000" stopOpacity={0.15} />
                                    <stop offset="100%" stopColor="#000" stopOpacity={0} />
                                </linearGradient>
                            </defs>
                            <Area
                                type="monotone"
                                dataKey="balance"
                                stroke="#000"
                                strokeWidth={3}
                                fill="url(#cashGradient)"
                                dot={false}
                                animationDuration={1000}
                            />
                            <Tooltip
                                content={({ active, payload }) => {
                                    if (active && payload && payload.length) {
                                        return (
                                            <div className="bg-black text-white px-3 py-2 text-xs font-bold border-2 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
                                                <p className="font-mono">{payload[0].payload.date}</p>
                                                <p className="font-black">{formatCompact(Number(payload[0].value))}</p>
                                            </div>
                                        )
                                    }
                                    return null
                                }}
                            />
                        </AreaChart>
                    </ResponsiveContainer>
                ) : (
                    <div className="h-full flex items-center justify-center border-2 border-dashed border-zinc-200 dark:border-zinc-700">
                        <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">Belum ada data arus kas</p>
                    </div>
                )}
            </div>

            {/* AR / AP Split */}
            <div className="flex-1 grid grid-cols-2 border-t-2 border-dashed border-zinc-200 dark:border-zinc-700 min-h-0">
                {/* Accounts Receivable */}
                <Link href="/finance/invoices" className="p-4 border-r-2 border-dashed border-zinc-200 dark:border-zinc-700 hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors">
                    <div className="flex items-center gap-1.5 mb-1.5">
                        <TrendingUp className="h-3.5 w-3.5 text-blue-500" />
                        <span className="text-[10px] font-black uppercase tracking-widest text-zinc-500 dark:text-zinc-400">Piutang</span>
                    </div>
                    <p className="text-xl font-black tracking-tighter text-zinc-900 dark:text-white">
                        {accountsReceivable > 0 ? formatCompact(accountsReceivable) : <span className="text-zinc-300 dark:text-zinc-600 text-sm">Rp 0</span>}
                    </p>
                    {overdueInvoices.length > 0 && (
                        <div className="flex items-center gap-1 mt-1.5">
                            <AlertCircle className="h-3 w-3 text-red-500" />
                            <span className="text-[10px] font-bold text-red-600 dark:text-red-400">{overdueInvoices.length} overdue</span>
                        </div>
                    )}
                    {overdueInvoices.length === 0 && accountsReceivable === 0 && (
                        <p className="text-[10px] text-zinc-400 mt-1">Belum ada piutang</p>
                    )}
                </Link>

                {/* Accounts Payable */}
                <Link href="/finance/bills" className="p-4 hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors">
                    <div className="flex items-center gap-1.5 mb-1.5">
                        <TrendingDown className="h-3.5 w-3.5 text-rose-500" />
                        <span className="text-[10px] font-black uppercase tracking-widest text-zinc-500 dark:text-zinc-400">Hutang</span>
                    </div>
                    <p className="text-xl font-black tracking-tighter text-zinc-900 dark:text-white">
                        {accountsPayable > 0 ? formatCompact(accountsPayable) : <span className="text-zinc-300 dark:text-zinc-600 text-sm">Rp 0</span>}
                    </p>
                    {upcomingPayables.length > 0 && (
                        <div className="flex items-center gap-1 mt-1.5">
                            <AlertCircle className="h-3 w-3 text-amber-500" />
                            <span className="text-[10px] font-bold text-amber-600 dark:text-amber-400">{upcomingPayables.length} jatuh tempo</span>
                        </div>
                    )}
                    {upcomingPayables.length === 0 && accountsPayable === 0 && (
                        <p className="text-[10px] text-zinc-400 mt-1">Belum ada hutang</p>
                    )}
                </Link>
            </div>
        </div>
    )
}
