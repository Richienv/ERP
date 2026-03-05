"use client"

import { useMemo, useRef, useState, useCallback } from "react"
import { useQuery } from "@tanstack/react-query"
import { queryKeys } from "@/lib/query-keys"
import {
    Calendar, ChevronLeft, ChevronRight, Info, X,
    Package, Clock, Factory, AlertTriangle,
} from "lucide-react"
import { Button } from "@/components/ui/button"

/* ── Types ── */
interface GanttWorkOrder {
    id: string
    number: string
    status: string
    plannedQty: number
    actualQty: number
    progress: number
    startDate: string | null
    dueDate: string | null
    priority: string
    stage: string | null
    product: {
        id: string
        code: string
        name: string
        unit: string
    }
    machine: {
        id: string
        code: string
        name: string
        group?: { id: string; name: string } | null
    } | null
}

interface GanttRow {
    label: string
    machineId: string | null
    bars: GanttBar[]
}

interface GanttBar {
    wo: GanttWorkOrder
    startDay: number  // offset from timeline start (in days)
    durationDays: number
}

/* ── Constants ── */
const DAY_WIDTH = 48
const ROW_HEIGHT = 52
const ROW_GAP = 4
const HEADER_HEIGHT = 56
const LABEL_WIDTH = 180
const MIN_BAR_WIDTH = 36

/* ── Status colors ── */
const STATUS_COLORS: Record<string, { bg: string; border: string; text: string; fill: string }> = {
    PLANNED:     { bg: "bg-zinc-100", border: "border-zinc-400", text: "text-zinc-700", fill: "#a1a1aa" },
    IN_PROGRESS: { bg: "bg-blue-50",  border: "border-blue-400", text: "text-blue-800", fill: "#3b82f6" },
    COMPLETED:   { bg: "bg-emerald-50", border: "border-emerald-400", text: "text-emerald-800", fill: "#10b981" },
    ON_HOLD:     { bg: "bg-amber-50", border: "border-amber-400", text: "text-amber-800", fill: "#f59e0b" },
    CANCELLED:   { bg: "bg-zinc-50",  border: "border-zinc-300", text: "text-zinc-500", fill: "#d4d4d8" },
}

const STATUS_LABELS: Record<string, string> = {
    PLANNED: "Direncanakan",
    IN_PROGRESS: "Berjalan",
    COMPLETED: "Selesai",
    ON_HOLD: "Ditahan",
    CANCELLED: "Dibatalkan",
}

const PRIORITY_INDICATORS: Record<string, string> = {
    CRITICAL: "border-l-red-500",
    HIGH: "border-l-orange-500",
    NORMAL: "border-l-blue-500",
    LOW: "border-l-zinc-400",
}

/* ── Helpers ── */
function daysBetween(a: Date, b: Date): number {
    const msPerDay = 86400000
    return Math.round((b.getTime() - a.getTime()) / msPerDay)
}

function formatDateShort(date: Date): string {
    return date.toLocaleDateString("id-ID", { day: "2-digit", month: "short" })
}

function formatDateFull(date: Date): string {
    return date.toLocaleDateString("id-ID", { day: "2-digit", month: "long", year: "numeric" })
}

function startOfDay(date: Date): Date {
    const d = new Date(date)
    d.setHours(0, 0, 0, 0)
    return d
}

/* ── Data hook ── */
function useGanttData() {
    return useQuery({
        queryKey: queryKeys.mfgGantt.list(),
        queryFn: async () => {
            // Fetch all non-cancelled WOs with machine info
            const res = await fetch("/api/manufacturing/work-orders?limit=200")
            if (!res.ok) return []
            const json = await res.json()
            if (!json.success) return []
            return json.data as GanttWorkOrder[]
        },
    })
}

