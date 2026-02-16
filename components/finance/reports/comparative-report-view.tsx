"use client"

import { useMemo } from "react"
import { ArrowUpRight, ArrowDownRight, Minus, TrendingUp } from "lucide-react"

// ==============================================================================
// Types
// ==============================================================================

interface PeriodData {
    label: string
    revenue: number
    costOfGoodsSold: number
    grossProfit: number
    operatingExpenses: number
    operatingIncome: number
    netIncome: number
}

interface ComparativeReportViewProps {
    currentPeriod: PeriodData
    priorPeriod: PeriodData
}

// ==============================================================================
// Pure Functions
// ==============================================================================

export function calculateVariance(current: number, prior: number): {
    amount: number
    percentage: number
    direction: 'up' | 'down' | 'flat'
} {
    const amount = current - prior
    const percentage = prior !== 0 ? Math.round((amount / Math.abs(prior)) * 10000) / 100 : 0
    const direction = amount > 0 ? 'up' : amount < 0 ? 'down' : 'flat'
    return { amount, percentage, direction }
}

// ==============================================================================
// Component
// ==============================================================================

export function ComparativeReportView({
    currentPeriod,
    priorPeriod,
}: ComparativeReportViewProps) {
    const formatIDR = (n: number) => Math.abs(n).toLocaleString('id-ID')

    const rows = useMemo(() => [
        { label: 'Pendapatan', key: 'revenue' as const, isHeader: false, indent: false },
        { label: 'Harga Pokok Penjualan', key: 'costOfGoodsSold' as const, isHeader: false, indent: false },
        { label: 'Laba Kotor', key: 'grossProfit' as const, isHeader: true, indent: false },
        { label: 'Beban Operasional', key: 'operatingExpenses' as const, isHeader: false, indent: true },
        { label: 'Laba Operasional', key: 'operatingIncome' as const, isHeader: true, indent: false },
        { label: 'Laba Bersih', key: 'netIncome' as const, isHeader: true, indent: false },
    ], [])

    return (
        <div className="bg-white border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-2.5 border-b-2 border-black bg-zinc-50">
                <div className="flex items-center gap-2">
                    <TrendingUp className="h-4 w-4 text-zinc-500" />
                    <span className="text-[10px] font-black uppercase tracking-widest text-zinc-500">
                        Laporan Komparatif Laba Rugi
                    </span>
                </div>
            </div>

            {/* Table */}
            <table className="w-full text-xs">
                <thead>
                    <tr className="bg-zinc-100 border-b-2 border-black">
                        <th className="text-[9px] font-black uppercase tracking-widest text-zinc-500 px-4 py-2.5 text-left w-[40%]">
                            Keterangan
                        </th>
                        <th className="text-[9px] font-black uppercase tracking-widest text-zinc-500 px-3 py-2.5 text-right w-[20%]">
                            {currentPeriod.label}
                        </th>
                        <th className="text-[9px] font-black uppercase tracking-widest text-zinc-500 px-3 py-2.5 text-right w-[20%]">
                            {priorPeriod.label}
                        </th>
                        <th className="text-[9px] font-black uppercase tracking-widest text-zinc-500 px-3 py-2.5 text-right w-[10%]">
                            Selisih
                        </th>
                        <th className="text-[9px] font-black uppercase tracking-widest text-zinc-500 px-3 py-2.5 text-right w-[10%]">
                            %
                        </th>
                    </tr>
                </thead>
                <tbody>
                    {rows.map((row) => {
                        const current = currentPeriod[row.key]
                        const prior = priorPeriod[row.key]
                        const variance = calculateVariance(current, prior)

                        return (
                            <tr
                                key={row.key}
                                className={`border-b ${
                                    row.isHeader
                                        ? 'border-black bg-zinc-50'
                                        : 'border-zinc-100'
                                }`}
                            >
                                <td className={`px-4 py-2 ${
                                    row.isHeader ? 'font-black' : 'font-medium'
                                } ${row.indent ? 'pl-8' : ''}`}>
                                    {row.label}
                                </td>
                                <td className={`px-3 py-2 text-right font-mono ${
                                    row.isHeader ? 'font-black' : 'font-bold'
                                }`}>
                                    Rp {formatIDR(current)}
                                </td>
                                <td className="px-3 py-2 text-right font-mono font-bold text-zinc-500">
                                    Rp {formatIDR(prior)}
                                </td>
                                <td className={`px-3 py-2 text-right font-mono font-bold ${
                                    variance.direction === 'up'
                                        ? 'text-emerald-600'
                                        : variance.direction === 'down'
                                        ? 'text-red-600'
                                        : 'text-zinc-400'
                                }`}>
                                    <span className="flex items-center justify-end gap-0.5">
                                        {variance.direction === 'up' ? (
                                            <ArrowUpRight className="h-3 w-3" />
                                        ) : variance.direction === 'down' ? (
                                            <ArrowDownRight className="h-3 w-3" />
                                        ) : (
                                            <Minus className="h-3 w-3" />
                                        )}
                                        {formatIDR(variance.amount)}
                                    </span>
                                </td>
                                <td className={`px-3 py-2 text-right font-mono font-bold ${
                                    variance.direction === 'up'
                                        ? 'text-emerald-600'
                                        : variance.direction === 'down'
                                        ? 'text-red-600'
                                        : 'text-zinc-400'
                                }`}>
                                    {variance.percentage > 0 ? '+' : ''}{variance.percentage}%
                                </td>
                            </tr>
                        )
                    })}
                </tbody>
            </table>

            {/* Summary bar */}
            <div className="px-4 py-2.5 border-t-2 border-black bg-zinc-50 flex items-center justify-between">
                <span className="text-[9px] font-black uppercase tracking-widest text-zinc-500">
                    Margin Laba Bersih
                </span>
                <div className="flex items-center gap-4 text-[10px] font-black font-mono">
                    <span>
                        {currentPeriod.revenue > 0
                            ? ((currentPeriod.netIncome / currentPeriod.revenue) * 100).toFixed(1)
                            : '0'}%
                        <span className="text-zinc-400 font-normal ml-1">(Saat ini)</span>
                    </span>
                    <span className="text-zinc-400">
                        {priorPeriod.revenue > 0
                            ? ((priorPeriod.netIncome / priorPeriod.revenue) * 100).toFixed(1)
                            : '0'}%
                        <span className="font-normal ml-1">(Sebelumnya)</span>
                    </span>
                </div>
            </div>
        </div>
    )
}
