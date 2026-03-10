"use client"

import { useAuth } from "@/lib/auth-context"
import { formatCurrency } from "@/lib/utils"
import {
    IconTrendingUp,
    IconCash,
    IconReceipt,
    IconAlertTriangle,
    IconRubberStamp,
} from "@tabler/icons-react"

interface GreetingBarProps {
    revenueMTD: number
    receivables: number
    payables: number
    overdueCount: number
    pendingApprovals: number
}

function getGreeting(): string {
    const hour = new Date().getHours()
    if (hour < 11) return "Selamat pagi"
    if (hour < 15) return "Selamat siang"
    if (hour < 18) return "Selamat sore"
    return "Selamat malam"
}

function formatDate(): string {
    return new Date().toLocaleDateString("id-ID", {
        weekday: "long",
        day: "numeric",
        month: "long",
        year: "numeric",
    })
}

interface KpiCardProps {
    label: string
    value: string
    icon: React.ReactNode
    accent: string
    bgAccent: string
    alert?: boolean
}

function KpiCard({ label, value, icon, accent, bgAccent, alert }: KpiCardProps) {
    return (
        <div className={`flex items-center gap-3 px-4 py-3 border-2 border-black ${bgAccent} min-w-0`}>
            <div className={`shrink-0 w-9 h-9 flex items-center justify-center border-2 border-black ${accent} text-white`}>
                {icon}
            </div>
            <div className="min-w-0 flex-1">
                <p className="text-[9px] font-black uppercase tracking-[0.15em] text-zinc-500 truncate">{label}</p>
                <p className={`text-base font-black tracking-tight leading-tight tabular-nums ${alert ? "text-red-600 animate-pulse" : "text-zinc-900 dark:text-zinc-100"}`}>
                    {value}
                </p>
            </div>
        </div>
    )
}

export function GreetingBar({ revenueMTD, receivables, payables, overdueCount, pendingApprovals }: GreetingBarProps) {
    const { user } = useAuth()
    const name = user?.name?.split(" ")[0] || "Boss"

    // Only show KPI pills that have actual data — no zeros
    const pills: KpiCardProps[] = []
    if (revenueMTD > 0) pills.push({ label: "Revenue MTD", value: formatCurrency(revenueMTD), icon: <IconTrendingUp className="w-4 h-4" />, accent: "bg-emerald-600", bgAccent: "bg-emerald-50 dark:bg-emerald-950/20" })
    if (receivables > 0) pills.push({ label: "Piutang (AR)", value: formatCurrency(receivables), icon: <IconCash className="w-4 h-4" />, accent: "bg-cyan-600", bgAccent: "bg-cyan-50 dark:bg-cyan-950/20" })
    if (payables > 0) pills.push({ label: "Hutang (AP)", value: formatCurrency(payables), icon: <IconReceipt className="w-4 h-4" />, accent: "bg-amber-600", bgAccent: "bg-amber-50 dark:bg-amber-950/20" })
    if (overdueCount > 0) pills.push({ label: "Invoice Overdue", value: String(overdueCount), icon: <IconAlertTriangle className="w-4 h-4" />, accent: "bg-red-600", bgAccent: "bg-red-50 dark:bg-red-950/20", alert: true })
    if (pendingApprovals > 0) pills.push({ label: "Perlu Approval", value: String(pendingApprovals), icon: <IconRubberStamp className="w-4 h-4" />, accent: "bg-orange-600", bgAccent: "bg-orange-50 dark:bg-orange-950/20", alert: true })

    const gridCols = pills.length <= 2 ? "grid-cols-2" : pills.length === 3 ? "grid-cols-3" : pills.length === 4 ? "grid-cols-2 md:grid-cols-4" : "grid-cols-2 md:grid-cols-5"

    return (
        <div className="space-y-3">
            <div className="flex items-end justify-between px-0.5">
                <div>
                    <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-zinc-400">{formatDate()}</p>
                    <h1 className="text-2xl font-black text-zinc-900 dark:text-zinc-100 tracking-tight">
                        {getGreeting()}, <span className="text-emerald-600">{name}</span>
                    </h1>
                </div>
                <div className="flex items-center gap-1.5 px-3 py-1 border-2 border-black bg-zinc-900 text-white">
                    <span className="relative flex h-2 w-2">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                    </span>
                    <span className="text-[9px] font-black uppercase tracking-widest">LIVE</span>
                </div>
            </div>

            {pills.length > 0 && (
                <div className={`grid gap-2 ${gridCols}`}>
                    {pills.map((pill) => <KpiCard key={pill.label} {...pill} />)}
                </div>
            )}
        </div>
    )
}
