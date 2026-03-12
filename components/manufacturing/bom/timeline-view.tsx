"use client"

import { useMemo, useState, useCallback, useRef, useEffect } from "react"
import {
    Scissors, Shirt, Droplets, Printer, Sparkles,
    ShieldCheck, Package, Wrench, Cog, Clock, Building2, ArrowLeftRight,
} from "lucide-react"
import { getIconByName, getColorTheme } from "./station-config"

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

/* Helper: get colors for a step, using stored colorTheme for OTHER types */
function getStepColors(step: any) {
    const st = step.station?.stationType || "OTHER"
    if (st === "OTHER" && step.station?.colorTheme) {
        return getColorTheme(step.station.colorTheme).hex
    }
    return STATION_COLORS[st] || STATION_COLORS.OTHER
}

/* Helper: get icon for a step, using stored iconName for OTHER types */
function getStepIcon(step: any) {
    const st = step.station?.stationType || "OTHER"
    if (st === "OTHER" && step.station?.iconName) {
        return getIconByName(step.station.iconName)
    }
    return STATION_ICONS[st] || Cog
}

/* ── Types ── */
interface TimelineViewProps {
    steps: any[]
    totalQty: number
    selectedStepId: string | null
    onStepSelect: (stepId: string | null) => void
    onMoveStep?: (stepId: string, startOffsetMinutes: number, lane?: number) => void
    criticalStepIds?: Set<string>
}

interface BarLayout {
    step: any
    row: number
    startMin: number
    durationMin: number       // total = perPcs × qty
    durationPerPcs: number    // original per-piece
}

/* ── Constants ── */
const MIN_BAR_MINUTES = 20
const PIXELS_PER_MINUTE = 4
const ROW_HEIGHT = 44
const ROW_GAP = 6
const HEADER_HEIGHT = 36
const LABEL_WIDTH = 120
const SNAP_MINUTES = 5

/* ── Per-step scheduling ──
 * Each process step gets its own row, labeled with station name.
 * Two steps using the same station still appear as separate rows.
 * Duration = durationMinutes × totalQty (total production time).
 */
function scheduleByStation(steps: any[], totalQty: number): { bars: BarLayout[]; totalMinutes: number; totalRows: number; rowLabels: string[] } {
    if (steps.length === 0) return { bars: [], totalMinutes: 0, totalRows: 0, rowLabels: [] }

    const qty = Math.max(totalQty, 1)
    const getDuration = (step: any) => Math.max((step.durationMinutes || 0) * qty, MIN_BAR_MINUTES)
    const getPerPcs = (step: any) => step.durationMinutes || 0

    // Compute start times (DAG logic)
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

    // Each step = own row, labeled with station name
    const rowLabels: string[] = []
    const bars: BarLayout[] = []
    for (let i = 0; i < sorted.length; i++) {
        const step = sorted[i]
        const stationName = step.station?.name || `Proses ${i + 1}`
        rowLabels.push(stationName)
        const start = startTimes.get(step.id) || 0
        const duration = getDuration(step)
        bars.push({ step, row: i, startMin: start, durationMin: duration, durationPerPcs: getPerPcs(step) })
    }

    const totalMinutes = endTimes.size > 0 ? Math.max(...endTimes.values(), MIN_BAR_MINUTES) : MIN_BAR_MINUTES
    return { bars, totalMinutes, totalRows: Math.max(sorted.length, 1), rowLabels }
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
    currentX: number
    barLayout: BarLayout
    active: boolean
}

function rowY(row: number) {
    return HEADER_HEIGHT + row * (ROW_HEIGHT + ROW_GAP) + ROW_GAP / 2
}

/* ═══════════════════ COMPONENT ═══════════════════ */

