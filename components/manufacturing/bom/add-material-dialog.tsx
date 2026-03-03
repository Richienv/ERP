"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { ScrollArea } from "@/components/ui/scroll-area"
import { NB } from "@/lib/dialog-styles"
import { Loader2, Search, Package } from "lucide-react"

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
                    // Exclude materials already in BOM
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
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className={NB.contentNarrow}>
                <DialogHeader className={NB.header}>
                    <DialogTitle className={NB.title}><Package className="h-5 w-5" /> Tambah Material</DialogTitle>
                    <p className={NB.subtitle}>Pilih bahan baku untuk ditambahkan ke BOM</p>
                </DialogHeader>
                <div className="p-4 space-y-3">
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400" />
                        <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Cari material..." className="pl-9 h-9 rounded-none border-2 border-black" />
                    </div>

                    <ScrollArea className="h-[200px] border-2 border-zinc-200">
                        {loading ? (
                            <div className="flex items-center justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-zinc-300" /></div>
                        ) : filtered.length === 0 ? (
                            <div className="text-center py-8">
                                <Package className="h-8 w-8 text-zinc-200 mx-auto mb-2" />
                                <p className="text-[10px] font-bold text-zinc-300">Tidak ada material ditemukan</p>
                            </div>
                        ) : (
                            <div className="divide-y">
                                {filtered.map((p) => (
                                    <button
                                        key={p.id}
                                        onClick={() => setSelected(p)}
                                        className={`w-full text-left px-3 py-2 hover:bg-zinc-50 transition-colors ${selected?.id === p.id ? "bg-orange-50 border-l-4 border-l-orange-500" : ""}`}
                                    >
                                        <p className="text-xs font-bold">{p.name}</p>
                                        <p className="text-[10px] text-zinc-400 font-mono">{p.code} · {p.unit}</p>
                                    </button>
                                ))}
                            </div>
                        )}
                    </ScrollArea>

                    {selected && (
                        <div className="grid grid-cols-2 gap-3 border-2 border-black p-3 bg-zinc-50">
                            <div>
                                <label className={NB.label}>Qty per Unit Produk</label>
                                <Input type="number" value={qty} onChange={(e) => setQty(parseFloat(e.target.value) || 0)} className="h-8 text-xs font-mono rounded-none border-zinc-300" />
                            </div>
                            <div>
                                <label className={NB.label}>Waste %</label>
                                <Input type="number" value={waste} onChange={(e) => setWaste(parseFloat(e.target.value) || 0)} className="h-8 text-xs font-mono rounded-none border-zinc-300" />
                            </div>
                        </div>
                    )}

                    <div className={NB.footer}>
                        <Button variant="outline" className={NB.cancelBtn} onClick={() => onOpenChange(false)}>Batal</Button>
                        <Button disabled={!selected} onClick={handleAdd} className={NB.submitBtn}>Tambah Material</Button>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    )
}
