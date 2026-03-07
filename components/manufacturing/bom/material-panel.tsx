"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Plus, Search, GripVertical, X, Package } from "lucide-react"

interface MaterialPanelProps {
    items: any[]
    steps: any[]
    onAddItem: () => void
    onRemoveItem: (id: string) => void
}

export function MaterialPanel({ items, steps, onAddItem, onRemoveItem }: MaterialPanelProps) {
    const [search, setSearch] = useState("")

    const filtered = items.filter((item) =>
        item.material?.name?.toLowerCase().includes(search.toLowerCase()) ||
        item.material?.code?.toLowerCase().includes(search.toLowerCase())
    )

    return (
        <div className="w-[220px] lg:w-[280px] 2xl:w-[320px] border-r-2 border-black bg-white flex flex-col h-full shrink-0">
            {/* Header */}
            <div className="px-4 py-3 border-b-2 border-black bg-zinc-50">
                <h3 className="text-xs font-black uppercase tracking-widest">Material</h3>
                <p className="text-[9px] font-bold text-zinc-400 mt-0.5">Drag ke work center proses</p>
            </div>

            {/* Search */}
            <div className="p-3 border-b border-zinc-200">
                <div className="relative">
                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-zinc-400" />
                    <Input
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        placeholder="Cari..."
                        className="pl-8 h-8 text-xs border-zinc-200 rounded-none placeholder:text-zinc-300"
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
                                className="flex items-center gap-2 p-2 border border-zinc-200 bg-white hover:border-black hover:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] transition-all cursor-grab active:cursor-grabbing group"
                            >
                                <GripVertical className="h-3.5 w-3.5 text-zinc-300 shrink-0" />
                                <div className="min-w-0 flex-1">
                                    <p className="text-xs font-bold truncate">{item.material?.name}</p>
                                    <p className="text-[9px] text-zinc-400 font-mono">{item.material?.code} · {Number(item.quantityPerUnit)} {item.unit || item.material?.unit || "pcs"}</p>
                                </div>
                                {assignCount > 0 && (
                                    <span className="bg-black text-white text-[9px] font-black w-5 h-5 flex items-center justify-center shrink-0">
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
                            <p className="text-[10px] font-bold text-zinc-300">Belum ada material</p>
                        </div>
                    )}
                </div>
            </ScrollArea>

            {/* Add button */}
            <div className="p-3 border-t-2 border-black">
                <Button onClick={onAddItem} className="w-full h-8 bg-black text-white font-black uppercase text-[10px] tracking-wider rounded-none shadow-[2px_2px_0px_0px_rgba(0,0,0,0.3)]">
                    <Plus className="mr-1.5 h-3.5 w-3.5" /> Tambah Material
                </Button>
            </div>
        </div>
    )
}
