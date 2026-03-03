"use client"

import { useMemo, useState, useCallback, useRef, useEffect } from "react"
import {
    Scissors, Shirt, Droplets, Printer, Sparkles,
    ShieldCheck, Package, Wrench, Cog, Clock, Users, ArrowLeftRight,
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
    onMoveStep?: (stepId: string, startOffsetMinutes: number) => void
    onUpdateDuration?: (stepId: string, durationMinutes: number) => void
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
        // Start at whichever is later: after parents finish, or the manual offset
        const start = Math.max(dagStart, offset)
        const duration = getDuration(step)
        startTimes.set(step.id, start)
        endTimes.set(step.id, start + duration)
    }

    const bars: BarLayout[] = []
    const rowOccupied: { end: number }[] = []

    for (const step of sorted) {
        const start = startTimes.get(step.id) || 0
        const duration = getDuration(step)
        let assignedRow = -1
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
type DragMode = "move" | "resize-right"

interface DragState {
    stepId: string
    mode: DragMode
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

export function TimelineView({
    steps, totalQty, selectedStepId, onStepSelect,
    onMoveStep, onUpdateDuration,
}: TimelineViewProps) {
    const { bars, totalMinutes, totalRows } = useMemo(() => scheduleSteps(steps), [steps])
    const ticks = useMemo(() => generateTicks(totalMinutes), [totalMinutes])
    const scrollRef = useRef<HTMLDivElement>(null)

    /* ── Drag state ── */
    const [drag, setDrag] = useState<DragState | null>(null)

    // Compute ghost position during move drag (snapped to grid)
    const ghostStartMin = useMemo(() => {
        if (!drag?.active || drag.mode !== "move") return -1
        const dx = drag.currentX - drag.startX
        const rawMin = drag.barLayout.startMin + dx / PIXELS_PER_MINUTE
        return Math.max(0, Math.round(rawMin / SNAP_MINUTES) * SNAP_MINUTES)
    }, [drag])

    // How many display rows (add one if ghost is below all existing rows)
    const ghostRow = useMemo(() => {
        if (!drag?.active || drag.mode !== "move") return -1
        const dy = drag.currentY - drag.startY
        const newY = rowY(drag.barLayout.row) + dy
        return Math.max(0, Math.round((newY - HEADER_HEIGHT - ROW_GAP / 2) / (ROW_HEIGHT + ROW_GAP)))
    }, [drag])

    const displayRows = drag?.active && drag.mode === "move" && ghostRow >= totalRows
        ? totalRows + 1 : totalRows

    const chartWidth = Math.max((totalMinutes + 30) * PIXELS_PER_MINUTE, 500)
    const chartHeight = displayRows * (ROW_HEIGHT + ROW_GAP) + HEADER_HEIGHT + ROW_HEIGHT + ROW_GAP

    /* ── Pointer handlers ── */
    const onPointerDown = useCallback((e: React.PointerEvent, stepId: string, mode: DragMode) => {
        e.preventDefault()
        e.stopPropagation()
        const bar = bars.find(b => b.step.id === stepId)
        if (!bar) return
        setDrag({
            stepId, mode, barLayout: bar,
            startX: e.clientX, startY: e.clientY,
            currentX: e.clientX, currentY: e.clientY,
            active: false,
        })
    }, [bars])

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

            if (prev.mode === "move" && onMoveStep) {
                const dx = prev.currentX - prev.startX
                const rawMin = prev.barLayout.startMin + dx / PIXELS_PER_MINUTE
                const snappedMin = Math.max(0, Math.round(rawMin / SNAP_MINUTES) * SNAP_MINUTES)
                if (snappedMin !== prev.barLayout.startMin) {
                    onMoveStep(prev.stepId, snappedMin)
                }
            } else if (prev.mode === "resize-right" && onUpdateDuration) {
                const dx = prev.currentX - prev.startX
                const deltaMin = Math.round((dx / PIXELS_PER_MINUTE) / SNAP_MINUTES) * SNAP_MINUTES
                const newDuration = Math.max(SNAP_MINUTES, prev.barLayout.durationMin + deltaMin)
                if (newDuration !== prev.barLayout.durationMin) {
                    onUpdateDuration(prev.stepId, newDuration)
                }
            }
        }

        window.addEventListener("pointermove", onMove)
        window.addEventListener("pointerup", onUp)
        return () => {
            window.removeEventListener("pointermove", onMove)
            window.removeEventListener("pointerup", onUp)
        }
    }, [!!drag, onMoveStep, onUpdateDuration, onStepSelect])

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
                <div className="flex items-center gap-1.5">
                    <ArrowLeftRight className="h-3.5 w-3.5 text-zinc-400" />
                    <span className="text-[9px] font-bold text-zinc-400">Drag blok bebas · Drag tepi kanan untuk durasi</span>
                </div>
            </div>

            {/* Scrollable canvas */}
            <div ref={scrollRef} className="flex-1 overflow-auto select-none">
                <div style={{ minWidth: chartWidth + LABEL_WIDTH, minHeight: chartHeight }} className="relative">

                    {/* ── Left sidebar ── */}
                    <div className="absolute left-0 top-0 bg-white border-r border-zinc-200 z-20" style={{ width: LABEL_WIDTH, height: chartHeight }}>
                        <div className="border-b border-zinc-200 flex items-end px-3 pb-1" style={{ height: HEADER_HEIGHT }}>
                            <span className="text-[8px] font-black uppercase tracking-widest text-zinc-400">Jalur</span>
                        </div>
                        {Array.from({ length: displayRows }, (_, i) => {
                            const isNew = i >= totalRows
                            const isGhostTarget = drag?.active && drag.mode === "move" && ghostRow === i
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
                                    <span className={`text-[10px] font-bold ${
                                        isGhostTarget ? "text-indigo-600" : isNew ? "text-zinc-300" : "text-zinc-400"
                                    }`}>
                                        {isNew ? "+ Jalur Baru" : `Jalur ${i + 1}`}
                                    </span>
                                </div>
                            )
                        })}
                        {/* Static "+ Drag ke sini" hint */}
                        {!(drag?.active && ghostRow >= totalRows) && (
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
                            const isGhostTarget = drag?.active && drag.mode === "move" && ghostRow === i
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
                        {drag?.active && drag.mode === "move" && ghostStartMin >= 0 && (
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

                            // Resize: show adjusted width live
                            const displayWidth = isDragging && drag?.mode === "resize-right"
                                ? Math.max(SNAP_MINUTES * PIXELS_PER_MINUTE, barWidth + (drag.currentX - drag.startX))
                                : barWidth

                            const progress = totalQty > 0 ? Math.min(100, ((bar.step.completedQty || 0) / totalQty) * 100) : 0

                            return (
                                <div key={bar.step.id}>
                                    {/* Static bar (fades when move-dragging) */}
                                    <div
                                        onPointerDown={(e) => onPointerDown(e, bar.step.id, "move")}
                                        className={`absolute rounded-md cursor-grab active:cursor-grabbing transition-shadow ${
                                            isDragging && drag?.mode === "move" ? "opacity-20" :
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
                                                <p className="text-[9px] font-mono opacity-60" style={{ color: c.text }}>{fmtDuration(bar.durationMin)}</p>
                                            </div>
                                            {bar.step.station?.operationType === "SUBCONTRACTOR" && (
                                                <span className="text-[7px] font-bold bg-amber-100 text-amber-700 px-1 py-0.5 rounded shrink-0">SUB</span>
                                            )}
                                        </div>
                                        {/* Right resize handle */}
                                        {onUpdateDuration && (
                                            <div
                                                onPointerDown={(e) => { e.stopPropagation(); onPointerDown(e, bar.step.id, "resize-right") }}
                                                className="absolute right-0 top-0 bottom-0 w-2.5 cursor-col-resize group/resize hover:bg-black/10 rounded-r-md"
                                            >
                                                <div className="absolute right-0.5 top-1/2 -translate-y-1/2 w-0.5 h-5 rounded-full bg-zinc-300 group-hover/resize:bg-zinc-500 transition-colors" />
                                            </div>
                                        )}
                                    </div>

                                    {/* Ghost bar during move drag */}
                                    {isDragging && drag?.mode === "move" && (
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
