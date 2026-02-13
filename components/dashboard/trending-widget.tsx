"use client"

import { BarChart3, ClipboardList, Package, CalendarOff, ShoppingCart } from "lucide-react"

interface TrendingWidgetProps {
    activePOs: number
    lowStockAlerts: number
    pendingLeaves: number
    activeOrders: number
}

interface StatRow {
    label: string
    value: number
    icon: React.ReactNode
    color: string
    barColor: string
}

export function TrendingWidget({ activePOs, lowStockAlerts, pendingLeaves, activeOrders }: TrendingWidgetProps) {
    const stats: StatRow[] = [
        { label: "PO Aktif", value: activePOs, icon: <ClipboardList className="h-3.5 w-3.5" />, color: "text-blue-600 dark:text-blue-400", barColor: "bg-blue-500" },
        { label: "Stok Rendah", value: lowStockAlerts, icon: <Package className="h-3.5 w-3.5" />, color: "text-amber-600 dark:text-amber-400", barColor: "bg-amber-500" },
        { label: "Cuti Pending", value: pendingLeaves, icon: <CalendarOff className="h-3.5 w-3.5" />, color: "text-rose-600 dark:text-rose-400", barColor: "bg-rose-500" },
        { label: "Sales Order", value: activeOrders, icon: <ShoppingCart className="h-3.5 w-3.5" />, color: "text-emerald-600 dark:text-emerald-400", barColor: "bg-emerald-500" },
    ]

    const maxValue = Math.max(...stats.map(s => s.value), 1)

    return (
        <div className="h-full flex flex-col bg-white dark:bg-zinc-900 border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] overflow-hidden">
            {/* Header */}
            <div className="flex-none flex items-center gap-2 px-4 py-3 border-b-2 border-black bg-zinc-50 dark:bg-zinc-800">
                <BarChart3 className="h-4 w-4 text-zinc-500" />
                <h3 className="text-xs font-black uppercase tracking-widest text-zinc-500 dark:text-zinc-400">Ringkasan Hari Ini</h3>
            </div>

            {/* Stats */}
            <div className="flex-1 p-4 flex flex-col justify-center gap-3">
                {stats.map((stat) => (
                    <div key={stat.label} className="flex items-center gap-3">
                        {/* Icon */}
                        <span className={`flex-none ${stat.color}`}>{stat.icon}</span>

                        {/* Label + Bar */}
                        <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between mb-1">
                                <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">{stat.label}</span>
                                <span className="text-sm font-black text-zinc-900 dark:text-white">{stat.value}</span>
                            </div>
                            {/* Bar */}
                            <div className="h-1.5 bg-zinc-100 dark:bg-zinc-800 w-full overflow-hidden">
                                <div
                                    className={`h-full ${stat.barColor} transition-all duration-500`}
                                    style={{ width: `${Math.max((stat.value / maxValue) * 100, stat.value > 0 ? 8 : 0)}%` }}
                                />
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    )
}
