"use client"

import { useState, useEffect } from "react"
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import {
    Package, X, Save, Trash2, Edit3, History,
    ArrowRightLeft, ArrowDownCircle, ArrowUpCircle,
    Loader2, AlertTriangle, Warehouse
} from "lucide-react"
import { toast } from "sonner"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { queryKeys } from "@/lib/query-keys"
import { updateProduct, deleteProduct } from "@/app/actions/inventory"
import { useUnits } from "@/hooks/use-master-data"

interface ProductQuickViewProps {
    productId: string | null
    open: boolean
    onOpenChange: (open: boolean) => void
    categories?: { id: string; name: string; code: string }[]
}

interface ProductData {
    id: string
    code: string
    name: string
    description: string | null
    unit: string
    categoryId: string | null
    categoryName: string | null
    costPrice: number
    sellingPrice: number
    minStock: number
    maxStock: number
    reorderLevel: number
    barcode: string | null
    isActive: boolean
    manualAlert: boolean
    stockLevels: { warehouseId: string; warehouseName: string; quantity: number }[]
    totalStock: number
}

interface Movement {
    id: string
    type: string
    date: string
    qty: number
    warehouseId: string
    warehouseName: string
    referenceId?: string
    reference?: string
    entity?: string
    notes?: string
    performedBy: string
}

type Tab = "detail" | "movements"

function getMovementIcon(type: string) {
    if (['PO_RECEIVE', 'PRODUCTION_IN', 'RETURN_IN', 'INITIAL'].includes(type)) {
        return <ArrowDownCircle className="h-4 w-4 text-emerald-600" />
    }
    if (['SO_SHIPMENT', 'PRODUCTION_OUT', 'RETURN_OUT', 'SCRAP'].includes(type)) {
        return <ArrowUpCircle className="h-4 w-4 text-red-500" />
    }
    if (type === 'TRANSFER') {
        return <ArrowRightLeft className="h-4 w-4 text-blue-500" />
    }
    return <Package className="h-4 w-4 text-amber-500" />
}

function getMovementLabel(type: string): string {
    const labels: Record<string, string> = {
        PO_RECEIVE: "Penerimaan PO",
        PRODUCTION_IN: "Produksi Masuk",
        RETURN_IN: "Retur Masuk",
        SO_SHIPMENT: "Pengiriman SO",
        PRODUCTION_OUT: "Produksi Keluar",
        RETURN_OUT: "Retur Keluar",
        SCRAP: "Scrap",
        TRANSFER: "Transfer",
        ADJUSTMENT: "Penyesuaian",
        INITIAL: "Saldo Awal",
    }
    return labels[type] || type
}

function getMovementColor(type: string): string {
    if (['PO_RECEIVE', 'PRODUCTION_IN', 'RETURN_IN', 'INITIAL'].includes(type)) return "bg-emerald-100 text-emerald-800 border-emerald-300"
    if (['SO_SHIPMENT', 'PRODUCTION_OUT', 'RETURN_OUT', 'SCRAP'].includes(type)) return "bg-red-100 text-red-800 border-red-300"
    if (type === 'TRANSFER') return "bg-blue-100 text-blue-800 border-blue-300"
    return "bg-amber-100 text-amber-800 border-amber-300"
}