/* ── Detail panel ── */
function WODetailPanel({ wo, onClose }: { wo: GanttWorkOrder; onClose: () => void }) {
    const sc = STATUS_COLORS[wo.status] || STATUS_COLORS.PLANNED
    return (
        <div className="border-2 border-black shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] bg-white dark:bg-zinc-900 overflow-hidden">
            <div className={`px-4 py-2.5 border-b-2 border-black flex items-center justify-between ${sc.bg}`}>
                <div className="flex items-center gap-2">
                    <Info className="h-4 w-4" />
                    <span className="text-xs font-black uppercase tracking-wide">Detail Work Order</span>
                </div>
                <button onClick={onClose} className="hover:bg-black/10 rounded p-0.5 transition-colors">
                    <X className="h-4 w-4" />
                </button>
            </div>
            <div className="p-4 space-y-3">
                <div className="flex items-center justify-between">
                    <span className="font-mono text-sm font-black">{wo.number}</span>
                    <span className={`inline-flex items-center gap-1 text-[9px] font-black uppercase tracking-wide px-2 py-0.5 border ${sc.bg} ${sc.border} ${sc.text}`}>
                        {STATUS_LABELS[wo.status] || wo.status}
                    </span>
                </div>
                <div className="border-t border-zinc-200 pt-2 space-y-2">
                    <div className="flex items-center gap-2">
                        <Package className="h-3.5 w-3.5 text-zinc-400 shrink-0" />
                        <span className="text-xs text-zinc-500 font-bold">Produk:</span>
                        <span className="text-xs font-bold text-zinc-800">{wo.product.name}</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <Factory className="h-3.5 w-3.5 text-zinc-400 shrink-0" />
                        <span className="text-xs text-zinc-500 font-bold">Mesin:</span>
                        <span className="text-xs font-bold text-zinc-800">{wo.machine?.name || "Belum ditentukan"}</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <Clock className="h-3.5 w-3.5 text-zinc-400 shrink-0" />
                        <span className="text-xs text-zinc-500 font-bold">Tanggal:</span>
                        <span className="text-xs font-bold text-zinc-800">
                            {wo.startDate ? formatDateFull(new Date(wo.startDate)) : "—"} s/d {wo.dueDate ? formatDateFull(new Date(wo.dueDate)) : "—"}
                        </span>
                    </div>
                </div>
                <div className="border-t border-zinc-200 pt-2">
                    <div className="flex justify-between text-xs mb-1">
                        <span className="font-bold text-zinc-500">Progress</span>
                        <span className="font-black text-zinc-800">{wo.actualQty}/{wo.plannedQty} {wo.product.unit}</span>
                    </div>
                    <div className="w-full h-2 bg-zinc-200 border border-zinc-300">
                        <div
                            className={`h-full transition-all ${wo.progress >= 100 ? "bg-emerald-500" : "bg-blue-500"}`}
                            style={{ width: `${Math.min(wo.progress, 100)}%` }}
                        />
                    </div>
                    <div className="text-right mt-0.5">
                        <span className="text-[10px] font-black text-zinc-500">{wo.progress}%</span>
                    </div>
                </div>
                {wo.priority === "CRITICAL" || wo.priority === "HIGH" ? (
                    <div className="flex items-center gap-1.5 px-2 py-1.5 bg-red-50 border border-red-300">
                        <AlertTriangle className="h-3.5 w-3.5 text-red-500" />
                        <span className="text-[10px] font-bold text-red-700">Prioritas: {wo.priority}</span>
                    </div>
                ) : null}
            </div>
        </div>
    )
}

/* ═══════════════════ MAIN COMPONENT ═══════════════════ */

