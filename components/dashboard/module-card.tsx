"use client"

import { ReactNode } from "react"
import Link from "next/link"
import { IconArrowRight } from "@tabler/icons-react"
import type { Icon } from "@tabler/icons-react"

/* ─── ModuleCard ─── */

interface ModuleCardProps {
    title: string
    icon: Icon
    href: string
    accentColor: string
    badge?: number
    badgeColor?: string
    children: ReactNode
    /** Span 2 columns on lg+ */
    wide?: boolean
}

export function ModuleCard({ title, icon: IconComponent, href, accentColor, badge, badgeColor = "bg-red-500", children, wide }: ModuleCardProps) {
    return (
        <div className={`border-2 border-black bg-white dark:bg-zinc-900 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] flex flex-col overflow-hidden ${wide ? "lg:col-span-2" : ""}`}>
            {/* Header with thick accent */}
            <div className={`${accentColor} px-3.5 py-2.5 flex items-center gap-2`}>
                <IconComponent className="w-4 h-4 text-white" />
                <span className="text-[11px] font-black uppercase tracking-[0.15em] text-white">{title}</span>
                {badge !== undefined && badge > 0 && (
                    <span className={`ml-auto flex h-5 min-w-5 items-center justify-center ${badgeColor} border-2 border-black px-1.5 text-[10px] font-black text-white tabular-nums`}>
                        {badge}
                    </span>
                )}
                <Link
                    href={href}
                    className="ml-auto flex items-center gap-1 text-[9px] font-black uppercase tracking-wider text-white/70 hover:text-white transition-colors"
                >
                    Detail <IconArrowRight className="w-3 h-3" />
                </Link>
            </div>

            {/* Content */}
            <div className="flex-1 p-3.5">
                {children}
            </div>
        </div>
    )
}

/* ─── CardMetric: bold metric row ─── */

export function CardMetric({ label, value, alert, sub }: { label: string; value: string; alert?: boolean; sub?: string }) {
    return (
        <div className="flex items-center justify-between py-1 border-b border-dashed border-zinc-200 dark:border-zinc-700 last:border-0">
            <span className="text-[11px] font-semibold text-zinc-500 dark:text-zinc-400">{label}</span>
            <div className="flex items-baseline gap-1.5">
                {sub && <span className="text-[10px] text-zinc-400">{sub}</span>}
                <span className={`text-[13px] font-black tabular-nums tracking-tight ${alert ? "text-red-600" : "text-zinc-900 dark:text-zinc-100"}`}>
                    {value}
                </span>
            </div>
        </div>
    )
}

/* ─── StatBlock: large hero stat ─── */

export function StatBlock({ label, value, accent, icon }: { label: string; value: string; accent: string; icon?: ReactNode }) {
    return (
        <div className="text-center px-2">
            <div className="flex items-center justify-center gap-1.5 mb-0.5">
                {icon}
                <span className={`text-xl font-black tracking-tight tabular-nums ${accent}`}>{value}</span>
            </div>
            <p className="text-[9px] font-bold uppercase tracking-[0.12em] text-zinc-400">{label}</p>
        </div>
    )
}

/* ─── ProgressBar ─── */

export function ProgressBar({ value, max, color = "bg-emerald-500", label }: { value: number; max: number; color?: string; label?: string }) {
    const pct = max > 0 ? Math.min((value / max) * 100, 100) : 0
    return (
        <div className="space-y-1">
            {label && (
                <div className="flex justify-between text-[10px]">
                    <span className="font-semibold text-zinc-500">{label}</span>
                    <span className="font-black text-zinc-700 dark:text-zinc-300 tabular-nums">{Math.round(pct)}%</span>
                </div>
            )}
            <div className="h-2 bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 overflow-hidden">
                <div className={`h-full ${color} transition-all duration-500 ease-out`} style={{ width: `${pct}%` }} />
            </div>
        </div>
    )
}

/* ─── SectionDivider ─── */

export function SectionDivider({ label }: { label: string }) {
    return (
        <div className="flex items-center gap-2 pt-2.5 pb-1">
            <span className="text-[9px] font-black uppercase tracking-[0.15em] text-zinc-400">{label}</span>
            <div className="flex-1 h-px bg-zinc-200 dark:bg-zinc-700" />
        </div>
    )
}
