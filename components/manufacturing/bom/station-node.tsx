"use client"

import { memo } from "react"
import { Handle, Position, type NodeProps } from "@xyflow/react"
import { Scissors, Shirt, Droplets, Printer, Sparkles, ShieldCheck, Package, Wrench, Cog, X, Trash2, Clock, Plus } from "lucide-react"

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
    startedAt?: string | null
    useSubkon: boolean
    isSelected: boolean
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
    const Icon = STATION_ICONS[station?.stationType] || Cog
    const isSubcon = data.useSubkon || station?.operationType === "SUBCONTRACTOR"

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault()
        e.stopPropagation()
        e.currentTarget.classList.remove("ring-2", "ring-orange-400")
        const bomItemId = e.dataTransfer.getData("application/bom-item-id")
        if (bomItemId && onDrop) {
            onDrop(bomItemId)
        }
    }

    return (
        <div
            className={`group relative bg-white border-2 ${isSelected ? "border-orange-500 shadow-[4px_4px_0px_0px_rgba(249,115,22,1)]" : "border-black shadow-[3px_3px_0px_0px_rgba(0,0,0,1)]"} w-[220px] transition-all`}
            onContextMenu={(e) => { e.preventDefault(); e.stopPropagation(); data.onContextMenu?.({ clientX: e.clientX, clientY: e.clientY }) }}
            onDragOver={(e) => { e.preventDefault(); e.currentTarget.classList.add("ring-2", "ring-orange-400") }}
            onDragLeave={(e) => { e.currentTarget.classList.remove("ring-2", "ring-orange-400") }}
            onDrop={handleDrop}
        >
            <Handle type="target" position={Position.Left} className="!bg-transparent !w-5 !h-5 !border-0 group-hover:!bg-black group-hover:!border-[3px] group-hover:!border-white hover:!bg-orange-500 hover:!scale-125 !transition-all !cursor-crosshair !-left-2.5" />

            {/* Header */}
            <div className={`px-3 py-2 border-b-2 border-black flex items-center gap-2 ${isSubcon ? "bg-amber-50" : "bg-emerald-50"}`}>
                <div className="bg-black text-white p-1 shrink-0"><Icon className="h-3.5 w-3.5" /></div>
                <div className="min-w-0 flex-1">
                    <p className="font-black text-xs uppercase truncate">{station?.name}</p>
                    <p className={`text-[9px] font-bold ${isSubcon ? "text-amber-600" : "text-emerald-600"}`}>
                        {isSubcon ? `Subkon: ${station?.subcontractor?.name || "-"}` : "In-House"}
                    </p>
                </div>
                <span className="bg-black text-white text-[10px] font-black px-1.5 py-0.5 shrink-0">{sequence}</span>
                {onRemoveStep && (
                    <button
                        onClick={(e) => { e.stopPropagation(); onRemoveStep() }}
                        className="opacity-0 group-hover:opacity-100 p-0.5 hover:bg-red-100 transition-all shrink-0"
                        title="Hapus stasiun"
                    >
                        <Trash2 className="h-3 w-3 text-red-500" />
                    </button>
                )}
            </div>

            {/* Materials drop zone */}
            <div className="p-2 min-h-[40px]">
                {materials.length === 0 ? (
                    <p className="text-[10px] text-zinc-300 font-bold text-center py-2">Drop material di sini</p>
                ) : (
                    <div className="space-y-1">
                        {materials.map((m) => (
                            <div key={m.bomItemId} className="flex items-center gap-1.5 bg-zinc-50 border border-zinc-200 px-2 py-1 group">
                                <span className="w-1.5 h-1.5 bg-black rounded-full shrink-0" />
                                <span className="text-[10px] font-bold truncate flex-1">{m.materialName}</span>
                                <button
                                    onClick={(e) => { e.stopPropagation(); onRemoveMaterial(m.bomItemId) }}
                                    className="opacity-0 group-hover:opacity-100 transition-opacity"
                                >
                                    <X className="h-3 w-3 text-zinc-400 hover:text-red-500" />
                                </button>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Cost + Duration footer */}
            <div className="px-3 py-1.5 border-t border-zinc-100 bg-zinc-50 flex items-center justify-between">
                <p className="text-[9px] font-bold text-zinc-400">
                    {data.materialCost > 0
                        ? <span className="text-emerald-600">{`Rp ${data.materialCost.toLocaleString("id-ID")}/unit`}</span>
                        : `Rp ${Number(station?.costPerUnit || 0).toLocaleString("id-ID")}/unit`
                    }
                </p>
                {data.durationMinutes && (
                    <span className="text-[9px] font-bold text-blue-500 flex items-center gap-0.5">
                        <Clock className="h-3 w-3" /> {data.durationMinutes}m
                    </span>
                )}
            </div>

            {/* Production progress bar */}
            {((data.completedQty ?? 0) > 0 || data.startedAt) && (data.totalProductionQty ?? 0) > 0 && (
                <div className="px-2 pb-1.5">
                    <div className="flex items-center justify-between mb-0.5">
                        <span className="text-[8px] font-bold text-zinc-400 uppercase tracking-wider">Progress</span>
                        <span className="text-[9px] font-mono font-bold text-zinc-600">
                            {data.completedQty || 0}/{data.totalProductionQty}
                        </span>
                    </div>
                    <div className="h-1.5 bg-zinc-200 rounded-full overflow-hidden">
                        <div
                            className="h-full bg-emerald-500 rounded-full transition-all"
                            style={{ width: `${Math.min(100, ((data.completedQty || 0) / (data.totalProductionQty!)) * 100)}%` }}
                        />
                    </div>
                </div>
            )}

            <Handle type="source" position={Position.Right} className="!bg-transparent !w-5 !h-5 !border-0 group-hover:!bg-black group-hover:!border-[3px] group-hover:!border-white hover:!bg-orange-500 hover:!scale-125 !transition-all !cursor-crosshair !-right-2.5" />

            {/* + Parallel (below) — creates sibling with same parents */}
            {data.onAddParallel && (
                <button
                    onClick={(e) => { e.stopPropagation(); data.onAddParallel!() }}
                    className="absolute -bottom-8 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-all bg-purple-500 hover:bg-purple-600 text-white border-2 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] rounded-full w-6 h-6 flex items-center justify-center z-30"
                    title="Tambah proses paralel"
                >
                    <Plus className="h-3.5 w-3.5" />
                </button>
            )}

            {/* + Sequential (right) — creates child step */}
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
