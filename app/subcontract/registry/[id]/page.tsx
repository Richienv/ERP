"use client"

import { useParams } from "next/navigation"
import { useSubcontractorDetail } from "@/hooks/use-subcontractor-detail"
import {
    subcontractStatusLabels,
    subcontractStatusColors,
} from "@/lib/subcontract-state-machine"
import { ArrowLeft, Factory, TrendingUp, Clock, AlertTriangle, CheckCircle } from "lucide-react"
import Link from "next/link"
import { SubcontractorRatesTable } from "@/components/subcontract/subcontractor-rates-table"
import { CardPageSkeleton } from "@/components/ui/page-skeleton"

const CAPABILITY_LABELS: Record<string, string> = {
    CUT: "Potong", SEW: "Jahit", WASH: "Cuci",
    PRINT: "Cetak", EMBROIDERY: "Bordir", FINISHING: "Finishing",
}
const CAPABILITY_COLORS: Record<string, string> = {
    CUT: "bg-amber-100 text-amber-700 border-amber-300",
    SEW: "bg-blue-100 text-blue-700 border-blue-300",
    WASH: "bg-cyan-100 text-cyan-700 border-cyan-300",
    PRINT: "bg-purple-100 text-purple-700 border-purple-300",
    EMBROIDERY: "bg-pink-100 text-pink-700 border-pink-300",
    FINISHING: "bg-emerald-100 text-emerald-700 border-emerald-300",
}

