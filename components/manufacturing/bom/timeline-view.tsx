"use client"

import { useMemo, useState, useCallback, useRef, useEffect } from "react"
import {
    Scissors, Shirt, Droplets, Printer, Sparkles,
    ShieldCheck, Package, Wrench, Cog, Clock, Users, ArrowLeftRight, Building2,
} from "lucide-react"

/* ── Station visuals ── */
const STATION_ICONS: Record<string, typeof Scissors> = {
    CUTTING: Scissors, SEWING: Shirt, WASHING: Droplets,
    PRINTING: Printer, EMBROIDERY: Sparkles, QC: ShieldCheck,
    PACKING: Package, FINISHING: Wrench, OTHER: Cog,
}

const STATION_COLORS: Record<string, { bg: string; border: string; text: string; accent: string }> = {
    CUTTING:    { bg: "#fef2f2", border: "#fca5a5", text: "#b91c1c", accent: "#f87171" },
    SEWING:     { bg: "#eff6ff", border: "#93c5fd", text: "#1d4ed8", accent: "#60a5fa" },
    WASHING:    { bg: "#ecfeff", border: "#67e8f9", text: "#0e7490", accent: "#22d3ee" },
    PRINTING:   { bg: "#faf5ff", border: "#c4b5fd", text: "#7c3aed", accent: "#a78bfa" },
    EMBROIDERY: { bg: "#fdf2f8", border: "#f9a8d4", text: "#be185d", accent: "#f472b6" },
    QC:         { bg: "#f0fdf4", border: "#86efac", text: "#15803d", accent: "#4ade80" },
    PACKING:    { bg: "#fffbeb", border: "#fcd34d", text: "#b45309", accent: "#fbbf24" },
    FINISHING:  { bg: "#f4f4f5", border: "#a1a1aa", text: "#3f3f46", accent: "#71717a" },
    OTHER:      { bg: "#f4f4f5", border: "#a1a1aa", text: "#3f3f46", accent: "#71717a" },
}

/* ── Types ── */
interface TimelineViewProps {
    steps: any[]
    totalQty: number
    selectedStepId: string | null
    onStepSelect: (stepId: string | null) => void
    onMoveStep?: (stepId: string, startOffsetMinutes: number, lane?: number) => void
}

interface BarLayout {
    step: any
    row: number
    startMin: number
    durationMin: number
}

/* ── Constants ── */
const MIN_BAR_MINUTES = 20
const PIXELS_PER_MINUTE = 4
const ROW_HEIGHT = 44
const ROW_GAP = 6
const HEADER_HEIGHT = 36
const LABEL_WIDTH = 120
const SNAP_MINUTES = 5

/* ── Station-grouped scheduling ──
 * Groups bars by stationId — each unique station gets its own row.
 */
function scheduleByStation(steps: any[]): { bars: BarLayout[]; totalMinutes: number; totalRows: number; rowLabels: string[] } {
    if (steps.length === 0) return { bars: [], totalMinutes: 0, totalRows: 0, rowLabels: [] }

    const getDuration = (step: any) => Math.max(step.durationMinutes || 0, MIN_BAR_MINUTES)

    // Compute start times (same DAG logic)
    const endTimes = new Map<string, number>()
    const startTimes = new Map<string, number>()
    const sorted = [...steps].sort((a, b) => a.sequence - b.sequence)

    for (const step of sorted) {
        const parentEnds = (step.parentStepIds || []).map((pid: string) => endTimes.get(pid) || 0)
        const dagStart = parentEnds.length > 0 ? Math.max(...parentEnds) : 0
        const offset = step.startOffsetMinutes || 0
        const start = offset > 0 ? offset : dagStart
        const duration = getDuration(step)
        startTimes.set(step.id, start)
        endTimes.set(step.id, start + duration)
    }

    // Group by stationId — each unique station = own row
    const stationOrder: string[] = []
    const stationNames: Record<string, string> = {}
    for (const step of sorted) {
        const sid = step.stationId || step.station?.id || step.id
        if (!stationOrder.includes(sid)) {
            stationOrder.push(sid)
            stationNames[sid] = step.station?.name || `Station ${stationOrder.length}`
        }
    }

    const bars: BarLayout[] = []
    for (const step of sorted) {
        const sid = step.stationId || step.station?.id || step.id
        const row = stationOrder.indexOf(sid)
        const start = startTimes.get(step.id) || 0
        const duration = getDuration(step)
        bars.push({ step, row, startMin: start, durationMin: duration })
    }

    const totalMinutes = endTimes.size > 0 ? Math.max(...endTimes.values(), MIN_BAR_MINUTES) : MIN_BAR_MINUTES
    const rowLabels = stationOrder.map(sid => stationNames[sid])
    return { bars, totalMinutes, totalRows: Math.max(stationOrder.length, 1), rowLabels }
}

