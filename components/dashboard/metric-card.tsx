"use client"

import Link from "next/link"
import { formatCurrency } from "@/lib/utils"

interface MetricCardProps {
    label: string
    value: number
    format?: "currency" | "number" | "percent"
    suffix?: string
    href?: string
    badge?: number
    badgeColor?: string
    muted?: boolean
}

export function MetricCard({
    label,
    value,
    format = "number",
    suffix,
    href,
    badge,
    badgeColor = "bg-red-500",
    muted = false,
}: MetricCardProps) {
    const displayValue = format === "currency"
        ? formatCurrency(value)
        : format === "percent"
            ? `${value}%`
            : value.toLocaleString("id-ID")

    const isZero = value === 0
    const valueClass = isZero && muted
        ? "text-zinc-300 dark:text-zinc-600"
        : "text-zinc-900 dark:text-zinc-100"

    const content = (
        <div className="flex flex-col gap-1 min-w-0">
            <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 dark:text-zinc-500 truncate">
                {label}
            </span>
            <div className="flex items-baseline gap-1.5">
                <span className={`text-lg font-black tracking-tight leading-none ${valueClass}`}>
                    {displayValue}
                </span>
                {suffix && (
                    <span className="text-[10px] font-medium text-zinc-400">{suffix}</span>
                )}
                {badge !== undefined && badge > 0 && (
                    <span className={`ml-auto flex h-4 min-w-4 items-center justify-center rounded-full ${badgeColor} px-1 text-[9px] font-black text-white tabular-nums`}>
                        {badge > 99 ? "99+" : badge}
                    </span>
                )}
            </div>
        </div>
    )

    if (href) {
        return (
            <Link href={href} className="block p-3 hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors">
                {content}
            </Link>
        )
    }

    return <div className="p-3">{content}</div>
}
