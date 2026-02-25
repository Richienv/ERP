"use client"

import { memo } from "react"
import { Handle, Position, type NodeProps } from "@xyflow/react"
import { Scissors, Shirt, Droplets, Printer, Sparkles, ShieldCheck, Package, Wrench, Cog, X, Trash2, Clock } from "lucide-react"

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
    isSelected: boolean
    onRemoveMaterial: (bomItemId: string) => void
    onDrop: (bomItemId: string) => void
    onRemoveStep?: () => void
    [key: string]: unknown
}

function StationNodeComponent({ data }: NodeProps & { data: StationNodeData }) {
    const { station, sequence, materials, isSelected, onRemoveMaterial, onDrop, onRemoveStep } = data
    const Icon = STATION_ICONS[station?.stationType] || Cog
    const isSubcon = station?.operationType === "SUBCONTRACTOR"

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
            className={`group bg-white border-2 ${isSelected ? "border-orange-500 shadow-[4px_4px_0px_0px_rgba(249,115,22,1)]" : "border-black shadow-[3px_3px_0px_0px_rgba(0,0,0,1)]"} w-[220px] transition-all`}
            onDragOver={(e) => { e.preventDefault(); e.currentTarget.classList.add("ring-2", "ring-orange-400") }}
            onDragLeave={(e) => { e.currentTarget.classList.remove("ring-2", "ring-orange-400") }}
            onDrop={handleDrop}
        >
            <Handle type="target" position={Position.Left} className="!bg-black !w-4 !h-4 !border-2 !border-white hover:!bg-orange-500 hover:!scale-150 !transition-all !cursor-crosshair" />

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

            <Handle type="source" position={Position.Right} className="!bg-black !w-4 !h-4 !border-2 !border-white hover:!bg-orange-500 hover:!scale-150 !transition-all !cursor-crosshair" />
        </div>
    )
}

export const StationNode = memo(StationNodeComponent)
