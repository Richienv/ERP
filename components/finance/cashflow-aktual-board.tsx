"use client"

import { useMemo } from "react"
import { cn, formatCurrency } from "@/lib/utils"
import { Badge } from "@/components/ui/badge"
import { CashflowItemRow } from "./cashflow-item-row"
import { getWeeks, getItemsForWeek, formatCompact, calcCashRunway } from "@/lib/cashflow-helpers"
import {
    IconWallet,
    IconGauge,
    IconBuildingBank,
    IconCalendarWeek,
} from "@tabler/icons-react"
import type { CashflowActualData, CashflowForecastData } from "@/lib/actions/finance-cashflow"

interface AktualBoardProps {
    data: CashflowActualData
    month: number
    year: number
    forecast?: CashflowForecastData | null
}

export function CashflowAktualBoard({ data, month, year, forecast }: AktualBoardProps) {
    const runway = calcCashRunway(data.startingBalance, data.summary.totalOut)
    const weeks = getWeeks(month, year)

    const items = useMemo(() =>
        data.actualItems.map(item => ({
            ...item,
            // Normalize to match getItemsForWeek expectations
        })),
        [data.actualItems]
    )

    return (
        <div className="border-2 border-black rounded-xl overflow-hidden bg-white shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
            {/* KPI Strip */}
            <div className="grid grid-cols-2 lg:grid-cols-4 border-b-2 border-black">
                {/* Posisi Kas */}
                <div className="p-4 border-r border-zinc-200">
                    <div className="flex items-center gap-1.5 text-xs text-zinc-500 mb-1">
                        <IconWallet size={14} /> Posisi Kas
                    </div>
                    <div className="text-lg font-black">{formatCompact(data.startingBalance)}</div>
                    <div className="text-[10px] text-zinc-400">Saldo awal bulan</div>
                </div>
                {/* Cash Runway */}
                <div className="p-4 border-r border-zinc-200">
                    <div className="flex items-center gap-1.5 text-xs text-zinc-500 mb-1">
                        <IconGauge size={14} /> Cash Runway
                    </div>
                    <div className={cn("text-lg font-black", runway.color)}>{runway.label}</div>
                    <div className="mt-1 h-1.5 bg-zinc-100 rounded-full overflow-hidden">
                        <div className={cn("h-full rounded-full", runway.barColor)} style={{ width: `${runway.barPct}%` }} />
                    </div>
                </div>
                {/* Saldo Akhir */}
                <div className="p-4 border-r border-zinc-200">
                    <div className="flex items-center gap-1.5 text-xs text-zinc-500 mb-1">
                        <IconBuildingBank size={14} /> Saldo Akhir
                    </div>
                    <div className={cn("text-lg font-black", data.summary.endBalance >= 0 ? "text-emerald-700" : "text-red-600")}>
                        {formatCompact(data.summary.endBalance)}
                    </div>
                    <div className="text-[10px] text-zinc-400">
                        Net {data.summary.net >= 0 ? "+" : ""}{formatCompact(data.summary.net)}
                    </div>
                </div>
                {/* Bulan Lalu Ref */}
                <div className="p-4">
                    <div className="flex items-center gap-1.5 text-xs text-zinc-500 mb-1">
                        Vs Bulan Lalu
                    </div>
                    {data.lastMonthRef ? (
                        <>
                            <div className="text-sm font-bold">
                                {data.lastMonthRef.count} transaksi
                            </div>
                            <div className="text-[10px] text-zinc-400">
                                Net {formatCompact(data.lastMonthRef.net)}
                            </div>
                        </>
                    ) : (
                        <div className="text-xs text-zinc-400 italic">Tidak ada data</div>
                    )}
                </div>
            </div>

            {/* Week Cards */}
            <div className="p-4 space-y-4">
                {weeks.map((week) => {
                    const weekItems = getItemsForWeek(items, week.start, week.end)
                    const weekIn = weekItems.filter(i => i.direction === "IN").reduce((s, i) => s + i.amount, 0)
                    const weekOut = weekItems.filter(i => i.direction === "OUT").reduce((s, i) => s + i.amount, 0)

                    return (
                        <div key={week.shortLabel} className={cn(
                            "border-2 border-black rounded-lg overflow-hidden",
                            week.isCurrent && "ring-2 ring-emerald-400 ring-offset-1"
                        )}>
                            {/* Week Header */}
                            <div className="flex items-center justify-between px-3 py-2 bg-zinc-50 border-b border-zinc-200">
                                <div className="flex items-center gap-2">
                                    <IconCalendarWeek size={14} />
                                    <span className="text-xs font-bold">{week.label}</span>
                                    {week.isCurrent && (
                                        <Badge className="bg-emerald-400 text-black text-[10px] h-4">Minggu ini</Badge>
                                    )}
                                </div>
                                <div className="flex items-center gap-3 text-xs">
                                    <span className="text-emerald-600 font-medium">+{formatCompact(weekIn)}</span>
                                    <span className="text-red-600 font-medium">-{formatCompact(weekOut)}</span>
                                </div>
                            </div>

                            {/* Items */}
                            <div className="divide-y divide-zinc-100">
                                {weekItems.length === 0 ? (
                                    <div className="px-3 py-4 text-xs text-zinc-400 text-center italic">
                                        Tidak ada transaksi di minggu ini
                                    </div>
                                ) : (
                                    weekItems.map((item) => (
                                        <CashflowItemRow
                                            key={item.id}
                                            id={item.id}
                                            description={item.description}
                                            amount={item.amount}
                                            direction={item.direction}
                                            category={item.category}
                                            status={item.status}
                                            source={item.source}
                                            totalAmount={item.totalAmount}
                                            paidPercentage={item.paidPercentage}
                                        />
                                    ))
                                )}
                            </div>
                        </div>
                    )
                })}
            </div>

            {/* Summary Bar */}
            <div className="border-t-2 border-black bg-zinc-50 px-4 py-3">
                <div className="grid grid-cols-5 gap-4 text-center text-xs">
                    <div>
                        <div className="text-zinc-500">Saldo Awal</div>
                        <div className="font-bold">{formatCurrency(data.startingBalance)}</div>
                    </div>
                    <div>
                        <div className="text-zinc-500">Total Masuk</div>
                        <div className="font-bold text-emerald-600">+{formatCurrency(data.summary.totalIn)}</div>
                    </div>
                    <div>
                        <div className="text-zinc-500">Total Keluar</div>
                        <div className="font-bold text-red-600">-{formatCurrency(data.summary.totalOut)}</div>
                    </div>
                    <div>
                        <div className="text-zinc-500">Net</div>
                        <div className={cn("font-bold", data.summary.net >= 0 ? "text-emerald-600" : "text-red-600")}>
                            {data.summary.net >= 0 ? "+" : ""}{formatCurrency(data.summary.net)}
                        </div>
                    </div>
                    <div>
                        <div className="text-zinc-500">Saldo Akhir</div>
                        <div className={cn("font-bold", data.summary.endBalance >= 0 ? "text-emerald-700" : "text-red-600")}>
                            {formatCurrency(data.summary.endBalance)}
                        </div>
                    </div>
                </div>
            </div>

            {/* Proyeksi 6 Bulan Strip */}
            {forecast && forecast.months.length > 0 && (
                <div className="border-t-2 border-black bg-white px-4 py-3">
                    <div className="text-xs font-bold text-zinc-500 mb-2">PROYEKSI 6 BULAN</div>
                    <div className="grid grid-cols-6 gap-2">
                        {forecast.months.slice(0, 6).map((m) => (
                            <div key={`${m.month}-${m.year}`} className="text-center text-[10px]">
                                <div className="text-zinc-400">{m.label}</div>
                                <div className={cn("font-bold", m.runningBalance >= 0 ? "text-emerald-600" : "text-red-600")}>
                                    {formatCompact(m.runningBalance)}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    )
}
