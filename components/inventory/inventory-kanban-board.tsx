'use client'

import { useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { ScrollArea } from '@/components/ui/scroll-area'
import { setProductManualAlert, createRestockRequest } from '@/app/actions/inventory'
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
import { useRouter } from 'next/navigation'
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

    return (
        <div
            className={`flex-1 min-w-[320px] max-w-[400px] flex flex-col h-full rounded-xl border-3 ${borderColor} ${bgColor} ${shadowClass} overflow-hidden`}
            onDragOver={handleDragOver}
            onDrop={handleDrop}
        >
            {/* Column Header */}
            <div className={`p-4 border-b-3 ${borderColor} bg-white/50 backdrop-blur-sm`}>
                <div className="flex items-center justify-between">
                    <h3 className="font-black uppercase tracking-wider text-sm flex items-center gap-2 text-black">
                        {status === 'CRITICAL' && <AlertCircle className="h-5 w-5 text-red-600 fill-red-100" />}
                        {status === 'LOW_STOCK' && <Package className="h-5 w-5 text-amber-600 fill-amber-100" />}
                        {status === 'HEALTHY' && <CheckCircle2 className="h-5 w-5 text-emerald-600 fill-emerald-100" />}
                        {status === 'NEW' && <Package className="h-5 w-5 text-blue-600 fill-blue-100" />}
                        {title}
                    </h3>
                    <div className={`px-2 py-0.5 text-xs font-black border-2 border-black bg-white rounded-full min-w-[24px] text-center`}>
                        {products.length}
                    </div>
                </div>
            </div>

            {/* Column Content */}
            <ScrollArea className="flex-1 p-3">
                <div className="space-y-4 pb-4">
                    {products.map(product => (
                        <div
                            key={product.id}
                            draggable
                            onDragStart={(e) => e.dataTransfer.setData('productId', product.id)}
                            onClick={() => onCardClick(product.id)}
                            className={cn(
                                "p-4 bg-white rounded-lg border-3 border-black shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] cursor-pointer active:cursor-grabbing h-full relative group hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] transition-all",
                                product.manualAlert && "border-red-600 shadow-red-900/20"
                            )}
                        >
                            <div className="flex justify-between items-start mb-2">
                                <Badge variant="outline" className="text-[10px] font-bold border-2 border-black bg-zinc-100 text-black px-1.5 py-0 rounded-md">
                                    {product.code}
                                </Badge>
                                {product.manualAlert && (
                                    <Badge className="text-[9px] bg-red-600 text-white border-2 border-red-800 shadow-sm px-1.5 h-5 rounded-md">
                                        MANUAL ALERT
                                    </Badge>
                                )}
                            </div>

                            <h4 className="font-black text-sm leading-tight mb-1 text-black line-clamp-2 uppercase">
                                {product.name}
                            </h4>
                            <p className="text-[10px] uppercase tracking-wide text-zinc-500 font-bold mb-3">
                                {typeof product.category === 'object' ? product.category?.name || 'Uncategorized' : product.category}
                            </p>

                            <div className="flex items-center justify-between pt-3 border-t-2 border-black/10 border-dashed">
                                <div>
                                    <div className="text-[9px] font-bold text-zinc-400 uppercase">Stock Level</div>
                                    <div className={cn("font-black text-base leading-none mt-0.5", product.totalStock === 0 ? "text-red-600" : "text-black")}>
                                        {product.totalStock} <span className="text-[10px] text-zinc-500 font-bold">{product.unit}</span>
                                    </div>
                                </div>
                                {product.status !== 'HEALTHY' && (
                                    <div className={cn(
                                        "text-[9px] font-black uppercase px-2 py-1 rounded border-2 border-black shadow-[1px_1px_0px_0px_rgba(0,0,0,1)]",
                                        product.status === 'CRITICAL' ? "bg-red-200 text-red-900" :
                                            product.status === 'LOW_STOCK' ? "bg-amber-200 text-amber-900" :
                                                "bg-blue-200 text-blue-900"
                                    )}>
                                        {product.status.replace('_', ' ')}
                                    </div>
                                )}
                            </div>

                            {/* Click hint */}
                            <div className="mt-2 pt-2 border-t border-dashed border-zinc-200 text-center opacity-0 group-hover:opacity-100 transition-opacity">
                                <span className="text-[8px] font-black uppercase tracking-widest text-zinc-400 flex items-center justify-center gap-1">
                                    <Eye className="h-2.5 w-2.5" /> Klik untuk lihat detail
                                </span>
                            </div>
                        </div>
                    ))}
                    {products.length === 0 && (
                        <div className="text-center py-12 border-3 border-dashed border-black/10 rounded-lg">
                            <Package className="h-8 w-8 text-black/20 mx-auto mb-2" />
                            <p className="text-xs font-bold text-black/30 uppercase">Empty</p>
                        </div>
                    )}
                </div>
            </ScrollArea>
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

    const router = useRouter()

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
                    router.refresh()
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
                router.refresh()
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
        <div className="h-[calc(100vh-220px)] flex gap-6 overflow-x-auto pb-4">
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
                <DialogContent className="max-w-xl border-2 border-black shadow-[6px_6px_0px_0px_rgba(0,0,0,1)]">
                    <DialogHeader>
                        <DialogTitle className="text-2xl font-black uppercase flex items-center gap-2">
                            {confirmDialog.toStatus === 'CRITICAL' ? (
                                <><AlertCircle className="h-6 w-6 text-red-600" /> Critical Restock Request</>
                            ) : (
                                "Remove Critical Alert"
                            )}
                        </DialogTitle>
                        <DialogDescription className="font-medium text-base">
                            {confirmDialog.toStatus === 'CRITICAL'
                                ? "Flagging this product as CRITICAL will trigger an immediate Purchase Request. Please provide details below."
                                : "Are you sure you want to remove the Critical flag? This will NOT cancel any active Purchase Requests."
                            }
                        </DialogDescription>
                    </DialogHeader>

                    {confirmDialog.toStatus === 'CRITICAL' && currentProduct && (
                        <div className="grid gap-6 py-4">
                            {/* Product Summary */}
                            <div className="flex items-center gap-4 bg-zinc-50 p-4 rounded-lg border-2 border-dashed border-zinc-200">
                                <div className="h-12 w-12 bg-white rounded-md border border-zinc-200 flex items-center justify-center">
                                    <Package className="h-6 w-6 text-zinc-400" />
                                </div>
                                <div>
                                    <h4 className="font-bold text-sm">{currentProduct.name}</h4>
                                    <p className="text-xs text-muted-foreground font-mono">{currentProduct.code} • Current: {currentProduct.totalStock} {currentProduct.unit}</p>
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label className="font-bold">Restock Quantity</Label>
                                    <div className="relative">
                                        <Input
                                            type="number"
                                            className="font-mono font-bold pl-8 border-2 border-black"
                                            value={prForm.quantity}
                                            onChange={(e) => setPrForm(prev => ({ ...prev, quantity: e.target.value }))}
                                        />
                                        <span className="absolute left-3 top-2.5 text-xs text-muted-foreground font-bold">#</span>
                                    </div>
                                </div>
                                <div className="space-y-2">
                                    <Label className="font-bold">Target Warehouse</Label>
                                    <Select value={prForm.warehouseId} onValueChange={(val) => setPrForm(prev => ({ ...prev, warehouseId: val }))}>
                                        <SelectTrigger className="border-2 border-black font-bold">
                                            <SelectValue placeholder="Select..." />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {warehouses.map(w => (
                                                <SelectItem key={w.id} value={w.id}>{w.name}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>

                            <div className="space-y-2">
                                <Label className="font-bold">Notes / Reason</Label>
                                <Textarea
                                    className="border-2 border-black font-medium resize-none"
                                    placeholder="e.g. Urgent customer order..."
                                    value={prForm.notes}
                                    onChange={(e) => setPrForm(prev => ({ ...prev, notes: e.target.value }))}
                                />
                            </div>

                            {/* Auto Calculation */}
                            <div className="bg-blue-50 border-2 border-blue-200 p-4 rounded-xl space-y-2">
                                <div className="flex items-center gap-2 text-blue-800 font-black text-xs uppercase tracking-wider">
                                    <Calculator className="h-4 w-4" /> Estimated Cost
                                </div>
                                <div className="flex justify-between items-center text-sm font-medium">
                                    <span>Subtotal ({currentProduct.costPrice || 0} × {prForm.quantity || 0})</span>
                                    <span>Rp {estimatedCost.toLocaleString()}</span>
                                </div>
                                <div className="flex justify-between items-center text-sm font-medium text-muted-foreground">
                                    <span>Tax (11%)</span>
                                    <span>Rp {tax.toLocaleString()}</span>
                                </div>
                                <div className="border-t border-blue-200 pt-2 flex justify-between items-center font-black text-lg">
                                    <span>Total Estimate</span>
                                    <span>Rp {totalWithTax.toLocaleString()}</span>
                                </div>
                            </div>
                        </div>
                    )}

                    <DialogFooter className="gap-2">
                        <Button variant="outline" onClick={() => setConfirmDialog(prev => ({ ...prev, isOpen: false }))}>Cancel</Button>
                        <Button
                            onClick={confirmMove}
                            className={cn(
                                "border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] uppercase font-black tracking-wide",
                                confirmDialog.toStatus === 'CRITICAL' ? "bg-red-600 hover:bg-red-700 text-white" : ""
                            )}
                        >
                            {confirmDialog.toStatus === 'CRITICAL' ? (
                                <><Truck className="mr-2 h-4 w-4" /> Create Request</>
                            ) : "Remove Alert"}
                        </Button>
                    </DialogFooter>
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
