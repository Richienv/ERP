"use client"

import { useState } from "react"
import { useQueryClient } from "@tanstack/react-query"
import { Layers, Plus, Trash2 } from "lucide-react"
import { Input } from "@/components/ui/input"
import { NB } from "@/lib/dialog-styles"
import { toast } from "sonner"
import { addCutPlanLayer, removeCutPlanLayer } from "@/lib/actions/cutting"
import { queryKeys } from "@/lib/query-keys"

interface Layer {
    id: string
    layerNumber: number
    fabricRollId: string
    rollNumber: string
    metersUsed: number
}

interface AvailableRoll {
    id: string
    rollNumber: string
    remainingMeters: number
}

interface LayerBuilderProps {
    cutPlanId: string
    layers: Layer[]
    availableRolls: AvailableRoll[]
    editable: boolean
}

export function LayerBuilder({
    cutPlanId,
    layers,
    availableRolls,
    editable,
}: LayerBuilderProps) {
    const queryClient = useQueryClient()
    const [selectedRoll, setSelectedRoll] = useState("")
    const [metersUsed, setMetersUsed] = useState("")
    const [loading, setLoading] = useState(false)

    const nextLayerNumber = layers.length > 0
        ? Math.max(...layers.map((l) => l.layerNumber)) + 1
        : 1

    const totalMetersUsed = layers.reduce((s, l) => s + l.metersUsed, 0)

    const handleAdd = async () => {
        if (!selectedRoll || !metersUsed) {
            toast.error("Pilih roll dan masukkan meter")
            return
        }

        setLoading(true)
        const result = await addCutPlanLayer({
            cutPlanId,
            layerNumber: nextLayerNumber,
            fabricRollId: selectedRoll,
            metersUsed: parseFloat(metersUsed),
        })
        setLoading(false)

        if (result.success) {
            toast.success(`Layer ${nextLayerNumber} ditambahkan`)
            queryClient.invalidateQueries({ queryKey: queryKeys.cutPlans.all })
            queryClient.invalidateQueries({ queryKey: queryKeys.cuttingDashboard.all })
            queryClient.invalidateQueries({ queryKey: queryKeys.fabricRolls.all })
            setSelectedRoll("")
            setMetersUsed("")
        } else {
            toast.error(result.error || "Gagal menambah layer")
        }
    }

    const handleRemove = async (layerId: string, layerNum: number) => {
        const result = await removeCutPlanLayer(layerId)
        if (result.success) {
            toast.success(`Layer ${layerNum} dihapus`)
            queryClient.invalidateQueries({ queryKey: queryKeys.cutPlans.all })
            queryClient.invalidateQueries({ queryKey: queryKeys.cuttingDashboard.all })
            queryClient.invalidateQueries({ queryKey: queryKeys.fabricRolls.all })
        } else {
            toast.error(result.error || "Gagal menghapus layer")
        }
    }

    return (
        <div className="bg-white border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
            <div className="px-4 py-2.5 border-b-2 border-black bg-zinc-50 flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <Layers className="h-4 w-4 text-zinc-500" />
                    <span className="text-[10px] font-black uppercase tracking-widest text-zinc-500">
                        Layer Kain
                    </span>
                </div>
                <div className="flex items-center gap-3">
                    <span className="text-[9px] font-bold text-zinc-400">
                        {layers.length} layer
                    </span>
                    <span className="text-[9px] font-black px-2 py-0.5 bg-zinc-100 border border-zinc-300">
                        {totalMetersUsed.toFixed(2)} m
                    </span>
                </div>
            </div>

            {/* Layer list */}
            {layers.length > 0 && (
                <div className={NB.tableWrap}>
                    <table className="w-full">
                        <thead className={NB.tableHead}>
                            <tr>
                                <th className={`${NB.tableHeadCell} text-left w-16`}>#</th>
                                <th className={`${NB.tableHeadCell} text-left`}>Roll</th>
                                <th className={`${NB.tableHeadCell} text-right`}>Meter</th>
                                {editable && <th className={`${NB.tableHeadCell} w-10`}></th>}
                            </tr>
                        </thead>
                        <tbody>
                            {layers.map((layer) => (
                                <tr key={layer.id} className={NB.tableRow}>
                                    <td className={`${NB.tableCell} font-mono font-bold`}>
                                        {layer.layerNumber}
                                    </td>
                                    <td className={NB.tableCell}>
                                        <span className="text-xs font-bold">{layer.rollNumber}</span>
                                    </td>
                                    <td className={`${NB.tableCell} text-right font-mono`}>
                                        {layer.metersUsed.toFixed(2)}
                                    </td>
                                    {editable && (
                                        <td className={NB.tableCell}>
                                            <button
                                                onClick={() => handleRemove(layer.id, layer.layerNumber)}
                                                className="text-red-500 hover:text-red-700"
                                            >
                                                <Trash2 className="h-3.5 w-3.5" />
                                            </button>
                                        </td>
                                    )}
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            {/* Add layer form */}
            {editable && (
                <div className="px-4 py-3 border-t border-zinc-200">
                    <div className="flex gap-2">
                        <select
                            className={`${NB.select} flex-1`}
                            value={selectedRoll}
                            onChange={(e) => setSelectedRoll(e.target.value)}
                        >
                            <option value="">Pilih roll...</option>
                            {availableRolls.map((r) => (
                                <option key={r.id} value={r.id}>
                                    {r.rollNumber} ({r.remainingMeters.toFixed(1)} m)
                                </option>
                            ))}
                        </select>
                        <Input
                            className={`${NB.inputMono} w-28`}
                            type="number"
                            step="0.01"
                            placeholder="Meter"
                            value={metersUsed}
                            onChange={(e) => setMetersUsed(e.target.value)}
                        />
                        <button
                            onClick={handleAdd}
                            disabled={loading}
                            className="border-2 border-black bg-zinc-100 hover:bg-zinc-200 px-3 h-10 rounded-none"
                        >
                            <Plus className="h-4 w-4" />
                        </button>
                    </div>
                </div>
            )}
        </div>
    )
}