export function ProductQuickView({ productId, open, onOpenChange, categories = [] }: ProductQuickViewProps) {
    const [tab, setTab] = useState<Tab>("detail")
    const [editing, setEditing] = useState(false)
    const [saving, setSaving] = useState(false)
    const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
    const [editForm, setEditForm] = useState<Partial<ProductData>>({})
    const queryClient = useQueryClient()
    const { data: units = [] } = useUnits()

    const { data: queryData, isLoading: loading } = useQuery({
        queryKey: queryKeys.products.detail(productId ?? ""),
        queryFn: async () => {
            const res = await fetch(`/api/products/${productId}`)
            const json = await res.json()
            if (!json.success || !json.data) return null
            const raw = json.data
            const prod: ProductData = {
                id: raw.id,
                code: raw.code,
                name: raw.name,
                description: raw.description,
                unit: raw.unit,
                categoryId: raw.categoryId,
                categoryName: raw.category?.name ?? null,
                costPrice: raw.costPrice,
                sellingPrice: raw.sellingPrice,
                minStock: raw.minStock,
                maxStock: raw.maxStock,
                reorderLevel: raw.reorderLevel,
                barcode: raw.barcode,
                isActive: raw.isActive,
                manualAlert: raw.manualAlert ?? false,
                stockLevels: (raw.stockLevels ?? []).map((sl: any) => ({
                    warehouseId: sl.warehouseId,
                    warehouseName: sl.warehouse?.name ?? "Unknown",
                    quantity: sl.quantity,
                })),
                totalStock: raw.currentStock ?? (raw.stockLevels ?? []).reduce((s: number, l: any) => s + l.quantity, 0),
            }
            const movs: Movement[] = (raw.transactions ?? []).map((t: any) => ({
                id: t.id,
                type: t.type,
                date: t.createdAt,
                qty: t.quantity,
                warehouseId: t.warehouseId,
                warehouseName: t.warehouse?.name ?? "Unknown",
                referenceId: t.referenceId ?? undefined,
                reference: t.reference ?? undefined,
                entity: t.entity ?? undefined,
                notes: t.notes ?? undefined,
                performedBy: t.performedBy ?? "",
            }))
            return { product: prod, movements: movs }
        },
        enabled: open && !!productId,
    })

    const product = queryData?.product ?? null
    const movements = queryData?.movements ?? []

    // Reset tab and editing when dialog opens with a new product
    useEffect(() => {
        if (open && productId) {
            setTab("detail")
            setEditing(false)
        }
    }, [open, productId])

    // Sync editForm when product data loads
    useEffect(() => {
        if (product) {
            setEditForm({
                name: product.name,
                description: product.description,
                unit: product.unit,
                categoryId: product.categoryId,
                costPrice: product.costPrice,
                sellingPrice: product.sellingPrice,
                minStock: product.minStock,
                maxStock: product.maxStock,
                reorderLevel: product.reorderLevel,
                barcode: product.barcode,
            })
        }
    }, [product])

    const handleSave = async () => {
        if (!productId) return
        setSaving(true)
        try {
            const result = await updateProduct(productId, {
                name: editForm.name,
                description: editForm.description || undefined,
                categoryId: editForm.categoryId || undefined,
                unit: editForm.unit,
                costPrice: editForm.costPrice,
                sellingPrice: editForm.sellingPrice,
                minStock: editForm.minStock,
                maxStock: editForm.maxStock,
                reorderLevel: editForm.reorderLevel,
                barcode: editForm.barcode || undefined,
            })
            if (result.success) {
                toast.success("Produk berhasil diperbarui")
                setEditing(false)
                queryClient.invalidateQueries({ queryKey: queryKeys.products.all })
                queryClient.invalidateQueries({ queryKey: queryKeys.inventoryDashboard.all })
                queryClient.invalidateQueries({ queryKey: queryKeys.categories.all })
                queryClient.invalidateQueries({ queryKey: queryKeys.sidebarActions.all })
            } else {
                toast.error(result.error || "Gagal memperbarui")
            }
        } catch {
            toast.error("Error saat menyimpan")
        } finally {
            setSaving(false)
        }
    }

    const handleDelete = async () => {
        if (!productId) return
        const result = await deleteProduct(productId)
        if (result.success) {
            toast.success("Produk berhasil dihapus")
            setDeleteDialogOpen(false)
            onOpenChange(false)
            queryClient.invalidateQueries({ queryKey: queryKeys.products.all })
            queryClient.invalidateQueries({ queryKey: queryKeys.inventoryDashboard.all })
            queryClient.invalidateQueries({ queryKey: queryKeys.sidebarActions.all })
        } else {
            toast.error(result.error || "Gagal menghapus")
        }
    }

    // Group transfer movements — find paired transfers by referenceId
    const enrichedMovements = movements.map(mv => {
        if (mv.type === 'TRANSFER' && mv.referenceId) {
            const pair = movements.find(m => m.id !== mv.id && m.referenceId === mv.referenceId && m.type === 'TRANSFER')
            if (mv.qty < 0 && pair) {
                return { ...mv, fromWarehouse: mv.warehouseName, toWarehouse: pair.warehouseName }
            }
            if (mv.qty > 0 && pair) {
                return { ...mv, fromWarehouse: pair.warehouseName, toWarehouse: mv.warehouseName }
            }
        }
        return { ...mv, fromWarehouse: undefined, toWarehouse: undefined }
    })

    return (
        <>
            <Dialog open={open} onOpenChange={onOpenChange}>
                <DialogContent className="max-w-2xl p-0 border-2 border-black shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] rounded-none overflow-hidden gap-0">
                    {/* Header */}
                    <DialogHeader className="bg-black text-white px-6 py-4">
                        <div className="flex items-center justify-between">
                            <div className="flex-1 min-w-0">
                                <DialogTitle className="text-lg font-black uppercase tracking-wider text-white truncate">
                                    {loading ? "Memuat..." : product?.name || "Produk"}
                                </DialogTitle>
                                {product && (
                                    <div className="flex items-center gap-2 mt-1">
                                        <span className="font-mono text-xs text-zinc-400">{product.code}</span>
                                        {product.categoryName && (
                                            <Badge className="bg-white/10 text-white border-white/20 text-[9px] font-bold">
                                                {product.categoryName}
                                            </Badge>
                                        )}
                                    </div>
                                )}
                            </div>
                            {product && !loading && (
                                <div className="flex items-center gap-1.5 ml-4">
                                    <Button
                                        size="sm"
                                        variant="ghost"
                                        onClick={() => setEditing(!editing)}
                                        className="text-white hover:bg-white/20 h-8 px-2"
                                    >
                                        <Edit3 className="h-3.5 w-3.5" />
                                    </Button>
                                    <Button
                                        size="sm"
                                        variant="ghost"
                                        onClick={() => setDeleteDialogOpen(true)}
                                        className="text-red-400 hover:bg-red-500/20 h-8 px-2"
                                    >
                                        <Trash2 className="h-3.5 w-3.5" />
                                    </Button>
                                </div>
                            )}
                        </div>
                    </DialogHeader>

                    {/* Tab Bar */}
                    <div className="flex border-b-2 border-black">
                        <button
                            onClick={() => setTab("detail")}
                            className={`flex-1 px-4 py-2.5 text-xs font-black uppercase tracking-widest transition-all border-r-2 border-black ${
                                tab === "detail" ? "bg-black text-white" : "bg-white text-zinc-500 hover:bg-zinc-50"
                            }`}
                        >
                            <Package className="h-3.5 w-3.5 inline mr-1.5" />
                            Detail Produk
                        </button>
                        <button
                            onClick={() => setTab("movements")}
                            className={`flex-1 px-4 py-2.5 text-xs font-black uppercase tracking-widest transition-all ${
                                tab === "movements" ? "bg-black text-white" : "bg-white text-zinc-500 hover:bg-zinc-50"
                            }`}
                        >
                            <History className="h-3.5 w-3.5 inline mr-1.5" />
                            Riwayat Stok
                            {movements.length > 0 && (
                                <span className={`ml-1.5 inline-flex items-center justify-center px-1.5 h-4 text-[9px] font-black rounded-full ${
                                    tab === "movements" ? "bg-amber-400 text-black" : "bg-zinc-200 text-zinc-600"
                                }`}>
                                    {movements.length}
                                </span>
                            )}
                        </button>
                    </div>

                    {/* Content */}
                    <ScrollArea className="max-h-[60vh]">
                        {loading ? (
                            <div className="flex items-center justify-center py-20">
                                <Loader2 className="h-6 w-6 animate-spin text-zinc-400" />
                            </div>
                        ) : !product ? (
                            <div className="text-center py-20 text-zinc-400">
                                <AlertTriangle className="h-8 w-8 mx-auto mb-2" />
                                <p className="text-sm font-bold">Produk tidak ditemukan</p>
                            </div>
                        ) : (
                            <div className="p-5">
                                {/* Detail Tab */}
                                {tab === "detail" && (
                                    <div className="space-y-5">
                                        {/* Stock Summary Strip */}
                                        <div className="grid grid-cols-3 gap-2">
                                            <div className="bg-zinc-50 border-2 border-black p-3 text-center">
                                                <div className="text-[9px] font-black uppercase tracking-wider text-zinc-500">Total Stok</div>
                                                <div className="text-xl font-black">{product.totalStock}</div>
                                                <div className="text-[10px] text-zinc-400 font-bold">{product.unit}</div>
                                            </div>
                                            <div className="bg-zinc-50 border-2 border-black p-3 text-center">
                                                <div className="text-[9px] font-black uppercase tracking-wider text-zinc-500">Min Stok</div>
                                                <div className="text-xl font-black">{product.minStock}</div>
                                                <div className="text-[10px] text-zinc-400 font-bold">{product.unit}</div>
                                            </div>
                                            <div className="bg-zinc-50 border-2 border-black p-3 text-center">
                                                <div className="text-[9px] font-black uppercase tracking-wider text-zinc-500">Gudang</div>
                                                <div className="text-xl font-black">{product.stockLevels.length}</div>
                                                <div className="text-[10px] text-zinc-400 font-bold">lokasi</div>
                                            </div>
                                        </div>

                                        {/* Per-warehouse breakdown */}
                                        {product.stockLevels.length > 0 && (
                                            <div className="border-2 border-black">
                                                <div className="bg-zinc-100 px-3 py-2 border-b-2 border-black flex items-center gap-2">
                                                    <Warehouse className="h-3.5 w-3.5" />
                                                    <span className="text-[10px] font-black uppercase tracking-widest">Distribusi Gudang</span>
                                                </div>
                                                {product.stockLevels.map((sl, i) => (
                                                    <div key={sl.warehouseId} className={`flex items-center justify-between px-3 py-2 ${i > 0 ? 'border-t border-zinc-200' : ''}`}>
                                                        <span className="text-sm font-bold">{sl.warehouseName}</span>
                                                        <span className="font-mono font-black text-sm">{sl.quantity} {product.unit}</span>
                                                    </div>
                                                ))}
                                            </div>
                                        )}

                                        {/* Editable Fields */}
                                        {editing ? (
                                            <div className="space-y-4 border-2 border-amber-300 bg-amber-50/50 p-4">
                                                <div className="flex items-center gap-2 mb-2">
                                                    <Edit3 className="h-4 w-4 text-amber-600" />
                                                    <span className="text-xs font-black uppercase tracking-widest text-amber-700">Mode Edit</span>
                                                </div>
                                                <div className="grid grid-cols-2 gap-3">
                                                    <div>
                                                        <label className="text-[10px] font-black uppercase tracking-wider text-zinc-500">Nama Produk</label>
                                                        <Input
                                                            value={editForm.name || ""}
                                                            onChange={e => setEditForm(f => ({ ...f, name: e.target.value }))}
                                                            className="mt-1 border-2 border-black font-bold h-9"
                                                        />
                                                    </div>
                                                    <div>
                                                        <label className="text-[10px] font-black uppercase tracking-wider text-zinc-500">Satuan</label>
                                                        <Select value={editForm.unit || "pcs"} onValueChange={v => setEditForm(f => ({ ...f, unit: v }))}>
                                                            <SelectTrigger className="mt-1 border-2 border-black font-bold h-9">
                                                                <SelectValue />
                                                            </SelectTrigger>
                                                            <SelectContent>
                                                                {units.map(u => <SelectItem key={u.code} value={u.code}>{u.code} - {u.name}</SelectItem>)}
                                                            </SelectContent>
                                                        </Select>
                                                    </div>
                                                </div>
                                                <div>
                                                    <label className="text-[10px] font-black uppercase tracking-wider text-zinc-500">Deskripsi</label>
                                                    <Textarea
                                                        value={editForm.description || ""}
                                                        onChange={e => setEditForm(f => ({ ...f, description: e.target.value }))}
                                                        className="mt-1 border-2 border-black font-medium min-h-[60px]"
                                                    />
                                                </div>
                                                <div className="grid grid-cols-2 gap-3">
                                                    <div>
                                                        <label className="text-[10px] font-black uppercase tracking-wider text-zinc-500">HPP (Rp)</label>
                                                        <Input
                                                            type="number"
                                                            value={editForm.costPrice || 0}
                                                            onChange={e => setEditForm(f => ({ ...f, costPrice: parseFloat(e.target.value) || 0 }))}
                                                            className="mt-1 border-2 border-black font-mono font-bold h-9"
                                                        />
                                                    </div>
                                                    <div>
                                                        <label className="text-[10px] font-black uppercase tracking-wider text-zinc-500">Harga Jual (Rp)</label>
                                                        <Input
                                                            type="number"
                                                            value={editForm.sellingPrice || 0}
                                                            onChange={e => setEditForm(f => ({ ...f, sellingPrice: parseFloat(e.target.value) || 0 }))}
                                                            className="mt-1 border-2 border-black font-mono font-bold h-9"
                                                        />
                                                    </div>
                                                </div>
                                                <div className="grid grid-cols-3 gap-3">
                                                    <div>
                                                        <label className="text-[10px] font-black uppercase tracking-wider text-zinc-500">Min Stok</label>
                                                        <Input
                                                            type="number"
                                                            value={editForm.minStock || 0}
                                                            onChange={e => setEditForm(f => ({ ...f, minStock: parseInt(e.target.value) || 0 }))}
                                                            className="mt-1 border-2 border-black font-mono font-bold h-9"
                                                        />
                                                    </div>
                                                    <div>
                                                        <label className="text-[10px] font-black uppercase tracking-wider text-zinc-500">Max Stok</label>
                                                        <Input
                                                            type="number"
                                                            value={editForm.maxStock || 0}
                                                            onChange={e => setEditForm(f => ({ ...f, maxStock: parseInt(e.target.value) || 0 }))}
                                                            className="mt-1 border-2 border-black font-mono font-bold h-9"
                                                        />
                                                    </div>
                                                    <div>
                                                        <label className="text-[10px] font-black uppercase tracking-wider text-zinc-500">Reorder</label>
                                                        <Input
                                                            type="number"
                                                            value={editForm.reorderLevel || 0}
                                                            onChange={e => setEditForm(f => ({ ...f, reorderLevel: parseInt(e.target.value) || 0 }))}
                                                            className="mt-1 border-2 border-black font-mono font-bold h-9"
                                                        />
                                                    </div>
                                                </div>
                                                {categories.length > 0 && (
                                                    <div>
                                                        <label className="text-[10px] font-black uppercase tracking-wider text-zinc-500">Kategori</label>
                                                        <Select value={editForm.categoryId || "none"} onValueChange={v => setEditForm(f => ({ ...f, categoryId: v === "none" ? null : v }))}>
                                                            <SelectTrigger className="mt-1 border-2 border-black font-bold h-9">
                                                                <SelectValue />
                                                            </SelectTrigger>
                                                            <SelectContent>
                                                                <SelectItem value="none">Tanpa Kategori</SelectItem>
                                                                {categories.map(c => <SelectItem key={c.id} value={c.id}>{c.code} - {c.name}</SelectItem>)}
                                                            </SelectContent>
                                                        </Select>
                                                    </div>
                                                )}
                                                <div className="flex gap-2 pt-2">
                                                    <Button
                                                        onClick={handleSave}
                                                        disabled={saving}
                                                        className="flex-1 bg-black text-white border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:translate-y-[2px] hover:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] transition-all font-black uppercase text-xs tracking-wider"
                                                    >
                                                        {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
                                                        Simpan
                                                    </Button>
                                                    <Button
                                                        variant="outline"
                                                        onClick={() => setEditing(false)}
                                                        className="border-2 border-black font-black uppercase text-xs tracking-wider"
                                                    >
                                                        <X className="h-4 w-4 mr-1" /> Batal
                                                    </Button>
                                                </div>
                                            </div>
                                        ) : (
                                            /* Read-only Detail */
                                            <div className="border-2 border-black divide-y-2 divide-black">
                                                {[
                                                    { label: "Deskripsi", value: product.description || "-" },
                                                    { label: "HPP", value: `Rp ${(product.costPrice || 0).toLocaleString('id-ID')}` },
                                                    { label: "Harga Jual", value: `Rp ${(product.sellingPrice || 0).toLocaleString('id-ID')}` },
                                                    { label: "Min / Max / Reorder", value: `${product.minStock} / ${product.maxStock} / ${product.reorderLevel}` },
                                                    { label: "Barcode", value: product.barcode || "-" },
                                                ].map(({ label, value }) => (
                                                    <div key={label} className="flex items-center px-3 py-2.5">
                                                        <span className="text-[10px] font-black uppercase tracking-wider text-zinc-500 w-32 flex-none">{label}</span>
                                                        <span className="text-sm font-bold text-zinc-900 flex-1">{value}</span>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                )}

                                {/* Movements Tab */}
                                {tab === "movements" && (
                                    <div className="space-y-3">
                                        {enrichedMovements.length === 0 ? (
                                            <div className="text-center py-12 border-2 border-dashed border-zinc-200">
                                                <History className="h-8 w-8 mx-auto text-zinc-300 mb-2" />
                                                <p className="text-xs font-black uppercase text-zinc-400">Belum ada riwayat pergerakan</p>
                                            </div>
                                        ) : (
                                            enrichedMovements.map((mv) => (
                                                <div key={mv.id} className="border-2 border-black bg-white hover:bg-zinc-50 transition-colors">
                                                    <div className="flex items-start gap-3 p-3">
                                                        {/* Icon */}
                                                        <div className="flex-none mt-0.5">{getMovementIcon(mv.type)}</div>
                                                        {/* Content */}
                                                        <div className="flex-1 min-w-0">
                                                            <div className="flex items-center justify-between gap-2 mb-1">
                                                                <Badge className={`text-[9px] font-black border ${getMovementColor(mv.type)}`}>
                                                                    {getMovementLabel(mv.type)}
                                                                </Badge>
                                                                <span className="text-[10px] text-zinc-400 font-bold">
                                                                    {new Date(mv.date).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}
                                                                </span>
                                                            </div>
                                                            {/* Warehouse info */}
                                                            <div className="text-xs font-bold text-zinc-700 mb-1">
                                                                {mv.type === 'TRANSFER' && (mv as any).fromWarehouse ? (
                                                                    <span className="flex items-center gap-1.5">
                                                                        <Warehouse className="h-3 w-3 text-zinc-400" />
                                                                        <span>{(mv as any).fromWarehouse}</span>
                                                                        <ArrowRightLeft className="h-3 w-3 text-blue-500" />
                                                                        <span>{(mv as any).toWarehouse}</span>
                                                                    </span>
                                                                ) : (
                                                                    <span className="flex items-center gap-1.5">
                                                                        <Warehouse className="h-3 w-3 text-zinc-400" />
                                                                        {mv.warehouseName}
                                                                    </span>
                                                                )}
                                                            </div>
                                                            {/* Reference & entity */}
                                                            {(mv.reference || mv.entity || mv.notes) && (
                                                                <div className="text-[10px] text-zinc-400 mt-0.5">
                                                                    {mv.reference && <span className="font-mono">{mv.reference}</span>}
                                                                    {mv.entity && <span> &middot; {mv.entity}</span>}
                                                                    {mv.notes && !mv.reference && !mv.entity && <span>{mv.notes}</span>}
                                                                </div>
                                                            )}
                                                        </div>
                                                        {/* Qty */}
                                                        <div className={`flex-none text-right font-mono font-black text-base ${mv.qty > 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                                                            {mv.qty > 0 ? '+' : ''}{mv.qty}
                                                        </div>
                                                    </div>
                                                </div>
                                            ))
                                        )}
                                    </div>
                                )}
                            </div>
                        )}
                    </ScrollArea>
                </DialogContent>
            </Dialog>

            {/* Delete Confirmation */}
            <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
                <AlertDialogContent className="border-2 border-black shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] rounded-none">
                    <AlertDialogHeader>
                        <AlertDialogTitle className="font-black uppercase tracking-wide flex items-center gap-2">
                            <AlertTriangle className="h-5 w-5 text-red-500" />
                            Hapus Produk?
                        </AlertDialogTitle>
                        <AlertDialogDescription>
                            Produk <strong>{product?.name}</strong> ({product?.code}) akan dinonaktifkan.
                            Produk yang memiliki stok tidak dapat dihapus.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel className="border-2 border-black font-bold">Batal</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={handleDelete}
                            className="bg-red-600 text-white border-2 border-red-700 font-black uppercase tracking-wider hover:bg-red-700"
                        >
                            <Trash2 className="h-4 w-4 mr-2" /> Hapus
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </>
    )
}
