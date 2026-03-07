"use client"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
    Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select"
import { Plus, Trash2 } from "lucide-react"

interface Allocation {
    stationId: string
    quantity: number
    notes: string
}

interface AllocationEditorProps {
    allocations: Allocation[]
    totalQty: number
    stations: any[]
    onChange: (allocations: Allocation[]) => void
}

export function AllocationEditor({ allocations, totalQty, stations, onChange }: AllocationEditorProps) {
    const allocated = allocations.reduce((sum, a) => sum + a.quantity, 0)
    const remaining = totalQty - allocated

    const addAllocation = () => {
        onChange([...allocations, { stationId: "", quantity: 0, notes: "" }])
    }

    const updateAllocation = (index: number, field: string, value: any) => {
        const updated = [...allocations]
        updated[index] = { ...updated[index], [field]: value }
        onChange(updated)
    }

    const removeAllocation = (index: number) => {
        onChange(allocations.filter((_, i) => i !== index))
    }

    return (
        <div className="space-y-3">
            <div className="flex items-center justify-between">
                <h4 className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Alokasi Produksi</h4>
                <div className="text-[10px] font-bold">
                    <span className={remaining === 0 ? "text-emerald-600" : remaining < 0 ? "text-red-600" : "text-amber-600"}>
                        {allocated}/{totalQty} pcs
                    </span>
                    {remaining > 0 && <span className="text-zinc-400 ml-1">({remaining} sisa)</span>}
                </div>
            </div>

            {allocations.map((alloc, index) => (
                <div key={index} className="flex items-center gap-2">
                    <Select value={alloc.stationId} onValueChange={(v) => updateAllocation(index, "stationId", v)}>
                        <SelectTrigger className="h-8 text-xs border-zinc-200 rounded-none flex-1">
                            <SelectValue placeholder="Pilih work center..." />
                        </SelectTrigger>
                        <SelectContent>
                            {stations.map((s) => (
                                <SelectItem key={s.id} value={s.id}>
                                    {s.name} {s.subcontractor ? `(${s.subcontractor.name})` : ""}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                    <Input
                        type="number"
                        value={alloc.quantity}
                        onChange={(e) => updateAllocation(index, "quantity", parseInt(e.target.value) || 0)}
                        className="h-8 w-20 text-xs font-mono border-zinc-200 rounded-none placeholder:text-zinc-300"
                        placeholder="0"
                    />
                    <span className="text-[10px] font-bold text-zinc-400 shrink-0">pcs</span>
                    <Button variant="ghost" size="sm" onClick={() => removeAllocation(index)} className="h-8 w-8 p-0 rounded-none">
                        <Trash2 className="h-3.5 w-3.5 text-zinc-400 hover:text-red-500" />
                    </Button>
                </div>
            ))}

            <Button onClick={addAllocation} variant="outline" size="sm" className="h-7 text-[10px] font-bold rounded-none border-dashed w-full">
                <Plus className="mr-1 h-3 w-3" /> Tambah Alokasi
            </Button>
        </div>
    )
}
