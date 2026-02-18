'use client'

import { useState } from 'react'
import { ScrollArea } from '@/components/ui/scroll-area'
import { setProductManualAlert, createRestockRequest } from '@/app/actions/inventory'
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
import { cn } from "@/lib/utils"
import { AlertCircle, CheckCircle2, Package, Calculator, Truck, Eye } from 'lucide-react'
import { toast } from 'sonner'
import { useQueryClient } from "@tanstack/react-query"
import { queryKeys } from "@/lib/query-keys"
import { ProductQuickView } from '@/components/inventory/product-quick-view'

interface Product {
    id: string
    code: string
    name: string
    category: { name: string } | null | string
    unit: string
    minStock: number
    totalStock: number
    status: string
    manualAlert: boolean
    costPrice?: number
    image: string
}

interface KanbanColumnProps {
    title: string
    status: string
    products: Product[]
    color: string
    onDrop: (productId: string, newStatus: string) => void
    onCardClick: (productId: string) => void
}

function KanbanColumn({ title, status, products, color, onDrop, onCardClick }: KanbanColumnProps) {
    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault()
    }

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault()
        const productId = e.dataTransfer.getData('productId')
        if (productId) {
            onDrop(productId, status)
        }
    }

    // Map status to "Ritchie Minimal" colors (Solid Pastels)
    const bgColor =
        status === 'CRITICAL' ? 'bg-red-50' :
            status === 'LOW_STOCK' ? 'bg-amber-50' :
                status === 'NEW' ? 'bg-blue-50' :
                    'bg-emerald-50'

    const borderColor = 'border-black'
    const shadowClass = 'shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]'

    // Map status to accent colors for left border
    const accentColor =
        status === 'CRITICAL' ? 'border-l-red-400' :
            status === 'LOW_STOCK' ? 'border-l-amber-400' :
                status === 'NEW' ? 'border-l-blue-400' :
                    'border-l-emerald-400'

    const headerBg =
        status === 'CRITICAL' ? 'bg-red-50 dark:bg-red-950/20' :
            status === 'LOW_STOCK' ? 'bg-amber-50 dark:bg-amber-950/20' :
                status === 'NEW' ? 'bg-blue-50 dark:bg-blue-950/20' :
                    'bg-emerald-50 dark:bg-emerald-950/20'

    const countBg =
        status === 'CRITICAL' ? 'bg-red-500' :
            status === 'LOW_STOCK' ? 'bg-amber-500' :
                status === 'NEW' ? 'bg-blue-500' :
                    'bg-emerald-500'

    return (
        <div
            className="flex-1 min-w-[320px] max-w-[400px] flex flex-col border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] bg-white dark:bg-zinc-900 overflow-hidden"
            onDragOver={handleDragOver}
            onDrop={handleDrop}
        >
            {/* Column Header */}
            <div className={`px-4 py-2.5 border-b-2 border-black flex items-center gap-2 border-l-[5px] ${accentColor} ${headerBg}`}>
                <div className="flex items-center gap-2 flex-1">
                    {status === 'CRITICAL' && <AlertCircle className="h-4 w-4 text-red-600" />}
                    {status === 'LOW_STOCK' && <Package className="h-4 w-4 text-amber-600" />}
                    {status === 'HEALTHY' && <CheckCircle2 className="h-4 w-4 text-emerald-600" />}
                    {status === 'NEW' && <Package className="h-4 w-4 text-blue-600" />}
                    <h3 className="text-[11px] font-black uppercase tracking-widest text-zinc-700 dark:text-zinc-200">
                        {title}
                    </h3>
                </div>
                <span className={`${countBg} text-white text-[10px] font-black px-2 py-0.5 min-w-[20px] text-center rounded-sm`}>
                    {products.length}
                </span>
            </div>

            {/* Column Content */}
            <div className="p-3">
                <div className="space-y-3 pb-4">
                    {products.map(product => (
                        <div
                            key={product.id}
                            draggable
                            onDragStart={(e) => e.dataTransfer.setData('productId', product.id)}
                            onClick={() => onCardClick(product.id)}
                            className={cn(
                                "p-4 bg-white dark:bg-zinc-800 border-2 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] cursor-pointer active:cursor-grabbing relative group hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-[1px_1px_0px_0px_rgba(0,0,0,1)] transition-all",
                                product.manualAlert && "border-red-600 shadow-red-900/20"
                            )}
                        >
                            <div className="flex justify-between items-start mb-2">
                                <span className="text-[10px] font-black uppercase tracking-wide px-2 py-0.5 border-2 border-black bg-zinc-100 text-zinc-700">
                                    {product.code}
                                </span>
                                {product.manualAlert && (
                                    <span className="text-[9px] font-black uppercase px-1.5 py-0.5 bg-red-600 text-white border-2 border-red-800">
                                        ALERT
                                    </span>
                                )}
                            </div>

                            <h4 className="font-black text-sm leading-tight mb-1 text-zinc-900 dark:text-zinc-100 line-clamp-2 uppercase">
                                {product.name}
                            </h4>
                            <p className="text-[10px] uppercase tracking-widest text-zinc-400 font-bold mb-3">
                                {typeof product.category === 'object' ? product.category?.name || 'Uncategorized' : product.category}
                            </p>

                            <div className="flex items-center justify-between pt-3 border-t-2 border-zinc-100 dark:border-zinc-700">
                                <div>
                                    <div className="text-[9px] font-black uppercase tracking-widest text-zinc-400">Level Stok</div>
                                    <div className={cn("font-black text-base leading-none mt-0.5", product.totalStock === 0 ? "text-red-600" : "text-zinc-900 dark:text-zinc-100")}>
                                        {product.totalStock} <span className="text-[10px] text-zinc-400 font-bold">{product.unit}</span>
                                    </div>
                                </div>
                                {product.status !== 'HEALTHY' && (
                                    <span className={cn(
                                        "text-[9px] font-black uppercase px-2 py-1 border-2 border-black shadow-[1px_1px_0px_0px_rgba(0,0,0,1)]",
                                        product.status === 'CRITICAL' ? "bg-red-100 text-red-800" :
                                            product.status === 'LOW_STOCK' ? "bg-amber-100 text-amber-800" :
                                                "bg-blue-100 text-blue-800"
                                    )}>
                                        {product.status.replace('_', ' ')}
                                    </span>
                                )}
                            </div>

                            {/* Click hint */}
                            <div className="mt-2 pt-2 border-t border-dashed border-zinc-200 dark:border-zinc-700 text-center opacity-0 group-hover:opacity-100 transition-opacity">
                                <span className="text-[8px] font-black uppercase tracking-widest text-zinc-400 flex items-center justify-center gap-1">
                                    <Eye className="h-2.5 w-2.5" /> Klik untuk detail
                                </span>
                            </div>
                        </div>
                    ))}
                    {products.length === 0 && (
                        <div className="text-center py-12 border-2 border-dashed border-zinc-200 dark:border-zinc-700">
                            <Package className="h-8 w-8 text-zinc-300 mx-auto mb-2" />
                            <p className="text-xs font-black uppercase tracking-widest text-zinc-400">Kosong</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}

interface InventoryKanbanProps {
    products: Product[]
    warehouses: { id: string, name: string }[]
    categories?: { id: string; name: string; code: string }[]
}

export function InventoryKanbanBoard({ products: initialProducts, warehouses, categories = [] }: InventoryKanbanProps) {
    const [products, setProducts] = useState(initialProducts)
    const [confirmDialog, setConfirmDialog] = useState<{ isOpen: boolean, productId: string | null, toStatus: string | null }>({
        isOpen: false,
        productId: null,
        toStatus: null
    })
    const [quickViewId, setQuickViewId] = useState<string | null>(null)
    const [quickViewOpen, setQuickViewOpen] = useState(false)

    // PR Form State
    const [prForm, setPrForm] = useState({
        quantity: "",
        warehouseId: "",
        notes: ""
    })

    const queryClient = useQueryClient()

    const handleDrop = async (productId: string, newStatus: string) => {
        const product = products.find(p => p.id === productId)
        if (!product) {
            console.error("Product not found in handleDrop", productId)
            return
        }

        console.log(`Dropping ${product.name} to ${newStatus}. Current Status: ${product.status}`)

        if (newStatus === 'CRITICAL') {
            // If it's already critical, normally we return.
            // BUT, if the user explicitly drags it there, maybe they want to UPDATE the manual alert?
            // For now, let's keep the check, but ensure string comparison is safe.
            if (product.status === 'CRITICAL') {
                console.log("Product already CRITICAL, ignoring drop.")
                return
            }

            console.log("Opening CRITICAL Dialog")

            // Open Dialog for Critical
            // 1. Set State
            // 1. Set Form Defaults Cleanly
            const minStock = Number(product.minStock) || 0
            setPrForm({
                quantity: minStock > 0 ? (minStock * 2).toString() : "10",
                warehouseId: warehouses.length > 0 ? warehouses[0].id : "",
                notes: ""
            })

            // 2. Open Dialog
            setConfirmDialog({ isOpen: true, productId, toStatus: 'CRITICAL' })
        } else {
            // Moving OUT of Critical
            if (product.manualAlert) {
                console.log("Opening Remove Alert Dialog")
                // Confirm turning off Manual Alert
                setConfirmDialog({ isOpen: true, productId, toStatus: newStatus })
            } else if (product.totalStock === 0) {
                toast.error("Cannot move 'Out of Stock' items. Please receive goods to update status.")
            } else if (newStatus === 'HEALTHY' && product.totalStock <= product.minStock) {
                toast.error("Cannot move 'Low Stock' items to Healthy manually. Please restock.")
            } else {
                toast.info("Status is automatically managed based on stock levels.")
            }
        }
    }

    const confirmMove = async () => {
        const { productId, toStatus } = confirmDialog
        if (!productId || !toStatus) return

        const product = products.find(p => p.id === productId)
        if (!product) return

        if (toStatus === 'CRITICAL') {
            // Validate PR Form
            if (!prForm.quantity || !prForm.warehouseId) {
                toast.error("Please fill in all required fields for Restock Request")
                return
            }

            // Optimistic Update
            setProducts(prev => prev.map(p => {
                if (p.id === productId) {
                    return { ...p, manualAlert: true, status: 'CRITICAL' }
                }
                return p
            }))

            toast.loading("Creating Restock Request & Alert...")
            setConfirmDialog(prev => ({ ...prev, isOpen: false }))

            try {
                const result = await createRestockRequest({
                    productId,
                    quantity: Number(prForm.quantity),
                    warehouseId: prForm.warehouseId, // This is just a note in text for now based on Schema constraints
                    notes: prForm.notes
                })

                if (result.success) {
                    const prNum = (result as any).prNumber
                    toast.dismiss()
                    toast.success(`Restock Request Created! PR #${prNum}`, {
                        description: "Product flagged as Critical."
                    })
                    queryClient.invalidateQueries({ queryKey: queryKeys.products.all })
                    queryClient.invalidateQueries({ queryKey: queryKeys.purchaseRequests.all })
                    queryClient.invalidateQueries({ queryKey: queryKeys.procurementDashboard.all })
                    queryClient.invalidateQueries({ queryKey: queryKeys.inventoryDashboard.all })
                } else {
                    throw new Error((result as any).error)
                }
            } catch (error: any) {
                toast.dismiss()
                toast.error(error.message || "Failed to create request")
                // Revert optimistic
                setProducts(initialProducts)
            }

        } else {
            // REMOVE ALERT
            // Optimistic Update
            setProducts(prev => prev.map(p => {
                if (p.id === productId) {
                    return {
                        ...p,
                        manualAlert: false,
                        status: p.totalStock <= p.minStock ? 'LOW_STOCK' : 'HEALTHY'
                    }
                }
                return p
            }))

            setConfirmDialog({ isOpen: false, productId: null, toStatus: null })
            toast.loading("Removing Critical Alert...")

            const result = await setProductManualAlert(productId, false)

            if (result.success) {
                toast.dismiss()
                toast.success("Manual Alert removed")
                queryClient.invalidateQueries({ queryKey: queryKeys.products.all })
                queryClient.invalidateQueries({ queryKey: queryKeys.inventoryDashboard.all })
            } else {
                toast.dismiss()
                toast.error("Failed to update status")
                setProducts(initialProducts)
            }
        }
    }

    const currentProduct = products.find(p => p.id === confirmDialog.productId)
    const estimatedCost = currentProduct && prForm.quantity ? (Number(currentProduct.costPrice || 0) * Number(prForm.quantity)) : 0
    const tax = estimatedCost * 0.11
    const totalWithTax = estimatedCost + tax

    const handleCardClick = (productId: string) => {
        setQuickViewId(productId)
        setQuickViewOpen(true)
    }

    return (
        <div className="flex gap-6 overflow-x-auto pb-4">
            <KanbanColumn
                title="New Arrivals"
                status="NEW"
                products={products.filter(p => !p.manualAlert && p.status === 'NEW')}
                color="bg-blue-50"
                onDrop={handleDrop}
                onCardClick={handleCardClick}
            />
            <KanbanColumn
                title="Healthy Stock"
                status="HEALTHY"
                products={products.filter(p => !p.manualAlert && p.status === 'HEALTHY')}
                color="bg-emerald-50"
                onDrop={handleDrop}
                onCardClick={handleCardClick}
            />
            <KanbanColumn
                title="Low Stock"
                status="LOW_STOCK"
                products={products.filter(p => !p.manualAlert && p.status === 'LOW_STOCK')}
                color="bg-amber-50"
                onDrop={handleDrop}
                onCardClick={handleCardClick}
            />
            <KanbanColumn
                title="Critical / Alert"
                status="CRITICAL"
                products={products.filter(p => p.manualAlert || p.status === 'CRITICAL')}
                color="bg-red-50"
                onDrop={handleDrop}
                onCardClick={handleCardClick}
            />

            {/* CONFIRMATION / PR DIALOG */}
            <Dialog open={confirmDialog.isOpen} onOpenChange={(open) => !open && setConfirmDialog(prev => ({ ...prev, isOpen: false }))}>
                <DialogContent className="max-w-xl p-0 border-2 border-black shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] rounded-none overflow-hidden gap-0">
                    <DialogHeader className="bg-black text-white px-6 py-4">
                        <DialogTitle className="text-lg font-black uppercase tracking-wider text-white flex items-center gap-2">
                            {confirmDialog.toStatus === 'CRITICAL' ? (
                                <><AlertCircle className="h-5 w-5 text-red-400" /> Permintaan Restock Kritis</>
                            ) : (
                                "Hapus Alert Kritis"
                            )}
                        </DialogTitle>
                        <p className="text-zinc-400 text-[11px] font-bold mt-0.5">
                            {confirmDialog.toStatus === 'CRITICAL'
                                ? "Produk akan ditandai KRITIS dan Purchase Request otomatis dibuat."
                                : "Alert kritis akan dihapus. Purchase Request aktif tidak akan dibatalkan."
                            }
                        </p>
                    </DialogHeader>

                    {confirmDialog.toStatus === 'CRITICAL' && currentProduct && (
                        <div className="p-6 space-y-4">
                            {/* Product Summary */}
                            <div className="flex items-center gap-4 bg-zinc-50 dark:bg-zinc-800 p-4 border-2 border-black">
                                <div className="h-12 w-12 bg-white dark:bg-zinc-900 border-2 border-black flex items-center justify-center">
                                    <Package className="h-6 w-6 text-zinc-400" />
                                </div>
                                <div>
                                    <h4 className="font-black text-sm uppercase">{currentProduct.name}</h4>
                                    <p className="text-[10px] text-zinc-400 font-mono font-bold">{currentProduct.code} &bull; Stok: {currentProduct.totalStock} {currentProduct.unit}</p>
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="text-[10px] font-black uppercase tracking-wider text-zinc-500 mb-1 block">Jumlah Restock</label>
                                    <div className="relative">
                                        <Input
                                            type="number"
                                            className="font-mono font-bold pl-8 border-2 border-black h-10"
                                            value={prForm.quantity}
                                            onChange={(e) => setPrForm(prev => ({ ...prev, quantity: e.target.value }))}
                                        />
                                        <span className="absolute left-3 top-2.5 text-xs text-zinc-400 font-bold">#</span>
                                    </div>
                                </div>
                                <div>
                                    <label className="text-[10px] font-black uppercase tracking-wider text-zinc-500 mb-1 block">Gudang Tujuan</label>
                                    <Select value={prForm.warehouseId} onValueChange={(val) => setPrForm(prev => ({ ...prev, warehouseId: val }))}>
                                        <SelectTrigger className="border-2 border-black font-bold h-10">
                                            <SelectValue placeholder="Pilih..." />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {warehouses.map(w => (
                                                <SelectItem key={w.id} value={w.id}>{w.name}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>

                            <div>
                                <label className="text-[10px] font-black uppercase tracking-wider text-zinc-500 mb-1 block">Catatan / Alasan</label>
                                <Textarea
                                    className="border-2 border-black font-medium resize-none min-h-[60px]"
                                    placeholder="Contoh: Pesanan pelanggan mendesak..."
                                    value={prForm.notes}
                                    onChange={(e) => setPrForm(prev => ({ ...prev, notes: e.target.value }))}
                                />
                            </div>

                            {/* Auto Calculation */}
                            <div className="bg-blue-50 dark:bg-blue-950/20 border-2 border-blue-300 p-4 space-y-2">
                                <div className="flex items-center gap-2 text-blue-800 dark:text-blue-400 font-black text-[10px] uppercase tracking-widest">
                                    <Calculator className="h-4 w-4" /> Estimasi Biaya
                                </div>
                                <div className="flex justify-between items-center text-sm font-medium">
                                    <span>Subtotal ({currentProduct.costPrice || 0} x {prForm.quantity || 0})</span>
                                    <span className="font-mono font-bold">Rp {estimatedCost.toLocaleString()}</span>
                                </div>
                                <div className="flex justify-between items-center text-sm font-medium text-zinc-400">
                                    <span>PPN (11%)</span>
                                    <span className="font-mono font-bold">Rp {tax.toLocaleString()}</span>
                                </div>
                                <div className="border-t border-blue-200 dark:border-blue-700 pt-2 flex justify-between items-center font-black text-lg">
                                    <span>Total Estimasi</span>
                                    <span className="font-mono">Rp {totalWithTax.toLocaleString()}</span>
                                </div>
                            </div>
                        </div>
                    )}

                    <div className="flex items-center justify-end gap-3 px-6 py-4 border-t-2 border-black bg-zinc-50 dark:bg-zinc-800">
                        <Button
                            variant="outline"
                            onClick={() => setConfirmDialog(prev => ({ ...prev, isOpen: false }))}
                            className="border-2 border-black font-black uppercase text-xs tracking-wider px-6 h-9"
                        >
                            Batal
                        </Button>
                        <Button
                            onClick={confirmMove}
                            className={cn(
                                "border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:translate-y-[2px] hover:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] transition-all uppercase font-black text-xs tracking-wider px-6 h-9",
                                confirmDialog.toStatus === 'CRITICAL' ? "bg-red-600 hover:bg-red-700 text-white border-red-700" : "bg-black text-white"
                            )}
                        >
                            {confirmDialog.toStatus === 'CRITICAL' ? (
                                <><Truck className="mr-2 h-4 w-4" /> Buat Permintaan</>
                            ) : "Hapus Alert"}
                        </Button>
                    </div>
                </DialogContent>
            </Dialog>

            {/* PRODUCT QUICK VIEW */}
            <ProductQuickView
                productId={quickViewId}
                open={quickViewOpen}
                onOpenChange={setQuickViewOpen}
                categories={categories}
            />
        </div>
    )
}
