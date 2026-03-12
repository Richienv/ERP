"use client"

import { useMemo } from "react"
import { cn, formatCurrency } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { CashflowItemRow } from "./cashflow-item-row"
import { getWeeks, getItemsForWeek, formatCompact, calcCashRunway } from "@/lib/cashflow-helpers"
import {
    IconWallet,
    IconGauge,
    IconBuildingBank,
    IconDeviceFloppy,
    IconCalendarWeek,
    IconPlus,
} from "@tabler/icons-react"
import type { CashflowPlanData, CashflowForecastData } from "@/lib/actions/finance-cashflow"

interface SimulasiBoardProps {
    data: CashflowPlanData
    forecast?: CashflowForecastData | null
    disabledSources: string[]
    itemStates: Record<string, { enabled: boolean; overrideAmount: number | null }>
    onToggleItem: (id: string, enabled: boolean) => void
    onAmountChange: (id: string, amount: number) => void
    onSave: () => void
    isSaving: boolean
    hasActiveScenario: boolean
    onAddItem?: () => void
}

export function CashflowSimulasiBoard({
    data, forecast, disabledSources, itemStates,
    onToggleItem, onAmountChange, onSave, isSaving, hasActiveScenario, onAddItem,
}: SimulasiBoardProps) {
    const allItems = useMemo(() => {
        const items = [...(data.autoItems || []), ...(data.manualItems || [])]
        // Filter by disabled sources
        return items.filter(item => !disabledSources.includes(item.category))
    }, [data.autoItems, data.manualItems, disabledSources])

    // Calculate effective amounts with scenario overrides
    const effectiveItems = useMemo(() => {
        return allItems.map(item => {
            const state = itemStates[item.id]
            const enabled = state?.enabled ?? true
            const overrideAmount = state?.overrideAmount ?? null
            const effectiveAmount = enabled ? (overrideAmount ?? item.amount) : 0
            return { ...item, enabled, overrideAmount, effectiveAmount }
        })
    }, [allItems, itemStates])

    // Live-recalculated totals
    const totals = useMemo(() => {
        const enabledItems = effectiveItems.filter(i => i.enabled)
        const totalIn = enabledItems.filter(i => i.direction === "IN").reduce((s, i) => s + i.effectiveAmount, 0)
        const totalOut = enabledItems.filter(i => i.direction === "OUT").reduce((s, i) => s + i.effectiveAmount, 0)
        return {
            totalIn,
            totalOut,
            net: totalIn - totalOut,
            endBalance: data.effectiveStartingBalance + totalIn - totalOut,
        }
    }, [effectiveItems, data.effectiveStartingBalance])

    const runway = calcCashRunway(data.effectiveStartingBalance, totals.totalOut)
    const weeks = getWeeks(data.month, data.year)

    return (
        <div className="flex-1 overflow-y-auto bg-white">
            {/* KPI Strip */}
            <div className="grid grid-cols-2 lg:grid-cols-4 border-b-2 border-black">
                {/* Posisi Kas */}
                <div className="p-4 border-r border-zinc-200">
                    <div className="flex items-center gap-1.5 text-xs text-zinc-500 mb-1">
                        <IconWallet size={14} /> Posisi Kas
                    </div>
                    <div className="text-lg font-black">{formatCompact(data.effectiveStartingBalance)}</div>
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
                {/* Proyeksi Akhir Bulan */}
                <div className="p-4 border-r border-zinc-200">
                    <div className="flex items-center gap-1.5 text-xs text-zinc-500 mb-1">
                        <IconBuildingBank size={14} /> Proyeksi Akhir
                    </div>
                    <div className={cn("text-lg font-black", totals.endBalance >= 0 ? "text-emerald-700" : "text-red-600")}>
                        {formatCompact(totals.endBalance)}
                    </div>
                    <div className="text-[10px] text-zinc-400">
                        Net {totals.net >= 0 ? "+" : ""}{formatCompact(totals.net)}
                    </div>
                </div>
                {/* Actions */}
                <div className="p-4 flex items-center gap-2">
                    <Button
                        size="sm"
                        onClick={onSave}
                        disabled={!hasActiveScenario || isSaving}
                        className="bg-emerald-500 hover:bg-emerald-600 text-white border-2 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]"
                    >
                        <IconDeviceFloppy size={14} className="mr-1" />
                        {isSaving ? "Menyimpan..." : "Simpan"}
                    </Button>
                    {onAddItem && (
                        <Button size="sm" variant="outline" onClick={onAddItem} className="border-2 border-black">
                            <IconPlus size={14} className="mr-1" /> Tambah
                        </Button>
                    )}
                </div>
            </div>

            {/* Week Cards */}
            <div className="p-4 space-y-4">
                {weeks.map((week) => {
                    const weekItems = getItemsForWeek(effectiveItems, week.start, week.end)
                    const inItems = weekItems.filter(i => i.direction === "IN" && i.enabled)
                    const outItems = weekItems.filter(i => i.direction === "OUT" && i.enabled)
                    const weekIn = inItems.reduce((s, i) => s + i.effectiveAmount, 0)
                    const weekOut = outItems.reduce((s, i) => s + i.effectiveAmount, 0)

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
                                    <span className={cn("font-bold", weekIn - weekOut >= 0 ? "text-emerald-700" : "text-red-600")}>
                                        Net {formatCompact(Math.abs(weekIn - weekOut))}{weekIn - weekOut < 0 ? " (-)": ""}
                                    </span>
                                </div>
                            </div>

                            {/* Items */}
                            <div className="divide-y divide-zinc-100">
                                {weekItems.length === 0 ? (
                                    <div className="px-3 py-4 text-xs text-zinc-400 text-center italic">
                                        Tidak ada item di minggu ini
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
                                            source={item.sourceId}
                                            simulasi
                                            enabled={item.enabled}
                                            overrideAmount={item.overrideAmount}
                                            onToggle={onToggleItem}
                                            onAmountChange={onAmountChange}
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
                        <div className="font-bold">{formatCurrency(data.effectiveStartingBalance)}</div>
                    </div>
                    <div>
                        <div className="text-zinc-500">Total Masuk</div>
                        <div className="font-bold text-emerald-600">+{formatCurrency(totals.totalIn)}</div>
                    </div>
                    <div>
                        <div className="text-zinc-500">Total Keluar</div>
                        <div className="font-bold text-red-600">-{formatCurrency(totals.totalOut)}</div>
                    </div>
                    <div>
                        <div className="text-zinc-500">Net</div>
                        <div className={cn("font-bold", totals.net >= 0 ? "text-emerald-600" : "text-red-600")}>
                            {totals.net >= 0 ? "+" : ""}{formatCurrency(totals.net)}
                        </div>
                    </div>
                    <div>
                        <div className="text-zinc-500">Saldo Akhir</div>
                        <div className={cn("font-bold", totals.endBalance >= 0 ? "text-emerald-700" : "text-red-600")}>
                            {formatCurrency(totals.endBalance)}
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