export function ProductionGantt() {
    const { data: workOrders, isLoading } = useGanttData()
    const scrollRef = useRef<HTMLDivElement>(null)
    const [selectedWO, setSelectedWO] = useState<GanttWorkOrder | null>(null)

    // Compute timeline boundaries and rows
    const { rows, timelineStart, timelineDays, todayOffset } = useMemo(() => {
        if (!workOrders || workOrders.length === 0) {
            return { rows: [], timelineStart: new Date(), timelineDays: 30, todayOffset: 0 }
        }

        const today = startOfDay(new Date())

        // Filter WOs that have dates and are not cancelled
        const dated = workOrders.filter(
            (wo) => wo.startDate && wo.dueDate && wo.status !== "CANCELLED"
        )

        if (dated.length === 0) {
            return { rows: [], timelineStart: today, timelineDays: 30, todayOffset: 0 }
        }

        // Determine timeline range: earliest start to latest due, with padding
        const allStarts = dated.map((wo) => startOfDay(new Date(wo.startDate!)))
        const allEnds = dated.map((wo) => startOfDay(new Date(wo.dueDate!)))
        const earliest = new Date(Math.min(...allStarts.map((d) => d.getTime()), today.getTime()))
        const latest = new Date(Math.max(...allEnds.map((d) => d.getTime())))

        // Pad 3 days before and 5 days after
        const tlStart = new Date(earliest)
        tlStart.setDate(tlStart.getDate() - 3)
        const tlEnd = new Date(latest)
        tlEnd.setDate(tlEnd.getDate() + 5)
        const totalDays = daysBetween(tlStart, tlEnd) + 1

        const todayOff = daysBetween(tlStart, today)

        // Group by machine (or "Belum Ditentukan")
        const groups = new Map<string, { label: string; machineId: string | null; bars: GanttBar[] }>()

        for (const wo of dated) {
            const key = wo.machine?.id || "__unassigned__"
            const label = wo.machine?.name || "Belum Ditentukan"

            if (!groups.has(key)) {
                groups.set(key, { label, machineId: wo.machine?.id || null, bars: [] })
            }

            const startDay = daysBetween(tlStart, startOfDay(new Date(wo.startDate!)))
            const endDay = daysBetween(tlStart, startOfDay(new Date(wo.dueDate!)))
            const duration = Math.max(endDay - startDay, 1)

            groups.get(key)!.bars.push({ wo, startDay, durationDays: duration })
        }

        // Sort rows: machines first (alphabetical), unassigned last
        const sorted = Array.from(groups.values()).sort((a, b) => {
            if (!a.machineId) return 1
            if (!b.machineId) return -1
            return a.label.localeCompare(b.label)
        })

        return {
            rows: sorted,
            timelineStart: tlStart,
            timelineDays: totalDays,
            todayOffset: todayOff,
        }
    }, [workOrders])

    // Generate day ticks
    const dayTicks = useMemo(() => {
        const ticks: { label: string; dayLabel: string; offset: number; isWeekend: boolean; isToday: boolean; isFirstOfMonth: boolean }[] = []
        const today = startOfDay(new Date())

        for (let i = 0; i < timelineDays; i++) {
            const date = new Date(timelineStart)
            date.setDate(date.getDate() + i)
            const dow = date.getDay()
            ticks.push({
                label: formatDateShort(date),
                dayLabel: date.getDate().toString(),
                offset: i,
                isWeekend: dow === 0 || dow === 6,
                isToday: date.getTime() === today.getTime(),
                isFirstOfMonth: date.getDate() === 1,
            })
        }
        return ticks
    }, [timelineStart, timelineDays])

    // Month headers
    const monthHeaders = useMemo(() => {
        const headers: { label: string; startOffset: number; span: number }[] = []
        let currentMonth = -1
        let currentStart = 0
        let currentLabel = ""

        for (let i = 0; i < timelineDays; i++) {
            const date = new Date(timelineStart)
            date.setDate(date.getDate() + i)
            const m = date.getMonth()

            if (m !== currentMonth) {
                if (currentMonth >= 0) {
                    headers.push({ label: currentLabel, startOffset: currentStart, span: i - currentStart })
                }
                currentMonth = m
                currentStart = i
                currentLabel = date.toLocaleDateString("id-ID", { month: "long", year: "numeric" })
            }
        }
        if (currentMonth >= 0) {
            headers.push({ label: currentLabel, startOffset: currentStart, span: timelineDays - currentStart })
        }
        return headers
    }, [timelineStart, timelineDays])

    // Scroll to today on first render
    const scrolledRef = useRef(false)
    const scrollCallbackRef = useCallback((node: HTMLDivElement | null) => {
        if (node && !scrolledRef.current && todayOffset > 0) {
            scrolledRef.current = true
            // Scroll so "today" is roughly 1/4 from left
            const targetScroll = Math.max(0, todayOffset * DAY_WIDTH - node.clientWidth / 4)
            node.scrollLeft = targetScroll
        }
        // Also store ref for button scroll
        ;(scrollRef as any).current = node
    }, [todayOffset])

    const scrollToToday = useCallback(() => {
        const el = scrollRef.current
        if (!el) return
        const targetScroll = Math.max(0, todayOffset * DAY_WIDTH - el.clientWidth / 4)
        el.scrollTo({ left: targetScroll, behavior: "smooth" })
    }, [todayOffset])

    const chartWidth = timelineDays * DAY_WIDTH
    const chartHeight = rows.length * (ROW_HEIGHT + ROW_GAP) + ROW_GAP

    /* ── Loading skeleton ── */
    if (isLoading) {
        return (
            <div className="border-2 border-black shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] bg-white dark:bg-zinc-900 overflow-hidden animate-pulse">
                <div className="bg-indigo-50 dark:bg-indigo-950/20 px-5 py-2.5 border-b-2 border-black flex items-center gap-2 border-l-[5px] border-l-indigo-400">
                    <div className="h-4 w-4 bg-zinc-200 rounded" />
                    <div className="h-4 w-40 bg-zinc-200 rounded" />
                </div>
                <div className="p-4 space-y-3">
                    {Array.from({ length: 5 }, (_, i) => (
                        <div key={i} className="flex items-center gap-3">
                            <div className="h-8 w-32 bg-zinc-100 rounded" />
                            <div className="h-8 flex-1 bg-zinc-100 rounded" />
                        </div>
                    ))}
                </div>
            </div>
        )
    }

    /* ── Empty state ── */
    if (!workOrders || workOrders.length === 0 || rows.length === 0) {
        return (
            <div className="border-2 border-black shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] bg-white dark:bg-zinc-900 overflow-hidden">
                <div className="bg-indigo-50 dark:bg-indigo-950/20 px-5 py-2.5 border-b-2 border-black flex items-center gap-2 border-l-[5px] border-l-indigo-400">
                    <Calendar className="h-4 w-4 text-indigo-600" />
                    <h3 className="text-[11px] font-black uppercase tracking-widest text-zinc-700 dark:text-zinc-200">
                        Gantt Chart Produksi
                    </h3>
                </div>
                <div className="text-center py-16">
                    <Calendar className="h-10 w-10 mx-auto text-zinc-300 mb-3" />
                    <p className="text-xs font-black uppercase tracking-widest text-zinc-400 mb-1">
                        Belum Ada Work Order Terjadwal
                    </p>
                    <p className="text-[10px] text-zinc-400">
                        Buat work order dengan tanggal mulai & selesai untuk melihat Gantt chart
                    </p>
                </div>
            </div>
        )
    }

    return (
        <div className="space-y-3">
            {/* Gantt Chart Card */}
            <div className="border-2 border-black shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] bg-white dark:bg-zinc-900 overflow-hidden">
                {/* Header */}
                <div className="bg-indigo-50 dark:bg-indigo-950/20 px-5 py-2.5 border-b-2 border-black flex items-center justify-between border-l-[5px] border-l-indigo-400">
                    <div className="flex items-center gap-2">
                        <Calendar className="h-4 w-4 text-indigo-600" />
                        <h3 className="text-[11px] font-black uppercase tracking-widest text-zinc-700 dark:text-zinc-200">
                            Gantt Chart Produksi
                        </h3>
                        <span className="text-[9px] font-bold text-zinc-400 ml-2">
                            {rows.length} work center &middot; {rows.reduce((s, r) => s + r.bars.length, 0)} order
                        </span>
                    </div>
                    <div className="flex items-center gap-1.5">
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={scrollToToday}
                            className="border-2 border-zinc-300 font-bold uppercase text-[9px] tracking-wide h-7 px-2.5 hover:border-indigo-400 transition-colors"
                        >
                            <Calendar className="h-3 w-3 mr-1" /> Hari Ini
                        </Button>
                    </div>
                </div>

                {/* Legend */}
                <div className="px-5 py-1.5 border-b border-zinc-200 flex items-center gap-4 bg-zinc-50/80">
                    {Object.entries(STATUS_LABELS).filter(([k]) => k !== "CANCELLED").map(([key, label]) => {
                        const sc = STATUS_COLORS[key]
                        return (
                            <div key={key} className="flex items-center gap-1.5">
                                <div className={`w-3 h-2.5 border ${sc.border} ${sc.bg}`} />
                                <span className="text-[9px] font-bold text-zinc-500">{label}</span>
                            </div>
                        )
                    })}
                </div>

                {/* Scrollable Gantt area */}
                <div className="flex overflow-hidden" style={{ maxHeight: 600 }}>
                    {/* Left sidebar - row labels */}
                    <div className="shrink-0 bg-white dark:bg-zinc-900 border-r-2 border-zinc-200 z-10" style={{ width: LABEL_WIDTH }}>
                        {/* Header spacer */}
                        <div className="border-b border-zinc-200 px-3 flex items-end pb-1" style={{ height: HEADER_HEIGHT }}>
                            <span className="text-[8px] font-black uppercase tracking-widest text-zinc-400">
                                Mesin / Work Center
                            </span>
                        </div>
                        <div className="overflow-hidden" style={{ height: chartHeight }}>
                            {rows.map((row, i) => (
                                <div
                                    key={row.machineId || `unassigned-${i}`}
                                    className="flex items-center px-3 border-b border-zinc-100"
                                    style={{ height: ROW_HEIGHT + ROW_GAP }}
                                >
                                    <div className="min-w-0">
                                        <p className="text-[10px] font-bold truncate text-zinc-700 dark:text-zinc-300">
                                            {row.label}
                                        </p>
                                        <p className="text-[8px] text-zinc-400 font-medium">
                                            {row.bars.length} order
                                        </p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Scrollable chart */}
                    <div
                        ref={scrollCallbackRef}
                        className="flex-1 overflow-auto"
                    >
                        <div style={{ width: chartWidth, minHeight: chartHeight + HEADER_HEIGHT }}>
                            {/* Timeline header */}
                            <div className="sticky top-0 bg-white dark:bg-zinc-900 z-20 border-b border-zinc-200" style={{ height: HEADER_HEIGHT }}>
                                {/* Month row */}
                                <div className="flex h-[28px] border-b border-zinc-100">
                                    {monthHeaders.map((mh) => (
                                        <div
                                            key={`${mh.label}-${mh.startOffset}`}
                                            className="border-r border-zinc-200 flex items-center justify-center"
                                            style={{ width: mh.span * DAY_WIDTH, left: mh.startOffset * DAY_WIDTH }}
                                        >
                                            <span className="text-[9px] font-black uppercase tracking-wide text-zinc-500">
                                                {mh.label}
                                            </span>
                                        </div>
                                    ))}
                                </div>
                                {/* Day row */}
                                <div className="relative flex" style={{ height: HEADER_HEIGHT - 28 }}>
                                    {dayTicks.map((tick) => (
                                        <div
                                            key={tick.offset}
                                            className={`flex items-center justify-center border-r shrink-0 ${
                                                tick.isToday
                                                    ? "bg-indigo-100 border-indigo-300 dark:bg-indigo-950/30"
                                                    : tick.isWeekend
                                                        ? "bg-zinc-50 border-zinc-100 dark:bg-zinc-800/30"
                                                        : "border-zinc-100"
                                            }`}
                                            style={{ width: DAY_WIDTH }}
                                        >
                                            <span className={`text-[9px] font-bold ${
                                                tick.isToday ? "text-indigo-700 font-black" : "text-zinc-400"
                                            }`}>
                                                {tick.dayLabel}
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* Chart body */}
                            <div className="relative" style={{ height: chartHeight }}>
                                {/* Row backgrounds */}
                                {rows.map((_, i) => (
                                    <div
                                        key={`row-bg-${i}`}
                                        className={`absolute w-full border-b border-zinc-100 ${
                                            i % 2 === 1 ? "bg-zinc-50/40" : "bg-white"
                                        }`}
                                        style={{
                                            top: i * (ROW_HEIGHT + ROW_GAP),
                                            height: ROW_HEIGHT + ROW_GAP,
                                        }}
                                    />
                                ))}

                                {/* Weekend columns */}
                                {dayTicks.filter((t) => t.isWeekend).map((tick) => (
                                    <div
                                        key={`wk-${tick.offset}`}
                                        className="absolute top-0 bottom-0 bg-zinc-50/60 dark:bg-zinc-800/20"
                                        style={{ left: tick.offset * DAY_WIDTH, width: DAY_WIDTH }}
                                    />
                                ))}

                                {/* Vertical grid lines (first of month) */}
                                {dayTicks.filter((t) => t.isFirstOfMonth).map((tick) => (
                                    <div
                                        key={`month-line-${tick.offset}`}
                                        className="absolute top-0 bottom-0 border-l border-zinc-300/60"
                                        style={{ left: tick.offset * DAY_WIDTH }}
                                    />
                                ))}

                                {/* Today marker */}
                                {todayOffset >= 0 && todayOffset < timelineDays && (
                                    <div
                                        className="absolute top-0 bottom-0 z-30 pointer-events-none"
                                        style={{ left: todayOffset * DAY_WIDTH + DAY_WIDTH / 2 }}
                                    >
                                        <div className="w-0.5 h-full bg-indigo-500/70" />
                                        <div className="absolute -top-0 -left-[18px] bg-indigo-600 text-white text-[7px] font-bold px-1.5 py-0.5 rounded-b whitespace-nowrap">
                                            HARI INI
                                        </div>
                                    </div>
                                )}

                                {/* Bars */}
                                {rows.map((row, rowIdx) =>
                                    row.bars.map((bar) => {
                                        const sc = STATUS_COLORS[bar.wo.status] || STATUS_COLORS.PLANNED
                                        const priorityBorder = PRIORITY_INDICATORS[bar.wo.priority] || PRIORITY_INDICATORS.NORMAL
                                        const barWidth = Math.max(bar.durationDays * DAY_WIDTH, MIN_BAR_WIDTH)
                                        const barLeft = bar.startDay * DAY_WIDTH
                                        const barTop = rowIdx * (ROW_HEIGHT + ROW_GAP) + ROW_GAP / 2
                                        const isSelected = selectedWO?.id === bar.wo.id

                                        return (
                                            <div
                                                key={bar.wo.id}
                                                onClick={() => setSelectedWO(isSelected ? null : bar.wo)}
                                                className={`absolute cursor-pointer transition-all border-2 border-l-[4px] ${sc.border} ${sc.bg} ${priorityBorder} ${
                                                    isSelected
                                                        ? "ring-2 ring-offset-1 ring-indigo-400 shadow-md z-20 scale-[1.02]"
                                                        : "hover:shadow-md hover:z-10 z-5"
                                                }`}
                                                style={{
                                                    left: barLeft,
                                                    top: barTop,
                                                    width: barWidth,
                                                    height: ROW_HEIGHT,
                                                }}
                                            >
                                                {/* Progress fill */}
                                                {bar.wo.progress > 0 && (
                                                    <div
                                                        className="absolute inset-0 opacity-15"
                                                        style={{
                                                            width: `${Math.min(bar.wo.progress, 100)}%`,
                                                            background: sc.fill,
                                                        }}
                                                    />
                                                )}
                                                <div className="relative h-full flex items-center gap-1.5 px-2 overflow-hidden">
                                                    <div className="min-w-0 flex-1">
                                                        <p className={`text-[10px] font-bold truncate ${sc.text}`}>
                                                            {bar.wo.number}
                                                        </p>
                                                        <p className="text-[8px] text-zinc-400 truncate">
                                                            {bar.wo.product.name}
                                                        </p>
                                                    </div>
                                                    {bar.wo.progress > 0 && barWidth > 80 && (
                                                        <span className={`text-[8px] font-black shrink-0 ${sc.text}`}>
                                                            {bar.wo.progress}%
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                        )
                                    })
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Detail panel */}
            {selectedWO && (
                <WODetailPanel wo={selectedWO} onClose={() => setSelectedWO(null)} />
            )}
        </div>
    )
}
