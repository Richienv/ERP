"use client"

import { useState } from "react"
import { useProcessStations } from "@/hooks/use-process-stations"
import { useQueryClient } from "@tanstack/react-query"
import { queryKeys } from "@/lib/query-keys"
import { CreateStationDialog } from "./create-station-dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Search, Plus, X, Building2, Shuffle } from "lucide-react"
import { toast } from "sonner"

interface Allocation {
    stationId: string
    quantity: number
    pricePerPcs: number
    notes: string
}

interface InHouseAllocatorProps {
    stationType: string
    allocations: Allocation[]
    totalQty: number
    onChange: (allocations: Allocation[]) => void
}

export function InHouseAllocator({ stationType, allocations, totalQty, onChange }: InHouseAllocatorProps) {
    const { data: allStations } = useProcessStations()
    const queryClient = useQueryClient()
    const [search, setSearch] = useState("")
    const [createOpen, setCreateOpen] = useState(false)

    const inhouseStations = (allStations || []).filter((s: any) =>
        s.operationType !== "SUBCONTRACTOR" &&
        (s.stationType === stationType || !stationType) &&
        s.isActive !== false
    )

    const filtered = inhouseStations.filter((s: any) =>
        s.name?.toLowerCase().includes(search.toLowerCase()) ||
        s.code?.toLowerCase().includes(search.toLowerCase())
    )

    const allocated = allocations.reduce((sum, a) => sum + a.quantity, 0)
    const remaining = totalQty - allocated

    const addAllocation = (stationId: string) => {
        if (allocations.some(a => a.stationId === stationId)) {
            toast.info("Work center ini sudah dialokasikan")
            return
        }
        onChange([...allocations, { stationId, quantity: 0, pricePerPcs: 0, notes: "" }])
    }

    const updateQty = (stationId: string, qty: number) => {
        onChange(allocations.map(a => a.stationId === stationId ? { ...a, quantity: qty } : a))
    }

    const removeAllocation = (stationId: string) => {
        onChange(allocations.filter(a => a.stationId !== stationId))
    }

    const autoDistribute = () => {
        if (allocations.length === 0) return
        const share = Math.floor(totalQty / allocations.length)
        const remainder = totalQty % allocations.length
        onChange(allocations.map((a, i) => ({
            ...a,
            quantity: share + (i < remainder ? 1 : 0),
        })))
    }

    return (
        <div className="space-y-3">
            {/* Header */}
            <div className="flex items-center justify-between">
                <h4 className="text-[10px] font-black uppercase tracking-widest text-zinc-500">
                    <Building2 className="h-3 w-3 inline mr-1" />
                    Distribusi Work Center
                </h4>
                <div className="flex items-center gap-2">
                    {allocations.length >= 2 && (
                        <button
                            onClick={autoDistribute}
                            className="text-[9px] font-bold text-blue-600 hover:underline flex items-center gap-0.5"
                        >
                            <Shuffle className="h-3 w-3" /> Bagi Rata
                        </button>
                    )}
                    <Button
                        variant="outline" size="sm"
                        onClick={() => setCreateOpen(true)}
                        className="h-6 text-[9px] font-bold rounded-none border-dashed px-2"
                    >
                        <Plus className="h-3 w-3 mr-1" /> Buat Baru
                    </Button>
                </div>
            </div>

            {/* Summary bar */}
            {allocations.length > 0 && (
                <div className={`flex items-center justify-between px-2 py-1.5 border-2 text-[10px] font-black ${
                    remaining === 0 ? "border-emerald-400 bg-emerald-50 text-emerald-700"
                        : remaining < 0 ? "border-red-400 bg-red-50 text-red-700"
                        : "border-amber-400 bg-amber-50 text-amber-700"
                }`}>
                    <span>{allocated}/{totalQty} pcs teralokasi</span>
                    {remaining > 0 && <span>{remaining} sisa</span>}
                    {remaining < 0 && <span>{Math.abs(remaining)} kelebihan!</span>}
                    {remaining === 0 && <span>Lengkap</span>}
                </div>
            )}

            {/* Search */}
            <div className="relative">
                <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-zinc-400" />
                <Input
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Cari..."
                    className="h-7 text-[10px] pl-7 border-zinc-200 rounded-none placeholder:text-zinc-300"
                />
            </div>

            {/* Unified station list */}
            <ScrollArea className="max-h-[200px]">
                <div className="space-y-1.5">
                    {filtered.map((station: any) => {
                        const alloc = allocations.find(a => a.stationId === station.id)
                        const isAllocated = !!alloc

                        return (
                            <div
                                key={station.id}
                                className={`p-2 border text-[10px] transition-all ${
                                    isAllocated
                                        ? "border-emerald-400 bg-emerald-50"
                                        : "border-zinc-200 hover:border-black hover:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]"
                                }`}
                            >
                                <div className="flex items-center gap-2">
                                    <div className="min-w-0 flex-1">
                                        <p className="font-black truncate">
                                            {station.name}
                                            {station.code && (
                                                <span className="text-zinc-400 font-mono ml-1">({station.code})</span>
                                            )}
                                        </p>
                                    </div>

                                    {isAllocated ? (
                                        <div className="flex items-center gap-1.5 shrink-0">
                                            <Input
                                                type="number"
                                                value={alloc.quantity}
                                                onChange={(e) => updateQty(station.id, parseInt(e.target.value) || 0)}
                                                className="h-6 w-20 text-[10px] font-mono border-emerald-300 rounded-none"
                                            />
                                            <span className="text-[9px] text-zinc-400">pcs</span>
                                            <button onClick={() => removeAllocation(station.id)}>
                                                <X className="h-3 w-3 text-zinc-400 hover:text-red-500" />
                                            </button>
                                        </div>
                                    ) : (
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
                            Belum ada work center untuk tipe ini
                        </p>
                    )}
                </div>
            </ScrollArea>

            <CreateStationDialog
                open={createOpen}
                onOpenChange={setCreateOpen}
                defaultStationType={stationType}
                defaultOperationType="IN_HOUSE"
                onCreated={(station: any) => {
                    queryClient.invalidateQueries({ queryKey: queryKeys.processStations.all })
                    addAllocation(station.id)
                }}
            />
        </div>
    )
}
