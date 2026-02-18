"use client"

import { useCuttingDashboard } from "@/hooks/use-cutting-dashboard"
import { cutPlanStatusLabels, cutPlanStatusColors } from "@/lib/cut-plan-state-machine"
import { Scissors, FileText, Layers, Clock, CheckCircle2 } from "lucide-react"
import Link from "next/link"
import { CuttingHeader } from "@/components/cutting/cutting-header"
import { CardPageSkeleton } from "@/components/ui/page-skeleton"

export default function CuttingPage() {
    const { data: result, isLoading } = useCuttingDashboard()

    if (isLoading || !result) {
        return <CardPageSkeleton accentColor="bg-amber-400" />
    }

    const { data, fabricProducts } = result

    return (
        <div className="p-6 space-y-6">
            <div className="space-y-6">
                <CuttingHeader title="Pemotongan Kain" fabricProducts={fabricProducts} />

                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="bg-white border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] p-4">
                        <div className="flex items-center gap-2 mb-2">
                            <FileText className="h-4 w-4 text-zinc-400" />
                            <span className="text-[9px] font-black uppercase tracking-widest text-zinc-400">Draft</span>
                        </div>
                        <div className="text-2xl font-black">{data.totalDraft}</div>
                    </div>
                    <div className="bg-white border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] p-4">
                        <div className="flex items-center gap-2 mb-2">
                            <Layers className="h-4 w-4 text-blue-500" />
                            <span className="text-[9px] font-black uppercase tracking-widest text-zinc-400">Dialokasikan</span>
                        </div>
                        <div className="text-2xl font-black">{data.totalAllocated}</div>
                    </div>
                    <div className="bg-white border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] p-4">
                        <div className="flex items-center gap-2 mb-2">
                            <Clock className="h-4 w-4 text-amber-500" />
                            <span className="text-[9px] font-black uppercase tracking-widest text-zinc-400">Sedang Potong</span>
                        </div>
                        <div className="text-2xl font-black">{data.totalInCutting}</div>
                    </div>
                    <div className="bg-white border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] p-4">
                        <div className="flex items-center gap-2 mb-2">
                            <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                            <span className="text-[9px] font-black uppercase tracking-widest text-zinc-400">Selesai</span>
                        </div>
                        <div className="text-2xl font-black">{data.totalCompleted}</div>
                    </div>
                </div>

                <div className="bg-white border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
                    <div className="px-4 py-2.5 border-b-2 border-black bg-zinc-50 flex items-center justify-between">
                        <span className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Cut Plan Terbaru</span>
                        <Link href="/cutting/plans" className="text-[9px] font-black uppercase tracking-wider text-blue-600 hover:underline">
                            Lihat Semua →
                        </Link>
                    </div>
                    {data.recentPlans.length === 0 ? (
                        <div className="p-8 text-center">
                            <Scissors className="h-8 w-8 mx-auto text-zinc-200 mb-2" />
                            <span className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Belum ada cut plan</span>
                        </div>
                    ) : (
                        <div className="divide-y divide-zinc-200">
                            {data.recentPlans.map((plan: any) => (
                                <Link key={plan.id} href={`/cutting/plans/${plan.id}`} className="px-4 py-3 flex items-center gap-4 hover:bg-zinc-50 block">
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2">
                                            <span className="text-xs font-black">{plan.number}</span>
                                            <span className={`text-[8px] font-black px-1.5 py-0.5 border ${cutPlanStatusColors[plan.status as keyof typeof cutPlanStatusColors]}`}>
                                                {cutPlanStatusLabels[plan.status as keyof typeof cutPlanStatusLabels]}
                                            </span>
                                        </div>
                                        <div className="text-[10px] text-zinc-500 font-bold">
                                            [{plan.fabricProductCode}] {plan.fabricProductName}
                                        </div>
                                    </div>
                                    <div className="text-right shrink-0 space-y-0.5">
                                        {plan.totalLayers && <div className="text-[9px] text-zinc-400 font-bold">{plan.totalLayers} layer</div>}
                                        {plan.markerEfficiency && <div className="text-[9px] font-bold text-emerald-600">Eff: {plan.markerEfficiency}%</div>}
                                    </div>
                                </Link>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}
