"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Loader2, Search, Package } from "lucide-react"
import {
    NBDialog,
    NBDialogHeader,
    NBDialogBody,
    NBDialogFooter,
} from "@/components/ui/nb-dialog"

interface AddMaterialDialogProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    existingMaterialIds: string[]
    onAdd: (item: { materialId: string; material: any; quantityPerUnit: number; unit: string; wastePct: number }) => void
}

export function AddMaterialDialog({ open, onOpenChange, existingMaterialIds, onAdd }: AddMaterialDialogProps) {
    const [products, setProducts] = useState<any[]>([])
    const [search, setSearch] = useState("")
    const [selected, setSelected] = useState<any>(null)
    const [qty, setQty] = useState(1)
    const [waste, setWaste] = useState(0)
    const [loading, setLoading] = useState(false)

    useEffect(() => {
        if (open) {
            setLoading(true)
            fetch("/api/products?limit=500&status=active&productType=RAW_MATERIAL,WIP")
                .then((r) => r.json())
                .then((data) => {
                    const items = data.data || data.products || []
                    setProducts(items.filter((p: any) => !existingMaterialIds.includes(p.id)))
                })
                .catch(() => setProducts([]))
                .finally(() => setLoading(false))
        } else {
            setSelected(null)
            setSearch("")
            setQty(1)
            setWaste(0)
        }
    }, [open, existingMaterialIds])

    const filtered = products.filter((p) =>
        p.name?.toLowerCase().includes(search.toLowerCase()) ||
        p.code?.toLowerCase().includes(search.toLowerCase())
    )

    const handleAdd = () => {
        if (!selected) return
        onAdd({
            materialId: selected.id,
            material: { id: selected.id, code: selected.code, name: selected.name, unit: selected.unit, costPrice: selected.costPrice },
            quantityPerUnit: qty,
            unit: selected.unit,
            wastePct: waste,
        })
        onOpenChange(false)
    }

    return (
        <NBDialog open={open} onOpenChange={onOpenChange} size="narrow">
            <NBDialogHeader
                icon={Package}
                title="Tambah Material"
                subtitle="Pilih bahan baku untuk ditambahkan ke BOM"
            />

            <NBDialogBody>
                <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400" />
                    <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Cari..." className="pl-9 h-9 rounded-none border border-zinc-300 placeholder:text-zinc-300" />
                </div>

                <ScrollArea className="h-[200px] border border-zinc-200">
                    {loading ? (
                        <div className="flex items-center justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-zinc-300" /></div>
                    ) : filtered.length === 0 ? (
                        <div className="text-center py-8">
                            <Package className="h-8 w-8 text-zinc-200 mx-auto mb-2" />
                            <p className="text-[10px] font-bold text-zinc-300">Tidak ada material ditemukan</p>
                        </div>
                    ) : (
                        <div className="divide-y">
                            {filtered.map((p) => {
                                const stock = p.totalStock ?? p.stockLevels?.reduce((s: number, l: any) => s + (l.quantity || 0), 0) ?? null
                                return (
                                    <button
                                        key={p.id}
                                        onClick={() => setSelected(p)}
                                        className={`w-full text-left px-3 py-2 hover:bg-zinc-50 transition-colors ${selected?.id === p.id ? "bg-orange-50 border-l-4 border-l-orange-500" : ""}`}
                                    >
                                        <div className="flex items-center justify-between gap-2">
                                            <div className="min-w-0 flex-1">
                                                <p className="text-xs font-bold truncate">{p.name}</p>
                                                <p className="text-[10px] text-zinc-400 font-mono">{p.code} · {p.unit}</p>
                                            </div>
                                            {stock != null && (
                                                <span className={`text-[9px] font-black px-1.5 py-0.5 shrink-0 ${
                                                    stock > 0 ? "bg-emerald-50 text-emerald-700 border border-emerald-200" : "bg-red-50 text-red-600 border border-red-200"
                                                }`}>
                                                    Stok: {Number(stock).toLocaleString("id-ID")}
                                                </span>
                                            )}
                                        </div>
                                    </button>
                                )
                            })}
                        </div>
                    )}
                </ScrollArea>

                {selected && (
                    <div className="grid grid-cols-2 gap-3 border border-zinc-200 p-3 bg-zinc-50">
                        <div>
                            <label className="text-[11px] font-bold uppercase tracking-wider text-zinc-600 mb-1 block">Qty per Unit Produk</label>
                            <Input type="number" value={qty} onChange={(e) => setQty(parseFloat(e.target.value) || 0)} className="h-8 text-xs font-mono rounded-none border-zinc-300" />
                        </div>
                        <div>
                            <label className="text-[11px] font-bold uppercase tracking-wider text-zinc-600 mb-1 block">Waste %</label>
                            <Input type="number" value={waste} onChange={(e) => setWaste(parseFloat(e.target.value) || 0)} className="h-8 text-xs font-mono rounded-none border-zinc-300" />
                        </div>
                    </div>
                )}
            </NBDialogBody>

            <NBDialogFooter
                onCancel={() => onOpenChange(false)}
                onSubmit={handleAdd}
                disabled={!selected}
                submitLabel="Tambah Material"
            />
        </NBDialog>
    )
}
