"use client"

import { memo } from "react"
import { Handle, Position, type NodeProps } from "@xyflow/react"
import { Scissors, Shirt, Droplets, Printer, Sparkles, ShieldCheck, Package, Wrench, Cog, X, Trash2, Clock, Plus, User, Building2 } from "lucide-react"
import { getIconByName, getColorTheme } from "./station-config"

const STATION_ICONS: Record<string, any> = {
    CUTTING: Scissors, SEWING: Shirt, WASHING: Droplets,
    PRINTING: Printer, EMBROIDERY: Sparkles, QC: ShieldCheck,
    PACKING: Package, FINISHING: Wrench, OTHER: Cog,
}

export interface StationNodeData {
    station: any
    sequence: number
    materials: { bomItemId: string; materialName: string }[]
    materialCost: number
    durationMinutes: number | null
    completedQty?: number
    totalProductionQty?: number
    stepTarget?: number
    startedAt?: string | null
    useSubkon?: boolean
    allocations?: any[]
    operatorName?: string | null
    groupName?: string | null
    splitPct?: number
    onPctChange?: (newPct: number) => void
    isSelected: boolean
    isCritical?: boolean
    onRemoveMaterial: (bomItemId: string) => void
    onDrop: (bomItemId: string) => void
    onRemoveStep?: () => void
    onContextMenu?: (pos: { clientX: number; clientY: number }) => void
    onAddParallel?: () => void
    onAddSequential?: () => void
    [key: string]: unknown
}

