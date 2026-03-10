"use client"

import { useState } from "react"
import { useProcessStations } from "@/hooks/use-process-stations"
import { useQueryClient } from "@tanstack/react-query"
import { queryKeys } from "@/lib/query-keys"
import { formatCurrency } from "@/lib/inventory-utils"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Search, Plus, Star, Clock, Package, X, Pencil } from "lucide-react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Checkbox } from "@/components/ui/checkbox"

interface Allocation {
    stationId: string
    quantity: number
    pricePerPcs: number
    notes: string
}

interface SubkonSelectorProps {
    stationType: string
    allocations: Allocation[]
    totalQty: number
    onChange: (allocations: Allocation[]) => void
}

function PriceEditDialog({
    open,
    onOpenChange,
    initialPrice,
    stationName,
    onSave,
}: {
    open: boolean
    onOpenChange: (open: boolean) => void
    initialPrice: number
    stationName: string
    onSave: (newPrice: number, saveAsDefault: boolean) => void
}) {
    const [price, setPrice] = useState(initialPrice.toString())
    const [saveAsDefault, setSaveAsDefault] = useState(false)

    // Reset when opened
    if (open && price !== initialPrice.toString() && !price) {
        setPrice(initialPrice.toString())
        setSaveAsDefault(false)
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[400px] border-2 border-black rounded-none shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
                <DialogHeader>
                    <DialogTitle className="font-black uppercase tracking-tight text-lg">Sesuaikan Harga</DialogTitle>
                    <p className="text-xs text-zinc-500 font-bold">Subkon: {stationName}</p>
                </DialogHeader>
                <div className="space-y-4 py-4">
                    <div className="space-y-1">
                        <label className="text-[10px] font-black uppercase text-zinc-400">Harga per Pcs (Rp)</label>
                        <Input
                            type="number"
                            value={price}
                            onChange={(e) => setPrice(e.target.value)}
                            className="font-mono border-2 border-black rounded-none h-10"
                        />
                    </div>
                    <label className="flex items-start gap-2.5 cursor-pointer group">
                        <Checkbox
                            checked={saveAsDefault}
                            onCheckedChange={(c) => setSaveAsDefault(!!c)}
                            className="mt-0.5 border-black rounded-none data-[state=checked]:bg-black data-[state=checked]:text-white"
                        />
                        <div className="space-y-1 leading-none">
                            <p className="text-[11px] font-bold text-zinc-900 group-hover:underline">Simpan sebagai harga dasar (Permanen)</p>
                            <p className="text-[10px] text-zinc-500">Jika dicentang, harga ini akan disimpan sebagai harga default master data subkon ini untuk ke depannya.</p>
                        </div>
                    </label>
                </div>
                <DialogFooter>
                    <Button variant="outline" className="border-2 border-black rounded-none font-bold uppercase text-[10px]" onClick={() => onOpenChange(false)}>
                        Batal
                    </Button>
                    <Button
                        className="border-2 border-black rounded-none font-black uppercase text-[10px] shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:translate-y-[1px] hover:shadow-[1px_1px_0px_0px_rgba(0,0,0,1)] transition-all"
                        onClick={() => {
                            onSave(parseFloat(price) || 0, saveAsDefault)
                            onOpenChange(false)
                        }}
                    >
                        Simpan
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}

export function SubkonSelector({ stationType, allocations, totalQty, onChange }: SubkonSelectorProps) {
    const { data: allStations } = useProcessStations()
    const queryClient = useQueryClient()
    const [search, setSearch] = useState("")
    const [editingPriceStation, setEditingPriceStation] = useState<string | null>(null)
    const [priceSuggestion, setPriceSuggestion] = useState<{ stationId: string; name: string; price: number } | null>(null)

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
        const station = subkonStations.find((s: any) => s.id === stationId)
        const defaultPrice = Number(station?.costPerUnit || 0)
        onChange([...allocations, { stationId, quantity: 0, pricePerPcs: defaultPrice, notes: "" }])

        // Show price suggestion bar if subkon has a known price
        const subName = station?.subcontractor?.name || station?.name || "Subkon"
        if (defaultPrice > 0) {
            setPriceSuggestion({ stationId, name: subName, price: defaultPrice })
        } else {
            // No default price — prompt user to set one
            setPriceSuggestion({ stationId, name: subName, price: 0 })
        }
    }

    const updateQty = (stationId: string, qty: number) => {
        onChange(allocations.map(a => a.stationId === stationId ? { ...a, quantity: qty } : a))
    }

    const updatePrice = async (stationId: string, price: number, saveAsDefault: boolean) => {
        onChange(allocations.map(a => a.stationId === stationId ? { ...a, pricePerPcs: price } : a))

        if (saveAsDefault) {
            try {
                await fetch(`/api/manufacturing/process-stations/${stationId}`, {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ costPerUnit: price })
                })
                queryClient.invalidateQueries({ queryKey: queryKeys.processStations.all })
            } catch (error) {
                console.error("Failed to update permanent station price:", error)
            }
        }
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
            </div>

            <div className="relative">
                <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-zinc-400" />
                <Input
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Cari..."
                    className="h-7 text-[10px] pl-7 border-zinc-200 rounded-none placeholder:text-zinc-300"
                />
            </div>

            <ScrollArea className="max-h-[120px]">
                <div className="space-y-1.5">
                    {filtered.map((station: any) => {
                        const isAllocated = allocations.some(a => a.stationId === station.id)
                        const alloc = allocations.find(a => a.stationId === station.id)
                        const sub = station.subcontractor
                        const masterPrice = Number(station.costPerUnit || 0)
                        const allocPrice = alloc?.pricePerPcs ?? 0
                        const displayPrice = allocPrice || masterPrice
                        const hasDifferentPrice = isAllocated && allocPrice > 0 && masterPrice > 0 && allocPrice !== masterPrice
                        return (
                            <div key={station.id}
                                className={`p-2 border text-[10px] transition-all ${isAllocated
                                        ? "border-amber-400 bg-amber-50"
                                        : "border-zinc-200 hover:border-black hover:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]"
                                    }`}
                            >
                                <div className="flex items-start justify-between gap-2">
                                    <div className="min-w-0">
                                        <p className="font-black truncate">{sub?.name || station.name}</p>
                                        <div className="flex items-center gap-2 mt-0.5 text-zinc-500">
                                            <span className="font-mono">{formatCurrency(displayPrice)}/unit</span>
                                            {hasDifferentPrice && (
                                                <span className="font-mono line-through text-zinc-400">{formatCurrency(masterPrice)}</span>
                                            )}
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

            {/* Price suggestion bar — Google-password-save style */}
            {priceSuggestion && (
                <div className="border-2 border-amber-400 bg-amber-50 p-2 flex items-center gap-2 animate-in slide-in-from-top-1">
                    <div className="flex-1 min-w-0">
                        <p className="text-[10px] font-bold text-amber-900 truncate">
                            {priceSuggestion.price > 0
                                ? `Harga ${priceSuggestion.name}: ${formatCurrency(priceSuggestion.price)}/pcs`
                                : `Atur harga untuk ${priceSuggestion.name}`
                            }
                        </p>
                    </div>
                    {priceSuggestion.price > 0 ? (
                        <>
                            <Button
                                size="sm"
                                className="h-5 text-[9px] font-black uppercase rounded-none bg-amber-600 hover:bg-amber-700 text-white px-2"
                                onClick={() => setPriceSuggestion(null)}
                            >
                                Terima
                            </Button>
                            <Button
                                size="sm"
                                variant="outline"
                                className="h-5 text-[9px] font-black uppercase rounded-none border-amber-400 px-2"
                                onClick={() => {
                                    setEditingPriceStation(priceSuggestion.stationId)
                                    setPriceSuggestion(null)
                                }}
                            >
                                Ubah
                            </Button>
                        </>
                    ) : (
                        <Button
                            size="sm"
                            className="h-5 text-[9px] font-black uppercase rounded-none bg-amber-600 hover:bg-amber-700 text-white px-2"
                            onClick={() => {
                                setEditingPriceStation(priceSuggestion.stationId)
                                setPriceSuggestion(null)
                            }}
                        >
                            Atur Harga
                        </Button>
                    )}
                    <button onClick={() => setPriceSuggestion(null)} className="text-amber-400 hover:text-amber-700">
                        <X className="h-3 w-3" />
                    </button>
                </div>
            )}

            {allocations.length > 0 && (
                <div className="border-t border-zinc-200 pt-2 space-y-1.5">
                    <div className="flex items-center justify-between">
                        <h4 className="text-[9px] font-black uppercase text-zinc-400">Alokasi Aktif</h4>
                        <span className={`text-[10px] font-bold ${remaining === 0 ? "text-emerald-600" : remaining < 0 ? "text-red-600" : "text-amber-600"
                            }`}>
                            {allocated}/{totalQty} pcs
                            {remaining > 0 && <span className="text-zinc-400 ml-1">({remaining} sisa)</span>}
                        </span>
                    </div>
                    {allocations.map((alloc) => {
                        const info = getStationInfo(alloc.stationId)
                        const subtotal = (alloc.pricePerPcs || 0) * (alloc.quantity || 0)
                        return (
                            <div key={alloc.stationId} className="space-y-1 pb-1.5 border-b border-zinc-100 last:border-0">
                                <div className="flex items-center gap-2">
                                    <span className="text-[10px] font-bold truncate flex-1">
                                        {info?.subcontractor?.name || info?.name || "—"}
                                    </span>
                                    <button onClick={() => removeAllocation(alloc.stationId)}>
                                        <X className="h-3 w-3 text-zinc-400 hover:text-red-500" />
                                    </button>
                                </div>
                                <div className="flex items-center gap-2">
                                    <Input
                                        type="number"
                                        value={alloc.quantity}
                                        onChange={(e) => updateQty(alloc.stationId, parseInt(e.target.value) || 0)}
                                        className="h-6 w-16 text-[10px] font-mono border-zinc-200 rounded-none"
                                    />
                                    <span className="text-[9px] text-zinc-400 shrink-0">pcs</span>
                                    <span className="text-[9px] text-zinc-300">×</span>
                                    <span className="text-[9px] text-zinc-400 shrink-0">Rp</span>
                                    <span className="font-mono text-[10px] font-bold text-zinc-700 min-w-[50px]">
                                        {formatCurrency(alloc.pricePerPcs || 0)}
                                    </span>
                                    <Button
                                        variant="outline" size="icon"
                                        className="h-5 w-5 rounded-none border-zinc-200"
                                        onClick={() => setEditingPriceStation(alloc.stationId)}
                                    >
                                        <Pencil className="h-2.5 w-2.5 text-zinc-500" />
                                    </Button>
                                    {subtotal > 0 && (
                                        <span className="text-[9px] font-bold text-emerald-700 shrink-0">
                                            = {formatCurrency(subtotal)}
                                        </span>
                                    )}
                                </div>
                            </div>
                        )
                    })}
                </div>
            )}

            {allocations.length > 0 && (() => {
                const totalSubkonCost = allocations.reduce((sum, a) => sum + (a.pricePerPcs || 0) * (a.quantity || 0), 0)
                return totalSubkonCost > 0 ? (
                    <div className="border-t-2 border-amber-300 pt-1.5 flex justify-between items-center">
                        <span className="text-[9px] font-black uppercase text-zinc-400">Total Biaya Subkon</span>
                        <span className="text-xs font-black text-amber-700">{formatCurrency(totalSubkonCost)}</span>
                    </div>
                ) : null
            })()}

            {editingPriceStation && (
                <PriceEditDialog
                    open={!!editingPriceStation}
                    onOpenChange={(open) => !open && setEditingPriceStation(null)}
                    initialPrice={allocations.find(a => a.stationId === editingPriceStation)?.pricePerPcs || 0}
                    stationName={getStationInfo(editingPriceStation)?.subcontractor?.name || getStationInfo(editingPriceStation)?.name || "Subkon"}
                    onSave={(newPrice, savePermanent) => updatePrice(editingPriceStation, newPrice, savePermanent)}
                />
            )}
        </div>
    )
}
