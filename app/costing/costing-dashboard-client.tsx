"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import {
    DollarSign,
    TrendingUp,
    AlertTriangle,
    FileText,
    Lock,
    CheckCircle2,
    Plus,
} from "lucide-react"
import { CostSheetForm } from "@/components/costing/cost-sheet-form"
import { costSheetStatusLabels, costSheetStatusColors, COST_CATEGORY_LABELS, COST_CATEGORY_COLORS } from "@/lib/costing-calculations"
import type { DashboardData } from "@/lib/actions/costing"
import type { CostSheetStatusType, CostCategoryType } from "@/lib/costing-calculations"

const formatIDR = (n: number) =>
    new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(n)

interface Props {
    data: DashboardData
    products: { id: string; name: string; code: string }[]
}

export function CostingDashboardClient({ data, products }: Props) {
    const router = useRouter()
    const [createOpen, setCreateOpen] = useState(false)

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <div>
                    <h1 className="text-2xl font-semibold  ">
                        Kalkulasi Biaya
                    </h1>
                    <p className="text-xs font-bold text-zinc-500 mt-1">
                        Dashboard biaya garmen — analisis margin & komposisi
                    </p>
                </div>
                <button
                    onClick={() => setCreateOpen(true)}
                    className="flex items-center gap-1.5 px-3 py-2 border border-border bg-slate-900 text-white font-semibold text-xs shadow-sm hover:shadow-sm transition-all"
                >
                    <Plus className="h-3.5 w-3.5" />
                    Buat Cost Sheet
                </button>
            </div>

            {/* 4 KPI Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-white border border-border p-4 shadow-sm">
                    <div className="flex items-center gap-2 mb-2">
                        <FileText className="h-4 w-4 text-zinc-400" />
                        <span className="text-xs font-semibold text-zinc-400">
                            Total Sheet
                        </span>
                    </div>
                    <div className="text-3xl font-semibold">{data.totalSheets}</div>
                    <div className="flex gap-2 mt-1.5">
                        <span className="text-xs font-bold text-zinc-400">{data.totalDraft} draft</span>
                        <span className="text-xs font-bold text-blue-500">{data.totalFinalized} final</span>
                        <span className="text-xs font-bold text-emerald-500">{data.totalApproved} disetujui</span>
                    </div>
                </div>

                <div className={`bg-white border p-4 shadow-sm ${data.avgMargin >= 20 ? "border-emerald-500" : "border-red-500"}`}>
                    <div className="flex items-center gap-2 mb-2">
                        <TrendingUp className="h-4 w-4 text-zinc-400" />
                        <span className="text-xs font-semibold text-zinc-400">
                            Rata-rata Margin
                        </span>
                    </div>
                    <div className={`text-3xl font-semibold ${data.avgMargin >= 20 ? "text-emerald-600" : "text-red-600"}`}>
                        {data.avgMargin}%
                    </div>
                    <div className="text-xs font-bold text-zinc-400 mt-1.5">
                        Dari {data.totalApproved} sheet disetujui
                    </div>
                </div>

                <div className="bg-white border border-blue-500 p-4 shadow-sm">
                    <div className="flex items-center gap-2 mb-2">
                        <DollarSign className="h-4 w-4 text-zinc-400" />
                        <span className="text-xs font-semibold text-zinc-400">
                            Total Biaya Produksi
                        </span>
                    </div>
                    <div className="text-xl font-semibold font-mono">
                        {formatIDR(data.totalProductionCost)}
                    </div>
                    <div className="text-xs font-bold text-zinc-400 mt-1.5">
                        Total dari sheet disetujui
                    </div>
                </div>

                <div className="bg-white border border-border p-4 shadow-sm">
                    <div className="flex items-center gap-2 mb-2">
                        <Lock className="h-4 w-4 text-zinc-400" />
                        <span className="text-xs font-semibold text-zinc-400">
                            Status Pipeline
                        </span>
                    </div>
                    <div className="flex items-end gap-1 mt-1">
                        {[
                            { n: data.totalDraft, label: "D", bg: "bg-zinc-200" },
                            { n: data.totalFinalized, label: "F", bg: "bg-blue-200" },
                            { n: data.totalApproved, label: "A", bg: "bg-emerald-200" },
                        ].map((s) => (
                            <div key={s.label} className="flex flex-col items-center gap-0.5">
                                <div
                                    className={`${s.bg} border border-border w-8`}
                                    style={{ height: `${Math.max(8, Math.min(40, s.n * 8))}px` }}
                                />
                                <span className="text-xs font-semibold">{s.label}</span>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* Margin Alert + Category Breakdown side by side */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Margin Alerts */}
                {data.lowMarginSheets.length > 0 && (
                    <div className="bg-red-50 border border-red-400 shadow-sm">
                        <div className="px-4 py-2.5 border-b border-red-400 bg-red-100 flex items-center gap-2">
                            <AlertTriangle className="h-4 w-4 text-red-600" />
                            <span className="text-xs font-semibold text-red-700">
                                Peringatan Margin Rendah
                            </span>
                        </div>
                        <div className="divide-y divide-red-200">
                            {data.lowMarginSheets.map((s) => (
                                <Link
                                    key={s.id}
                                    href={`/costing/sheets/${s.id}`}
                                    className="px-4 py-2.5 flex items-center justify-between hover:bg-red-100 transition-colors block"
                                >
                                    <div>
                                        <span className="text-xs font-bold">{s.productName}</span>
                                        <span className="text-xs text-red-500 font-mono ml-2">({s.number})</span>
                                    </div>
                                    <span className="text-xs font-semibold text-red-600">{s.margin}%</span>
                                </Link>
                            ))}
                        </div>
                    </div>
                )}

                {/* Category Breakdown */}
                {data.categoryBreakdown.length > 0 && (
                    <div className="bg-white border border-border shadow-sm">
                        <div className="px-4 py-2.5 border-b border-border bg-zinc-50">
                            <span className="text-xs font-semibold text-zinc-500">
                                Komposisi Biaya Rata-rata
                            </span>
                        </div>
                        <div className="p-4 space-y-3">
                            {data.categoryBreakdown.map((cat) => (
                                <div key={cat.category}>
                                    <div className="flex items-center justify-between mb-1">
                                        <div className="flex items-center gap-2">
                                            <div
                                                className="w-2.5 h-2.5 border border-border"
                                                style={{ backgroundColor: COST_CATEGORY_COLORS[cat.category as CostCategoryType] || '#6b7280' }}
                                            />
                                            <span className="text-xs font-semibold">
                                                {COST_CATEGORY_LABELS[cat.category as CostCategoryType] || cat.category}
                                            </span>
                                        </div>
                                        <span className="text-xs font-semibold px-1.5 py-0.5 bg-zinc-100 border border-zinc-300">
                                            {cat.pct}%
                                        </span>
                                    </div>
                                    <div className="h-2 bg-zinc-100 border border-zinc-200 overflow-hidden">
                                        <div
                                            className="h-full transition-all"
                                            style={{
                                                width: `${cat.pct}%`,
                                                backgroundColor: COST_CATEGORY_COLORS[cat.category as CostCategoryType] || '#6b7280',
                                            }}
                                        />
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* If no alerts, just show category full width */}
                {data.lowMarginSheets.length === 0 && data.categoryBreakdown.length === 0 && (
                    <div className="bg-white border border-border p-8 text-center shadow-sm md:col-span-2">
                        <DollarSign className="h-8 w-8 mx-auto text-zinc-200 mb-2" />
                        <span className="text-xs font-semibold text-zinc-400">
                            Belum ada cost sheet yang disetujui untuk analisis
                        </span>
                    </div>
                )}
            </div>

            {/* Recent Sheets */}
            <div className="bg-white border border-border shadow-sm">
                <div className="px-4 py-2.5 border-b border-border bg-zinc-50 flex items-center justify-between">
                    <span className="text-xs font-semibold text-zinc-500">
                        Cost Sheet Terbaru
                    </span>
                    <Link
                        href="/costing/sheets"
                        className="text-xs font-semibold text-blue-600 hover:underline"
                    >
                        Lihat Semua
                    </Link>
                </div>

                {data.recentSheets.length === 0 ? (
                    <div className="p-8 text-center">
                        <DollarSign className="h-8 w-8 mx-auto text-zinc-200 mb-2" />
                        <span className="text-xs font-semibold text-zinc-400">
                            Belum ada cost sheet
                        </span>
                    </div>
                ) : (
                    <div className="divide-y divide-zinc-200">
                        {data.recentSheets.map((sheet) => {
                            const margin = sheet.targetPrice && sheet.totalCost > 0
                                ? Math.round(((sheet.targetPrice - sheet.totalCost) / sheet.targetPrice) * 100)
                                : null
                            return (
                                <Link
                                    key={sheet.id}
                                    href={`/costing/sheets/${sheet.id}`}
                                    className="px-4 py-3 flex items-center gap-4 hover:bg-zinc-50 transition-colors block"
                                >
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2">
                                            <span className="text-xs font-semibold">{sheet.number}</span>
                                            <span className="text-xs font-bold text-zinc-400">v{sheet.version}</span>
                                            <span className={`text-xs font-semibold px-1.5 py-0.5 border ${costSheetStatusColors[sheet.status as CostSheetStatusType]}`}>
                                                {costSheetStatusLabels[sheet.status as CostSheetStatusType]}
                                            </span>
                                        </div>
                                        <div className="text-xs text-zinc-500 font-bold">
                                            [{sheet.productCode}] {sheet.productName}
                                        </div>
                                    </div>
                                    <div className="text-right shrink-0">
                                        <div className="text-xs font-mono font-bold">
                                            {formatIDR(sheet.totalCost)}
                                        </div>
                                        {margin !== null && (
                                            <div className={`text-xs font-semibold ${margin >= 20 ? "text-emerald-600" : "text-red-600"}`}>
                                                Margin {margin}%
                                            </div>
                                        )}
                                    </div>
                                </Link>
                            )
                        })}
                    </div>
                )}
            </div>

            {/* Create Dialog */}
            <CostSheetForm
                open={createOpen}
                onOpenChange={setCreateOpen}
                products={products}
            />
        </div>
    )
}
