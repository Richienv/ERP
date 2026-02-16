"use client"

import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, BarChart, Bar, XAxis } from "recharts"
import { subcontractStatusLabels } from "@/lib/subcontract-state-machine"
import { Package } from "lucide-react"

// ==============================================================================
// Status Distribution Chart
// ==============================================================================

const STATUS_CHART_COLORS: Record<string, string> = {
    SC_DRAFT: "#a1a1aa",
    SC_SENT: "#3b82f6",
    SC_IN_PROGRESS: "#f59e0b",
    SC_PARTIAL_COMPLETE: "#8b5cf6",
    SC_COMPLETED: "#10b981",
    SC_CANCELLED: "#ef4444",
}

interface StatusDistributionChartProps {
    data: { status: string; count: number }[]
}

export function StatusDistributionChart({ data }: StatusDistributionChartProps) {
    if (data.length === 0) {
        return (
            <div className="text-center py-6">
                <span className="text-[9px] font-bold text-zinc-400">Belum ada data</span>
            </div>
        )
    }

    const chartData = data.map((d) => ({
        name: subcontractStatusLabels[d.status as keyof typeof subcontractStatusLabels] || d.status,
        value: d.count,
        color: STATUS_CHART_COLORS[d.status] || "#a1a1aa",
    }))

    const total = chartData.reduce((sum, d) => sum + d.value, 0)

    return (
        <div className="flex items-center gap-4">
            <div className="w-[140px] h-[140px] relative">
                <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                        <Pie
                            data={chartData}
                            innerRadius={40}
                            outerRadius={60}
                            paddingAngle={3}
                            dataKey="value"
                        >
                            {chartData.map((entry, i) => (
                                <Cell key={i} fill={entry.color} />
                            ))}
                        </Pie>
                        <Tooltip
                            formatter={(value: number) => [value, "Order"]}
                            contentStyle={{ fontSize: 11, fontWeight: 700 }}
                        />
                    </PieChart>
                </ResponsiveContainer>
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-center pointer-events-none">
                    <span className="text-lg font-black">{total}</span>
                    <div className="text-[7px] font-bold text-zinc-400 uppercase">Total</div>
                </div>
            </div>
            <div className="flex-1 space-y-1">
                {chartData.map((d) => (
                    <div key={d.name} className="flex items-center gap-2">
                        <div
                            className="w-2.5 h-2.5 shrink-0"
                            style={{ backgroundColor: d.color }}
                        />
                        <span className="text-[9px] font-bold text-zinc-600 flex-1">{d.name}</span>
                        <span className="text-[10px] font-black">{d.value}</span>
                    </div>
                ))}
            </div>
        </div>
    )
}

// ==============================================================================
// Material at Vendor Table
// ==============================================================================

interface MaterialAtVendorTableProps {
    data: { subcontractorName: string; productName: string; qty: number }[]
}

export function MaterialAtVendorTable({ data }: MaterialAtVendorTableProps) {
    if (data.length === 0) {
        return (
            <div className="text-center py-6">
                <Package className="h-6 w-6 mx-auto text-zinc-200 mb-1" />
                <span className="text-[9px] font-bold text-zinc-400">
                    Tidak ada material di vendor
                </span>
            </div>
        )
    }

    return (
        <div className="overflow-x-auto">
            <table className="w-full">
                <thead className="bg-zinc-50 border-b border-zinc-200">
                    <tr>
                        <th className="text-[9px] font-black uppercase tracking-widest text-zinc-500 px-3 py-2 text-left">
                            Mitra CMT
                        </th>
                        <th className="text-[9px] font-black uppercase tracking-widest text-zinc-500 px-3 py-2 text-left">
                            Produk
                        </th>
                        <th className="text-[9px] font-black uppercase tracking-widest text-zinc-500 px-3 py-2 text-right">
                            Qty
                        </th>
                    </tr>
                </thead>
                <tbody>
                    {data.map((row, i) => (
                        <tr key={i} className="border-b border-zinc-200 last:border-b-0">
                            <td className="px-3 py-2 text-xs font-bold">{row.subcontractorName}</td>
                            <td className="px-3 py-2 text-xs font-bold text-zinc-500">{row.productName}</td>
                            <td className="px-3 py-2 text-xs font-mono font-black text-right">
                                {row.qty.toLocaleString()}
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    )
}
