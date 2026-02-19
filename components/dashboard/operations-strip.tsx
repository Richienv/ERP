"use client"

import { Factory, Package, ShoppingCart, Users, Shield } from "lucide-react"
import Link from "next/link"

interface OperationsStripProps {
    activeWorkOrders: number
    lowStockCount: number
    salesRevenueMTD: number
    attendanceRate: number
    totalStaff: number
    qualityPassRate: number
}

function formatCompact(value: number): string {
    if (value === 0) return "Rp 0"
    const abs = Math.abs(value)
    if (abs >= 1_000_000_000) return `Rp ${(value / 1_000_000_000).toFixed(1)}M`
    if (abs >= 1_000_000) return `Rp ${(value / 1_000_000).toFixed(1)}jt`
    if (abs >= 1_000) return `Rp ${(value / 1_000).toFixed(0)}rb`
    return `Rp ${value.toFixed(0)}`
}

function getHealthColor(status: "good" | "warning" | "critical"): string {
    switch (status) {
        case "good": return "bg-emerald-500"
        case "warning": return "bg-amber-500"
        case "critical": return "bg-red-500"
    }
}

interface Tile {
    label: string
    value: string
    detail: string
    icon: React.ReactNode
    health: "good" | "warning" | "critical"
    href: string
}

export function OperationsStrip({
    activeWorkOrders,
    lowStockCount,
    salesRevenueMTD,
    attendanceRate,
    totalStaff,
    qualityPassRate
}: OperationsStripProps) {
    const tiles: Tile[] = [
        {
            label: "Produksi",
            value: `${activeWorkOrders}`,
            detail: "WO aktif",
            icon: <Factory className="h-4 w-4" />,
            health: activeWorkOrders > 0 ? "good" : "warning",
            href: "/manufacturing"
        },
        {
            label: "Gudang",
            value: `${lowStockCount}`,
            detail: "stok rendah",
            icon: <Package className="h-4 w-4" />,
            health: lowStockCount === 0 ? "good" : lowStockCount <= 3 ? "warning" : "critical",
            href: "/inventory"
        },
        {
            label: "Penjualan",
            value: formatCompact(salesRevenueMTD),
            detail: "MTD",
            icon: <ShoppingCart className="h-4 w-4" />,
            health: salesRevenueMTD > 0 ? "good" : "warning",
            href: "/sales"
        },
        {
            label: "SDM",
            value: totalStaff > 0
                ? (attendanceRate > 0 ? `${attendanceRate.toFixed(0)}%` : `${totalStaff}`)
                : "—",
            detail: totalStaff > 0
                ? (attendanceRate > 0 ? `${totalStaff} staf` : "total staf")
                : "belum ada data",
            icon: <Users className="h-4 w-4" />,
            health: totalStaff === 0 ? "warning" :
                attendanceRate >= 90 ? "good" : attendanceRate >= 70 ? "warning" : "critical",
            href: "/hcm"
        },
        {
            label: "Kualitas",
            value: qualityPassRate < 0 ? "—" : `${qualityPassRate.toFixed(1)}%`,
            detail: qualityPassRate < 0 ? "belum ada inspeksi" : "pass rate",
            icon: <Shield className="h-4 w-4" />,
            health: qualityPassRate < 0 ? "warning" :
                qualityPassRate >= 95 ? "good" : qualityPassRate >= 85 ? "warning" : "critical",
            href: "/manufacturing/quality"
        }
    ]

    return (
        <div className="bg-white dark:bg-zinc-900 border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] overflow-hidden">
            <div className="grid grid-cols-2 md:grid-cols-5">
                {tiles.map((tile, i) => (
                    <Link
                        key={tile.label}
                        href={tile.href}
                        className={`
                            group relative p-4 transition-all hover:bg-zinc-50 dark:hover:bg-zinc-800/50 active:scale-[0.98]
                            ${i < tiles.length - 1 ? "md:border-r-2 border-b-2 md:border-b-0 border-black" : ""}
                        `}
                    >
                        {/* Header row: Icon + Label + Health dot */}
                        <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-1.5">
                                <span className="text-zinc-400 group-hover:text-zinc-600 dark:group-hover:text-zinc-300 transition-colors">{tile.icon}</span>
                                <span className="text-[10px] font-black uppercase tracking-widest text-zinc-400 group-hover:text-zinc-600 dark:group-hover:text-zinc-300 transition-colors">
                                    {tile.label}
                                </span>
                            </div>
                            <div className={`h-2 w-2 rounded-full ${getHealthColor(tile.health)}`} />
                        </div>

                        {/* Big number */}
                        <p className="text-2xl font-black tracking-tighter text-zinc-900 dark:text-white">
                            {tile.value}
                        </p>

                        {/* Detail */}
                        <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 mt-0.5">
                            {tile.detail}
                        </p>
                    </Link>
                ))}
            </div>
        </div>
    )
}
