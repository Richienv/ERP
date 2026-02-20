import {
    Wallet, ArrowRightLeft, Hourglass, Activity,
    TrendingUp, TrendingDown, ArrowUpRight, ArrowDownLeft, Package, AlertTriangle
} from "lucide-react";
import Link from "next/link";

function formatCompact(value: number): string {
    if (value === 0) return "Rp 0"
    const abs = Math.abs(value)
    if (abs >= 1_000_000_000) return `Rp ${(value / 1_000_000_000).toFixed(1)}M`
    if (abs >= 1_000_000) return `Rp ${(value / 1_000_000).toFixed(1)}jt`
    if (abs >= 1_000) return `Rp ${(value / 1_000).toFixed(0)}rb`
    return `Rp ${value.toFixed(0)}`
}

interface PulseMetric {
    label: string
    value: string
    icon: React.ReactNode
    href: string
    trend?: "up" | "down" | "neutral"
    trendLabel: string
    accentColor: string
}

interface GlobalKPIsProps {
    kpiData: {
        totalValue: number
        totalProducts: number
        lowStock: number
        inventoryAccuracy?: number
        inboundToday?: number
        outboundToday?: number
        [key: string]: any
    }
}

export function GlobalKPIs({ kpiData }: GlobalKPIsProps) {
    if (!kpiData) return null

    const metrics: PulseMetric[] = [
        {
            label: "TOTAL INVENTORI",
            value: formatCompact(kpiData.totalValue),
            icon: <Wallet className="h-5 w-5" />,
            href: "/inventory/stock",
            trend: kpiData.totalValue > 0 ? "up" : "neutral",
            trendLabel: `${kpiData.totalProducts} SKU aktif`,
            accentColor: "bg-emerald-400"
        },
        {
            label: "LOW STOCK",
            value: `${kpiData.lowStock}`,
            icon: <AlertTriangle className="h-5 w-5" />,
            href: "/inventory/stock",
            trend: kpiData.lowStock > 0 ? "down" : "up",
            trendLabel: kpiData.lowStock > 0 ? "Perlu restock" : "Semua aman",
            accentColor: kpiData.lowStock > 0 ? "bg-red-400" : "bg-emerald-400"
        },
        {
            label: "STOCK OPNAME",
            value: `${kpiData.inventoryAccuracy ?? 0}%`,
            icon: <Activity className="h-5 w-5" />,
            href: "/inventory/audit",
            trend: (kpiData.inventoryAccuracy ?? 0) >= 95 ? "up" : (kpiData.inventoryAccuracy ?? 0) >= 80 ? "neutral" : "down",
            trendLabel: "Audit & verifikasi stok",
            accentColor: "bg-blue-400"
        },
        {
            label: "INBOUND",
            value: `${(kpiData as any).inboundToday ?? 0}`,
            icon: <ArrowDownLeft className="h-5 w-5" />,
            href: "/inventory/movements",
            trend: "neutral",
            trendLabel: "Hari ini",
            accentColor: "bg-purple-400"
        },
        {
            label: "OUTBOUND",
            value: `${(kpiData as any).outboundToday ?? 0}`,
            icon: <ArrowUpRight className="h-5 w-5" />,
            href: "/inventory/movements",
            trend: "neutral",
            trendLabel: "Hari ini",
            accentColor: "bg-amber-400"
        },
    ]

    return (
        <div className="bg-white dark:bg-zinc-900 overflow-hidden">
            <div className="grid grid-cols-2 md:grid-cols-5">
                {metrics.map((metric, i) => (
                    <Link
                        key={metric.label}
                        href={metric.href}
                        className={`
                            group relative p-4 md:p-5 transition-all hover:bg-zinc-50 dark:hover:bg-zinc-800
                            ${i < metrics.length - 1 ? "md:border-r-2 border-b-2 md:border-b-0 border-black" : ""}
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
                                {metric.value}
                            </span>
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
    );
}
