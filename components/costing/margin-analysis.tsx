"use client"

import { TrendingUp, ArrowUp, ArrowDown, Minus } from "lucide-react"
import {
    calculateMargin,
    calculateSellingPrice,
    calculateVariance,
    calculateActualTotal,
    type CostItem,
} from "@/lib/costing-calculations"

interface MarginAnalysisProps {
    totalCost: number
    targetPrice: number | null
    targetMargin: number | null
    items: CostItem[]
}

export function MarginAnalysis({
    totalCost,
    targetPrice,
    targetMargin,
    items,
}: MarginAnalysisProps) {
    const actualTotal = calculateActualTotal(items)
    const hasActuals = actualTotal > 0

    const currentMargin = targetPrice ? calculateMargin(totalCost, targetPrice) : null
    const suggestedPrice = targetMargin ? calculateSellingPrice(totalCost, targetMargin) : null

    const costVariance = hasActuals ? calculateVariance(totalCost, actualTotal) : null

    return (
        <div className="bg-white border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
            <div className="px-4 py-2.5 border-b-2 border-black bg-zinc-50 flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-zinc-500" />
                <span className="text-[10px] font-black uppercase tracking-widest text-zinc-500">
                    Analisis Margin
                </span>
            </div>

            <div className="p-4 grid grid-cols-2 md:grid-cols-4 gap-4">
                {/* Total Cost */}
                <div>
                    <div className="text-[9px] font-bold text-zinc-400 uppercase">Total Biaya</div>
                    <div className="text-lg font-black font-mono">
                        {totalCost.toLocaleString('id-ID')}
                    </div>
                </div>

                {/* Target Price */}
                <div>
                    <div className="text-[9px] font-bold text-zinc-400 uppercase">Target Harga</div>
                    <div className="text-lg font-black font-mono">
                        {targetPrice ? targetPrice.toLocaleString('id-ID') : '—'}
                    </div>
                </div>

                {/* Current Margin */}
                <div>
                    <div className="text-[9px] font-bold text-zinc-400 uppercase">Margin Saat Ini</div>
                    <div className={`text-lg font-black ${
                        currentMargin !== null
                            ? currentMargin >= (targetMargin ?? 0)
                                ? 'text-emerald-600'
                                : 'text-red-600'
                            : ''
                    }`}>
                        {currentMargin !== null ? `${currentMargin}%` : '—'}
                    </div>
                    {targetMargin !== null && (
                        <div className="text-[9px] font-bold text-zinc-400">
                            Target: {targetMargin}%
                        </div>
                    )}
                </div>

                {/* Suggested Price */}
                <div>
                    <div className="text-[9px] font-bold text-zinc-400 uppercase">Harga Saran</div>
                    <div className="text-lg font-black font-mono">
                        {suggestedPrice ? suggestedPrice.toLocaleString('id-ID') : '—'}
                    </div>
                    {targetMargin !== null && (
                        <div className="text-[9px] font-bold text-zinc-400">
                            Untuk margin {targetMargin}%
                        </div>
                    )}
                </div>
            </div>

            {/* Cost Variance (if actuals exist) */}
            {costVariance && (
                <div className="px-4 py-3 border-t border-zinc-200">
                    <div className="flex items-center gap-3">
                        <span className="text-[9px] font-black uppercase tracking-widest text-zinc-400">
                            Varians Biaya:
                        </span>
                        <div className={`flex items-center gap-1 text-xs font-black ${
                            costVariance.direction === 'OVER'
                                ? 'text-red-600'
                                : costVariance.direction === 'UNDER'
                                ? 'text-emerald-600'
                                : 'text-zinc-500'
                        }`}>
                            {costVariance.direction === 'OVER' && <ArrowUp className="h-3.5 w-3.5" />}
                            {costVariance.direction === 'UNDER' && <ArrowDown className="h-3.5 w-3.5" />}
                            {costVariance.direction === 'ON_TARGET' && <Minus className="h-3.5 w-3.5" />}
                            <span className="font-mono">
                                {costVariance.amount.toLocaleString('id-ID')}
                            </span>
                            <span>({costVariance.percentage}%)</span>
                        </div>
                        <span className="text-[9px] font-bold text-zinc-400">
                            Aktual: {actualTotal.toLocaleString('id-ID')}
                        </span>
                    </div>
                </div>
            )}
        </div>
    )
}
