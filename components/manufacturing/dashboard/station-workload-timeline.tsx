"use client"

import { useMemo, useRef, useState, useEffect, useCallback } from "react"
import { useQuery } from "@tanstack/react-query"
import { queryKeys } from "@/lib/query-keys"
import {
    Scissors, Shirt, Droplets, Printer, Sparkles,
    ShieldCheck, Package, Wrench, Cog, Clock, Building2,
    Layers, ChevronRight, ChevronDown, Loader2,
    ArrowRight, Factory,
} from "lucide-react"
import { formatIDR } from "@/lib/utils"

/* ── Station visuals (shared with timeline-view) ── */
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

const PRODUCT_COLORS = [
    { bg: "#dbeafe", border: "#3b82f6", text: "#1e40af" },
    { bg: "#fce7f3", border: "#ec4899", text: "#9d174d" },
    { bg: "#d1fae5", border: "#10b981", text: "#065f46" },
    { bg: "#fef3c7", border: "#f59e0b", text: "#92400e" },
    { bg: "#e0e7ff", border: "#6366f1", text: "#3730a3" },
    { bg: "#fae8ff", border: "#d946ef", text: "#86198f" },
    { bg: "#ccfbf1", border: "#14b8a6", text: "#134e4a" },
    { bg: "#fee2e2", border: "#ef4444", text: "#991b1b" },
]

/* ── Constants ── */
const PIXELS_PER_MINUTE = 3
const ROW_HEIGHT = 52
const ROW_GAP = 4
const HEADER_HEIGHT = 40
const LABEL_WIDTH = 160
const MIN_BAR_WIDTH = 80

/* ── Types ── */
interface StepWithContext {
    id: string
    bomId: string
    productName: string
    productCode: string
    totalQty: number
    stationId: string
    station: {
        id: string; code: string; name: string
        stationType: string; operationType: string
        costPerUnit: number
        subcontractor?: { id: string; name: string } | null
    }
    sequence: number
    durationMinutes: number | null
    parentStepIds: string[]
    startOffsetMinutes: number
    completedQty: number
    useSubkon: boolean | null
    operatorName: string | null
    activeWorkOrders: number
    workOrderStatus: string | null
    allocations: any[]
}

interface BarLayout {
    step: StepWithContext
    row: number
    startMin: number
    durationMin: number
    productIndex: number
}

/* ── Helpers ── */
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

function rowY(row: number) {
    return HEADER_HEIGHT + row * (ROW_HEIGHT + ROW_GAP) + ROW_GAP / 2
}

/* ── Schedule all steps across BOMs, grouped by station ── */
function scheduleAllByStation(steps: StepWithContext[]): {
    bars: BarLayout[]; totalMinutes: number; totalRows: number
    rowLabels: { name: string; stationType: string; operationType: string; subName?: string }[]
    productNames: string[]
} {
    if (steps.length === 0) return { bars: [], totalMinutes: 0, totalRows: 0, rowLabels: [], productNames: [] }

    // Unique products (for color coding)
    const productNames = Array.from(new Set(steps.map(s => s.productName)))
    const productIndexMap = new Map<string, number>()
    productNames.forEach((name, i) => productIndexMap.set(name, i))

    // Per-BOM DAG scheduling (compute start/end per step within its BOM)
    const bomGroups = new Map<string, StepWithContext[]>()
    for (const step of steps) {
        const arr = bomGroups.get(step.bomId) || []
        arr.push(step)
        bomGroups.set(step.bomId, arr)
    }

    const endTimes = new Map<string, number>()
    const startTimes = new Map<string, number>()

    for (const [, bomSteps] of bomGroups) {
        const sorted = [...bomSteps].sort((a, b) => a.sequence - b.sequence)
        const qty = Math.max(sorted[0]?.totalQty || 1, 1)

        for (const step of sorted) {
            const dur = Math.max((step.durationMinutes || 0) * qty, 20)
            const parentEnds = (step.parentStepIds || []).map((pid: string) => endTimes.get(pid) || 0)
            const dagStart = parentEnds.length > 0 ? Math.max(...parentEnds) : 0
            const offset = step.startOffsetMinutes || 0
            const start = offset > 0 ? offset : dagStart
            startTimes.set(step.id, start)
            endTimes.set(step.id, start + dur)
        }
    }

    // Group by station
    const stationOrder: string[] = []
    const stationMeta: Record<string, { name: string; stationType: string; operationType: string; subName?: string }> = {}

    for (const step of steps) {
        const sid = step.stationId || step.station?.id
        if (!stationOrder.includes(sid)) {
            stationOrder.push(sid)
            stationMeta[sid] = {
                name: step.station?.name || `Station`,
                stationType: step.station?.stationType || "OTHER",
                operationType: step.station?.operationType || "IN_HOUSE",
                subName: step.station?.subcontractor?.name,
            }
        }
    }

    // Sort stations by type then name
    stationOrder.sort((a, b) => {
        const typeA = stationMeta[a].stationType
        const typeB = stationMeta[b].stationType
        if (typeA !== typeB) return typeA.localeCompare(typeB)
        return stationMeta[a].name.localeCompare(stationMeta[b].name)
    })

    // Build bars — within each station row, stack overlapping bars vertically
    // For simplicity: one sub-row per BOM on the same station
    const bars: BarLayout[] = []
    for (const step of steps) {
        const sid = step.stationId || step.station?.id
        const row = stationOrder.indexOf(sid)
        const qty = Math.max(step.totalQty, 1)
        const dur = Math.max((step.durationMinutes || 0) * qty, 20)
        const start = startTimes.get(step.id) || 0
        const productIndex = productIndexMap.get(step.productName) || 0
        bars.push({ step, row, startMin: start, durationMin: dur, productIndex })
    }

    const totalMinutes = endTimes.size > 0 ? Math.max(...endTimes.values(), 20) : 20
    const rowLabels = stationOrder.map(sid => stationMeta[sid])

    return { bars, totalMinutes, totalRows: stationOrder.length, rowLabels, productNames }
}