/* ── Scheduling ──
 * Each step starts at:
 *   max(parent end times, startOffsetMinutes)
 * If no parents: starts at startOffsetMinutes (default 0)
 * This allows free horizontal positioning via startOffsetMinutes.
 */
function scheduleSteps(steps: any[]): { bars: BarLayout[]; totalMinutes: number; totalRows: number } {
    if (steps.length === 0) return { bars: [], totalMinutes: 0, totalRows: 0 }

    const getDuration = (step: any) => Math.max(step.durationMinutes || 0, MIN_BAR_MINUTES)

    const endTimes = new Map<string, number>()
    const startTimes = new Map<string, number>()
    const sorted = [...steps].sort((a, b) => a.sequence - b.sequence)

    for (const step of sorted) {
        const parentEnds = (step.parentStepIds || []).map((pid: string) => endTimes.get(pid) || 0)
        const dagStart = parentEnds.length > 0 ? Math.max(...parentEnds) : 0
        const offset = step.startOffsetMinutes || 0
        // If user has manually positioned (dragged), use their offset directly.
        // Otherwise, use DAG-based scheduling (after parents finish).
        const start = offset > 0 ? offset : dagStart
        const duration = getDuration(step)
        startTimes.set(step.id, start)
        endTimes.set(step.id, start + duration)
    }

    const bars: BarLayout[] = []
    const rowOccupied: { end: number }[] = []

    // Helper: ensure rowOccupied has enough rows
    const ensureRow = (r: number) => {
        while (rowOccupied.length <= r) rowOccupied.push({ end: 0 })
    }

    for (const step of sorted) {
        const start = startTimes.get(step.id) || 0
        const duration = getDuration(step)
        let assignedRow = -1

        // If user manually placed this step in a lane, respect it
        if (step.manualLane != null && step.manualLane >= 0) {
            assignedRow = step.manualLane
            ensureRow(assignedRow)
            rowOccupied[assignedRow].end = Math.max(rowOccupied[assignedRow].end, start + duration)
        } else {
            // Auto-assign: first row where it fits
            for (let r = 0; r < rowOccupied.length; r++) {
                if (rowOccupied[r].end <= start) {
                    assignedRow = r
                    rowOccupied[r].end = start + duration
                    break
                }
            }
            if (assignedRow === -1) {
                assignedRow = rowOccupied.length
                rowOccupied.push({ end: start + duration })
            }
        }
        bars.push({ step, row: assignedRow, startMin: start, durationMin: duration })
    }

    const totalMinutes = endTimes.size > 0 ? Math.max(...endTimes.values(), MIN_BAR_MINUTES) : MIN_BAR_MINUTES
    return { bars, totalMinutes, totalRows: Math.max(rowOccupied.length, 1) }
}

function fmtDuration(min: number): string {
    if (min < 60) return `${Math.round(min)}m`
    const h = Math.floor(min / 60)
    const m = Math.round(min % 60)
    return m > 0 ? `${h}j ${m}m` : `${h}j`
}

function generateTicks(totalMinutes: number): { label: string; minute: number }[] {
    const ticks: { label: string; minute: number }[] = []
    let interval: number
    if (totalMinutes <= 60) interval = 5
    else if (totalMinutes <= 120) interval = 15
    else if (totalMinutes <= 480) interval = 30
    else if (totalMinutes <= 1440) interval = 60
    else interval = 480

    for (let m = 0; m <= totalMinutes + interval; m += interval) {
        if (m >= 60) {
            const h = Math.floor(m / 60)
            const mins = m % 60
            ticks.push({ label: mins > 0 ? `${h}j${mins}m` : `${h}j`, minute: m })
        } else {
            ticks.push({ label: `${m}m`, minute: m })
        }
    }
    return ticks
}

