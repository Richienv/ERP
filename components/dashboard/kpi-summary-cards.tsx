"use client"

import Link from "next/link"
import { FileText, ShoppingCart, Users, Receipt } from "lucide-react"

interface KpiSummaryCardsProps {
    totalPRValue: number
    totalPOValue: number
    totalSalary: number
    ppnNet: number
    totalPRs: number
    totalPOs: number
}

function formatCompact(value: number): string {
    if (value === 0) return "Rp 0"
    const abs = Math.abs(value)
    const sign = value < 0 ? "-" : ""
    if (abs >= 1_000_000_000) return `${sign}Rp ${(abs / 1_000_000_000).toFixed(1)}M`
    if (abs >= 1_000_000) return `${sign}Rp ${(abs / 1_000_000).toFixed(1)}jt`
    if (abs >= 1_000) return `${sign}Rp ${(abs / 1_000).toFixed(0)}rb`
    return `${sign}Rp ${abs.toFixed(0)}`
}

const cards = [
    {
        key: "pr",
        label: "Total Purchase Request",
        icon: FileText,
        href: "/procurement/requests",
        accentColor: "bg-sky-400",
        getValue: (p: KpiSummaryCardsProps) => p.totalPRValue,
        getSub: (p: KpiSummaryCardsProps) => `${p.totalPRs} PR`,
    },
    {
        key: "po",
        label: "Total Purchase Order",
        icon: ShoppingCart,
        href: "/procurement/orders",
        accentColor: "bg-indigo-400",
        getValue: (p: KpiSummaryCardsProps) => p.totalPOValue,
        getSub: (p: KpiSummaryCardsProps) => `${p.totalPOs} PO`,
    },
    {
        key: "gaji",
        label: "Gaji Bulan Ini",
        icon: Users,
        href: "/hcm/payroll",
        accentColor: "bg-teal-400",
        getValue: (p: KpiSummaryCardsProps) => p.totalSalary,
        getSub: () => "Estimasi gaji aktif",
    },
    {
        key: "ppn",
        label: "PPN Bulan Ini",
        icon: Receipt,
        href: "/finance/reports",
        accentColor: "bg-orange-400",
        getValue: (p: KpiSummaryCardsProps) => p.ppnNet,
        getSub: (p: KpiSummaryCardsProps) => p.ppnNet >= 0 ? "PPN Keluaran > Masukan" : "PPN Masukan > Keluaran",
    },
]

export function KpiSummaryCards(props: KpiSummaryCardsProps) {
    return (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {cards.map((card) => {
                const value = card.getValue(props)
                const Icon = card.icon
                return (
                    <Link
                        key={card.key}
                        href={card.href}
                        className="group relative bg-white dark:bg-zinc-900 border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] p-4 md:p-5 transition-all hover:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:translate-x-[2px] hover:translate-y-[2px]"
                    >
                        <div className={`absolute top-0 left-0 right-0 h-1 ${card.accentColor}`} />

                        <div className="flex items-center gap-2 mb-3">
                            <Icon className="h-4 w-4 text-zinc-400 group-hover:text-black dark:group-hover:text-white transition-colors" />
                            <span className="text-[10px] font-black uppercase tracking-widest text-zinc-500 group-hover:text-black dark:group-hover:text-white transition-colors">
                                {card.label}
                            </span>
                        </div>

                        <div className="text-2xl md:text-3xl font-black tracking-tighter text-zinc-900 dark:text-white">
                            {value === 0 ? (
                                <span className="text-zinc-300 dark:text-zinc-700 text-lg">Belum ada data</span>
                            ) : (
                                formatCompact(value)
                            )}
                        </div>

                        <div className="text-[10px] font-bold text-zinc-400 mt-1 tracking-wide">
                            {card.getSub(props)}
                        </div>
                    </Link>
                )
            })}
        </div>
    )
}