/* ═══════════════════ COMPONENT ═══════════════════ */

export function StationWorkloadTimeline() {
    const { data, isLoading, error } = useQuery({
        queryKey: queryKeys.manufacturing.stationWorkload(),
        queryFn: async () => {
            const res = await fetch("/api/manufacturing/station-workload")
            const json = await res.json()
            if (!json.success) throw new Error(json.error)
            return json.data as {
                steps: StepWithContext[]
                stations: any[]
                boms: { id: string; productName: string; productCode: string; version: string; totalQty: number; stepCount: number; hasActiveWO: boolean }[]
                bomCount: number
                totalSteps: number
            }
        },
    })

    // BOM filter state — empty = show all
    const [selectedBomIds, setSelectedBomIds] = useState<Set<string>>(new Set())

    const toggleBom = (bomId: string) => {
        setSelectedBomIds(prev => {
            const next = new Set(prev)
            next.has(bomId) ? next.delete(bomId) : next.add(bomId)
            return next
        })
        setSelectedBar(null)
    }

    const selectAllBoms = () => setSelectedBomIds(new Set())

    const allSteps = data?.steps || []
    const steps = useMemo(() => {
        if (selectedBomIds.size === 0) return allSteps
        return allSteps.filter(s => selectedBomIds.has(s.bomId))
    }, [allSteps, selectedBomIds])

    const { bars, totalMinutes, totalRows, rowLabels, productNames } = useMemo(
        () => scheduleAllByStation(steps), [steps]
    )

    const ticks = useMemo(() => generateTicks(totalMinutes), [totalMinutes])
    const scrollRef = useRef<HTMLDivElement>(null)

    // Detail popup
    const [selectedBar, setSelectedBar] = useState<BarLayout | null>(null)

    // Collapsed rows
    const [collapsedRows, setCollapsedRows] = useState<Set<number>>(new Set())
    const toggleRow = (row: number) => {
        setCollapsedRows(prev => {
            const next = new Set(prev)
            next.has(row) ? next.delete(row) : next.add(row)
            return next
        })
    }

    const chartWidth = Math.max((totalMinutes + 30) * PIXELS_PER_MINUTE, 600)
    const chartHeight = totalRows * (ROW_HEIGHT + ROW_GAP) + HEADER_HEIGHT + ROW_HEIGHT

    // KPI summaries (reflect filtered steps)
    const totalBoms = selectedBomIds.size > 0 ? selectedBomIds.size : (data?.bomCount || 0)
    const totalStepsCount = steps.length
    const stationsWithWork = new Set(steps.map(s => s.stationId)).size
    const inProgressSteps = steps.filter(s => s.workOrderStatus === "IN_PROGRESS").length

    if (isLoading) {
        return (
            <div className="border-2 border-black shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] bg-white flex items-center justify-center py-20">
                <Loader2 className="h-5 w-5 animate-spin text-zinc-400 mr-2" />
                <span className="text-xs font-bold uppercase tracking-widest text-zinc-400">Memuat beban kerja stasiun...</span>
            </div>
        )
    }

    if (error) {
        return (
            <div className="border-2 border-black shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] bg-white">
                <div className="px-6 py-4 border-b-2 border-black bg-zinc-50 flex items-center gap-3 border-l-[6px] border-l-red-400">
                    <Factory className="h-5 w-5 text-red-600" />
                    <h2 className="text-lg font-black uppercase tracking-tight">Timeline Work Center</h2>
                </div>
                <div className="px-6 py-8 text-center text-red-500 text-xs font-bold">
                    Gagal memuat data: {(error as Error).message}
                </div>
            </div>
        )
    }

    if (allSteps.length === 0) {
        return (
            <div className="border-2 border-black shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] bg-white">
                <div className="px-6 py-4 border-b-2 border-black bg-zinc-50 flex items-center gap-3 border-l-[6px] border-l-emerald-400">
                    <Factory className="h-5 w-5 text-emerald-600" />
                    <h2 className="text-lg font-black uppercase tracking-tight">Timeline Work Center</h2>
                </div>
                <div className="flex items-center justify-center py-16 text-zinc-400 text-xs font-bold uppercase tracking-widest">
                    Belum ada BOM aktif dengan proses — buat BOM terlebih dahulu
                </div>
            </div>
        )
    }

    return (
        <div className="border-2 border-black shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] bg-white overflow-hidden">
            {/* Header */}
            <div className="px-6 py-4 border-b-2 border-black bg-zinc-50 flex items-center justify-between border-l-[6px] border-l-emerald-400">
                <div className="flex items-center gap-3">
                    <Factory className="h-5 w-5 text-emerald-600" />
                    <div>
                        <h2 className="text-lg font-black uppercase tracking-tight">Timeline Work Center</h2>
                        <p className="text-zinc-400 text-[10px] font-medium mt-0.5">
                            Visualisasi beban kerja semua stasiun dari {totalBoms} BOM aktif
                        </p>
                    </div>
                </div>
            </div>

            {/* KPI strip */}
            <div className="border-b border-zinc-200 bg-white px-6 py-3 flex items-center gap-8">
                <div className="flex items-center gap-2">
                    <Layers className="h-4 w-4 text-indigo-500" />
                    <span className="text-[9px] font-black uppercase text-zinc-400">BOM Aktif:</span>
                    <span className="text-sm font-black text-indigo-700">{totalBoms}</span>
                </div>
                <div className="flex items-center gap-2">
                    <Building2 className="h-4 w-4 text-blue-500" />
                    <span className="text-[9px] font-black uppercase text-zinc-400">Stasiun Aktif:</span>
                    <span className="text-sm font-black text-blue-700">{stationsWithWork}</span>
                </div>
                <div className="flex items-center gap-2">
                    <Clock className="h-4 w-4 text-emerald-500" />
                    <span className="text-[9px] font-black uppercase text-zinc-400">Total Waktu:</span>
                    <span className="text-sm font-black text-emerald-700">{fmtDuration(totalMinutes)}</span>
                </div>
                <div className="flex items-center gap-2">
                    <ArrowRight className="h-4 w-4 text-amber-500" />
                    <span className="text-[9px] font-black uppercase text-zinc-400">Proses:</span>
                    <span className="text-sm font-black text-amber-700">{totalStepsCount}</span>
                    {inProgressSteps > 0 && (
                        <span className="text-[8px] font-black bg-green-100 text-green-700 px-1.5 py-0.5">{inProgressSteps} berjalan</span>
                    )}
                </div>
            </div>

            {/* BOM filter chips */}
            <div className="border-b border-zinc-200 bg-zinc-50/50 px-6 py-2.5 flex items-center gap-2 flex-wrap">
                <span className="text-[9px] font-black uppercase text-zinc-400 mr-1 shrink-0">Pilih BOM:</span>
                <button
                    onClick={selectAllBoms}
                    className={`h-7 text-[10px] font-bold px-2.5 border-2 transition-all inline-flex items-center ${
                        selectedBomIds.size === 0
                            ? "border-black bg-black text-white"
                            : "border-zinc-300 bg-white text-zinc-500 hover:border-zinc-400"
                    }`}
                >
                    Semua ({data?.boms?.length || 0})
                </button>
                {(data?.boms || []).map((bom, i) => {
                    const isSelected = selectedBomIds.has(bom.id)
                    const c = PRODUCT_COLORS[i % PRODUCT_COLORS.length]
                    return (
                        <button
                            key={bom.id}
                            onClick={() => toggleBom(bom.id)}
                            className={`h-7 text-[10px] font-bold px-2.5 border-2 transition-all inline-flex items-center gap-1.5 ${
                                isSelected
                                    ? "shadow-[2px_2px_0px_0px_rgba(0,0,0,0.3)]"
                                    : selectedBomIds.size === 0
                                        ? "border-zinc-200 bg-white hover:border-zinc-300"
                                        : "border-zinc-200 bg-white text-zinc-400 hover:border-zinc-300"
                            }`}
                            style={isSelected ? { borderColor: c.border, background: c.bg, color: c.text } : undefined}
                        >
                            <div className="w-2.5 h-2.5 rounded-sm border shrink-0" style={{ background: c.bg, borderColor: c.border }} />
                            {bom.productName}
                            <span className="text-[8px] opacity-60">({bom.stepCount} proses • {bom.totalQty} pcs)</span>
                            {bom.hasActiveWO && <span className="w-1.5 h-1.5 rounded-full bg-green-500 shrink-0" />}
                        </button>
                    )
                })}
            </div>

            {/* Timeline chart */}
            <div ref={scrollRef} className="overflow-auto select-none" style={{ maxHeight: 500 }}>
                <div style={{ minWidth: chartWidth + LABEL_WIDTH, minHeight: chartHeight }} className="relative">

                    {/* ── Left sidebar ── */}
                    <div className="absolute left-0 top-0 bg-white border-r-2 border-zinc-200 z-20" style={{ width: LABEL_WIDTH, height: chartHeight }}>
                        <div className="border-b border-zinc-200 flex items-end px-3 pb-1.5" style={{ height: HEADER_HEIGHT }}>
                            <span className="text-[8px] font-black uppercase tracking-widest text-zinc-400">Work Center</span>
                        </div>
                        {rowLabels.map((label, i) => {
                            const sc = STATION_COLORS[label.stationType] || STATION_COLORS.OTHER
                            const Icon = STATION_ICONS[label.stationType] || Cog
                            const stationBars = bars.filter(b => b.row === i)
                            return (
                                <div
                                    key={i}
                                    className="flex items-center gap-2 px-3 border-b border-zinc-100 cursor-pointer hover:bg-zinc-50 transition-colors"
                                    style={{ height: ROW_HEIGHT + ROW_GAP }}
                                    onClick={() => toggleRow(i)}
                                >
                                    <div className="w-6 h-6 rounded flex items-center justify-center shrink-0" style={{ background: sc.bg }}>
                                        <Icon className="h-3.5 w-3.5" style={{ color: sc.text }} />
                                    </div>
                                    <div className="min-w-0 flex-1">
                                        <p className="text-[10px] font-bold truncate text-zinc-700">{label.name}</p>
                                        <div className="flex items-center gap-1">
                                            <span className="text-[8px] font-mono text-zinc-400">{stationBars.length} proses</span>
                                            {label.operationType === "SUBCONTRACTOR" && (
                                                <span className="text-[7px] font-bold bg-amber-100 text-amber-700 px-1 py-0.5">SUB</span>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            )
                        })}
                    </div>

                    {/* ── Chart area ── */}
                    <div className="absolute top-0" style={{ left: LABEL_WIDTH, right: 0, height: chartHeight }}>

                        {/* Time ruler */}
                        <div className="border-b border-zinc-200 relative bg-zinc-50/80 sticky top-0 z-30" style={{ height: HEADER_HEIGHT }}>
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
                        {Array.from({ length: totalRows }, (_, i) => (
                            <div
                                key={`rb-${i}`}
                                className={`absolute w-full border-b border-zinc-100 ${i % 2 === 1 ? "bg-zinc-50/30" : "bg-white"}`}
                                style={{ top: HEADER_HEIGHT + i * (ROW_HEIGHT + ROW_GAP), height: ROW_HEIGHT + ROW_GAP }}
                            />
                        ))}

                        {/* ── Bars ── */}
                        {bars.map((bar) => {
                            const pc = PRODUCT_COLORS[bar.productIndex % PRODUCT_COLORS.length]
                            const st = bar.step.station?.stationType || "OTHER"
                            const sc = STATION_COLORS[st] || STATION_COLORS.OTHER
                            const Icon = STATION_ICONS[st] || Cog
                            const isSelected = selectedBar?.step.id === bar.step.id
                            const barWidth = Math.max(bar.durationMin * PIXELS_PER_MINUTE, MIN_BAR_WIDTH)
                            const qty = Math.max(bar.step.totalQty, 1)
                            const target = qty
                            const progress = target > 0 ? Math.min(100, ((bar.step.completedQty || 0) / target) * 100) : 0
                            const isInProgress = bar.step.workOrderStatus === "IN_PROGRESS"

                            return (
                                <div
                                    key={bar.step.id}
                                    onClick={() => setSelectedBar(isSelected ? null : bar)}
                                    className={`absolute cursor-pointer transition-all ${
                                        isSelected ? "ring-2 ring-offset-1 ring-orange-400 shadow-lg z-20" :
                                        "shadow-sm hover:shadow-md hover:brightness-[0.97] z-10"
                                    }`}
                                    style={{
                                        left: bar.startMin * PIXELS_PER_MINUTE,
                                        top: rowY(bar.row),
                                        width: barWidth,
                                        height: ROW_HEIGHT,
                                        background: pc.bg,
                                        borderLeft: `3px solid ${pc.border}`,
                                        borderRadius: 4,
                                    }}
                                >
                                    {/* Progress fill */}
                                    {progress > 0 && (
                                        <div className="absolute inset-0 rounded-r opacity-15" style={{ width: `${progress}%`, background: pc.border }} />
                                    )}

                                    {/* In-progress pulse */}
                                    {isInProgress && (
                                        <div className="absolute top-1 right-1 w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                                    )}

                                    <div className="relative h-full flex items-center gap-1.5 pl-2 pr-3 overflow-hidden">
                                        <Icon className="h-3 w-3 shrink-0" style={{ color: sc.text }} />
                                        <div className="min-w-0 flex-1">
                                            <p className="text-[10px] font-bold truncate" style={{ color: pc.text }}>
                                                {bar.step.productName}
                                            </p>
                                            <p className="text-[8px] font-mono opacity-70" style={{ color: pc.text }}>
                                                {fmtDuration(bar.durationMin)} • {qty} pcs
                                            </p>
                                        </div>
                                        {progress > 0 && (
                                            <span className="text-[8px] font-black shrink-0" style={{ color: pc.text }}>{Math.round(progress)}%</span>
                                        )}
                                    </div>
                                </div>
                            )
                        })}

                        {/* End marker */}
                        {totalMinutes > 0 && (
                            <div className="absolute top-0 bottom-0 z-20" style={{ left: totalMinutes * PIXELS_PER_MINUTE }}>
                                <div className="w-px h-full bg-emerald-300/50" />
                                <div className="absolute top-0 -left-px bg-emerald-500 text-white text-[7px] font-bold px-1.5 py-0.5 rounded-b whitespace-nowrap">
                                    {fmtDuration(totalMinutes)}
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Detail panel */}
            {selectedBar && (
                <div className="border-t-2 border-black bg-zinc-50 px-6 py-4">
                    <div className="flex items-start gap-6">
                        <div className="flex-1 space-y-1">
                            <h3 className="text-sm font-black text-zinc-900">{selectedBar.step.productName}</h3>
                            <p className="text-xs text-zinc-500">
                                Stasiun: <span className="font-bold text-zinc-700">{selectedBar.step.station?.name}</span>
                                {selectedBar.step.station?.subcontractor && (
                                    <span className="ml-2 text-amber-600 font-bold">({selectedBar.step.station.subcontractor.name})</span>
                                )}
                            </p>
                            {selectedBar.step.operatorName && (
                                <p className="text-xs text-zinc-500">Operator: <span className="font-bold text-zinc-700">{selectedBar.step.operatorName}</span></p>
                            )}
                        </div>
                        <div className="text-right space-y-1">
                            <p className="text-xs text-zinc-500">Durasi: <span className="font-black text-zinc-900">{fmtDuration(selectedBar.durationMin)}</span></p>
                            <p className="text-xs text-zinc-500">Qty: <span className="font-bold text-zinc-700">{selectedBar.step.totalQty} pcs</span></p>
                            <p className="text-xs text-zinc-500">
                                Progress: <span className="font-bold text-zinc-700">{selectedBar.step.completedQty || 0}/{selectedBar.step.totalQty}</span>
                            </p>
                            {selectedBar.step.activeWorkOrders > 0 && (
                                <p className="text-xs">
                                    <span className={`font-bold px-1.5 py-0.5 text-[9px] ${
                                        selectedBar.step.workOrderStatus === "IN_PROGRESS"
                                            ? "bg-green-100 text-green-700"
                                            : "bg-blue-100 text-blue-700"
                                    }`}>
                                        {selectedBar.step.workOrderStatus === "IN_PROGRESS" ? "Sedang Berjalan" : "Direncanakan"}
                                    </span>
                                </p>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
