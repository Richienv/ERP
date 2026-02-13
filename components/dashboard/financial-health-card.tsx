"use client"

import { AreaChart, Area, ResponsiveContainer, Tooltip } from "recharts"
import { ArrowRight, TrendingUp, TrendingDown, AlertCircle, Receipt, Wallet, CircleDollarSign } from "lucide-react"
import Link from "next/link"

interface RecentInvoice {
    id: string
    number: string
    customer: string
    date: string
    total: number
    status: string
}

interface FinancialHealthCardProps {
    cashFlowData: Array<{ date: string; balance: number }>
    accountsReceivable: number
    accountsPayable: number
    overdueInvoices: Array<{ id: string; number: string; customer: string; amount: number; daysOverdue: number }>
    upcomingPayables: Array<{ id: string; number: string; vendor: string; amount: number; dueDate: string }>
    recentInvoices?: RecentInvoice[]
    netCashIn?: number
    revenueMTD?: number
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
    upcomingPayables,
    recentInvoices = [],
    netCashIn = 0,
    revenueMTD = 0,
}: FinancialHealthCardProps) {
    const hasChartData = cashFlowData && cashFlowData.length > 0

    return (
        <div className="h-full flex flex-col bg-white dark:bg-zinc-900 border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] overflow-hidden">
            {/* Header */}
            <div className="flex-none flex items-center justify-between px-4 py-2.5 border-b-2 border-black">
                <h3 className="text-xs font-black uppercase tracking-widest text-zinc-500 dark:text-zinc-400">
                    Revenue Stream
                </h3>
                <Link href="/finance" className="text-[10px] font-black uppercase tracking-wider text-zinc-400 hover:text-black dark:hover:text-white transition-colors flex items-center gap-1">
                    Detail <ArrowRight className="h-3 w-3" />
                </Link>
            </div>

            {/* Metric Tiles — Revenue MTD, Unpaid AR, Net Cash In */}
            <div className="flex-none grid grid-cols-3 border-b-2 border-black">
                <Link href="/sales" className="p-3 border-r border-dashed border-zinc-200 dark:border-zinc-700 hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors">
                    <div className="flex items-center gap-1 mb-1">
                        <Receipt className="h-3 w-3 text-blue-500" />
                        <span className="text-[9px] font-black uppercase tracking-widest text-zinc-400">Revenue MTD</span>
                    </div>
                    <p className="text-lg font-black tracking-tighter text-zinc-900 dark:text-white">
                        {revenueMTD > 0 ? formatCompact(revenueMTD) : <span className="text-zinc-300 text-sm">Rp 0</span>}
                    </p>
                </Link>
                <Link href="/finance/invoices" className="p-3 border-r border-dashed border-zinc-200 dark:border-zinc-700 hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors">
                    <div className="flex items-center gap-1 mb-1">
                        <AlertCircle className="h-3 w-3 text-orange-500" />
                        <span className="text-[9px] font-black uppercase tracking-widest text-zinc-400">Unpaid AR</span>
                    </div>
                    <p className={`text-lg font-black tracking-tighter ${accountsReceivable > 0 ? "text-orange-600" : "text-zinc-900 dark:text-white"}`}>
                        {accountsReceivable > 0 ? formatCompact(accountsReceivable) : <span className="text-zinc-300 text-sm">Rp 0</span>}
                    </p>
                    {overdueInvoices.length > 0 && (
                        <span className="text-[9px] font-bold text-red-600">{overdueInvoices.length} overdue</span>
                    )}
                </Link>
                <Link href="/finance" className="p-3 hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors">
                    <div className="flex items-center gap-1 mb-1">
                        <Wallet className="h-3 w-3 text-emerald-500" />
                        <span className="text-[9px] font-black uppercase tracking-widest text-zinc-400">Net Cash In</span>
                    </div>
                    <p className={`text-lg font-black tracking-tighter ${netCashIn > 0 ? "text-emerald-600" : "text-zinc-900 dark:text-white"}`}>
                        {netCashIn > 0 ? formatCompact(netCashIn) : <span className="text-zinc-300 text-sm">Rp 0</span>}
                    </p>
                </Link>
            </div>

            {/* Cash Flow Mini Chart */}
            <div className="flex-none h-[70px] px-2 pt-1">
                {hasChartData ? (
                    <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={cashFlowData} margin={{ top: 5, right: 5, bottom: 0, left: 5 }}>
                            <defs>
                                <linearGradient id="cashGradient" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="0%" stopColor="#000" stopOpacity={0.12} />
                                    <stop offset="100%" stopColor="#000" stopOpacity={0} />
                                </linearGradient>
                            </defs>
                            <Area
                                type="monotone"
                                dataKey="balance"
                                stroke="#000"
                                strokeWidth={2}
                                fill="url(#cashGradient)"
                                dot={false}
                                animationDuration={800}
                            />
                            <Tooltip
                                content={({ active, payload }) => {
                                    if (active && payload && payload.length) {
                                        return (
                                            <div className="bg-black text-white px-2 py-1 text-[10px] font-bold border-2 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
                                                <p className="font-mono">{payload[0].payload.date}</p>
                                                <p className="font-black">{formatCompact(Number(payload[0].value) * 1_000_000)}</p>
                                            </div>
                                        )
                                    }
                                    return null
                                }}
                            />
                        </AreaChart>
                    </ResponsiveContainer>
                ) : (
                    <div className="h-full flex items-center justify-center border border-dashed border-zinc-200 dark:border-zinc-700 rounded">
                        <p className="text-[9px] font-bold uppercase tracking-wider text-zinc-400">Arus kas 7 hari</p>
                    </div>
                )}
            </div>

            {/* Transaction Log */}
            <div className="flex-1 min-h-0 flex flex-col border-t border-dashed border-zinc-200 dark:border-zinc-700">
                <div className="flex-none flex items-center justify-between px-3 py-1.5">
                    <span className="text-[9px] font-black uppercase tracking-widest text-zinc-400">
                        Transaksi Terbaru
                    </span>
                    <Link href="/finance/invoices" className="text-[9px] font-bold text-zinc-400 hover:text-black dark:hover:text-white transition-colors">
                        Lihat Semua
                    </Link>
                </div>
                <div className="flex-1 overflow-y-auto">
                    {recentInvoices.length === 0 ? (
                        <div className="flex items-center justify-center h-full px-3">
                            <p className="text-[10px] text-zinc-400">Belum ada transaksi invoice.</p>
                        </div>
                    ) : (
                        <div className="divide-y divide-zinc-100 dark:divide-zinc-800">
                            {recentInvoices.map(inv => (
                                <div key={inv.id} className="flex items-center justify-between px-3 py-2 hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors">
                                    <div className="flex items-center gap-2.5 min-w-0">
                                        <div className={`
                                            h-7 w-7 rounded-md border border-black flex items-center justify-center text-[9px] font-black flex-shrink-0
                                            ${inv.status === 'PAID' ? "bg-emerald-100 text-emerald-700" :
                                                inv.status === 'OVERDUE' ? "bg-red-100 text-red-700" :
                                                    "bg-zinc-100 text-zinc-600"
                                            }
                                        `}>
                                            {inv.status === 'PAID' ? 'PD' : inv.status === 'OVERDUE' ? 'OD' : 'OP'}
                                        </div>
                                        <div className="min-w-0">
                                            <p className="text-[11px] font-bold truncate">{inv.customer}</p>
                                            <p className="text-[9px] font-mono text-zinc-400 truncate">{inv.number} • {inv.date}</p>
                                        </div>
                                    </div>
                                    <div className="text-right flex-shrink-0 ml-2">
                                        <p className="text-[11px] font-black">{formatCompact(inv.total)}</p>
                                        <p className={`text-[9px] font-bold uppercase ${inv.status === 'PAID' ? "text-emerald-600" :
                                                inv.status === 'OVERDUE' ? "text-red-600" :
                                                    "text-amber-600"
                                            }`}>
                                            {inv.status}
                                        </p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}
