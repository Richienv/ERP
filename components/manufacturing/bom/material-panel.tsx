"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Plus, Search, GripVertical, X, Package } from "lucide-react"
import { useBOMCanvas } from "@/app/manufacturing/bom/[id]/bom-canvas-context"
import { useStockAvailability } from "@/app/manufacturing/bom/[id]/hooks/use-stock-availability"

interface MaterialPanelProps {
    onAddItem: () => void
    onRemoveItem: (id: string) => void
}

export function MaterialPanel({ onAddItem, onRemoveItem }: MaterialPanelProps) {
    const { items, steps, totalQty } = useBOMCanvas()
    const { data: stockData } = useStockAvailability(items, totalQty)
    const stockMap = new Map(stockData?.map((s) => [s.productId, s]) ?? [])
    const [search, setSearch] = useState("")

    const filtered = items.filter((item) =>
        item.material?.name?.toLowerCase().includes(search.toLowerCase()) ||
        item.material?.code?.toLowerCase().includes(search.toLowerCase())
    )

    return (
        <div className="w-[220px] lg:w-[280px] 2xl:w-[320px] border-r border-border bg-white flex flex-col h-full shrink-0">
            {/* Header */}
            <div className="px-4 py-3 border-b border-border bg-zinc-50">
                <h3 className="text-xs font-semibold  ">Material</h3>
                <p className="text-xs font-bold text-zinc-400 mt-0.5">Drag ke work center proses</p>
            </div>

            {/* Search */}
            <div className="p-3 border-b border-zinc-200">
                <div className="relative">
                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-zinc-400" />
                    <Input
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        placeholder="Cari..."
                        className="pl-8 h-8 text-xs border-zinc-200 rounded-md placeholder:text-zinc-300"
                    />
                </div>
            </div>

            {/* Material list */}
            <ScrollArea className="flex-1">
                <div className="p-2 space-y-1">
                    {filtered.map((item) => {
                        const assignCount = steps.reduce((count, step) =>
                            count + ((step.materials || []).some((m: any) => m.bomItemId === item.id) ? 1 : 0), 0)
                        return (
                            <div
                                key={item.id}
                                draggable
                                onDragStart={(e) => {
                                    e.dataTransfer.setData("application/bom-item-id", item.id)
                                    e.dataTransfer.effectAllowed = "copy"
                                }}
                                className="flex items-center gap-2 p-2 border border-zinc-200 bg-white hover:border-border hover:shadow-sm transition-all cursor-grab active:cursor-grabbing group"
                            >
                                <GripVertical className="h-3.5 w-3.5 text-zinc-300 shrink-0" />
                                {(() => {
                                    const stock = stockMap.get(item.materialId)
                                    const dot = !stock ? "bg-zinc-200" : stock.status === "cukup" ? "bg-green-500" : stock.status === "hampir-habis" ? "bg-yellow-400" : "bg-red-500"
                                    const tip = !stock ? "Memuat stok..." : `Stok: ${stock.available} — Butuh: ${stock.required}${stock.status === "kurang" ? ` — Kurang ${stock.required - stock.available}` : ""}`
                                    return <span className={`w-2 h-2 rounded-full ${dot} shrink-0`} title={tip} />
                                })()}
                                <div className="min-w-0 flex-1">
                                    <p className="text-xs font-bold truncate">{item.material?.name}</p>
                                    <p className="text-xs text-zinc-400 font-mono">{item.material?.code} · {Number(item.quantityPerUnit)} {item.unit || item.material?.unit || "pcs"}</p>
                                </div>
                                {assignCount > 0 && (
                                    <span className="bg-slate-900 text-white text-xs font-semibold w-5 h-5 flex items-center justify-center shrink-0">
                                        {assignCount}
                                    </span>
                                )}
                                <button
                                    onClick={() => onRemoveItem(item.id)}
                                    className="opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
                                >
                                    <X className="h-3.5 w-3.5 text-zinc-400 hover:text-red-500" />
                                </button>
                            </div>
                        )
                    })}

                    {filtered.length === 0 && (
                        <div className="text-center py-6">
                            <Package className="h-8 w-8 text-zinc-200 mx-auto mb-2" />
                            <p className="text-xs font-bold text-zinc-300">Belum ada material</p>
                        </div>
                    )}
                </div>
            </ScrollArea>

            {/* Add button */}
            <div className="p-3 border-t border-border">
                <Button onClick={onAddItem} className="w-full h-8 bg-slate-900 text-white font-semibold text-xs rounded-md shadow-sm">
                    <Plus className="mr-1.5 h-3.5 w-3.5" /> Tambah Material
                </Button>
            </div>
        </div>
    )
}
