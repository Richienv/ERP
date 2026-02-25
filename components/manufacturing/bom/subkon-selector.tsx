"use client"

import { useState } from "react"
import { useProcessStations } from "@/hooks/use-process-stations"
import { useQueryClient } from "@tanstack/react-query"
import { queryKeys } from "@/lib/query-keys"
import { CreateStationDialog } from "./create-station-dialog"
import { formatCurrency } from "@/lib/inventory-utils"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Search, Plus, Star, Clock, Package, X } from "lucide-react"

interface Allocation {
    stationId: string
    quantity: number
    notes: string
}

interface SubkonSelectorProps {
    stationType: string
    allocations: Allocation[]
    totalQty: number
    onChange: (allocations: Allocation[]) => void
}

export function SubkonSelector({ stationType, allocations, totalQty, onChange }: SubkonSelectorProps) {
    const { data: allStations } = useProcessStations()
    const queryClient = useQueryClient()
    const [search, setSearch] = useState("")
    const [createOpen, setCreateOpen] = useState(false)

    const subkonStations = (allStations || []).filter((s: any) =>
        s.operationType === "SUBCONTRACTOR" &&
        (s.stationType === stationType || !stationType) &&
        s.isActive !== false
    )

    const filtered = subkonStations.filter((s: any) =>
        s.name?.toLowerCase().includes(search.toLowerCase()) ||
        s.subcontractor?.name?.toLowerCase().includes(search.toLowerCase())
    )

    const allocated = allocations.reduce((sum, a) => sum + a.quantity, 0)
    const remaining = totalQty - allocated

    const addAllocation = (stationId: string) => {
        if (allocations.some(a => a.stationId === stationId)) return
        onChange([...allocations, { stationId, quantity: 0, notes: "" }])
    }

    const updateQty = (stationId: string, qty: number) => {
        onChange(allocations.map(a => a.stationId === stationId ? { ...a, quantity: qty } : a))
    }

    const removeAllocation = (stationId: string) => {
        onChange(allocations.filter(a => a.stationId !== stationId))
    }

    const getStationInfo = (stationId: string) =>
        subkonStations.find((s: any) => s.id === stationId)

    return (
        <div className="space-y-3">
            <div className="flex items-center justify-between">
                <h4 className="text-[10px] font-black uppercase tracking-widest text-zinc-500">
                    Pilih Subkontraktor
                </h4>
                <Button
                    variant="outline" size="sm"
                    onClick={() => setCreateOpen(true)}
                    className="h-6 text-[9px] font-bold rounded-none border-dashed px-2"
                >
                    <Plus className="h-3 w-3 mr-1" /> Buat Baru
                </Button>
            </div>

            <div className="relative">
                <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-zinc-400" />
                <Input
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Cari subkon..."
                    className="h-7 text-[10px] pl-7 border-zinc-200 rounded-none"
                />
            </div>

            <ScrollArea className="max-h-[120px]">
                <div className="space-y-1.5">
                    {filtered.map((station: any) => {
                        const isAllocated = allocations.some(a => a.stationId === station.id)
                        const sub = station.subcontractor
                        return (
                            <div key={station.id}
                                className={`p-2 border text-[10px] transition-all ${
                                    isAllocated
                                        ? "border-amber-400 bg-amber-50"
                                        : "border-zinc-200 hover:border-black hover:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]"
                                }`}
                            >
                                <div className="flex items-start justify-between gap-2">
                                    <div className="min-w-0">
                                        <p className="font-black truncate">{sub?.name || station.name}</p>
                                        <div className="flex items-center gap-2 mt-0.5 text-zinc-500">
                                            <span className="font-mono">{formatCurrency(Number(station.costPerUnit || 0))}/unit</span>
                                            {sub?.maxCapacityPerMonth && (
                                                <>
                                                    <span>·</span>
                                                    <span><Package className="h-3 w-3 inline" /> {sub.maxCapacityPerMonth.toLocaleString()} pcs/bln</span>
                                                </>
                                            )}
                                        </div>
                                        <div className="flex items-center gap-2 mt-0.5 text-zinc-400">
                                            {sub?.leadTimeDays && (
                                                <span><Clock className="h-3 w-3 inline" /> {sub.leadTimeDays} hari</span>
                                            )}
                                            {sub?.rating > 0 && (
                                                <span><Star className="h-3 w-3 inline text-amber-400" /> {sub.rating}/5</span>
                                            )}
                                            {sub?.onTimeRate > 0 && (
                                                <span>· OTD {sub.onTimeRate}%</span>
                                            )}
                                        </div>
                                    </div>
                                    {!isAllocated && (
                                        <Button
                                            variant="outline" size="sm"
                                            onClick={() => addAllocation(station.id)}
                                            className="h-6 text-[9px] font-bold rounded-none shrink-0 px-2"
                                        >
                                            <Plus className="h-3 w-3" /> Alokasi
                                        </Button>
                                    )}
                                </div>
                            </div>
                        )
                    })}
                    {filtered.length === 0 && (
                        <p className="text-[10px] text-zinc-300 font-bold py-3 text-center">
                            Belum ada subkontraktor
                        </p>
                    )}
                </div>
            </ScrollArea>

            {allocations.length > 0 && (
                <div className="border-t border-zinc-200 pt-2 space-y-1.5">
                    <div className="flex items-center justify-between">
                        <h4 className="text-[9px] font-black uppercase text-zinc-400">Alokasi Aktif</h4>
                        <span className={`text-[10px] font-bold ${
                            remaining === 0 ? "text-emerald-600" : remaining < 0 ? "text-red-600" : "text-amber-600"
                        }`}>
                            {allocated}/{totalQty} pcs
                            {remaining > 0 && <span className="text-zinc-400 ml-1">({remaining} sisa)</span>}
                        </span>
                    </div>
                    {allocations.map((alloc) => {
                        const info = getStationInfo(alloc.stationId)
                        return (
                            <div key={alloc.stationId} className="flex items-center gap-2">
                                <span className="text-[10px] font-bold truncate flex-1">
                                    {info?.subcontractor?.name || info?.name || "—"}
                                </span>
                                <Input
                                    type="number"
                                    value={alloc.quantity}
                                    onChange={(e) => updateQty(alloc.stationId, parseInt(e.target.value) || 0)}
                                    className="h-6 w-16 text-[10px] font-mono border-zinc-200 rounded-none"
                                />
                                <span className="text-[9px] text-zinc-400">pcs</span>
                                <button onClick={() => removeAllocation(alloc.stationId)}>
                                    <X className="h-3 w-3 text-zinc-400 hover:text-red-500" />
                                </button>
                            </div>
                        )
                    })}
                </div>
            )}

            <CreateStationDialog
                open={createOpen}
                onOpenChange={setCreateOpen}
                defaultStationType={stationType}
                defaultOperationType="SUBCONTRACTOR"
                onCreated={(station: any) => {
                    queryClient.invalidateQueries({ queryKey: queryKeys.processStations.all })
                    addAllocation(station.id)
                }}
            />
        </div>
    )
}
