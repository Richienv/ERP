"use client"

import { AlertTriangle, Wrench, Zap, Package, UserX, RefreshCw, Clock, Settings } from "lucide-react"
import type { DowntimeCategory } from "@prisma/client"

interface DowntimeLog {
    id: string
    machineName: string
    machineCode: string
    category: DowntimeCategory
    startTime: string
    endTime: string | null
    durationMinutes: number | null
    notes: string | null
    loggerName: string
}

interface MachineDowntimeWidgetProps {
    logs: DowntimeLog[]
}

function categoryIcon(cat: DowntimeCategory) {
    switch (cat) {
        case 'MECHANICAL': return <Wrench className="h-3 w-3" />
        case 'ELECTRICAL': return <Zap className="h-3 w-3" />
        case 'MATERIAL_SHORTAGE': return <Package className="h-3 w-3" />
        case 'OPERATOR_ERROR': return <UserX className="h-3 w-3" />
        case 'CHANGEOVER': return <RefreshCw className="h-3 w-3" />
        case 'PLANNED_MAINTENANCE': return <Settings className="h-3 w-3" />
        default: return <AlertTriangle className="h-3 w-3" />
    }
}

function categoryLabel(cat: DowntimeCategory): string {
    switch (cat) {
        case 'MECHANICAL': return 'Mekanis'
        case 'ELECTRICAL': return 'Elektrik'
        case 'MATERIAL_SHORTAGE': return 'Material'
        case 'OPERATOR_ERROR': return 'Operator'
        case 'CHANGEOVER': return 'Changeover'
        case 'PLANNED_MAINTENANCE': return 'Maintenance'
        default: return 'Lainnya'
    }
}

function categoryColor(cat: DowntimeCategory): string {
    switch (cat) {
        case 'MECHANICAL': return 'bg-red-100 text-red-700 border-red-300'
        case 'ELECTRICAL': return 'bg-amber-100 text-amber-700 border-amber-300'
        case 'MATERIAL_SHORTAGE': return 'bg-orange-100 text-orange-700 border-orange-300'
        case 'OPERATOR_ERROR': return 'bg-violet-100 text-violet-700 border-violet-300'
        case 'CHANGEOVER': return 'bg-blue-100 text-blue-700 border-blue-300'
        case 'PLANNED_MAINTENANCE': return 'bg-emerald-100 text-emerald-700 border-emerald-300'
        default: return 'bg-zinc-100 text-zinc-700 border-zinc-300'
    }
}

function formatDuration(minutes: number | null): string {
    if (minutes === null) return 'Ongoing'
    if (minutes < 60) return `${minutes}m`
    const h = Math.floor(minutes / 60)
    const m = minutes % 60
    return m > 0 ? `${h}j ${m}m` : `${h}j`
}

export function MachineDowntimeWidget({ logs }: MachineDowntimeWidgetProps) {
    const totalDowntime = logs.reduce((sum, l) => sum + (l.durationMinutes ?? 0), 0)
    const ongoingCount = logs.filter((l) => l.endTime === null).length

    return (
        <div className="bg-white dark:bg-zinc-900 border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] h-full flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-2.5 border-b-2 border-black bg-zinc-50 dark:bg-zinc-800">
                <div className="flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4 text-zinc-500" />
                    <span className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Downtime Mesin</span>
                </div>
                <div className="flex items-center gap-2">
                    {ongoingCount > 0 && (
                        <span className="text-[9px] font-black px-1.5 py-0.5 bg-red-500 text-white border-2 border-black animate-pulse">
                            {ongoingCount} AKTIF
                        </span>
                    )}
                    <span className="text-[10px] font-black px-2 py-0.5 border-2 border-black bg-zinc-100 text-zinc-700">
                        {formatDuration(totalDowntime)}
                    </span>
                </div>
            </div>

            {/* Logs */}
            <div className="flex-1 overflow-y-auto divide-y divide-zinc-100 dark:divide-zinc-800">
                {logs.length === 0 && (
                    <div className="flex flex-col items-center justify-center h-full text-center p-4">
                        <Settings className="h-6 w-6 text-zinc-300 mb-2" />
                        <span className="text-[10px] font-black uppercase tracking-widest text-zinc-400">
                            Tidak ada downtime hari ini
                        </span>
                    </div>
                )}
                {logs.map((log) => (
                    <div key={log.id} className="px-4 py-2.5 hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors">
                        <div className="flex items-center justify-between mb-1">
                            <div className="flex items-center gap-2">
                                <span className="text-xs font-black text-zinc-900 dark:text-white">
                                    {log.machineCode}
                                </span>
                                <span className={`inline-flex items-center gap-1 text-[9px] font-black px-1.5 py-0.5 border ${categoryColor(log.category)}`}>
                                    {categoryIcon(log.category)}
                                    {categoryLabel(log.category)}
                                </span>
                            </div>
                            <div className="flex items-center gap-1 text-[10px] font-bold text-zinc-400">
                                <Clock className="h-3 w-3" />
                                {log.endTime === null ? (
                                    <span className="text-red-500 font-black">Ongoing</span>
                                ) : (
                                    <span>{formatDuration(log.durationMinutes)}</span>
                                )}
                            </div>
                        </div>
                        {log.notes && (
                            <p className="text-[10px] font-medium text-zinc-500 line-clamp-1">{log.notes}</p>
                        )}
                    </div>
                ))}
            </div>
        </div>
    )
}