export function TimelineView({
    steps, totalQty, selectedStepId, onStepSelect, onMoveStep, criticalStepIds,
}: TimelineViewProps) {
    const { bars, totalMinutes, totalRows, rowLabels } = useMemo(() => scheduleByStation(steps, totalQty), [steps, totalQty])

    // Per-piece total: sum of all step durations without multiplying by qty
    const totalPerPcsMinutes = useMemo(() => bars.reduce((sum, b) => sum + b.durationPerPcs, 0), [bars])

    const ticks = useMemo(() => generateTicks(totalMinutes), [totalMinutes])
    const scrollRef = useRef<HTMLDivElement>(null)

    /* ── Drag state ── */
    const [drag, setDrag] = useState<DragState | null>(null)

    const ghostStartMin = useMemo(() => {
        if (!drag?.active) return -1
        const dx = drag.currentX - drag.startX
        const rawMin = drag.barLayout.startMin + dx / PIXELS_PER_MINUTE
        return Math.max(0, Math.round(rawMin / SNAP_MINUTES) * SNAP_MINUTES)
    }, [drag])

    const displayRows = totalRows
    const chartWidth = Math.max((totalMinutes + 30) * PIXELS_PER_MINUTE, 500)
    const chartHeight = displayRows * (ROW_HEIGHT + ROW_GAP) + HEADER_HEIGHT + ROW_HEIGHT + ROW_GAP

    /* ── Pointer handlers ── */
    const onPointerDown = useCallback((e: React.PointerEvent, stepId: string) => {
        e.preventDefault()
        e.stopPropagation()
        const bar = bars.find(b => b.step.id === stepId)
        if (!bar) return
        setDrag({ stepId, barLayout: bar, startX: e.clientX, currentX: e.clientX, active: false })
    }, [bars])

    const dragRef = useRef<DragState | null>(null)
    dragRef.current = drag

    // Store callbacks in refs to avoid re-registering listeners
    const onMoveStepRef = useRef(onMoveStep)
    onMoveStepRef.current = onMoveStep
    const onStepSelectRef = useRef(onStepSelect)
    onStepSelectRef.current = onStepSelect

    useEffect(() => {
        if (!drag) return

        const onMove = (e: PointerEvent) => {
            setDrag(prev => {
                if (!prev) return null
                const dx = e.clientX - prev.startX
                const active = prev.active || Math.abs(dx) > 4
                return { ...prev, currentX: e.clientX, active }
            })
        }

        const onUp = () => {
            const prev = dragRef.current
            setDrag(null)
            if (!prev) return

            if (!prev.active) {
                onStepSelectRef.current(prev.stepId)
                return
            }

            if (onMoveStepRef.current) {
                const dx = prev.currentX - prev.startX
                const rawMin = prev.barLayout.startMin + dx / PIXELS_PER_MINUTE
                const snappedMin = Math.max(0, Math.round(rawMin / SNAP_MINUTES) * SNAP_MINUTES)
                if (snappedMin !== prev.barLayout.startMin) {
                    onMoveStepRef.current(prev.stepId, snappedMin)
                }
            }
        }

        window.addEventListener("pointermove", onMove)
        window.addEventListener("pointerup", onUp)
        return () => {
            window.removeEventListener("pointermove", onMove)
            window.removeEventListener("pointerup", onUp)
        }
    }, [!!drag])

    // Compute per-step targets for progress (split among parallel siblings)
    const stepTargets = useMemo(() => {
        const targets = new Map<string, number>()
        for (const step of steps) {
            const allocs = step.allocations || []
            const allocTotal = allocs.reduce((s: number, a: any) => s + (a.quantity || 0), 0)
            if (allocTotal > 0) {
                targets.set(step.id, allocTotal)
            } else {
                const stationType = step.station?.stationType
                const siblings = stationType ? steps.filter((s: any) => s.station?.stationType === stationType) : [step]
                if (siblings.length > 1) {
                    const idx = siblings.indexOf(step)
                    const share = Math.floor(totalQty / siblings.length)
                    const remainder = totalQty % siblings.length
                    targets.set(step.id, share + (idx < remainder ? 1 : 0))
                } else {
                    targets.set(step.id, totalQty)
                }
            }
        }
        return targets
    }, [steps, totalQty])

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
                    <span className="text-[9px] font-black uppercase text-zinc-400">Total Waktu:</span>
                    <span className="text-xs font-black text-indigo-700">{fmtDuration(totalMinutes)}</span>
                </div>
                <div className="flex items-center gap-1.5">
                    <Clock className="h-3.5 w-3.5 text-violet-400" />
                    <span className="text-[9px] font-black uppercase text-zinc-400">Waktu/pcs:</span>
                    <span className="text-xs font-black text-violet-600">{fmtDuration(totalPerPcsMinutes)}</span>
                </div>
                <div className="flex items-center gap-1.5">
                    <Building2 className="h-3.5 w-3.5 text-blue-500" />
                    <span className="text-[9px] font-black uppercase text-zinc-400">Work Center:</span>
                    <span className="text-xs font-black text-blue-700">{totalRows}</span>
                </div>
                <div className="flex items-center gap-1.5 ml-auto">
                    <ArrowLeftRight className="h-3.5 w-3.5 text-zinc-400" />
                    <span className="text-[9px] font-bold text-zinc-400">Drag blok untuk atur waktu</span>
                </div>
            </div>

            {/* Scrollable canvas */}
            <div ref={scrollRef} className="flex-1 overflow-auto select-none">
                <div style={{ minWidth: chartWidth + LABEL_WIDTH, minHeight: chartHeight }} className="relative">

                    {/* ── Left sidebar ── */}
                    <div className="absolute left-0 top-0 bg-white border-r border-zinc-200 z-20" style={{ width: LABEL_WIDTH, height: chartHeight }}>
                        <div className="border-b border-zinc-200 flex items-end px-3 pb-1" style={{ height: HEADER_HEIGHT }}>
                            <span className="text-[8px] font-black uppercase tracking-widest text-zinc-400">Work Center</span>
                        </div>
                        {Array.from({ length: displayRows }, (_, i) => (
                            <div
                                key={i}
                                className="flex items-center px-3 border-b border-zinc-100"
                                style={{ height: ROW_HEIGHT + ROW_GAP }}
                            >
                                <span className="text-[10px] font-bold truncate text-zinc-400">
                                    {rowLabels[i] || `Work Center ${i + 1}`}
                                </span>
                            </div>
                        ))}
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
                        {Array.from({ length: displayRows }, (_, i) => (
                            <div
                                key={`rb-${i}`}
                                className={`absolute w-full border-b border-zinc-100 ${i % 2 === 1 ? "bg-zinc-50/30" : "bg-white"}`}
                                style={{ top: HEADER_HEIGHT + i * (ROW_HEIGHT + ROW_GAP), height: ROW_HEIGHT + ROW_GAP }}
                            />
                        ))}

                        {/* ── Snap guide line while dragging ── */}
                        {drag?.active && ghostStartMin >= 0 && (
                            <div
                                className="absolute top-0 bottom-0 border-l border-dashed border-indigo-300 z-30 pointer-events-none"
                                style={{ left: ghostStartMin * PIXELS_PER_MINUTE }}
                            />
                        )}

                        {/* ── Bars ── */}
                        {bars.map((bar) => {
                            const c = getStepColors(bar.step)
                            const Icon = getStepIcon(bar.step)
                            const isSelected = bar.step.id === selectedStepId
                            const isDragging = drag?.active && drag.stepId === bar.step.id
                            const isCritical = criticalStepIds?.has(bar.step.id) ?? true // default true when no criticalStepIds
                            const barWidth = Math.max(bar.durationMin * PIXELS_PER_MINUTE, 60)
                            const stepTarget = stepTargets.get(bar.step.id) || totalQty
                            const progress = stepTarget > 0 ? Math.min(100, ((bar.step.completedQty || 0) / stepTarget) * 100) : 0

                            return (
                                <div key={bar.step.id}>
                                    {/* Static bar */}
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
                                            width: barWidth,
                                            height: ROW_HEIGHT,
                                            background: isCritical
                                                ? c.bg
                                                : `repeating-linear-gradient(45deg, ${c.bg}, ${c.bg} 4px, rgba(0,0,0,0.04) 4px, rgba(0,0,0,0.04) 8px)`,
                                            borderLeft: `3px solid ${isCritical ? c.accent : "#a1a1aa"}`,
                                        }}
                                    >
                                        {/* Progress fill */}
                                        {progress > 0 && (
                                            <div className="absolute inset-0 rounded-r-md opacity-15" style={{ width: `${progress}%`, background: c.accent }} />
                                        )}
                                        <div className="relative h-full flex items-center gap-2 pl-2.5 pr-5 overflow-hidden">
                                            <Icon className="h-3.5 w-3.5 shrink-0" style={{ color: isCritical ? c.text : "#a1a1aa" }} />
                                            <div className="min-w-0 flex-1">
                                                <div className="flex items-center gap-1">
                                                {isCritical && <span className="text-amber-500 text-[9px] leading-none shrink-0">⚡</span>}
                                                <p className="text-[11px] font-bold truncate" style={{ color: isCritical ? c.text : "#a1a1aa" }}>{bar.step.station?.name || "—"}</p>
                                                </div>
                                                <p className="text-[9px] font-mono opacity-60" style={{ color: c.text }}>
                                                    {bar.durationPerPcs > 0 && totalQty > 1
                                                        ? `${fmtDuration(bar.durationPerPcs)}/pcs × ${totalQty} = ${fmtDuration(bar.durationMin)}`
                                                        : fmtDuration(bar.durationMin)
                                                    }
                                                </p>
                                            </div>
                                            {progress > 0 && (
                                                <span className="text-[8px] font-black shrink-0" style={{ color: c.text }}>{Math.round(progress)}%</span>
                                            )}
                                            {bar.step.station?.operationType === "SUBCONTRACTOR" && (
                                                <span className="text-[7px] font-bold bg-amber-100 text-amber-700 px-1 py-0.5 rounded shrink-0">SUB</span>
                                            )}
                                        </div>
                                    </div>

                                    {/* Ghost bar during drag */}
                                    {isDragging && (
                                        <div
                                            className="absolute rounded-md shadow-lg ring-2 ring-indigo-400 pointer-events-none z-50"
                                            style={{
                                                left: ghostStartMin * PIXELS_PER_MINUTE,
                                                top: rowY(bar.row),
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