export default function SubcontractorDetailPage() {
    const { id } = useParams<{ id: string }>()
    const { data, isLoading } = useSubcontractorDetail(id)

    if (isLoading || !data) return <CardPageSkeleton accentColor="bg-orange-400" />

    return (
        <div className="mf-page">
            <div className="flex items-center gap-3">
                <Link
                    href="/subcontract/registry"
                    className="flex items-center gap-1 text-[9px] font-black uppercase tracking-wider text-zinc-500 hover:text-black transition-colors"
                >
                    <ArrowLeft className="h-3.5 w-3.5" />
                    Kembali
                </Link>
                <div className="w-px h-4 bg-zinc-300" />
                <div className="flex items-center gap-2">
                    <Factory className="h-5 w-5" />
                    <h1 className="text-sm font-black uppercase tracking-widest">Detail Mitra CMT</h1>
                </div>
            </div>

            <div className="space-y-6">
                {/* Header card */}
                <div className="bg-white border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
                    <div className="px-4 py-3 border-b-2 border-black bg-zinc-50 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <Factory className="h-4 w-4" />
                            <span className="text-sm font-black">{data.name}</span>
                        </div>
                        <span className={`text-[9px] font-black px-2 py-0.5 border ${
                            data.isActive
                                ? "bg-emerald-100 text-emerald-700 border-emerald-300"
                                : "bg-red-100 text-red-700 border-red-300"
                        }`}>
                            {data.isActive ? "AKTIF" : "NONAKTIF"}
                        </span>
                    </div>
                    <div className="px-4 py-3 grid grid-cols-2 md:grid-cols-4 gap-4">
                        <div>
                            <div className="text-[9px] font-bold text-zinc-400 uppercase">NPWP</div>
                            <div className="text-xs font-mono font-bold">{data.npwp || "\u2014"}</div>
                        </div>
                        <div>
                            <div className="text-[9px] font-bold text-zinc-400 uppercase">Kontak</div>
                            <div className="text-xs font-bold">{data.contactPerson || "\u2014"}</div>
                            <div className="text-[9px] text-zinc-500">{data.phone}</div>
                        </div>
                        <div>
                            <div className="text-[9px] font-bold text-zinc-400 uppercase">Kapasitas</div>
                            <div className="text-xs font-bold">{data.capacityUnitsPerDay ? `${data.capacityUnitsPerDay} unit/hari` : "\u2014"}</div>
                        </div>
                        <div>
                            <div className="text-[9px] font-bold text-zinc-400 uppercase">Kapabilitas</div>
                            <div className="flex flex-wrap gap-1 mt-0.5">
                                {data.capabilities.map((cap) => (
                                    <span key={cap} className={`text-[7px] font-black px-1 py-0.5 border ${CAPABILITY_COLORS[cap] || "bg-zinc-100 text-zinc-600 border-zinc-300"}`}>
                                        {CAPABILITY_LABELS[cap] || cap}
                                    </span>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>

                {/* Performance Scorecard */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="bg-white border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] p-4">
                        <div className="flex items-center gap-2 mb-2">
                            <CheckCircle className="h-4 w-4 text-emerald-500" />
                            <span className="text-[9px] font-black uppercase tracking-widest text-zinc-400">Total Order</span>
                        </div>
                        <div className="text-2xl font-black">{data.performance.totalOrders}</div>
                        <div className="text-[9px] font-bold text-zinc-400">{data.performance.completedOrders} selesai</div>
                    </div>
                    <div className="bg-white border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] p-4">
                        <div className="flex items-center gap-2 mb-2">
                            <Clock className="h-4 w-4 text-blue-500" />
                            <span className="text-[9px] font-black uppercase tracking-widest text-zinc-400">On-Time</span>
                        </div>
                        <div className={`text-2xl font-black ${data.performance.onTimePercent >= 80 ? "text-emerald-600" : data.performance.onTimePercent >= 50 ? "text-amber-600" : "text-red-600"}`}>
                            {data.performance.onTimePercent}%
                        </div>
                        <div className="text-[9px] font-bold text-zinc-400">Tepat waktu</div>
                    </div>
                    <div className="bg-white border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] p-4">
                        <div className="flex items-center gap-2 mb-2">
                            <AlertTriangle className="h-4 w-4 text-red-500" />
                            <span className="text-[9px] font-black uppercase tracking-widest text-zinc-400">Defect Rate</span>
                        </div>
                        <div className={`text-2xl font-black ${data.performance.defectRatePercent <= 2 ? "text-emerald-600" : data.performance.defectRatePercent <= 5 ? "text-amber-600" : "text-red-600"}`}>
                            {data.performance.defectRatePercent}%
                        </div>
                        <div className="text-[9px] font-bold text-zinc-400">Tingkat cacat</div>
                    </div>
                    <div className="bg-white border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] p-4">
                        <div className="flex items-center gap-2 mb-2">
                            <TrendingUp className="h-4 w-4 text-purple-500" />
                            <span className="text-[9px] font-black uppercase tracking-widest text-zinc-400">Turnaround</span>
                        </div>
                        <div className="text-2xl font-black">{data.performance.avgTurnaroundDays}</div>
                        <div className="text-[9px] font-bold text-zinc-400">Hari rata-rata</div>
                    </div>
                </div>

                {/* Rates table -- with inline edit/delete */}
                <SubcontractorRatesTable rates={data.rates} subcontractorId={data.id} />

                {/* Active orders */}
                {data.activeOrders.length > 0 && (
                    <div className="bg-white border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
                        <div className="px-4 py-2.5 border-b-2 border-black bg-zinc-50">
                            <span className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Order Aktif</span>
                        </div>
                        <div className="divide-y divide-zinc-200">
                            {data.activeOrders.map((o) => (
                                <Link key={o.id} href={`/subcontract/orders/${o.id}`} className="px-4 py-3 flex items-center gap-4 hover:bg-zinc-50 block">
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2">
                                            <span className="text-xs font-black">{o.number}</span>
                                            <span className={`text-[8px] font-black px-1.5 py-0.5 border ${subcontractStatusColors[o.status]}`}>
                                                {subcontractStatusLabels[o.status]}
                                            </span>
                                        </div>
                                        <div className="text-[10px] text-zinc-500 font-bold">{o.operation}</div>
                                    </div>
                                    <div className="text-right shrink-0">
                                        <div className="text-xs font-mono font-bold">{o.totalReturnedQty}/{o.totalIssuedQty}</div>
                                        <div className="text-[8px] text-zinc-400 font-bold uppercase">Kembali/Kirim</div>
                                    </div>
                                </Link>
                            ))}
                        </div>
                    </div>
                )}

                {/* Completed orders */}
                {data.completedOrders.length > 0 && (
                    <div className="bg-white border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
                        <div className="px-4 py-2.5 border-b-2 border-black bg-zinc-50">
                            <span className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Riwayat Order</span>
                        </div>
                        <div className="divide-y divide-zinc-200">
                            {data.completedOrders.map((o) => (
                                <Link key={o.id} href={`/subcontract/orders/${o.id}`} className="px-4 py-2 flex items-center gap-4 hover:bg-zinc-50 block">
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2">
                                            <span className="text-xs font-bold text-zinc-600">{o.number}</span>
                                            <span className="text-[8px] font-black px-1.5 py-0.5 border bg-emerald-100 text-emerald-700 border-emerald-300">Selesai</span>
                                        </div>
                                    </div>
                                    <div className="text-[10px] text-zinc-400 font-bold">
                                        {new Date(o.issuedDate).toLocaleDateString("id-ID")}
                                    </div>
                                </Link>
                            ))}
                        </div>
                    </div>
                )}
            </div>
        </div>
    )
}
