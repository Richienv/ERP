"use client"

import { TrendingUp, TrendingDown, Wallet, Receipt, Percent, Package, Flame } from "lucide-react"
import Link from "next/link"
import { formatIDR } from "@/lib/utils"

interface PulseMetric {
    label: string
    value: number
    formatted: string
    suffix?: string
    icon: React.ReactNode
    href: string
    trend?: "up" | "down" | "neutral"
    trendLabel?: string
    accentColor: string
}

interface CompanyPulseBarProps {
    cashBalance: number
    revenueMTD: number
    netMargin: number
    inventoryValue: number
    inventoryItems: number
    burnRate: number
}

function formatCompact(value: number): string {
    if (value === 0) return "Rp 0"
    const abs = Math.abs(value)
    if (abs >= 1_000_000_000) return `Rp ${(value / 1_000_000_000).toFixed(1)}M`
    if (abs >= 1_000_000) return `Rp ${(value / 1_000_000).toFixed(1)}jt`
    if (abs >= 1_000) return `Rp ${(value / 1_000).toFixed(0)}rb`
    return `Rp ${value.toFixed(0)}`
}

export function CompanyPulseBar({
    cashBalance,
    revenueMTD,
    netMargin,
    inventoryValue,
    inventoryItems,
    burnRate
}: CompanyPulseBarProps) {
    const metrics: PulseMetric[] = [
        {
            label: "KAS",
            value: cashBalance,
            formatted: formatCompact(cashBalance),
            icon: <Wallet className="h-5 w-5" />,
            href: "/finance",
            trend: cashBalance > 0 ? "up" : "neutral",
            trendLabel: cashBalance > 0 ? "Positif" : "Belum ada data",
            accentColor: "bg-emerald-400"
        },
        {
            label: "REVENUE MTD",
            value: revenueMTD,
            formatted: formatCompact(revenueMTD),
            icon: <Receipt className="h-5 w-5" />,
            href: "/sales",
            trend: revenueMTD > 0 ? "up" : "neutral",
            trendLabel: "Bulan ini",
            accentColor: "bg-blue-400"
        },
        {
            label: "NET MARGIN",
            value: netMargin,
            formatted: `${netMargin.toFixed(1)}%`,
            icon: <Percent className="h-5 w-5" />,
            href: "/finance/reports",
            trend: netMargin > 0 ? "up" : netMargin < 0 ? "down" : "neutral",
            trendLabel: netMargin > 10 ? "Sehat" : netMargin > 0 ? "Rendah" : "Belum ada data",
            accentColor: "bg-purple-400"
        },
        {
            label: "INVENTORI",
            value: inventoryValue,
            formatted: formatCompact(inventoryValue),
            icon: <Package className="h-5 w-5" />,
            href: "/inventory",
            trend: "neutral",
            trendLabel: `${inventoryItems.toLocaleString("id-ID")} unit`,
            accentColor: "bg-amber-400"
        },
        {
            label: "BURN RATE",
            value: burnRate,
            formatted: formatCompact(burnRate),
            suffix: "/hari",
            icon: <Flame className="h-5 w-5" />,
            href: "/finance/reports",
            trend: burnRate > 0 ? "down" : "neutral",
            trendLabel: burnRate > 0 ? "Pengeluaran harian" : "Belum ada data",
            accentColor: "bg-rose-400"
        }
    ]

    return (
        <div className="bg-white dark:bg-zinc-900 border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] overflow-hidden">
            <div className="grid grid-cols-2 md:grid-cols-5">
                {metrics.map((metric, i) => (
                    <Link
                        key={metric.label}
                        href={metric.href}
                        className={`
                                group relative p-4 md:p-5 transition-all hover:bg-zinc-50 dark:hover:bg-zinc-800
                                ${i < metrics.length - 1 ? "md:border-r-2 border-b-2 md:border-b-0 border-zinc-100 dark:border-zinc-800" : ""}
                            `}
                    >
                        {/* Accent top line */}
                        <div className={`absolute top-0 left-0 right-0 h-1 ${metric.accentColor} opacity-100`} />

                        {/* Label + Icon */}
                        <div className="flex items-center gap-2 mb-2">
                            <span className="text-zinc-400 group-hover:text-black dark:group-hover:text-white transition-colors">
                                {metric.icon}
                            </span>
                            <span className="text-[10px] font-black uppercase tracking-widest text-zinc-500 group-hover:text-black dark:group-hover:text-white transition-colors">
                                {metric.label}
                            </span>
                        </div>

                        {/* Big Number */}
                        <div className="flex items-baseline gap-1">
                            <span className="text-2xl md:text-3xl font-black tracking-tighter text-zinc-900 dark:text-white">
                                {metric.value === 0 && metric.label !== "NET MARGIN" ? (
                                    <span className="text-zinc-300 dark:text-zinc-700 text-lg">Belum ada data</span>
                                ) : (
                                    metric.formatted
                                )}
                            </span>
                            {metric.suffix && metric.value > 0 && (
                                <span className="text-xs font-bold text-zinc-400">{metric.suffix}</span>
                            )}
                        </div>

                        {/* Trend */}
                        <div className="flex items-center gap-1 mt-1.5">
                            {metric.trend === "up" && <TrendingUp className="h-3 w-3 text-emerald-500" />}
                            {metric.trend === "down" && <TrendingDown className="h-3 w-3 text-rose-500" />}
                            <span className={`text-[10px] font-bold tracking-wide ${metric.trend === "up" ? "text-emerald-600 dark:text-emerald-400" :
                                    metric.trend === "down" ? "text-rose-600 dark:text-rose-400" :
                                        "text-zinc-400"
                                }`}>
                                {metric.trendLabel}
                            </span>
                        </div>
                    </Link>
                ))}
            </div>
        </div>
    )
}
