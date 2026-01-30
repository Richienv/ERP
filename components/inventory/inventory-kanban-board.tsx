'use client'

import { useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { ScrollArea } from '@/components/ui/scroll-area'
import { setProductManualAlert } from '@/app/actions/inventory'
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { AlertCircle, CheckCircle2, Package } from 'lucide-react'
import { toast } from 'sonner'
import { useRouter } from 'next/navigation'

interface Product {
    id: string
    code: string
    name: string
    category: string
    unit: string
    minStock: number
    totalStock: number
    status: string
    manualAlert: boolean
    image: string
}

interface KanbanColumnProps {
    title: string
    status: string
    products: Product[]
    color: string
    onDrop: (productId: string, newStatus: string) => void
}

function KanbanColumn({ title, status, products, color, onDrop }: KanbanColumnProps) {
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
                            className={cn(
                                "p-4 bg-white rounded-lg border-3 border-black shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] cursor-grab active:cursor-grabbing h-full relative group",
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
                                {product.category}
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
                                        product.status === 'CRITICAL' ? "bg-red-200 text-red-900" : "bg-amber-200 text-amber-900"
                                    )}>
                                        {product.status.replace('_', ' ')}
                                    </div>
                                )}
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

export function InventoryKanbanBoard({ products: initialProducts }: { products: Product[] }) {
    const [products, setProducts] = useState(initialProducts)
    // If dialog open state is not managed properly, it will not work.
    const [confirmDialog, setConfirmDialog] = useState<{ isOpen: boolean, productId: string | null, toStatus: string | null }>({
        isOpen: false,
        productId: null,
        toStatus: null
    })
    const router = useRouter()

    const handleDrop = async (productId: string, newStatus: string) => {
        const product = products.find(p => p.id === productId)
        if (!product) return

        // Prevent dropping in same column
        // Logic: 
        // 1. If currently CRITICAL (manualAlert=true OR auto-critical) -> Dropped to HEALTHY/LOW
        // 2. If currently HEALTHY/LOW -> Dropped to CRITICAL

        if (newStatus === 'CRITICAL') {
            if (product.status === 'CRITICAL') return // Already there
            // Confirm Manual Alert
            setConfirmDialog({ isOpen: true, productId, toStatus: 'CRITICAL' })
        } else {
            // Moving OUT of Critical
            if (product.manualAlert) {
                // Confirm turning off Manual Alert
                setConfirmDialog({ isOpen: true, productId, toStatus: newStatus })
            } else if (product.totalStock === 0) {
                toast.error("Cannot move 'Out of Stock' items. Please receive goods to update status.")
            } else if (newStatus === 'HEALTHY' && product.totalStock <= product.minStock) {
                toast.error("Cannot move 'Low Stock' items to Healthy manually. Please restock.")
            } else {
                // Nothing to do for auto-calculated statuses
                toast.info("Status is automatically managed based on stock levels.")
            }
        }
    }

    const confirmMove = async () => {
        const { productId, toStatus } = confirmDialog
        if (!productId || !toStatus) return

        const product = products.find(p => p.id === productId)
        if (!product) return

        let newManualAlert = false

        if (toStatus === 'CRITICAL') {
            newManualAlert = true
        } else {
            newManualAlert = false
        }

        // Optimistic Update
        setProducts(prev => prev.map(p => {
            if (p.id === productId) {
                return {
                    ...p,
                    manualAlert: newManualAlert,
                    status: newManualAlert ? 'CRITICAL' : (p.totalStock <= p.minStock ? 'LOW_STOCK' : 'HEALTHY') // Minimal logic re-calc
                }
            }
            return p
        }))

        setConfirmDialog({ isOpen: false, productId: null, toStatus: null })
        toast.loading("Updating product status...")

        const result = await setProductManualAlert(productId, newManualAlert)

        if (result.success) {
            toast.dismiss()
            toast.success(newManualAlert ? "Product flagged as Critical" : "Manual Alert removed")
            router.refresh()
        } else {
            toast.dismiss()
            toast.error("Failed to update status")
            // Revert
            setProducts(initialProducts)
        }
    }

    const healthyProducts = products.filter(p => !p.manualAlert && p.status === 'HEALTHY')
    const lowStockProducts = products.filter(p => !p.manualAlert && p.status === 'LOW_STOCK')
    const criticalProducts = products.filter(p => p.manualAlert || p.status === 'CRITICAL')

    return (
        <div className="h-[calc(100vh-220px)] flex gap-6 overflow-x-auto pb-4">
            <KanbanColumn
                title="Healthy Stock"
                status="HEALTHY"
                products={healthyProducts}
                color="bg-emerald-50"
                onDrop={handleDrop}
            />
            <KanbanColumn
                title="Low Stock"
                status="LOW_STOCK"
                products={lowStockProducts}
                color="bg-amber-50"
                onDrop={handleDrop}
            />
            <KanbanColumn
                title="Critical / Alert"
                status="CRITICAL"
                products={criticalProducts}
                color="bg-red-50"
                onDrop={handleDrop}
            />

            <Dialog open={confirmDialog.isOpen} onOpenChange={(open) => !open && setConfirmDialog(prev => ({ ...prev, isOpen: false }))}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Confirm Status Change</DialogTitle>
                        <DialogDescription>
                            {confirmDialog.toStatus === 'CRITICAL'
                                ? "Are you sure you want to flag this product as CRITICAL? This will add it to the Dashboard Alert list regardless of stock levels."
                                : "Are you sure you want to remove the Critical flag? The product status will revert to being controlled by stock levels."
                            }
                        </DialogDescription>
                    </DialogHeader>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setConfirmDialog(prev => ({ ...prev, isOpen: false }))}>Cancel</Button>
                        <Button onClick={confirmMove} className={confirmDialog.toStatus === 'CRITICAL' ? "bg-red-600 hover:bg-red-700" : ""}>
                            {confirmDialog.toStatus === 'CRITICAL' ? "Set Critical" : "Remove Alert"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    )
}