/* ── Drag types ── */
interface DragState {
    stepId: string
    startX: number
    startY: number
    currentX: number
    currentY: number
    barLayout: BarLayout
    active: boolean
}

function rowY(row: number) {
    return HEADER_HEIGHT + row * (ROW_HEIGHT + ROW_GAP) + ROW_GAP / 2
}

/* ═══════════════════ COMPONENT ═══════════════════ */

type TimelineMode = "jalur" | "stasiun"

export function TimelineView({
    steps, totalQty, selectedStepId, onStepSelect,
    onMoveStep,
}: TimelineViewProps) {
    const [timelineMode, setTimelineMode] = useState<TimelineMode>("jalur")

    const jalurSchedule = useMemo(() => scheduleSteps(steps), [steps])
    const stasiunSchedule = useMemo(() => scheduleByStation(steps), [steps])

    const isStasiunMode = timelineMode === "stasiun"
    const { bars, totalMinutes, totalRows } = isStasiunMode ? stasiunSchedule : jalurSchedule
    const stasiunRowLabels = stasiunSchedule.rowLabels

    const ticks = useMemo(() => generateTicks(totalMinutes), [totalMinutes])
    const scrollRef = useRef<HTMLDivElement>(null)

    /* ── Drag state ── */
    const [drag, setDrag] = useState<DragState | null>(null)

    // Compute ghost position during move drag (snapped to grid)
    const ghostStartMin = useMemo(() => {
        if (!drag?.active) return -1
        const dx = drag.currentX - drag.startX
        const rawMin = drag.barLayout.startMin + dx / PIXELS_PER_MINUTE
        return Math.max(0, Math.round(rawMin / SNAP_MINUTES) * SNAP_MINUTES)
    }, [drag])

    // How many display rows (add one if ghost is below all existing rows)
    const ghostRow = useMemo(() => {
        if (!drag?.active) return -1
        const dy = drag.currentY - drag.startY
        const newY = rowY(drag.barLayout.row) + dy
        return Math.max(0, Math.round((newY - HEADER_HEIGHT - ROW_GAP / 2) / (ROW_HEIGHT + ROW_GAP)))
    }, [drag])

    const displayRows = drag?.active && ghostRow >= totalRows
        ? totalRows + 1 : totalRows

    const chartWidth = Math.max((totalMinutes + 30) * PIXELS_PER_MINUTE, 500)
    const chartHeight = displayRows * (ROW_HEIGHT + ROW_GAP) + HEADER_HEIGHT + ROW_HEIGHT + ROW_GAP

    /* ── Pointer handlers ── */
    const onPointerDown = useCallback((e: React.PointerEvent, stepId: string) => {
        e.preventDefault()
        e.stopPropagation()
        // In stasiun mode, only allow click-to-select (no drag)
        if (isStasiunMode) {
            onStepSelect(stepId)
            return
        }
        const bar = bars.find(b => b.step.id === stepId)
        if (!bar) return
        setDrag({
            stepId, barLayout: bar,
            startX: e.clientX, startY: e.clientY,
            currentX: e.clientX, currentY: e.clientY,
            active: false,
        })
    }, [bars, isStasiunMode, onStepSelect])

    // Keep a ref to the latest drag state so onUp can read it without re-subscribing
    const dragRef = useRef<DragState | null>(null)
    dragRef.current = drag

    useEffect(() => {
        if (!drag) return

        const onMove = (e: PointerEvent) => {
            setDrag(prev => {
                if (!prev) return null
                const dx = e.clientX - prev.startX
                const dy = e.clientY - prev.startY
                const active = prev.active || Math.abs(dx) > 4 || Math.abs(dy) > 4
                return { ...prev, currentX: e.clientX, currentY: e.clientY, active }
            })
        }

        const onUp = () => {
            // Read final state from ref — don't call parent callbacks inside setDrag updater
            const prev = dragRef.current
            setDrag(null)

            if (!prev) return

            if (!prev.active) {
                // Click — select
                onStepSelect(prev.stepId)
                return
            }

            if (onMoveStep) {
                const dx = prev.currentX - prev.startX
                const dy = prev.currentY - prev.startY
                const rawMin = prev.barLayout.startMin + dx / PIXELS_PER_MINUTE
                const snappedMin = Math.max(0, Math.round(rawMin / SNAP_MINUTES) * SNAP_MINUTES)
                const newY = rowY(prev.barLayout.row) + dy
                const targetRow = Math.max(0, Math.round((newY - HEADER_HEIGHT - ROW_GAP / 2) / (ROW_HEIGHT + ROW_GAP)))
                const rowChanged = targetRow !== prev.barLayout.row
                if (snappedMin !== prev.barLayout.startMin || rowChanged) {
                    onMoveStep(prev.stepId, snappedMin, targetRow)
                }
            }
        }

        window.addEventListener("pointermove", onMove)
        window.addEventListener("pointerup", onUp)
        return () => {
            window.removeEventListener("pointermove", onMove)
            window.removeEventListener("pointerup", onUp)
        }
    }, [!!drag, onMoveStep, onStepSelect])

    /* ── Summary ── */
    const maxParallel = totalRows

    if (steps.length === 0) {
        return (
            <div className="flex-1 flex items-center justify-center text-zinc-400 text-xs font-bold uppercase tracking-widest">
                Belum ada proses — tambahkan dari toolbar di atas
            </div>
        )
    }

    return (
        <div className="flex-1 flex flex-col overflow-hidden bg-white">
            {/* Summary strip */}
            <div className="border-b border-zinc-200 bg-zinc-50 px-4 py-2 flex items-center gap-5 shrink-0">
                <div className="flex items-center gap-1.5">
                    <Clock className="h-3.5 w-3.5 text-indigo-500" />
                    <span className="text-[9px] font-black uppercase text-zinc-400">Total:</span>
                    <span className="text-xs font-black text-indigo-700">{fmtDuration(totalMinutes)}</span>
                </div>
                <div className="flex items-center gap-1.5">
                    <Users className="h-3.5 w-3.5 text-blue-500" />
                    <span className="text-[9px] font-black uppercase text-zinc-400">Jalur Paralel:</span>
                    <span className="text-xs font-black text-blue-700">{maxParallel}</span>
                </div>

                {/* View mode toggle */}
                <div className="flex items-center gap-0 border border-zinc-300 rounded overflow-hidden ml-auto">
                    <button
                        onClick={() => setTimelineMode("jalur")}
                        className={`flex items-center gap-1 px-2.5 py-1 text-[9px] font-black uppercase transition-colors ${
                            timelineMode === "jalur" ? "bg-indigo-500 text-white" : "bg-white text-zinc-400 hover:bg-zinc-50"
                        }`}
                    >
                        <Users className="h-3 w-3" /> Jalur
                    </button>
                    <button
                        onClick={() => setTimelineMode("stasiun")}
                        className={`flex items-center gap-1 px-2.5 py-1 text-[9px] font-black uppercase transition-colors ${
                            timelineMode === "stasiun" ? "bg-indigo-500 text-white" : "bg-white text-zinc-400 hover:bg-zinc-50"
                        }`}
                    >
                        <Building2 className="h-3 w-3" /> Stasiun
                    </button>
                </div>

                {!isStasiunMode && (
                    <div className="flex items-center gap-1.5">
                        <ArrowLeftRight className="h-3.5 w-3.5 text-zinc-400" />
                        <span className="text-[9px] font-bold text-zinc-400">Drag blok bebas</span>
                    </div>
                )}
            </div>

            {/* Scrollable canvas */}
            <div ref={scrollRef} className="flex-1 overflow-auto select-none">
                <div style={{ minWidth: chartWidth + LABEL_WIDTH, minHeight: chartHeight }} className="relative">

                    {/* ── Left sidebar ── */}
                    <div className="absolute left-0 top-0 bg-white border-r border-zinc-200 z-20" style={{ width: LABEL_WIDTH, height: chartHeight }}>
                        <div className="border-b border-zinc-200 flex items-end px-3 pb-1" style={{ height: HEADER_HEIGHT }}>
                            <span className="text-[8px] font-black uppercase tracking-widest text-zinc-400">
                                {isStasiunMode ? "Stasiun" : "Jalur"}
                            </span>
                        </div>
                        {Array.from({ length: displayRows }, (_, i) => {
                            const isNew = i >= totalRows
                            const isGhostTarget = !isStasiunMode && drag?.active && ghostRow === i
                            return (
                                <div
                                    key={i}
                                    className={`flex items-center px-3 transition-colors duration-100 ${
                                        isGhostTarget ? "bg-indigo-50 border-b border-indigo-200" :
                                        isNew ? "border-b border-dashed border-zinc-200" :
                                        "border-b border-zinc-100"
                                    }`}
                                    style={{ height: ROW_HEIGHT + ROW_GAP }}
                                >
                                    <span className={`text-[10px] font-bold truncate ${
                                        isGhostTarget ? "text-indigo-600" : isNew ? "text-zinc-300" : "text-zinc-400"
                                    }`}>
                                        {isNew ? (isStasiunMode ? "" : "+ Jalur Baru")
                                            : isStasiunMode ? (stasiunRowLabels[i] || `Stasiun ${i + 1}`)
                                            : `Jalur ${i + 1}`}
                                    </span>
                                </div>
                            )
                        })}
                        {/* Static "+ Drag ke sini" hint — only in jalur mode */}
                        {!isStasiunMode && !(drag?.active && ghostRow >= totalRows) && steps.length > 0 && (
                            <div className="flex items-center px-3 text-zinc-300" style={{ height: ROW_HEIGHT + ROW_GAP }}>
                                <span className="text-[10px] font-bold">+ Drag ke sini</span>
                            </div>
                        )}
                    </div>

                    {/* ── Chart area ── */}
                    <div className="absolute top-0" style={{ left: LABEL_WIDTH, right: 0, height: chartHeight }}>

                        {/* Time ruler */}
                        <div className="border-b border-zinc-200 relative bg-zinc-50/80" style={{ height: HEADER_HEIGHT }}>
                            {ticks.map((t) => (
                                <div key={t.minute} className="absolute bottom-0 flex flex-col items-center" style={{ left: t.minute * PIXELS_PER_MINUTE }}>
                                    <span className="text-[8px] font-mono font-bold text-zinc-400 mb-0.5 whitespace-nowrap">{t.label}</span>
                                    <div className="w-px h-1.5 bg-zinc-300" />
                                </div>
                            ))}
                        </div>

                        {/* Grid lines */}
                        {ticks.map((t) => (
                            <div key={`g-${t.minute}`} className="absolute border-l border-zinc-100/80" style={{ left: t.minute * PIXELS_PER_MINUTE, top: HEADER_HEIGHT, bottom: 0 }} />
                        ))}

                        {/* Row backgrounds */}
                        {Array.from({ length: displayRows + 1 }, (_, i) => {
                            const isGhostTarget = drag?.active && ghostRow === i
                            const isNew = i >= totalRows
                            return (
                                <div
                                    key={`rb-${i}`}
                                    className={`absolute w-full transition-colors duration-100 ${
                                        isGhostTarget ? "bg-indigo-50/40 border-b border-indigo-200" :
                                        isNew ? "border-b border-dashed border-zinc-100" :
                                        `border-b border-zinc-100 ${i % 2 === 1 ? "bg-zinc-50/30" : "bg-white"}`
                                    }`}
                                    style={{ top: HEADER_HEIGHT + i * (ROW_HEIGHT + ROW_GAP), height: ROW_HEIGHT + ROW_GAP }}
                                />
                            )
                        })}

                        {/* ── Snap guide line (vertical) while dragging ── */}
                        {drag?.active && ghostStartMin >= 0 && (
                            <div
                                className="absolute top-0 bottom-0 border-l border-dashed border-indigo-300 z-30 pointer-events-none"
                                style={{ left: ghostStartMin * PIXELS_PER_MINUTE }}
                            />
                        )}

                        {/* ── Bars ── */}
                        {bars.map((bar) => {
                            const st = bar.step.station?.stationType || "OTHER"
                            const c = STATION_COLORS[st] || STATION_COLORS.OTHER
                            const Icon = STATION_ICONS[st] || Cog
                            const isSelected = bar.step.id === selectedStepId
                            const isDragging = drag?.active && drag.stepId === bar.step.id
                            const barWidth = Math.max(bar.durationMin * PIXELS_PER_MINUTE, 60)

                            const displayWidth = barWidth

                            const progress = totalQty > 0 ? Math.min(100, ((bar.step.completedQty || 0) / totalQty) * 100) : 0

                            return (
                                <div key={bar.step.id}>
                                    {/* Static bar (fades when move-dragging) */}
                                    <div
                                        onPointerDown={(e) => onPointerDown(e, bar.step.id)}
                                        className={`absolute rounded-md cursor-grab active:cursor-grabbing transition-shadow ${
                                            isDragging ? "opacity-20" :
                                            isSelected ? "ring-2 ring-offset-1 ring-orange-400 shadow-md z-20" :
                                            "shadow-sm hover:shadow-md z-10"
                                        }`}
                                        style={{
                                            left: bar.startMin * PIXELS_PER_MINUTE,
                                            top: rowY(bar.row),
                                            width: displayWidth,
                                            height: ROW_HEIGHT,
                                            background: c.bg,
                                            borderLeft: `3px solid ${c.accent}`,
                                        }}
                                    >
                                        {progress > 0 && (
                                            <div className="absolute inset-0 rounded-r-md opacity-15" style={{ width: `${progress}%`, background: c.accent }} />
                                        )}
                                        <div className="relative h-full flex items-center gap-2 pl-2.5 pr-5 overflow-hidden">
                                            <Icon className="h-3.5 w-3.5 shrink-0" style={{ color: c.text }} />
                                            <div className="min-w-0 flex-1">
                                                <p className="text-[11px] font-bold truncate" style={{ color: c.text }}>{bar.step.station?.name || "—"}</p>
                                                <p className="text-[9px] font-mono opacity-60" style={{ color: c.text }}>{fmtDuration(bar.durationMin)}/pcs</p>
                                            </div>
                                            {bar.step.station?.operationType === "SUBCONTRACTOR" && (
                                                <span className="text-[7px] font-bold bg-amber-100 text-amber-700 px-1 py-0.5 rounded shrink-0">SUB</span>
                                            )}
                                        </div>
                                    </div>

                                    {/* Ghost bar during move drag */}
                                    {isDragging && (
                                        <div
                                            className="absolute rounded-md shadow-lg ring-2 ring-indigo-400 pointer-events-none z-50"
                                            style={{
                                                left: ghostStartMin * PIXELS_PER_MINUTE,
                                                top: rowY(drag.barLayout.row) + (drag.currentY - drag.startY),
                                                width: barWidth,
                                                height: ROW_HEIGHT,
                                                background: c.bg,
                                                borderLeft: `3px solid ${c.accent}`,
                                                opacity: 0.92,
                                            }}
                                        >
                                            <div className="relative h-full flex items-center gap-2 pl-2.5 pr-4 overflow-hidden">
                                                <Icon className="h-3.5 w-3.5 shrink-0" style={{ color: c.text }} />
                                                <div className="min-w-0 flex-1">
                                                    <p className="text-[11px] font-bold truncate" style={{ color: c.text }}>{bar.step.station?.name || "—"}</p>
                                                    <p className="text-[9px] font-mono" style={{ color: c.text }}>
                                                        {fmtDuration(ghostStartMin)} — {fmtDuration(ghostStartMin + bar.durationMin)}
                                                    </p>
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )
                        })}

                        {/* End marker */}
                        <div className="absolute top-0 bottom-0 z-20" style={{ left: totalMinutes * PIXELS_PER_MINUTE }}>
                            <div className="w-px h-full bg-emerald-300/50" />
                            <div className="absolute top-0 -left-px bg-emerald-500 text-white text-[7px] font-bold px-1.5 py-0.5 rounded-b whitespace-nowrap">
                                {fmtDuration(totalMinutes)}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}
