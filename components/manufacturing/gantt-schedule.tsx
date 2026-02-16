"use client"

import { useMemo, useState } from "react"
import { CalendarClock, ChevronLeft, ChevronRight, AlertTriangle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { STAGE_LABELS, STAGE_COLORS } from "@/lib/garment-stage-machine"
import type { GarmentStage } from "@prisma/client"
import type { WorkOrderWithStage } from "@/lib/actions/manufacturing-garment"

interface GanttScheduleProps {
    workOrders: WorkOrderWithStage[]
    onSelectWorkOrder?: (wo: WorkOrderWithStage) => void
}

const DAY_WIDTH = 48
const ROW_HEIGHT = 36
const HEADER_HEIGHT = 52
const DAYS_VISIBLE = 14

function addDays(date: Date, days: number): Date {
    const d = new Date(date)
    d.setDate(d.getDate() + days)
    return d
}

function startOfDay(date: Date): Date {
    const d = new Date(date)
    d.setHours(0, 0, 0, 0)
    return d
}

function daysBetween(a: Date, b: Date): number {
    const ms = startOfDay(b).getTime() - startOfDay(a).getTime()
    return Math.round(ms / (1000 * 60 * 60 * 24))
}

function formatShortDate(date: Date): string {
    return date.toLocaleDateString('id-ID', { day: '2-digit', month: 'short' })
}

function isWeekend(date: Date): boolean {
    const day = date.getDay()
    return day === 0 || day === 6
}

export function GanttSchedule({ workOrders, onSelectWorkOrder }: GanttScheduleProps) {
    const [viewStart, setViewStart] = useState(() => startOfDay(new Date()))

    const viewEnd = useMemo(() => addDays(viewStart, DAYS_VISIBLE), [viewStart])

    const days = useMemo(() => {
        const result: Date[] = []
        for (let i = 0; i < DAYS_VISIBLE; i++) {
            result.push(addDays(viewStart, i))
        }
        return result
    }, [viewStart])

    // Filter to work orders that have scheduled dates and overlap with the visible window
    const scheduledOrders = useMemo(() => {
        return workOrders
            .filter((wo) => wo.scheduledStart && wo.scheduledEnd)
            .filter((wo) => {
                const start = new Date(wo.scheduledStart!)
                const end = new Date(wo.scheduledEnd!)
                return start < viewEnd && end > viewStart
            })
            .sort((a, b) => new Date(a.scheduledStart!).getTime() - new Date(b.scheduledStart!).getTime())
    }, [workOrders, viewStart, viewEnd])

    // Unscheduled work orders
    const unscheduledOrders = useMemo(() => {
        return workOrders.filter((wo) => !wo.scheduledStart || !wo.scheduledEnd)
    }, [workOrders])

    const prevWeek = () => setViewStart((v) => addDays(v, -7))
    const nextWeek = () => setViewStart((v) => addDays(v, 7))
    const goToday = () => setViewStart(startOfDay(new Date()))

    const totalWidth = DAYS_VISIBLE * DAY_WIDTH

    return (
        <div className="bg-white border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
            {/* Header Controls */}
            <div className="flex items-center justify-between px-4 py-2.5 border-b-2 border-black bg-zinc-50">
                <div className="flex items-center gap-2">
                    <CalendarClock className="h-4 w-4 text-zinc-500" />
                    <span className="text-[10px] font-black uppercase tracking-widest text-zinc-500">
                        Jadwal Produksi
                    </span>
                    <span className="text-[10px] font-bold text-zinc-400 ml-2">
                        {scheduledOrders.length} terjadwal / {unscheduledOrders.length} belum
                    </span>
                </div>
                <div className="flex items-center gap-1">
                    <Button variant="outline" size="sm" onClick={prevWeek} className="h-7 w-7 p-0 border-2 border-black rounded-none">
                        <ChevronLeft className="h-3.5 w-3.5" />
                    </Button>
                    <Button variant="outline" size="sm" onClick={goToday} className="h-7 px-2 text-[10px] font-black uppercase border-2 border-black rounded-none">
                        Hari ini
                    </Button>
                    <Button variant="outline" size="sm" onClick={nextWeek} className="h-7 w-7 p-0 border-2 border-black rounded-none">
                        <ChevronRight className="h-3.5 w-3.5" />
                    </Button>
                </div>
            </div>

            {/* Gantt Chart Area */}
            <div className="overflow-x-auto">
                <div style={{ minWidth: totalWidth + 200 }}>
                    {/* Date header */}
                    <div className="flex border-b-2 border-black" style={{ height: HEADER_HEIGHT }}>
                        {/* Label column */}
                        <div className="w-[200px] min-w-[200px] border-r-2 border-black bg-zinc-100 flex items-end px-3 pb-2">
                            <span className="text-[9px] font-black uppercase tracking-widest text-zinc-400">Work Order</span>
                        </div>
                        {/* Day columns */}
                        <div className="flex">
                            {days.map((day, i) => {
                                const isToday = startOfDay(new Date()).getTime() === startOfDay(day).getTime()
                                const weekend = isWeekend(day)
                                return (
                                    <div
                                        key={i}
                                        className={`flex flex-col items-center justify-end pb-1 border-r border-zinc-200 ${
                                            isToday ? 'bg-blue-50' : weekend ? 'bg-zinc-50' : ''
                                        }`}
                                        style={{ width: DAY_WIDTH }}
                                    >
                                        <span className={`text-[8px] font-black uppercase ${
                                            isToday ? 'text-blue-600' : weekend ? 'text-zinc-400' : 'text-zinc-500'
                                        }`}>
                                            {day.toLocaleDateString('id-ID', { weekday: 'short' })}
                                        </span>
                                        <span className={`text-[10px] font-bold ${
                                            isToday ? 'text-blue-700 bg-blue-200 px-1.5 rounded-sm' : 'text-zinc-600'
                                        }`}>
                                            {day.getDate()}
                                        </span>
                                        {day.getDate() === 1 && (
                                            <span className="text-[7px] font-black text-zinc-400 uppercase">
                                                {day.toLocaleDateString('id-ID', { month: 'short' })}
                                            </span>
                                        )}
                                    </div>
                                )
                            })}
                        </div>
                    </div>

                    {/* Rows */}
                    {scheduledOrders.length === 0 ? (
                        <div className="flex items-center justify-center py-12 text-zinc-400">
                            <div className="text-center">
                                <CalendarClock className="h-8 w-8 mx-auto mb-2 opacity-30" />
                                <span className="text-[10px] font-black uppercase tracking-widest">
                                    Belum ada jadwal dalam rentang ini
                                </span>
                            </div>
                        </div>
                    ) : (
                        scheduledOrders.map((wo) => {
                            const woStart = new Date(wo.scheduledStart!)
                            const woEnd = new Date(wo.scheduledEnd!)
                            const offsetDays = Math.max(0, daysBetween(viewStart, woStart))
                            const startClipped = woStart < viewStart ? viewStart : woStart
                            const endClipped = woEnd > viewEnd ? viewEnd : woEnd
                            const durationDays = Math.max(1, daysBetween(startClipped, endClipped))

                            const left = daysBetween(viewStart, startClipped) * DAY_WIDTH
                            const width = durationDays * DAY_WIDTH

                            const stageColors = wo.stage ? STAGE_COLORS[wo.stage] : { bg: 'bg-zinc-100', text: 'text-zinc-700', accent: 'bg-zinc-500' }
                            const stageLabel = wo.stage ? STAGE_LABELS[wo.stage] : '—'

                            const isDue = wo.dueDate && new Date(wo.dueDate) < new Date()
                            const progressPct = wo.plannedQty > 0 ? Math.round((wo.actualQty / wo.plannedQty) * 100) : 0

                            return (
                                <div
                                    key={wo.id}
                                    className="flex border-b border-zinc-100 hover:bg-zinc-50/50 transition-colors cursor-pointer"
                                    style={{ height: ROW_HEIGHT }}
                                    onClick={() => onSelectWorkOrder?.(wo)}
                                >
                                    {/* Label */}
                                    <div className="w-[200px] min-w-[200px] border-r-2 border-black flex items-center px-3 gap-2 overflow-hidden">
                                        <div className={`w-1.5 h-5 ${stageColors.accent} shrink-0`} />
                                        <div className="min-w-0">
                                            <div className="text-[10px] font-black truncate">{wo.number}</div>
                                            <div className="text-[8px] text-zinc-400 font-bold truncate">{wo.productCode}</div>
                                        </div>
                                        {isDue && <AlertTriangle className="h-3 w-3 text-red-500 shrink-0" />}
                                    </div>

                                    {/* Bar area */}
                                    <div className="relative flex-1" style={{ minWidth: totalWidth }}>
                                        {/* Day grid lines */}
                                        {days.map((day, i) => (
                                            <div
                                                key={i}
                                                className={`absolute top-0 bottom-0 border-r border-zinc-100 ${
                                                    isWeekend(day) ? 'bg-zinc-50/50' : ''
                                                }`}
                                                style={{ left: i * DAY_WIDTH, width: DAY_WIDTH }}
                                            />
                                        ))}

                                        {/* Today marker */}
                                        {(() => {
                                            const todayOffset = daysBetween(viewStart, new Date())
                                            if (todayOffset >= 0 && todayOffset < DAYS_VISIBLE) {
                                                return (
                                                    <div
                                                        className="absolute top-0 bottom-0 w-px bg-blue-400 z-10"
                                                        style={{ left: todayOffset * DAY_WIDTH + DAY_WIDTH / 2 }}
                                                    />
                                                )
                                            }
                                            return null
                                        })()}

                                        {/* Gantt bar */}
                                        <div
                                            className={`absolute top-1.5 border-2 border-black ${stageColors.bg} flex items-center px-1.5 overflow-hidden group`}
                                            style={{
                                                left: left,
                                                width: Math.max(width, DAY_WIDTH),
                                                height: ROW_HEIGHT - 12,
                                            }}
                                        >
                                            {/* Progress fill */}
                                            <div
                                                className={`absolute inset-0 ${stageColors.accent} opacity-20`}
                                                style={{ width: `${progressPct}%` }}
                                            />
                                            <span className={`text-[9px] font-black relative z-10 truncate ${stageColors.text}`}>
                                                {stageLabel} • {wo.plannedQty} pcs
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            )
                        })
                    )}
                </div>
            </div>

            {/* Unscheduled List */}
            {unscheduledOrders.length > 0 && (
                <div className="border-t-2 border-black">
                    <div className="px-4 py-2 bg-amber-50 border-b border-amber-200 flex items-center gap-2">
                        <AlertTriangle className="h-3.5 w-3.5 text-amber-600" />
                        <span className="text-[10px] font-black uppercase tracking-widest text-amber-700">
                            Belum Dijadwalkan ({unscheduledOrders.length})
                        </span>
                    </div>
                    <div className="divide-y divide-zinc-100 max-h-[160px] overflow-y-auto">
                        {unscheduledOrders.map((wo) => {
                            const stageColors = wo.stage ? STAGE_COLORS[wo.stage] : { bg: 'bg-zinc-100', text: 'text-zinc-700', accent: 'bg-zinc-500' }
                            return (
                                <div
                                    key={wo.id}
                                    className="flex items-center gap-3 px-4 py-2 hover:bg-zinc-50 cursor-pointer"
                                    onClick={() => onSelectWorkOrder?.(wo)}
                                >
                                    <div className={`w-1.5 h-5 ${stageColors.accent}`} />
                                    <span className="text-[10px] font-black font-mono">{wo.number}</span>
                                    <span className="text-[10px] text-zinc-500 truncate flex-1">{wo.productName}</span>
                                    <span className="text-[10px] font-bold">{wo.plannedQty} pcs</span>
                                    {wo.dueDate && (
                                        <span className={`text-[9px] font-bold ${
                                            new Date(wo.dueDate) < new Date() ? 'text-red-600' : 'text-zinc-400'
                                        }`}>
                                            Due: {formatShortDate(new Date(wo.dueDate))}
                                        </span>
                                    )}
                                    <span className={`text-[9px] font-black px-1.5 py-0.5 border ${
                                        wo.priority === 'CRITICAL' ? 'bg-red-100 text-red-700 border-red-300' :
                                        wo.priority === 'HIGH' ? 'bg-amber-100 text-amber-700 border-amber-300' :
                                        'bg-zinc-100 text-zinc-600 border-zinc-300'
                                    }`}>
                                        {wo.priority}
                                    </span>
                                </div>
                            )
                        })}
                    </div>
                </div>
            )}
        </div>
    )
}
