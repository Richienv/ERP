"use client"

import { useSubcontractDashboard } from "@/hooks/use-subcontract-dashboard"
import { subcontractStatusLabels, subcontractStatusColors } from "@/lib/subcontract-state-machine"
import {
    Factory, ClipboardList, AlertTriangle, Users,
    DollarSign, TrendingUp, Clock, Package,
} from "lucide-react"
import Link from "next/link"
import { StatusDistributionChart, MaterialAtVendorTable } from "@/components/subcontract/dashboard-charts"
import { CardPageSkeleton } from "@/components/ui/page-skeleton"

export default function SubcontractPage() {
    const { data, isLoading } = useSubcontractDashboard()

    if (isLoading || !data) {
        return <CardPageSkeleton accentColor="bg-blue-400" />
    }

    const formatCurrency = (value: number) =>
        new Intl.NumberFormat("id-ID", {
            style: "currency", currency: "IDR", minimumFractionDigits: 0,
        }).format(value)

    return (
        <div className="p-6 space-y-6">
            <div className="flex items-center gap-2">
                <Factory className="h-5 w-5" />
                <h1 className="text-sm font-semibold  ">Subkontrak & CMT</h1>
            </div>

            <div className="space-y-6">
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                    <div className="bg-white border border-border shadow-sm p-4">
                        <div className="flex items-center gap-2 mb-2">
                            <ClipboardList className="h-4 w-4 text-blue-500" />
                            <span className="text-xs font-semibold text-zinc-400">Order Aktif</span>
                        </div>
                        <div className="text-2xl font-semibold">{data.totalActive}</div>
                    </div>
                    <div className="bg-white border border-border shadow-sm p-4">
                        <div className="flex items-center gap-2 mb-2">
                            <Users className="h-4 w-4 text-emerald-500" />
                            <span className="text-xs font-semibold text-zinc-400">Mitra CMT</span>
                        </div>
                        <div className="text-2xl font-semibold">{data.totalSubcontractors}</div>
                    </div>
                    <div className="bg-white border border-border shadow-sm p-4">
                        <div className="flex items-center gap-2 mb-2">
                            <AlertTriangle className="h-4 w-4 text-red-500" />
                            <span className="text-xs font-semibold text-zinc-400">Terlambat</span>
                        </div>
                        <div className={`text-2xl font-semibold ${data.overdueCount > 0 ? "text-red-600" : ""}`}>{data.overdueCount}</div>
                    </div>
                    <div className="bg-white border border-border shadow-sm p-4">
                        <div className="flex items-center gap-2 mb-2">
                            <DollarSign className="h-4 w-4 text-amber-500" />
                            <span className="text-xs font-semibold text-zinc-400">Biaya Bulan Ini</span>
                        </div>
                        <div className="text-lg font-semibold">{formatCurrency(data.totalCostThisMonth)}</div>
                    </div>
                    <div className="bg-white border border-border shadow-sm p-4">
                        <div className="flex items-center gap-2 mb-2">
                            <TrendingUp className="h-4 w-4 text-purple-500" />
                            <span className="text-xs font-semibold text-zinc-400">Yield Rate</span>
                        </div>
                        <div className={`text-2xl font-semibold ${data.yieldRate >= 95 ? "text-emerald-600" : data.yieldRate >= 85 ? "text-amber-600" : "text-red-600"}`}>{data.yieldRate}%</div>
                        <div className="text-xs font-bold text-zinc-400">Kembali / Kirim</div>
                    </div>
                    <div className="bg-white border border-border shadow-sm p-4">
                        <div className="flex items-center gap-2 mb-2">
                            <Clock className="h-4 w-4 text-cyan-500" />
                            <span className="text-xs font-semibold text-zinc-400">On-Time</span>
                        </div>
                        <div className={`text-2xl font-semibold ${data.onTimeDeliveryPercent >= 80 ? "text-emerald-600" : data.onTimeDeliveryPercent >= 50 ? "text-amber-600" : "text-red-600"}`}>{data.onTimeDeliveryPercent}%</div>
                        <div className="text-xs font-bold text-zinc-400">Tepat waktu</div>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="bg-white border border-border shadow-sm">
                        <div className="px-4 py-2.5 border-b border-border bg-zinc-50">
                            <span className="text-xs font-semibold text-zinc-500">Distribusi Status</span>
                        </div>
                        <div className="p-4">
                            <StatusDistributionChart data={data.statusDistribution} />
                        </div>
                    </div>
                    <div className="bg-white border border-border shadow-sm">
                        <div className="px-4 py-2.5 border-b border-border bg-zinc-50 flex items-center gap-2">
                            <Package className="h-3.5 w-3.5 text-zinc-500" />
                            <span className="text-xs font-semibold text-zinc-500">Material di Vendor</span>
                        </div>
                        <MaterialAtVendorTable data={data.materialAtVendor} />
                    </div>
                </div>

                {data.overdueOrders?.length > 0 && (
                    <div className="bg-red-50 border border-red-400 shadow-sm">
                        <div className="px-4 py-2.5 border-b border-red-400 bg-red-100 flex items-center gap-2">
                            <AlertTriangle className="h-3.5 w-3.5 text-red-600" />
                            <span className="text-xs font-semibold text-red-700">Order Terlambat</span>
                        </div>
                        <div className="divide-y divide-red-200">
                            {data.overdueOrders.map((order: any) => (
                                <Link key={order.id} href={`/subcontract/orders/${order.id}`} className="px-4 py-3 flex items-center gap-4 hover:bg-red-100 block">
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2">
                                            <span className="text-xs font-semibold text-red-800">{order.number}</span>
                                            <span className={`text-xs font-semibold px-1.5 py-0.5 border ${subcontractStatusColors[order.status as keyof typeof subcontractStatusColors]}`}>
                                                {subcontractStatusLabels[order.status as keyof typeof subcontractStatusLabels]}
                                            </span>
                                        </div>
                                        <div className="text-xs text-red-600 font-bold">
                                            {order.subcontractorName} — Target: {order.expectedReturnDate ? new Date(order.expectedReturnDate).toLocaleDateString("id-ID") : "—"}
                                        </div>
                                    </div>
                                    <div className="text-right shrink-0">
                                        <div className="text-xs font-mono font-bold text-red-800">{order.totalReturnedQty}/{order.totalIssuedQty}</div>
                                        <div className="text-xs text-red-400 font-bold ">Kembali/Kirim</div>
                                    </div>
                                </Link>
                            ))}
                        </div>
                    </div>
                )}

                <div className="bg-white border border-border shadow-sm">
                    <div className="px-4 py-2.5 border-b border-border bg-zinc-50 flex items-center justify-between">
                        <span className="text-xs font-semibold text-zinc-500">Order Terbaru</span>
                        <Link href="/subcontract/orders" className="text-xs font-semibold text-blue-600 hover:underline">Lihat Semua →</Link>
                    </div>
                    {data.recentOrders?.length === 0 ? (
                        <div className="p-8 text-center">
                            <ClipboardList className="h-8 w-8 mx-auto text-zinc-200 mb-2" />
                            <span className="text-xs font-semibold text-zinc-400">Belum ada order subkontrak</span>
                        </div>
                    ) : (
                        <div className="divide-y divide-zinc-200">
                            {(data.recentOrders ?? []).map((order: any) => (
                                <Link key={order.id} href={`/subcontract/orders/${order.id}`} className="px-4 py-3 flex items-center gap-4 hover:bg-zinc-50 block">
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2">
                                            <span className="text-xs font-semibold">{order.number}</span>
                                            <span className={`text-xs font-semibold px-1.5 py-0.5 border ${subcontractStatusColors[order.status as keyof typeof subcontractStatusColors]}`}>
                                                {subcontractStatusLabels[order.status as keyof typeof subcontractStatusLabels]}
                                            </span>
                                        </div>
                                        <div className="text-xs text-zinc-500 font-bold">{order.subcontractorName} — {order.operation}</div>
                                    </div>
                                    <div className="text-right shrink-0">
                                        <div className="text-xs font-mono font-bold">{order.totalReturnedQty}/{order.totalIssuedQty}</div>
                                        <div className="text-xs text-zinc-400 font-bold ">Kembali/Kirim</div>
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
