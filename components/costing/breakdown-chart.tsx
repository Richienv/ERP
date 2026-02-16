"use client"

import { PieChart, DollarSign } from "lucide-react"
import {
    COST_CATEGORY_LABELS,
    COST_CATEGORY_COLORS,
    type CostCategoryType,
} from "@/lib/costing-calculations"

interface BreakdownItem {
    category: string
    totalCost: number
    actualTotalCost: number | null
}

interface BreakdownChartProps {
    items: BreakdownItem[]
    totalCost: number
}

export function BreakdownChart({ items, totalCost }: BreakdownChartProps) {
    // Aggregate by category
    const categoryMap = new Map<string, { planned: number; actual: number }>()
    for (const item of items) {
        const existing = categoryMap.get(item.category) || { planned: 0, actual: 0 }
        existing.planned += item.totalCost
        existing.actual += item.actualTotalCost ?? 0
        categoryMap.set(item.category, existing)
    }

    const categories = Array.from(categoryMap.entries())
        .map(([cat, vals]) => ({
            category: cat as CostCategoryType,
            planned: Math.round(vals.planned * 100) / 100,
            actual: Math.round(vals.actual * 100) / 100,
            pct: totalCost > 0 ? Math.round((vals.planned / totalCost) * 100) : 0,
        }))
        .sort((a, b) => b.planned - a.planned)

    return (
        <div className="bg-white border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
            <div className="px-4 py-2.5 border-b-2 border-black bg-zinc-50 flex items-center gap-2">
                <PieChart className="h-4 w-4 text-zinc-500" />
                <span className="text-[10px] font-black uppercase tracking-widest text-zinc-500">
                    Komposisi Biaya
                </span>
            </div>

            <div className="p-4 space-y-3">
                {categories.length === 0 ? (
                    <div className="text-center py-4">
                        <DollarSign className="h-6 w-6 mx-auto text-zinc-200 mb-1" />
                        <span className="text-[9px] font-bold text-zinc-400">Belum ada item biaya</span>
                    </div>
                ) : (
                    categories.map((cat) => (
                        <div key={cat.category}>
                            <div className="flex items-center justify-between mb-1">
                                <div className="flex items-center gap-2">
                                    <div
                                        className="w-2.5 h-2.5 border border-black"
                                        style={{
                                            backgroundColor: COST_CATEGORY_COLORS[cat.category] || '#6b7280',
                                        }}
                                    />
                                    <span className="text-[10px] font-black">
                                        {COST_CATEGORY_LABELS[cat.category] || cat.category}
                                    </span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <span className="text-[10px] font-mono font-bold">
                                        {cat.planned.toLocaleString('id-ID')}
                                    </span>
                                    <span className="text-[9px] font-black px-1.5 py-0.5 bg-zinc-100 border border-zinc-300">
                                        {cat.pct}%
                                    </span>
                                </div>
                            </div>
                            <div className="h-2 bg-zinc-100 border border-zinc-200 overflow-hidden">
                                <div
                                    className="h-full transition-all"
                                    style={{
                                        width: `${cat.pct}%`,
                                        backgroundColor: COST_CATEGORY_COLORS[cat.category] || '#6b7280',
                                    }}
                                />
                            </div>
                        </div>
                    ))
                )}
            </div>
        </div>
    )
}
