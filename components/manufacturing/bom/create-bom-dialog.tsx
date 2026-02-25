"use client"

import { useState, useEffect, useMemo } from "react"
import { useQueryClient } from "@tanstack/react-query"
import { Button } from "@/components/ui/button"
import {
    Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { ScrollArea } from "@/components/ui/scroll-area"
import {
    Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select"
import { toast } from "sonner"
import { queryKeys } from "@/lib/query-keys"
import { NB } from "@/lib/dialog-styles"
import {
    Loader2, Package, Search, X, Check, Layers, Plus,
} from "lucide-react"

const PRODUCT_TYPES = [
    { value: "MANUFACTURED", label: "Manufactured (MFG)", prefix: "MFG" },
    { value: "RAW_MATERIAL", label: "Raw Material (RAW)", prefix: "RAW" },
    { value: "TRADING", label: "Trading (TRD)", prefix: "TRD" },
    { value: "WIP", label: "Work In Process (WIP)", prefix: "WIP" },
]

const TYPE_PREFIX: Record<string, string> = {
    MANUFACTURED: "MFG",
    RAW_MATERIAL: "RAW",
    TRADING: "TRD",
    WIP: "WIP",
}

interface CreateBOMDialogProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    onCreated?: (bom: any) => void
}

export function CreateBOMDialog({ open, onOpenChange, onCreated }: CreateBOMDialogProps) {
    const queryClient = useQueryClient()
    const [loading, setLoading] = useState(false)
    const [products, setProducts] = useState<any[]>([])
    const [materials, setMaterials] = useState<any[]>([])
    const [units, setUnits] = useState<any[]>([])
    const [loadingProducts, setLoadingProducts] = useState(false)

    // Product selection
    const [selectedProduct, setSelectedProduct] = useState<any>(null)
    const [productSearch, setProductSearch] = useState("")
    const [showCreateProduct, setShowCreateProduct] = useState(false)

    // New product form
    const [newProductName, setNewProductName] = useState("")
    const [newProductUnit, setNewProductUnit] = useState("pcs")
    const [newProductType, setNewProductType] = useState("MANUFACTURED")
    const [newProductCost, setNewProductCost] = useState(0)
    const [creatingProduct, setCreatingProduct] = useState(false)

    // Material selection
    const [materialSearch, setMaterialSearch] = useState("")
    const [selectedMaterials, setSelectedMaterials] = useState<Map<string, { material: any; qty: number; waste: number }>>(new Map())
    const [showCreateMaterial, setShowCreateMaterial] = useState(false)

    // New material form
    const [newMatName, setNewMatName] = useState("")
    const [newMatUnit, setNewMatUnit] = useState("pcs")
    const [newMatCost, setNewMatCost] = useState(0)
    const [creatingMaterial, setCreatingMaterial] = useState(false)

    // BOM fields
    const [version, setVersion] = useState("v1")
    const [totalQty, setTotalQty] = useState(0)
    const [notes, setNotes] = useState("")

    const fetchProducts = () => {
        setLoadingProducts(true)
        fetch("/api/products?limit=500&status=active")
            .then((r) => r.json())
            .then((data) => {
                const all = data.data || data.products || []
                setProducts(all)
                setMaterials(all.filter((p: any) => p.productType === "RAW_MATERIAL" || p.productType === "WIP"))
            })
            .catch(() => { setProducts([]); setMaterials([]) })
            .finally(() => setLoadingProducts(false))
    }

    const generateNextCode = (type: string, allProducts: any[]) => {
        const prefix = TYPE_PREFIX[type] || "PRD"
        const existing = allProducts
            .filter((p: any) => p.code?.startsWith(prefix + "-"))
            .map((p: any) => {
                const parts = p.code.split("-")
                const last = parts[parts.length - 1]
                return parseInt(last) || 0
            })
        const maxSeq = existing.length > 0 ? Math.max(...existing) : 0
        return `${prefix}-${String(maxSeq + 1).padStart(3, "0")}`
    }

    useEffect(() => {
        if (open) {
            fetchProducts()
            // Fetch units
            import("@/lib/actions/master-data").then((mod) => {
                mod.getUnits().then((u: any[]) => setUnits(u)).catch(() => setUnits([]))
            })
        } else {
            setSelectedProduct(null)
            setProductSearch("")
            setMaterialSearch("")
            setSelectedMaterials(new Map())
            setVersion("v1")
            setTotalQty(0)
            setNotes("")
            setShowCreateProduct(false)
            setShowCreateMaterial(false)
        }
    }, [open])

    const filteredProducts = useMemo(() => {
        if (!productSearch) return products
        const q = productSearch.toLowerCase()
        return products.filter((p: any) =>
            p.name?.toLowerCase().includes(q) || p.code?.toLowerCase().includes(q)
        )
    }, [products, productSearch])

    const filteredMaterials = useMemo(() => {
        if (!materialSearch) return materials
        const q = materialSearch.toLowerCase()
        return materials.filter((p: any) =>
            p.name?.toLowerCase().includes(q) || p.code?.toLowerCase().includes(q)
        )
    }, [materials, materialSearch])

    const toggleMaterial = (mat: any) => {
        setSelectedMaterials((prev) => {
            const next = new Map(prev)
            if (next.has(mat.id)) {
                next.delete(mat.id)
            } else {
                next.set(mat.id, { material: mat, qty: 1, waste: 0 })
            }
            return next
        })
    }

    const updateMaterialQty = (id: string, qty: number) => {
        setSelectedMaterials((prev) => {
            const next = new Map(prev)
            const item = next.get(id)
            if (item) next.set(id, { ...item, qty })
            return next
        })
    }

    const updateMaterialWaste = (id: string, waste: number) => {
        setSelectedMaterials((prev) => {
            const next = new Map(prev)
            const item = next.get(id)
            if (item) next.set(id, { ...item, waste })
            return next
        })
    }

    // ── Inline Create Product ──
    const handleCreateProduct = async () => {
        if (!newProductName || !newProductUnit) {
            toast.error("Nama dan unit produk wajib diisi")
            return
        }
        setCreatingProduct(true)
        try {
            const code = generateNextCode(newProductType, products)
            const res = await fetch("/api/products", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    name: newProductName,
                    code,
                    unit: newProductUnit,
                    productType: newProductType,
                    costPrice: newProductCost,
                    sellingPrice: 0,
                }),
            })
            const result = await res.json()
            if (result.success) {
                toast.success(`Produk "${newProductName}" berhasil dibuat (${code})`)
                const created = result.data
                setSelectedProduct(created)
                setShowCreateProduct(false)
                setNewProductName("")
                setNewProductUnit("pcs")
                setNewProductType("MANUFACTURED")
                setNewProductCost(0)
                fetchProducts()
            } else {
                toast.error(result.error || "Gagal membuat produk")
            }
        } catch {
            toast.error("Terjadi kesalahan")
        } finally {
            setCreatingProduct(false)
        }
    }

    // ── Inline Create Material ──
    const handleCreateMaterial = async () => {
        if (!newMatName || !newMatUnit) {
            toast.error("Nama dan unit material wajib diisi")
            return
        }
        setCreatingMaterial(true)
        try {
            const code = generateNextCode("RAW_MATERIAL", products)
            const res = await fetch("/api/products", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    name: newMatName,
                    code,
                    unit: newMatUnit,
                    productType: "RAW_MATERIAL",
                    costPrice: newMatCost,
                    sellingPrice: 0,
                }),
            })
            const result = await res.json()
            if (result.success) {
                toast.success(`Material "${newMatName}" berhasil dibuat (${code})`)
                const created = result.data
                setSelectedMaterials((prev) => {
                    const next = new Map(prev)
                    next.set(created.id, { material: created, qty: 1, waste: 0 })
                    return next
                })
                setShowCreateMaterial(false)
                setNewMatName("")
                setNewMatUnit("pcs")
                setNewMatCost(0)
                fetchProducts()
            } else {
                toast.error(result.error || "Gagal membuat material")
            }
        } catch {
            toast.error("Terjadi kesalahan")
        } finally {
            setCreatingMaterial(false)
        }
    }

    // ── Submit BOM ──
    const handleSubmit = async () => {
        if (!selectedProduct) {
            toast.error("Pilih produk terlebih dahulu")
            return
        }
        setLoading(true)
        try {
            const materialsPayload = Array.from(selectedMaterials.entries()).map(([matId, item]) => ({
                materialId: matId,
                quantityPerUnit: item.qty,
                unit: item.material.unit || "",
                wastePct: item.waste,
            }))

            const res = await fetch("/api/manufacturing/production-bom", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    productId: selectedProduct.id,
                    version,
                    totalProductionQty: totalQty,
                    notes: notes || undefined,
                    materials: materialsPayload.length > 0 ? materialsPayload : undefined,
                }),
            })
            const result = await res.json()

            if (result.success) {
                toast.success("Production BOM berhasil dibuat")
                queryClient.invalidateQueries({ queryKey: queryKeys.productionBom.all })
                onOpenChange(false)
                onCreated?.(result.data)
            } else {
                toast.error(result.error || "Gagal membuat BOM")
            }
        } catch {
            toast.error("Terjadi kesalahan")
        } finally {
            setLoading(false)
        }
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className={NB.content}>
                <DialogHeader className={NB.header}>
                    <DialogTitle className={NB.title}>
                        <Package className="h-5 w-5" /> Buat Production BOM Baru
                    </DialogTitle>
                    <p className={NB.subtitle}>Pilih produk, tambahkan material, lalu lanjut ke canvas editor</p>
                </DialogHeader>

                <ScrollArea className={NB.scroll}>
                    <div className="p-5 space-y-5">
                        {/* ═══ STEP 1: Product Selection ═══ */}
                        <div className={NB.section}>
                            <div className={NB.sectionHead}>
                                <span className="bg-black text-white text-[9px] font-black w-5 h-5 flex items-center justify-center">1</span>
                                <span className={NB.sectionTitle}>Pilih Produk</span>
                            </div>
                            <div className={NB.sectionBody}>
                                {selectedProduct ? (
                                    <div className="flex items-center justify-between border-2 border-black bg-orange-50 px-3 py-2">
                                        <div>
                                            <p className="font-black text-sm">{selectedProduct.name}</p>
                                            <p className="text-[10px] font-mono text-zinc-500">{selectedProduct.code} · {selectedProduct.unit} · {selectedProduct.productType}</p>
                                        </div>
                                        <Button variant="ghost" size="sm" onClick={() => setSelectedProduct(null)} className="h-7 w-7 p-0">
                                            <X className="h-4 w-4" />
                                        </Button>
                                    </div>
                                ) : showCreateProduct ? (
                                    /* ── Inline new product form ── */
                                    <div className="border-2 border-orange-400 bg-orange-50/50 p-3 space-y-3">
                                        <div className="flex items-center justify-between">
                                            <p className="text-[10px] font-black uppercase tracking-wider text-orange-600">Produk Baru</p>
                                            <Button variant="ghost" size="sm" onClick={() => setShowCreateProduct(false)} className="h-6 w-6 p-0">
                                                <X className="h-3.5 w-3.5" />
                                            </Button>
                                        </div>
                                        <div className="grid grid-cols-2 gap-2">
                                            <div className="col-span-2">
                                                <label className={NB.label}>Nama Produk <span className={NB.labelRequired}>*</span></label>
                                                <Input value={newProductName} onChange={(e) => setNewProductName(e.target.value)} placeholder="Contoh: Kemeja Flanel Pria" className="h-8 text-xs rounded-none border-2 border-black" />
                                            </div>
                                            <div>
                                                <label className={NB.label}>Tipe Produk</label>
                                                <Select value={newProductType} onValueChange={setNewProductType}>
                                                    <SelectTrigger className="h-8 text-xs rounded-none border-2 border-black">
                                                        <SelectValue />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        {PRODUCT_TYPES.map((t) => (
                                                            <SelectItem key={t.value} value={t.value}>
                                                                <span className="text-xs">{t.label}</span>
                                                            </SelectItem>
                                                        ))}
                                                    </SelectContent>
                                                </Select>
                                            </div>
                                            <div>
                                                <label className={NB.label}>Unit <span className={NB.labelRequired}>*</span></label>
                                                <Select value={newProductUnit} onValueChange={setNewProductUnit}>
                                                    <SelectTrigger className="h-8 text-xs rounded-none border-2 border-black">
                                                        <SelectValue placeholder="Pilih unit..." />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        {units.map((u: any) => (
                                                            <SelectItem key={u.id} value={u.code}>
                                                                <span className="text-xs">{u.code} — {u.name}</span>
                                                            </SelectItem>
                                                        ))}
                                                    </SelectContent>
                                                </Select>
                                            </div>
                                            <div>
                                                <label className={NB.label}>Harga Pokok (Rp)</label>
                                                <Input type="number" value={newProductCost} onChange={(e) => setNewProductCost(parseFloat(e.target.value) || 0)} className="h-8 text-xs font-mono rounded-none border-2 border-black" />
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-2 text-[9px] font-mono text-zinc-400 bg-zinc-100 px-2 py-1 border border-zinc-200">
                                            <span>Kode otomatis:</span>
                                            <span className="font-bold text-black">{generateNextCode(newProductType, products)}</span>
                                        </div>
                                        <Button
                                            onClick={handleCreateProduct}
                                            disabled={creatingProduct || !newProductName}
                                            className="w-full h-8 bg-orange-500 hover:bg-orange-600 text-white font-black uppercase text-[10px] rounded-none border-2 border-orange-600"
                                        >
                                            {creatingProduct ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : <Check className="h-3.5 w-3.5 mr-1" />}
                                            Buat & Pilih Produk
                                        </Button>
                                    </div>
                                ) : (
                                    /* ── Product search + list ── */
                                    <>
                                        <div className="flex items-center gap-2">
                                            <div className="relative flex-1">
                                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400" />
                                                <Input
                                                    value={productSearch}
                                                    onChange={(e) => setProductSearch(e.target.value)}
                                                    placeholder="Cari produk..."
                                                    className="pl-9 h-9 rounded-none border-2 border-black"
                                                />
                                            </div>
                                            <Button
                                                variant="outline"
                                                onClick={() => setShowCreateProduct(true)}
                                                className="h-9 border-2 border-black font-black uppercase text-[9px] tracking-wider rounded-none shrink-0 px-3"
                                            >
                                                <Plus className="h-3.5 w-3.5 mr-1" /> Baru
                                            </Button>
                                        </div>
                                        <ScrollArea className="h-[140px] border-2 border-zinc-200">
                                            {loadingProducts ? (
                                                <div className="flex items-center justify-center py-8">
                                                    <Loader2 className="h-5 w-5 animate-spin text-zinc-300" />
                                                </div>
                                            ) : filteredProducts.length === 0 ? (
                                                <div className="text-center py-8">
                                                    <p className="text-[10px] font-bold text-zinc-400">Tidak ada produk ditemukan</p>
                                                    <Button variant="link" onClick={() => setShowCreateProduct(true)} className="text-[10px] text-orange-500 p-0 h-auto mt-1">
                                                        + Buat produk baru
                                                    </Button>
                                                </div>
                                            ) : (
                                                <div className="divide-y">
                                                    {filteredProducts.map((p: any) => (
                                                        <button
                                                            key={p.id}
                                                            onClick={() => { setSelectedProduct(p); setProductSearch("") }}
                                                            className="w-full text-left px-3 py-2 hover:bg-orange-50 transition-colors"
                                                        >
                                                            <p className="text-xs font-bold">{p.name}</p>
                                                            <p className="text-[10px] text-zinc-400 font-mono">{p.code} · {p.unit} · {p.productType}</p>
                                                        </button>
                                                    ))}
                                                </div>
                                            )}
                                        </ScrollArea>
                                    </>
                                )}

                                <div className="grid grid-cols-2 gap-3">
                                    <div>
                                        <label className={NB.label}>Versi <span className={NB.labelRequired}>*</span></label>
                                        <Input value={version} onChange={(e) => setVersion(e.target.value)} placeholder="v1" className={NB.inputMono} />
                                    </div>
                                    <div>
                                        <label className={NB.label}>Target Produksi (pcs)</label>
                                        <Input type="number" value={totalQty} onChange={(e) => setTotalQty(parseFloat(e.target.value) || 0)} className={NB.inputMono} />
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* ═══ STEP 2: Material Selection ═══ */}
                        <div className={NB.section}>
                            <div className={NB.sectionHead}>
                                <span className="bg-black text-white text-[9px] font-black w-5 h-5 flex items-center justify-center">2</span>
                                <span className={NB.sectionTitle}>Pilih Material</span>
                                <span className="text-[9px] text-zinc-400 font-bold ml-auto">{selectedMaterials.size} dipilih</span>
                            </div>
                            <div className={NB.sectionBody}>
                                <div className="flex items-center gap-2">
                                    <div className="relative flex-1">
                                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400" />
                                        <Input
                                            value={materialSearch}
                                            onChange={(e) => setMaterialSearch(e.target.value)}
                                            placeholder="Cari material (kancing, zipper, kain...)"
                                            className="pl-9 h-9 rounded-none border-2 border-black"
                                        />
                                    </div>
                                    <Button
                                        variant="outline"
                                        onClick={() => setShowCreateMaterial(true)}
                                        className="h-9 border-2 border-black font-black uppercase text-[9px] tracking-wider rounded-none shrink-0 px-3"
                                    >
                                        <Plus className="h-3.5 w-3.5 mr-1" /> Baru
                                    </Button>
                                </div>

                                {/* Inline new material form */}
                                {showCreateMaterial && (
                                    <div className="border-2 border-emerald-400 bg-emerald-50/50 p-3 space-y-3">
                                        <div className="flex items-center justify-between">
                                            <p className="text-[10px] font-black uppercase tracking-wider text-emerald-600">Material Baru</p>
                                            <Button variant="ghost" size="sm" onClick={() => setShowCreateMaterial(false)} className="h-6 w-6 p-0">
                                                <X className="h-3.5 w-3.5" />
                                            </Button>
                                        </div>
                                        <div className="grid grid-cols-2 gap-2">
                                            <div className="col-span-2">
                                                <label className={NB.label}>Nama Material <span className={NB.labelRequired}>*</span></label>
                                                <Input value={newMatName} onChange={(e) => setNewMatName(e.target.value)} placeholder="Contoh: Kancing Plastik 2cm" className="h-8 text-xs rounded-none border-2 border-black" />
                                            </div>
                                            <div>
                                                <label className={NB.label}>Unit <span className={NB.labelRequired}>*</span></label>
                                                <Select value={newMatUnit} onValueChange={setNewMatUnit}>
                                                    <SelectTrigger className="h-8 text-xs rounded-none border-2 border-black">
                                                        <SelectValue placeholder="Pilih unit..." />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        {units.map((u: any) => (
                                                            <SelectItem key={u.id} value={u.code}>
                                                                <span className="text-xs">{u.code} — {u.name}</span>
                                                            </SelectItem>
                                                        ))}
                                                    </SelectContent>
                                                </Select>
                                            </div>
                                            <div>
                                                <label className={NB.label}>Harga Pokok (Rp)</label>
                                                <Input type="number" value={newMatCost} onChange={(e) => setNewMatCost(parseFloat(e.target.value) || 0)} className="h-8 text-xs font-mono rounded-none border-2 border-black" />
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-2 text-[9px] font-mono text-zinc-400 bg-zinc-100 px-2 py-1 border border-zinc-200">
                                            <span>Kode otomatis:</span>
                                            <span className="font-bold text-black">{generateNextCode("RAW_MATERIAL", products)}</span>
                                        </div>
                                        <Button
                                            onClick={handleCreateMaterial}
                                            disabled={creatingMaterial || !newMatName}
                                            className="w-full h-8 bg-emerald-500 hover:bg-emerald-600 text-white font-black uppercase text-[10px] rounded-none border-2 border-emerald-600"
                                        >
                                            {creatingMaterial ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : <Check className="h-3.5 w-3.5 mr-1" />}
                                            Buat & Tambahkan Material
                                        </Button>
                                    </div>
                                )}

                                <ScrollArea className="h-[180px] border-2 border-zinc-200">
                                    {loadingProducts ? (
                                        <div className="flex items-center justify-center py-8">
                                            <Loader2 className="h-5 w-5 animate-spin text-zinc-300" />
                                        </div>
                                    ) : filteredMaterials.length === 0 ? (
                                        <div className="text-center py-8">
                                            <Layers className="h-8 w-8 text-zinc-200 mx-auto mb-2" />
                                            <p className="text-[10px] font-bold text-zinc-400">Tidak ada material ditemukan</p>
                                            <Button variant="link" onClick={() => setShowCreateMaterial(true)} className="text-[10px] text-emerald-500 p-0 h-auto mt-1">
                                                + Buat material baru
                                            </Button>
                                        </div>
                                    ) : (
                                        <div className="divide-y">
                                            {filteredMaterials.map((mat: any) => {
                                                const isSelected = selectedMaterials.has(mat.id)
                                                return (
                                                    <button
                                                        key={mat.id}
                                                        onClick={() => toggleMaterial(mat)}
                                                        className={`w-full text-left px-3 py-2 hover:bg-zinc-50 transition-colors flex items-center gap-2 ${isSelected ? "bg-emerald-50" : ""}`}
                                                    >
                                                        <div className={`w-4 h-4 border-2 flex items-center justify-center shrink-0 ${isSelected ? "bg-emerald-500 border-emerald-500" : "border-zinc-300"}`}>
                                                            {isSelected && <Check className="h-3 w-3 text-white" />}
                                                        </div>
                                                        <div className="min-w-0 flex-1">
                                                            <p className="text-xs font-bold truncate">{mat.name}</p>
                                                            <p className="text-[10px] text-zinc-400 font-mono">{mat.code} · {mat.unit}</p>
                                                        </div>
                                                        {mat.costPrice > 0 && (
                                                            <span className="text-[9px] font-mono text-zinc-400 shrink-0">
                                                                Rp {Number(mat.costPrice).toLocaleString("id-ID")}
                                                            </span>
                                                        )}
                                                    </button>
                                                )
                                            })}
                                        </div>
                                    )}
                                </ScrollArea>

                                {/* Selected materials qty/waste editor */}
                                {selectedMaterials.size > 0 && (
                                    <div className="space-y-2">
                                        <label className={NB.label}>Qty & Waste per Material</label>
                                        {Array.from(selectedMaterials.entries()).map(([id, item]) => (
                                            <div key={id} className="flex items-center gap-2 border border-zinc-200 bg-zinc-50 px-3 py-1.5">
                                                <div className="min-w-0 flex-1">
                                                    <p className="text-[10px] font-bold truncate">{item.material.name}</p>
                                                </div>
                                                <div className="flex items-center gap-1 shrink-0">
                                                    <label className="text-[8px] font-bold text-zinc-400">QTY</label>
                                                    <Input
                                                        type="number"
                                                        value={item.qty}
                                                        onChange={(e) => updateMaterialQty(id, parseFloat(e.target.value) || 0)}
                                                        className="w-16 h-6 text-[10px] font-mono rounded-none border-zinc-300 p-1"
                                                    />
                                                </div>
                                                <div className="flex items-center gap-1 shrink-0">
                                                    <label className="text-[8px] font-bold text-zinc-400">WASTE%</label>
                                                    <Input
                                                        type="number"
                                                        value={item.waste}
                                                        onChange={(e) => updateMaterialWaste(id, parseFloat(e.target.value) || 0)}
                                                        className="w-14 h-6 text-[10px] font-mono rounded-none border-zinc-300 p-1"
                                                    />
                                                </div>
                                                <Button variant="ghost" size="sm" onClick={() => toggleMaterial(item.material)} className="h-6 w-6 p-0">
                                                    <X className="h-3 w-3" />
                                                </Button>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Notes */}
                        <div>
                            <label className={NB.label}>Catatan</label>
                            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Catatan opsional..." className={NB.textarea} />
                        </div>

                        {/* Footer */}
                        <div className={NB.footer}>
                            <Button type="button" variant="outline" className={NB.cancelBtn} onClick={() => onOpenChange(false)}>Batal</Button>
                            <Button
                                disabled={loading || !selectedProduct}
                                onClick={handleSubmit}
                                className={NB.submitBtn}
                            >
                                {loading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Membuat...</> : "Buat BOM & Buka Canvas"}
                            </Button>
                        </div>
                    </div>
                </ScrollArea>
            </DialogContent>
        </Dialog>
    )
}
