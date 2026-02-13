"use client"

import { useEffect, useState } from "react"
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Plus, Trash2, Loader2, Package, Wrench } from "lucide-react"
import { toast } from "sonner"
import { cn } from "@/lib/utils"

interface Product {
    id: string
    code: string
    name: string
    unit: string
}

interface MaterialLine {
    id: string
    materialId: string
    quantity: string
    unit: string
    wastePct: string
}

interface CreateBOMDialogProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    onCreated: () => void
}

export function CreateBOMDialog({ open, onOpenChange, onCreated }: CreateBOMDialogProps) {
    const [products, setProducts] = useState<Product[]>([])
    const [loadingProducts, setLoadingProducts] = useState(false)
    const [submitting, setSubmitting] = useState(false)

    const [productId, setProductId] = useState("")
    const [version, setVersion] = useState("v1")
    const [status, setStatus] = useState("true") // isActive as string
    const [lines, setLines] = useState<MaterialLine[]>([])

    // Fetch products when dialog opens
    useEffect(() => {
        if (open) {
            fetchProducts()
            // Reset form
            setProductId("")
            setVersion("v1")
            setStatus("true")
            setLines([])
        }
    }, [open])

    async function fetchProducts() {
        setLoadingProducts(true)
        try {
            const res = await fetch("/api/products?limit=500&status=active")
            const data = await res.json()
            if (data.success !== false) {
                // API returns either { data: [...] } or { success: true, data: [...] }
                const productList = data.data || data.products || data
                if (Array.isArray(productList)) {
                    setProducts(productList.map((p: any) => ({
                        id: p.id,
                        code: p.code,
                        name: p.name,
                        unit: p.unit,
                    })))
                }
            }
        } catch (error) {
            console.error("Error fetching products:", error)
        } finally {
            setLoadingProducts(false)
        }
    }

    function addLine() {
        setLines(prev => [...prev, {
            id: crypto.randomUUID(),
            materialId: "",
            quantity: "1",
            unit: "",
            wastePct: "0",
        }])
    }

    function removeLine(id: string) {
        setLines(prev => prev.filter(l => l.id !== id))
    }

    function updateLine(id: string, field: keyof MaterialLine, value: string) {
        setLines(prev => prev.map(l => {
            if (l.id !== id) return l
            const updated = { ...l, [field]: value }
            // Auto-fill unit when material is selected
            if (field === "materialId") {
                const product = products.find(p => p.id === value)
                if (product) updated.unit = product.unit
            }
            return updated
        }))
    }

    // Products available as finished good (not already selected as material)
    const finishedGoodProducts = products
    // Products available as materials (exclude the finished good)
    const materialProducts = products.filter(p => p.id !== productId)

    async function handleSubmit() {
        if (!productId) {
            toast.error("Pilih produk jadi terlebih dahulu", {
                className: "font-bold border-2 border-black"
            })
            return
        }

        setSubmitting(true)
        try {
            const res = await fetch("/api/manufacturing/bom", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    productId,
                    version,
                    items: lines
                        .filter(l => l.materialId)
                        .map(l => ({
                            materialId: l.materialId,
                            quantity: l.quantity,
                            unit: l.unit || null,
                            wastePct: l.wastePct,
                        })),
                }),
            })

            const data = await res.json()

            if (data.success) {
                toast.success("Bill of Materials berhasil dibuat", {
                    className: "font-bold border-2 border-black"
                })
                onOpenChange(false)
                onCreated()
            } else {
                toast.error(data.error || "Gagal membuat BOM", {
                    className: "font-bold border-2 border-black"
                })
            }
        } catch (error) {
            console.error("Error creating BOM:", error)
            toast.error("Terjadi kesalahan jaringan", {
                className: "font-bold border-2 border-black"
            })
        } finally {
            setSubmitting(false)
        }
    }

    function getProductLabel(id: string) {
        const p = products.find(p => p.id === id)
        return p ? `${p.code} - ${p.name}` : ""
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-2xl max-h-[90vh] flex flex-col overflow-hidden p-0 border-2 border-black shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] rounded-none">
                {/* Neo-Brutalist Header */}
                <div className="bg-black text-white px-6 pt-6 pb-4 shrink-0">
                    <DialogHeader>
                        <DialogTitle className="text-2xl font-black uppercase tracking-tight text-white flex items-center gap-3">
                            <div className="h-10 w-10 bg-white text-black flex items-center justify-center border-2 border-white shadow-[2px_2px_0px_0px_rgba(255,255,255,0.3)]">
                                <Wrench className="h-5 w-5" />
                            </div>
                            Buat Bill of Materials
                        </DialogTitle>
                        <DialogDescription className="text-zinc-400 font-medium text-xs uppercase tracking-wide mt-2">
                            Definisikan komponen material untuk produk jadi
                        </DialogDescription>
                    </DialogHeader>
                </div>

                {/* Scrollable body */}
                <ScrollArea className="flex-1 min-h-0">
                    <div className="px-6 py-5 space-y-6">
                        {/* Product selection row */}
                        <div className="grid grid-cols-[1fr_auto_auto] gap-4 items-end">
                            <div className="space-y-2">
                                <Label className="text-[10px] font-black uppercase tracking-widest">Produk Jadi *</Label>
                                <Select value={productId} onValueChange={setProductId}>
                                    <SelectTrigger className="border-2 border-black shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] font-bold bg-white dark:bg-zinc-900">
                                        <SelectValue placeholder={loadingProducts ? "Memuat..." : "Pilih produk"} />
                                    </SelectTrigger>
                                    <SelectContent className="max-h-60 border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
                                        {finishedGoodProducts.map(p => (
                                            <SelectItem key={p.id} value={p.id} className="font-medium">
                                                <span className="font-mono text-[10px] text-muted-foreground mr-2 font-bold">{p.code}</span>
                                                {p.name}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-2">
                                <Label className="text-[10px] font-black uppercase tracking-widest">Versi</Label>
                                <Input
                                    value={version}
                                    onChange={(e) => setVersion(e.target.value)}
                                    className="w-20 border-2 border-black shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] font-bold text-center bg-white dark:bg-zinc-900"
                                />
                            </div>
                            <div className="space-y-2">
                                <Label className="text-[10px] font-black uppercase tracking-widest">Status</Label>
                                <Select value={status} onValueChange={setStatus}>
                                    <SelectTrigger className="w-28 border-2 border-black shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] font-bold bg-white dark:bg-zinc-900">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent className="border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
                                        <SelectItem value="true" className="font-bold">Aktif</SelectItem>
                                        <SelectItem value="false" className="font-bold">Nonaktif</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>

                        {/* Material lines */}
                        <div className="space-y-3">
                            <div className="flex items-center justify-between">
                                <Label className="text-xs font-black uppercase tracking-widest">Material / Komponen</Label>
                                <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    onClick={addLine}
                                    className="border-2 border-black shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] transition-all font-black uppercase text-[10px] tracking-wide bg-white active:scale-[0.98]"
                                >
                                    <Plus className="mr-1.5 h-3.5 w-3.5" />
                                    Tambah
                                </Button>
                            </div>

                            {lines.length === 0 ? (
                                <div className="border-2 border-dashed border-black p-8 text-center bg-zinc-50 dark:bg-zinc-800/30">
                                    <div className="h-16 w-16 mx-auto bg-zinc-100 border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] flex items-center justify-center mb-4">
                                        <Package className="h-8 w-8 text-zinc-400" />
                                    </div>
                                    <p className="text-sm font-bold text-muted-foreground mb-3 uppercase tracking-wide">
                                        Belum ada material
                                    </p>
                                    <Button
                                        type="button"
                                        variant="outline"
                                        size="sm"
                                        onClick={addLine}
                                        className="border-2 border-black shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] transition-all font-black uppercase text-[10px] tracking-wide bg-white active:scale-[0.98]"
                                    >
                                        <Plus className="mr-1.5 h-3.5 w-3.5" /> Tambah Material
                                    </Button>
                                </div>
                            ) : (
                                <div className="border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] overflow-hidden">
                                    {/* Column headers */}
                                    <div className="grid grid-cols-[1fr_80px_80px_80px_36px] gap-2 bg-black text-white p-3">
                                        <span className="text-[10px] font-black uppercase tracking-widest">Material</span>
                                        <span className="text-[10px] font-black uppercase tracking-widest">Qty</span>
                                        <span className="text-[10px] font-black uppercase tracking-widest">Satuan</span>
                                        <span className="text-[10px] font-black uppercase tracking-widest">Waste%</span>
                                        <span />
                                    </div>

                                    {lines.map((line, i) => (
                                        <div
                                            key={line.id}
                                            className={cn(
                                                "grid grid-cols-[1fr_80px_80px_80px_36px] gap-2 items-center p-2 border-b border-dashed border-zinc-300 dark:border-zinc-700",
                                                i % 2 === 0 ? "bg-white dark:bg-zinc-900" : "bg-zinc-50/50 dark:bg-zinc-800/30"
                                            )}
                                        >
                                            <Select
                                                value={line.materialId}
                                                onValueChange={(v) => updateLine(line.id, "materialId", v)}
                                            >
                                                <SelectTrigger className="text-xs border-2 border-black font-bold bg-white dark:bg-zinc-900 h-9">
                                                    <SelectValue placeholder="Pilih" />
                                                </SelectTrigger>
                                                <SelectContent className="max-h-60 border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
                                                    {materialProducts.map(p => (
                                                        <SelectItem key={p.id} value={p.id} className="font-medium">
                                                            <span className="font-mono text-[10px] text-muted-foreground mr-1.5 font-bold">{p.code}</span>
                                                            {p.name}
                                                        </SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                            <Input
                                                type="number"
                                                min="0"
                                                step="0.01"
                                                value={line.quantity}
                                                onChange={(e) => updateLine(line.id, "quantity", e.target.value)}
                                                className="text-xs border-2 border-black font-bold text-center bg-white dark:bg-zinc-900 h-9"
                                            />
                                            <Input
                                                value={line.unit}
                                                onChange={(e) => updateLine(line.id, "unit", e.target.value)}
                                                className="text-xs border-2 border-black font-bold text-center bg-zinc-100 dark:bg-zinc-800 h-9"
                                                readOnly
                                            />
                                            <Input
                                                type="number"
                                                min="0"
                                                step="0.1"
                                                value={line.wastePct}
                                                onChange={(e) => updateLine(line.id, "wastePct", e.target.value)}
                                                className="text-xs border-2 border-black font-bold text-center bg-white dark:bg-zinc-900 h-9"
                                            />
                                            <Button
                                                type="button"
                                                variant="ghost"
                                                size="icon"
                                                className="h-9 w-9 text-muted-foreground hover:text-white hover:bg-red-600 border-2 border-transparent hover:border-black transition-all"
                                                onClick={() => removeLine(line.id)}
                                            >
                                                <Trash2 className="h-4 w-4" />
                                            </Button>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                </ScrollArea>

                {/* Neo-Brutalist Footer */}
                <DialogFooter className="px-6 py-4 border-t-2 border-black shrink-0 bg-zinc-50 dark:bg-zinc-800 gap-2">
                    <Button
                        variant="outline"
                        onClick={() => onOpenChange(false)}
                        disabled={submitting}
                        className="border-2 border-black shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] transition-all font-black uppercase text-xs tracking-wide bg-white active:scale-[0.98]"
                    >
                        Batal
                    </Button>
                    <Button
                        onClick={handleSubmit}
                        disabled={submitting || !productId}
                        className="bg-black text-white border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,0.3)] hover:translate-y-[2px] hover:shadow-[2px_2px_0px_0px_rgba(0,0,0,0.3)] transition-all font-black uppercase text-xs tracking-wide active:scale-[0.98]"
                    >
                        {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        Buat BOM
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}
