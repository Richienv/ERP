"use client"

import { useParams } from "next/navigation"
import { useCutPlanDetail } from "@/hooks/use-cut-plan-detail"
import {
    cutPlanStatusLabels,
    cutPlanStatusColors,
    isCutPlanTerminal,
    getCutPlanNextStatuses,
} from "@/lib/cut-plan-state-machine"
import { ArrowLeft, Scissors, Ruler, Layers, Calendar } from "lucide-react"
import Link from "next/link"
import { OutputTable } from "@/components/cutting/output-table"
import { CutPlanStatusActions } from "@/components/cutting/cut-plan-status-actions"
import { CardPageSkeleton } from "@/components/ui/page-skeleton"

export default function CutPlanDetailPage() {
    const { id } = useParams<{ id: string }>()
    const { data: plan, isLoading } = useCutPlanDetail(id)

    if (isLoading || !plan) return <CardPageSkeleton accentColor="bg-amber-400" />

    const isEditable = !isCutPlanTerminal(plan.status)
    const nextStatuses = getCutPlanNextStatuses(plan.status)

    return (
        <div className="mf-page">
            <div className="flex items-center gap-3">
                <Link
                    href="/cutting/plans"
                    className="flex items-center gap-1 text-[9px] font-black uppercase tracking-wider text-zinc-500 hover:text-black transition-colors"
                >
                    <ArrowLeft className="h-3.5 w-3.5" />
                    Kembali
                </Link>
                <div className="w-px h-4 bg-zinc-300" />
                <div className="flex items-center gap-2">
                    <Scissors className="h-5 w-5" />
                    <h1 className="text-sm font-black uppercase tracking-widest">Detail Cut Plan</h1>
                </div>
            </div>

            <div className="space-y-6">
                {/* Header */}
                <div className="bg-white border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
                    <div className="px-4 py-3 border-b-2 border-black bg-zinc-50 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <Scissors className="h-4 w-4" />
                            <span className="text-sm font-black">{plan.number}</span>
                            <span
                                className={`text-[8px] font-black px-1.5 py-0.5 border ${
                                    cutPlanStatusColors[plan.status]
                                }`}
                            >
                                {cutPlanStatusLabels[plan.status]}
                            </span>
                        </div>
                        {nextStatuses.length > 0 && (
                            <CutPlanStatusActions
                                planId={plan.id}
                                currentStatus={plan.status}
                                nextStatuses={nextStatuses}
                            />
                        )}
                    </div>
                    <div className="px-4 py-3 grid grid-cols-2 md:grid-cols-4 gap-4">
                        <div>
                            <div className="text-[9px] font-bold text-zinc-400 uppercase">Produk Kain</div>
                            <div className="text-xs font-black">{plan.fabricProductName}</div>
                            <div className="text-[9px] font-mono text-zinc-500">{plan.fabricProductCode}</div>
                        </div>
                        <div>
                            <div className="text-[9px] font-bold text-zinc-400 uppercase flex items-center gap-1">
                                <Ruler className="h-3 w-3" /> Panjang Marker
                            </div>
                            <div className="text-xs font-mono font-bold">
                                {plan.markerLength ? `${plan.markerLength} m` : "\u2014"}
                            </div>
                        </div>
                        <div>
                            <div className="text-[9px] font-bold text-zinc-400 uppercase flex items-center gap-1">
                                <Layers className="h-3 w-3" /> Layer / Kain
                            </div>
                            <div className="text-xs font-mono font-bold">
                                {plan.totalLayers ?? "\u2014"} layer
                                {plan.totalFabricMeters ? ` / ${plan.totalFabricMeters} m` : ""}
                            </div>
                        </div>
                        <div>
                            <div className="text-[9px] font-bold text-zinc-400 uppercase flex items-center gap-1">
                                <Calendar className="h-3 w-3" /> Efisiensi / Tanggal
                            </div>
                            <div className="text-xs font-bold">
                                {plan.markerEfficiency ? (
                                    <span className="text-emerald-600 font-mono">{plan.markerEfficiency}%</span>
                                ) : "\u2014"}
                                {plan.plannedDate && (
                                    <span className="text-zinc-500 ml-2">
                                        {new Date(plan.plannedDate).toLocaleDateString("id-ID")}
                                    </span>
                                )}
                            </div>
                        </div>
                    </div>
                </div>

                {/* Layers */}
                {plan.layers.length > 0 && (
                    <div className="bg-white border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
                        <div className="px-4 py-2.5 border-b-2 border-black bg-zinc-50 flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <Layers className="h-4 w-4 text-zinc-500" />
                                <span className="text-[10px] font-black uppercase tracking-widest text-zinc-500">
                                    Layer Kain
                                </span>
                            </div>
                            <span className="text-[9px] font-bold text-zinc-400">
                                {plan.layers.length} layer •{" "}
                                {plan.layers.reduce((s, l) => s + l.metersUsed, 0).toFixed(2)} m
                            </span>
                        </div>
                        <table className="w-full">
                            <thead className="bg-zinc-50 border-b border-zinc-200">
                                <tr>
                                    <th className="text-[10px] font-black uppercase tracking-widest text-zinc-500 px-3 py-2 text-left w-16">#</th>
                                    <th className="text-[10px] font-black uppercase tracking-widest text-zinc-500 px-3 py-2 text-left">Roll</th>
                                    <th className="text-[10px] font-black uppercase tracking-widest text-zinc-500 px-3 py-2 text-right">Meter</th>
                                </tr>
                            </thead>
                            <tbody>
                                {plan.layers.map((layer) => (
                                    <tr key={layer.id} className="border-b border-zinc-200 last:border-b-0">
                                        <td className="px-3 py-2 text-xs font-mono font-bold">{layer.layerNumber}</td>
                                        <td className="px-3 py-2 text-xs font-bold">{layer.rollNumber}</td>
                                        <td className="px-3 py-2 text-xs font-mono text-right">{layer.metersUsed.toFixed(2)}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}

                {/* Outputs */}
                <OutputTable
                    cutPlanId={plan.id}
                    outputs={plan.outputs}
                    editable={isEditable}
                />
            </div>
        </div>
    )
}
