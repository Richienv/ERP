"use client"

import Link from "next/link"
import { Package, ClipboardList, ArrowRightLeft, AlertTriangle, Layers, BarChart } from "lucide-react"

const inventoryModules = [
    { title: "Produk", href: "/inventory/products", icon: Package, bg: "bg-emerald-500", hoverBg: "hover:bg-emerald-600" },
    { title: "Level Stok", href: "/inventory/stock", icon: Layers, bg: "bg-blue-500", hoverBg: "hover:bg-blue-600" },
    { title: "Pergerakan", href: "/inventory/movements", icon: ArrowRightLeft, bg: "bg-violet-500", hoverBg: "hover:bg-violet-600" },
    { title: "Audit", href: "/inventory/audit", icon: ClipboardList, bg: "bg-amber-500", hoverBg: "hover:bg-amber-600" },
    { title: "Peringatan", href: "/inventory/alerts", icon: AlertTriangle, bg: "bg-rose-500", hoverBg: "hover:bg-rose-600" },
    { title: "Laporan", href: "/inventory/reports", icon: BarChart, bg: "bg-cyan-500", hoverBg: "hover:bg-cyan-600" },
]

export function InventoryQuickActions() {
    return (
        <div className="bg-zinc-50 dark:bg-zinc-800/50 overflow-hidden h-full flex items-center">
            <div className="flex items-center gap-2 px-4 py-2.5 w-full justify-center">
                {inventoryModules.map((mod) => {
                    const Icon = mod.icon
                    return (
                        <Link
                            key={mod.href}
                            href={mod.href}
                            className={`
                                group flex items-center gap-1.5 px-3 py-2 transition-all
                                ${mod.bg} ${mod.hoverBg} text-white
                                border-2 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]
                                hover:shadow-none hover:translate-y-[1px]
                                active:translate-y-[2px]
                            `}
                        >
                            <Icon className="h-3.5 w-3.5 shrink-0" />
                            <span className="text-[9px] font-black uppercase tracking-wider whitespace-nowrap">
                                {mod.title}
                            </span>
                        </Link>
                    )
                })}
            </div>
        </div>
    )
}