function StationNodeComponent({ data }: NodeProps & { data: StationNodeData }) {
    const { station, sequence, materials, isSelected, onRemoveMaterial, onDrop, onRemoveStep } = data
    const Icon = station?.iconName
        ? getIconByName(station.iconName)
        : STATION_ICONS[station?.stationType] || Cog
    const isSubcon = data.useSubkon !== undefined ? data.useSubkon : station?.operationType === "SUBCONTRACTOR"
    const headerBg = isSubcon
        ? "bg-amber-50"
        : station?.colorTheme
            ? getColorTheme(station.colorTheme).toolbar.split(" ").find((c: string) => c.startsWith("bg-")) || "bg-emerald-50"
            : "bg-emerald-50"

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault()
        e.stopPropagation()
        e.currentTarget.classList.remove("ring-2", "ring-orange-400")
        const bomItemId = e.dataTransfer.getData("application/bom-item-id")
        if (bomItemId && onDrop) {
            onDrop(bomItemId)
        }
    }

    const hasProgress = ((data.completedQty ?? 0) > 0 || data.startedAt) && (data.stepTarget ?? data.totalProductionQty ?? 0) > 0
    const progressTarget = data.stepTarget || data.totalProductionQty || 1
    const progressPct = Math.min(100, ((data.completedQty || 0) / progressTarget) * 100)

    // Work center display name with code
    const wcName = station?.name || "—"
    const wcCode = station?.code || ""

    return (
        <div
            className={`group relative bg-white border-2 ${isSelected ? "border-orange-500 shadow-[4px_4px_0px_0px_rgba(249,115,22,1)]" : data.isCritical ? "border-amber-500 shadow-[3px_3px_0px_0px_rgba(245,158,11,1)]" : "border-black shadow-[3px_3px_0px_0px_rgba(0,0,0,1)]"} w-[260px] transition-all`}
            onContextMenu={(e) => { e.preventDefault(); e.stopPropagation(); data.onContextMenu?.({ clientX: e.clientX, clientY: e.clientY }) }}
            onDragOver={(e) => { e.preventDefault(); e.currentTarget.classList.add("ring-2", "ring-orange-400") }}
            onDragLeave={(e) => { e.currentTarget.classList.remove("ring-2", "ring-orange-400") }}
            onDrop={handleDrop}
        >
            <Handle type="target" position={Position.Left} className="!bg-transparent !w-5 !h-5 !border-0 group-hover:!bg-black group-hover:!border-[3px] group-hover:!border-white hover:!bg-orange-500 hover:!scale-125 !transition-all !cursor-crosshair !-left-2.5" />

            {/* ── Header: Station name + sequence ── */}
            <div className={`px-3 py-2 border-b-2 border-black ${headerBg}`}>
                <div className="flex items-center gap-2">
                    <div className="bg-black text-white p-1.5 shrink-0"><Icon className="h-3.5 w-3.5" /></div>
                    <div className="min-w-0 flex-1">
                        <p className="font-black text-xs uppercase truncate leading-tight">{wcName}</p>
                        <div className="flex items-center gap-1.5 mt-0.5">
                            <span className={`text-[9px] font-black ${isSubcon ? "text-amber-600" : "text-emerald-600"}`}>
                                {isSubcon ? "Subkon" : "In-House"}
                            </span>
                            {station?.stationType && (
                                <span className="text-[7px] font-black uppercase px-1 py-0.5 bg-black/10 text-zinc-600">
                                    {station.stationType}
                                </span>
                            )}
                        </div>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                        {data.isCritical && <span title="Jalur kritis" className="text-amber-500 text-xs font-black leading-none">⚡</span>}
                        <span className="bg-black text-white text-[10px] font-black w-6 h-6 flex items-center justify-center">{sequence}</span>
                        {data.splitPct != null && (
                            <button
                                onClick={(e) => {
                                    e.stopPropagation()
                                    const input = prompt(`Persentase untuk ${station?.name} (1-99):`, String(data.splitPct))
                                    if (input != null) {
                                        const val = Math.max(1, Math.min(99, parseInt(input) || data.splitPct!))
                                        data.onPctChange?.(val)
                                    }
                                }}
                                className="bg-orange-500 text-white text-[9px] font-black px-1.5 h-6 flex items-center hover:bg-orange-600 transition-colors cursor-pointer"
                                title="Klik untuk ubah persentase"
                            >
                                {data.splitPct}%
                            </button>
                        )}
                        {onRemoveStep && (
                            <button
                                onClick={(e) => { e.stopPropagation(); onRemoveStep() }}
                                className="opacity-0 group-hover:opacity-100 p-0.5 hover:bg-red-100 transition-all"
                                title="Hapus work center"
                            >
                                <Trash2 className="h-3 w-3 text-red-500" />
                            </button>
                        )}
                    </div>
                </div>
            </div>

            {/* ── Info strip: WC code, operator, subkon name ── */}
            <div className="px-3 py-1.5 bg-zinc-50 border-b border-zinc-200 space-y-0.5">
                {/* Work center with code */}
                <div className="flex items-center gap-1.5">
                    <Building2 className="h-3 w-3 text-zinc-400 shrink-0" />
                    <span className="text-[9px] font-bold text-zinc-600 truncate">
                        {wcName}{wcCode ? ` (${wcCode})` : ""}
                    </span>
                </div>
                {/* Subkon vendor name */}
                {isSubcon && (
                    <div className="flex items-center gap-1.5">
                        <Cog className="h-3 w-3 text-amber-500 shrink-0" />
                        <span className="text-[9px] font-bold text-amber-700 truncate">
                            {(() => {
                                const allocs = data.allocations || []
                                if (allocs.length > 0) {
                                    const names = allocs.map((a: any) => a.station?.name || a.station?.subcontractor?.name).filter(Boolean)
                                    if (names.length > 0) return names.join(", ")
                                }
                                return station?.subcontractor?.name || "Belum dipilih"
                            })()}
                        </span>
                    </div>
                )}
                {/* Operator */}
                {data.operatorName && (
                    <div className="flex items-center gap-1.5">
                        <User className="h-3 w-3 text-zinc-400 shrink-0" />
                        <span className="text-[9px] font-bold text-zinc-600 truncate">{data.operatorName}</span>
                    </div>
                )}
                {/* Work center group */}
                {data.groupName && (
                    <div className="flex items-center gap-1.5">
                        <Cog className="h-3 w-3 text-zinc-400 shrink-0" />
                        <span className="text-[9px] font-bold text-zinc-500 truncate">Grup: {data.groupName}</span>
                    </div>
                )}
            </div>

            {/* ── Materials drop zone ── */}
            <div className="px-3 py-2 min-h-[44px]">
                {materials.length === 0 ? (
                    <p className="text-[10px] text-zinc-300 font-bold text-center py-2">Drop material di sini</p>
                ) : (
                    <div className="space-y-1">
                        {materials.map((m) => (
                            <div key={m.bomItemId} className="flex items-center gap-1.5 bg-zinc-50 border border-zinc-200 px-2 py-1 group/mat">
                                <span className="w-1.5 h-1.5 bg-black rounded-full shrink-0" />
                                <span className="text-[10px] font-bold truncate flex-1">{m.materialName}</span>
                                <button
                                    onClick={(e) => { e.stopPropagation(); onRemoveMaterial(m.bomItemId) }}
                                    className="opacity-0 group-hover/mat:opacity-100 transition-opacity"
                                >
                                    <X className="h-3 w-3 text-zinc-400 hover:text-red-500" />
                                </button>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* ── Cost + Duration footer ── */}
            <div className="px-3 py-1.5 border-t border-zinc-200 bg-zinc-50 flex items-center justify-between">
                <span className="text-[9px] font-bold">
                    {data.materialCost > 0
                        ? <span className="text-emerald-600">Rp {data.materialCost.toLocaleString("id-ID")}/unit</span>
                        : <span className="text-zinc-400">Rp {Number(station?.costPerUnit || 0).toLocaleString("id-ID")}/unit</span>
                    }
                </span>
                {data.durationMinutes && (
                    <span className="text-[9px] font-bold text-blue-600 flex items-center gap-0.5">
                        <Clock className="h-3 w-3" /> {data.durationMinutes}m/pcs
                    </span>
                )}
            </div>

            {/* ── Progress bar ── */}
            {hasProgress && (
                <div className="px-3 py-1.5 border-t border-zinc-200">
                    <div className="flex items-center justify-between mb-1">
                        <span className="text-[8px] font-black text-zinc-400 uppercase tracking-wider">Progress</span>
                        <span className="text-[9px] font-mono font-bold text-zinc-600">
                            {data.completedQty || 0}/{data.stepTarget || data.totalProductionQty}
                        </span>
                    </div>
                    <div className="h-2 bg-zinc-200 overflow-hidden border border-zinc-300">
                        <div
                            className={`h-full transition-all ${progressPct >= 100 ? "bg-emerald-500" : "bg-emerald-400"}`}
                            style={{ width: `${progressPct}%` }}
                        />
                    </div>
                </div>
            )}

            <Handle type="source" position={Position.Right} className="!bg-transparent !w-5 !h-5 !border-0 group-hover:!bg-black group-hover:!border-[3px] group-hover:!border-white hover:!bg-orange-500 hover:!scale-125 !transition-all !cursor-crosshair !-right-2.5" />

            {/* + Parallel (below) */}
            {data.onAddParallel && (
                <button
                    onClick={(e) => { e.stopPropagation(); data.onAddParallel!() }}
                    className="absolute -bottom-8 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-all bg-purple-500 hover:bg-purple-600 text-white border-2 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] rounded-full w-6 h-6 flex items-center justify-center z-30"
                    title="Tambah proses paralel"
                >
                    <Plus className="h-3.5 w-3.5" />
                </button>
            )}

            {/* + Sequential (right) */}
            {data.onAddSequential && (
                <button
                    onClick={(e) => { e.stopPropagation(); data.onAddSequential!() }}
                    className="absolute -right-8 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-all bg-emerald-500 hover:bg-emerald-600 text-white border-2 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] rounded-full w-6 h-6 flex items-center justify-center z-30"
                    title="Tambah proses berikutnya"
                >
                    <Plus className="h-3.5 w-3.5" />
                </button>
            )}
        </div>
    )
}

export const StationNode = memo(StationNodeComponent)
