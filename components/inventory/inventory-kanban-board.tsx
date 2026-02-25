'use client'

import { useState, useEffect } from 'react'
import { ScrollArea } from '@/components/ui/scroll-area'
import { setProductManualAlert, createRestockRequest, requestPurchase } from '@/app/actions/inventory'
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
import { AlertCircle, CheckCircle2, Package, Calculator, Truck, Eye, ShoppingCart, ClipboardList, ArrowDownToLine } from 'lucide-react'
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
    hasPendingPR?: boolean
    hasIncomingPO?: boolean
    procurementStatus?: string | null
    procurementDetail?: {
        type: 'PR' | 'PO'
        number: string
        status: string
        expectedDate?: string | null
        supplierName?: string
        orderedQty?: number
        receivedQty?: number
        quantity?: number
        createdAt?: string
    } | null
    prQuantity?: number
    prNumber?: string | null
    prStatus?: string | null
}

interface KanbanColumnProps {
    title: string
    status: string
    products: Product[]
    color: string
    onDrop: (productId: string, newStatus: string) => void
    onCardClick: (productId: string) => void
    onRequestPR?: (productId: string) => void
}

function KanbanColumn({ title, status, products, color, onDrop, onCardClick, onRequestPR }: KanbanColumnProps) {
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

    // Map status to accent colors for left border
    const accentColor =
        status === 'CRITICAL' ? 'border-l-red-400' :
            status === 'LOW_STOCK' ? 'border-l-amber-400' :
                status === 'NEW' ? 'border-l-blue-400' :
                    status === 'PLANNING' ? 'border-l-violet-400' :
                        status === 'INCOMING' ? 'border-l-cyan-400' :
                            'border-l-emerald-400'

    const headerBg =
        status === 'CRITICAL' ? 'bg-red-50 dark:bg-red-950/20' :
            status === 'LOW_STOCK' ? 'bg-amber-50 dark:bg-amber-950/20' :
                status === 'NEW' ? 'bg-blue-50 dark:bg-blue-950/20' :
                    status === 'PLANNING' ? 'bg-violet-50 dark:bg-violet-950/20' :
                        status === 'INCOMING' ? 'bg-cyan-50 dark:bg-cyan-950/20' :
                            'bg-emerald-50 dark:bg-emerald-950/20'

    const countBg =
        status === 'CRITICAL' ? 'bg-red-500' :
            status === 'LOW_STOCK' ? 'bg-amber-500' :
                status === 'NEW' ? 'bg-blue-500' :
                    status === 'PLANNING' ? 'bg-violet-500' :
                        status === 'INCOMING' ? 'bg-cyan-500' :
                            'bg-emerald-500'

    const StatusIcon =
        status === 'CRITICAL' ? AlertCircle :
            status === 'LOW_STOCK' ? Package :
                status === 'HEALTHY' ? CheckCircle2 :
                    status === 'PLANNING' ? ClipboardList :
                        status === 'INCOMING' ? ArrowDownToLine :
                            ArrowDownToLine

    const iconColor =
        status === 'CRITICAL' ? 'text-red-600' :
            status === 'LOW_STOCK' ? 'text-amber-600' :
                status === 'HEALTHY' ? 'text-emerald-600' :
                    status === 'PLANNING' ? 'text-violet-600' :
                        status === 'INCOMING' ? 'text-cyan-600' :
                            'text-blue-600'

    return (
        <div
            className="flex-1 min-w-[320px] max-w-[400px] flex flex-col border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] bg-white dark:bg-zinc-900 overflow-hidden"
            onDragOver={handleDragOver}
            onDrop={handleDrop}
        >
            {/* Column Header */}
            <div className={`px-4 py-2.5 border-b-2 border-black flex items-center gap-2 border-l-[5px] ${accentColor} ${headerBg}`}>
                <div className="flex items-center gap-2 flex-1">
                    <StatusIcon className={`h-4 w-4 ${iconColor}`} />
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
                            {/* Red dot indicator for incomplete data */}
                            {(() => {
                                const categoryName = typeof product.category === 'object' ? product.category?.name : product.category
                                const hasNoCategory = !categoryName || categoryName === 'Uncategorized' || categoryName === 'UNCATEGORIZED'
                                const hasNoCost = !product.costPrice || product.costPrice === 0
                                const isIncomplete = hasNoCategory || hasNoCost
                                if (!isIncomplete) return null
                                const warnings: string[] = []
                                if (hasNoCategory) warnings.push('Kategori kosong')
                                if (hasNoCost) warnings.push('HPP kosong')
                                return (
                                    <div className="absolute -top-1.5 -right-1.5 z-10 flex items-center gap-1" title={warnings.join(', ')}>
                                        <span className="relative flex h-3.5 w-3.5">
                                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
                                            <span className="relative inline-flex rounded-full h-3.5 w-3.5 bg-red-500 border-2 border-white" />
                                        </span>
                                    </div>
                                )
                            })()}

                            <div className="flex justify-between items-start mb-2">
                                <span className="text-[10px] font-black uppercase tracking-wide px-2 py-0.5 border-2 border-black bg-zinc-100 text-zinc-700">
                                    {product.code}
                                </span>
                                <div className="flex items-center gap-1">
                                    {product.hasPendingPR && (
                                        <span className="text-[9px] font-black uppercase px-1.5 py-0.5 bg-violet-600 text-white border-2 border-violet-800">
                                            PR
                                        </span>
                                    )}
                                    {product.manualAlert && (
                                        <span className="text-[9px] font-black uppercase px-1.5 py-0.5 bg-red-600 text-white border-2 border-red-800">
                                            ALERT
                                        </span>
                                    )}
                                </div>
                            </div>

                            <h4 className="font-black text-sm leading-tight mb-1 text-zinc-900 dark:text-zinc-100 line-clamp-2 uppercase">
                                {product.name}
                            </h4>

                            {/* Category with warning styling if missing */}
                            {(() => {
                                const categoryName = typeof product.category === 'object' ? product.category?.name : product.category
                                const hasNoCategory = !categoryName || categoryName === 'Uncategorized' || categoryName === 'UNCATEGORIZED'
                                return (
                                    <p className={cn(
                                        "text-[10px] uppercase tracking-widest font-bold mb-3",
                                        hasNoCategory ? "text-red-500" : "text-zinc-400"
                                    )}>
                                        {hasNoCategory ? 'Kategori kosong' : categoryName}
                                    </p>
                                )
                            })()}

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
                                                product.status === 'PLANNING' ? "bg-violet-100 text-violet-800" :
                                                    "bg-blue-100 text-blue-800"
                                    )}>
                                        {product.status.replace('_', ' ')}
                                    </span>
                                )}
                            </div>

                            {/* PR Requested Quantity */}
                            {(product.prQuantity ?? 0) > 0 && (
                                <div className="mt-2 pt-2 border-t-2 border-violet-100 dark:border-violet-900">
                                    <div className="flex items-center justify-between">
                                        <span className="text-[8px] font-black uppercase tracking-wider text-zinc-400">Diminta (PR)</span>
                                        <span className="text-sm font-black text-violet-700">
                                            {product.prQuantity} <span className="text-[9px] font-bold text-zinc-400">{product.unit}</span>
                                        </span>
                                    </div>
                                    {product.prNumber && (
                                        <div className="text-[9px] font-mono font-bold text-violet-500 mt-0.5">
                                            {product.prNumber}
                                            <span className={cn(
                                                "ml-1 px-1 py-0.5 text-[7px] font-black uppercase border",
                                                product.prStatus === 'APPROVED' ? "bg-emerald-100 text-emerald-800 border-emerald-300"
                                                    : product.prStatus === 'REJECTED' ? "bg-red-100 text-red-800 border-red-300"
                                                        : "bg-violet-100 text-violet-800 border-violet-300"
                                            )}>
                                                {product.prStatus}
                                            </span>
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* PO Pipeline Status */}
                            {product.procurementDetail && product.procurementDetail.type === 'PO' && (
                                <div className={cn(
                                    "mt-2 pt-2 border-t-2",
                                    (product.prQuantity ?? 0) > 0 ? "border-cyan-100 dark:border-cyan-900" : "border-cyan-100 dark:border-cyan-900"
                                )}>
                                    <div className="flex items-center justify-between">
                                        <span className="text-[8px] font-black uppercase tracking-wider text-zinc-400">Pipeline</span>
                                        <span className={cn(
                                            "text-[8px] font-black uppercase px-1.5 py-0.5 border",
                                            product.procurementDetail.status === 'SHIPPED' ? "bg-cyan-100 text-cyan-800 border-cyan-300"
                                                : product.procurementDetail.status === 'ORDERED' ? "bg-blue-100 text-blue-800 border-blue-300"
                                                    : product.procurementDetail.status === 'VENDOR_CONFIRMED' ? "bg-indigo-100 text-indigo-800 border-indigo-300"
                                                        : product.procurementDetail.status === 'APPROVED' ? "bg-amber-100 text-amber-800 border-amber-300"
                                                            : "bg-emerald-100 text-emerald-800 border-emerald-300"
                                        )}>
                                            {product.procurementDetail.status === 'APPROVED' ? 'Menunggu Vendor'
                                                : product.procurementDetail.status === 'ORDERED' ? 'Dipesan'
                                                    : product.procurementDetail.status === 'VENDOR_CONFIRMED' ? 'Vendor Konfirmasi'
                                                        : product.procurementDetail.status === 'SHIPPED' ? 'Dikirim'
                                                            : product.procurementDetail.status === 'PARTIAL_RECEIVED' ? 'Sebagian Diterima'
                                                                : product.procurementDetail.status.replace('_', ' ')
                                            }
                                        </span>
                                    </div>
                                    <div className="flex items-center gap-1 mt-1">
                                        <span className="text-[9px] font-mono font-bold text-zinc-500">
                                            {product.procurementDetail.number}
                                        </span>
                                        {product.procurementDetail.supplierName && (
                                            <span className="text-[9px] text-zinc-400">• {product.procurementDetail.supplierName}</span>
                                        )}
                                    </div>
                                    {product.procurementDetail.expectedDate && (
                                        <div className="text-[9px] text-cyan-600 font-bold mt-0.5">
                                            ETA: {new Date(product.procurementDetail.expectedDate).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })}
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* PR-only Pipeline Status (no PO yet) */}
                            {product.procurementDetail && product.procurementDetail.type === 'PR' && (product.prQuantity ?? 0) === 0 && (
                                <div className="mt-2 pt-2 border-t-2 border-violet-100 dark:border-violet-900">
                                    <div className="flex items-center justify-between">
                                        <span className="text-[8px] font-black uppercase tracking-wider text-zinc-400">Pipeline</span>
                                        <span className={cn(
                                            "text-[8px] font-black uppercase px-1.5 py-0.5 border",
                                            product.procurementDetail.status === 'APPROVED' ? "bg-emerald-100 text-emerald-800 border-emerald-300"
                                                : "bg-violet-100 text-violet-800 border-violet-300"
                                        )}>
                                            PR {product.procurementDetail.status}
                                        </span>
                                    </div>
                                    <div className="text-[9px] font-mono font-bold text-zinc-500 mt-1">
                                        {product.procurementDetail.number}
                                    </div>
                                </div>
                            )}

                            {/* Incomplete data warning strip */}
                            {(() => {
                                const categoryName = typeof product.category === 'object' ? product.category?.name : product.category
                                const hasNoCategory = !categoryName || categoryName === 'Uncategorized' || categoryName === 'UNCATEGORIZED'
                                const hasNoCost = !product.costPrice || product.costPrice === 0
                                if (!hasNoCategory && !hasNoCost) return null
                                return (
                                    <div className="mt-2 pt-2 border-t-2 border-dashed border-red-200 dark:border-red-800 flex items-center gap-1.5">
                                        <AlertCircle className="h-3 w-3 text-red-500 flex-shrink-0" />
                                        <span className="text-[8px] font-black uppercase tracking-wide text-red-500">
                                            {[hasNoCategory && 'Kategori', hasNoCost && 'HPP'].filter(Boolean).join(' & ')} belum diisi
                                        </span>
                                    </div>
                                )
                            })()}

                            {/* Action row: PR button + click hint */}
                            {onRequestPR && (
                                <div className="mt-2 pt-2 border-t border-dashed border-zinc-200 dark:border-zinc-700 flex items-center justify-between opacity-0 group-hover:opacity-100 transition-opacity">
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation()
                                            onRequestPR(product.id)
                                        }}
                                        disabled={product.hasPendingPR}
                                        className={cn(
                                            "flex items-center gap-1 text-[8px] font-black uppercase tracking-wider px-2 py-1 border-2 border-black shadow-[1px_1px_0px_0px_rgba(0,0,0,1)] hover:translate-y-[1px] hover:shadow-none transition-all",
                                            product.hasPendingPR
                                                ? "bg-zinc-100 text-zinc-400 cursor-not-allowed border-zinc-300 shadow-none"
                                                : "bg-violet-100 text-violet-800 hover:bg-violet-200"
                                        )}
                                    >
                                        <ShoppingCart className="h-2.5 w-2.5" />
                                        {product.hasPendingPR ? 'PR Aktif' : 'Request PR'}
                                    </button>
                                    <span className="text-[8px] font-black uppercase tracking-widest text-zinc-400 flex items-center gap-1">
                                        <Eye className="h-2.5 w-2.5" /> Detail
                                    </span>
                                </div>
                            )}
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

    // Sync internal state when prop changes (e.g. after React Query refetch)
    useEffect(() => {
        setProducts(initialProducts)
    }, [initialProducts])

    const [confirmDialog, setConfirmDialog] = useState<{
        isOpen: boolean
        productId: string | null
        toStatus: string | null
        mode: 'critical_restock' | 'remove_alert' | 'request_pr'
    }>({
        isOpen: false,
        productId: null,
        toStatus: null,
        mode: 'request_pr'
    })
    const [quickViewId, setQuickViewId] = useState<string | null>(null)
    const [quickViewOpen, setQuickViewOpen] = useState(false)

    // PR Form State
    const [prForm, setPrForm] = useState({
        quantity: "",
        warehouseId: "",
        notes: ""
    })
    const [isSubmittingPR, setIsSubmittingPR] = useState(false)

    const queryClient = useQueryClient()

    // Open PR dialog for any product (from card button)
    const handleRequestPR = (productId: string) => {
        const product = products.find(p => p.id === productId)
        if (!product) return

        if (product.hasPendingPR) {
            toast.info("Produk ini sudah memiliki Purchase Request aktif.")
            return
        }

        const minStock = Number(product.minStock) || 0
        const deficit = Math.max(minStock - product.totalStock, 0)
        setPrForm({
            quantity: deficit > 0 ? deficit.toString() : (minStock > 0 ? (minStock * 2).toString() : "10"),
            warehouseId: warehouses.length > 0 ? warehouses[0].id : "",
            notes: ""
        })

        setConfirmDialog({ isOpen: true, productId, toStatus: null, mode: 'request_pr' })
    }

    const handleDrop = async (productId: string, newStatus: string) => {
        const product = products.find(p => p.id === productId)
        if (!product) {
            console.error("Product not found in handleDrop", productId)
            return
        }

        if (newStatus === 'CRITICAL') {
            if (product.status === 'CRITICAL') {
                return
            }

            const minStock = Number(product.minStock) || 0
            setPrForm({
                quantity: minStock > 0 ? (minStock * 2).toString() : "10",
                warehouseId: warehouses.length > 0 ? warehouses[0].id : "",
                notes: ""
            })

            setConfirmDialog({ isOpen: true, productId, toStatus: 'CRITICAL', mode: 'critical_restock' })
        } else {
            if (product.manualAlert) {
                setConfirmDialog({ isOpen: true, productId, toStatus: newStatus, mode: 'remove_alert' })
            } else if (product.totalStock === 0) {
                toast.error("Tidak bisa memindahkan item tanpa stok. Terima barang terlebih dahulu.")
            } else if (newStatus === 'HEALTHY' && product.totalStock <= product.minStock) {
                toast.error("Tidak bisa memindahkan item stok rendah ke Sehat. Restock terlebih dahulu.")
            } else {
                toast.info("Status otomatis dikelola berdasarkan level stok.")
            }
        }
    }

    const confirmAction = async () => {
        const { productId, toStatus, mode } = confirmDialog
        if (!productId) return
        const product = products.find(p => p.id === productId)
        if (!product) return

        setIsSubmittingPR(true)

        try {
            if (mode === 'request_pr') {
                // Normal PR — no critical alert
                if (!prForm.quantity) {
                    toast.error("Jumlah harus diisi")
                    setIsSubmittingPR(false)
                    return
                }

                setConfirmDialog(prev => ({ ...prev, isOpen: false }))
                toast.loading("Membuat Purchase Request...")

                const result = await requestPurchase({
                    itemId: productId,
                    quantity: Number(prForm.quantity),
                    notes: prForm.notes || `Request dari Kelola Produk. Gudang: ${prForm.warehouseId}`
                })

                toast.dismiss()

                if (result.success) {
                    toast.success("Purchase Request berhasil dibuat!", {
                        description: "PR masuk ke antrian Procurement."
                    })
                    // Update local state to show PR badge
                    setProducts(prev => prev.map(p =>
                        p.id === productId ? { ...p, hasPendingPR: true } : p
                    ))
                    queryClient.invalidateQueries({ queryKey: queryKeys.products.all })
                    queryClient.invalidateQueries({ queryKey: queryKeys.purchaseRequests.all })
                    queryClient.invalidateQueries({ queryKey: queryKeys.procurementDashboard.all })
                    queryClient.invalidateQueries({ queryKey: queryKeys.inventoryDashboard.all })
                } else {
                    const errMsg = (result as any).message || (result as any).error || "Gagal membuat PR"
                    if ((result as any).alreadyPending) {
                        toast.info("Purchase Request sudah ada untuk produk ini.")
                        setProducts(prev => prev.map(p =>
                            p.id === productId ? { ...p, hasPendingPR: true } : p
                        ))
                    } else {
                        toast.error(errMsg)
                    }
                }

            } else if (mode === 'critical_restock') {
                // Critical Restock — sets manualAlert + creates PR
                if (!prForm.quantity || !prForm.warehouseId) {
                    toast.error("Harap isi semua field yang diperlukan")
                    setIsSubmittingPR(false)
                    return
                }

                setProducts(prev => prev.map(p =>
                    p.id === productId ? { ...p, manualAlert: true, status: 'CRITICAL' } : p
                ))

                setConfirmDialog(prev => ({ ...prev, isOpen: false }))
                toast.loading("Membuat Restock Request & Alert...")

                const result = await createRestockRequest({
                    productId,
                    quantity: Number(prForm.quantity),
                    warehouseId: prForm.warehouseId,
                    notes: prForm.notes
                })

                toast.dismiss()

                if (result.success) {
                    const prNum = (result as any).prNumber
                    toast.success(`Restock Request dibuat! PR #${prNum}`, {
                        description: "Produk ditandai Kritis."
                    })
                    queryClient.invalidateQueries({ queryKey: queryKeys.products.all })
                    queryClient.invalidateQueries({ queryKey: queryKeys.purchaseRequests.all })
                    queryClient.invalidateQueries({ queryKey: queryKeys.procurementDashboard.all })
                    queryClient.invalidateQueries({ queryKey: queryKeys.inventoryDashboard.all })
                } else {
                    toast.error((result as any).error || "Gagal membuat request")
                    setProducts(initialProducts)
                }

            } else if (mode === 'remove_alert') {
                // Remove critical alert
                setProducts(prev => prev.map(p =>
                    p.id === productId ? {
                        ...p,
                        manualAlert: false,
                        status: p.totalStock <= p.minStock ? 'LOW_STOCK' : 'HEALTHY'
                    } : p
                ))

                setConfirmDialog({ isOpen: false, productId: null, toStatus: null, mode: 'request_pr' })
                toast.loading("Menghapus Alert Kritis...")

                const result = await setProductManualAlert(productId, false)

                toast.dismiss()

                if (result.success) {
                    toast.success("Alert kritis dihapus")
                    queryClient.invalidateQueries({ queryKey: queryKeys.products.all })
                    queryClient.invalidateQueries({ queryKey: queryKeys.inventoryDashboard.all })
                } else {
                    toast.error("Gagal mengupdate status")
                    setProducts(initialProducts)
                }
            }
        } catch (error: any) {
            toast.dismiss()
            toast.error(error.message || "Terjadi kesalahan")
            setProducts(initialProducts)
        } finally {
            setIsSubmittingPR(false)
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

    // Products with active PO go to Incoming column (highest priority)
    const incomingProducts = products.filter(p => p.hasIncomingPO)
    // Products with pending PR go to Planning column (but NOT if they already have an active PO)
    const planningProducts = products.filter(p => p.hasPendingPR && !p.hasIncomingPO)

    return (
        <div className="flex gap-6 overflow-x-auto pb-4">
            <KanbanColumn
                title="Planning (PR Aktif)"
                status="PLANNING"
                products={planningProducts}
                color="bg-violet-50"
                onDrop={handleDrop}
                onCardClick={handleCardClick}
            />
            <KanbanColumn
                title="Incoming (PO Aktif)"
                status="INCOMING"
                products={incomingProducts}
                color="bg-cyan-50"
                onDrop={handleDrop}
                onCardClick={handleCardClick}
            />
            <KanbanColumn
                title="Healthy Stock"
                status="HEALTHY"
                products={products.filter(p => p.status === 'HEALTHY')}
                color="bg-emerald-50"
                onDrop={handleDrop}
                onCardClick={handleCardClick}
                onRequestPR={handleRequestPR}
            />
            <KanbanColumn
                title="Low Stock"
                status="LOW_STOCK"
                products={products.filter(p => p.status === 'LOW_STOCK')}
                color="bg-amber-50"
                onDrop={handleDrop}
                onCardClick={handleCardClick}
                onRequestPR={handleRequestPR}
            />
            <KanbanColumn
                title="Critical / Alert"
                status="CRITICAL"
                products={products.filter(p => p.status === 'CRITICAL')}
                color="bg-red-50"
                onDrop={handleDrop}
                onCardClick={handleCardClick}
                onRequestPR={handleRequestPR}
            />

            {/* PR / RESTOCK DIALOG */}
            <Dialog open={confirmDialog.isOpen} onOpenChange={(open) => !open && setConfirmDialog(prev => ({ ...prev, isOpen: false }))}>
                <DialogContent className="max-w-xl p-0 border-2 border-black shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] rounded-none overflow-hidden gap-0">
                    <DialogHeader className="bg-black text-white px-6 py-4">
                        <DialogTitle className="text-lg font-black uppercase tracking-wider text-white flex items-center gap-2">
                            {confirmDialog.mode === 'critical_restock' ? (
                                <><AlertCircle className="h-5 w-5 text-red-400" /> Permintaan Restock Kritis</>
                            ) : confirmDialog.mode === 'request_pr' ? (
                                <><ShoppingCart className="h-5 w-5 text-violet-400" /> Buat Purchase Request</>
                            ) : (
                                "Hapus Alert Kritis"
                            )}
                        </DialogTitle>
                        <p className="text-zinc-400 text-[11px] font-bold mt-0.5">
                            {confirmDialog.mode === 'critical_restock'
                                ? "Produk akan ditandai KRITIS dan Purchase Request otomatis dibuat."
                                : confirmDialog.mode === 'request_pr'
                                    ? "Purchase Request akan dikirim ke tim Procurement untuk diproses."
                                    : "Alert kritis akan dihapus. Purchase Request aktif tidak akan dibatalkan."
                            }
                        </p>
                    </DialogHeader>

                    {(confirmDialog.mode === 'critical_restock' || confirmDialog.mode === 'request_pr') && currentProduct && (
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
                                {confirmDialog.mode === 'critical_restock' && (
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
                                )}
                                {confirmDialog.mode === 'request_pr' && (
                                    <div>
                                        <label className="text-[10px] font-black uppercase tracking-wider text-zinc-500 mb-1 block">Gudang (opsional)</label>
                                        <Select value={prForm.warehouseId} onValueChange={(val) => setPrForm(prev => ({ ...prev, warehouseId: val }))}>
                                            <SelectTrigger className="border-2 border-black font-bold h-10">
                                                <SelectValue placeholder="Pilih gudang..." />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {warehouses.map(w => (
                                                    <SelectItem key={w.id} value={w.id}>{w.name}</SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                )}
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
                            {Number(currentProduct.costPrice || 0) > 0 && Number(prForm.quantity || 0) > 0 && (
                                <div className={cn(
                                    "border-2 p-4 space-y-2",
                                    confirmDialog.mode === 'critical_restock'
                                        ? "bg-red-50 dark:bg-red-950/20 border-red-300"
                                        : "bg-blue-50 dark:bg-blue-950/20 border-blue-300"
                                )}>
                                    <div className={cn(
                                        "flex items-center gap-2 font-black text-[10px] uppercase tracking-widest",
                                        confirmDialog.mode === 'critical_restock'
                                            ? "text-red-800 dark:text-red-400"
                                            : "text-blue-800 dark:text-blue-400"
                                    )}>
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
                                    <div className={cn(
                                        "border-t pt-2 flex justify-between items-center font-black text-lg",
                                        confirmDialog.mode === 'critical_restock' ? "border-red-200 dark:border-red-700" : "border-blue-200 dark:border-blue-700"
                                    )}>
                                        <span>Total Estimasi</span>
                                        <span className="font-mono">Rp {totalWithTax.toLocaleString()}</span>
                                    </div>
                                </div>
                            )}
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
                            onClick={confirmAction}
                            disabled={isSubmittingPR}
                            className={cn(
                                "border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:translate-y-[2px] hover:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] transition-all uppercase font-black text-xs tracking-wider px-6 h-9",
                                confirmDialog.mode === 'critical_restock'
                                    ? "bg-red-600 hover:bg-red-700 text-white border-red-700"
                                    : confirmDialog.mode === 'request_pr'
                                        ? "bg-violet-600 hover:bg-violet-700 text-white border-violet-700"
                                        : "bg-black text-white"
                            )}
                        >
                            {confirmDialog.mode === 'critical_restock' ? (
                                <><Truck className="mr-2 h-4 w-4" /> Buat Permintaan</>
                            ) : confirmDialog.mode === 'request_pr' ? (
                                <><ShoppingCart className="mr-2 h-4 w-4" /> Buat PR</>
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
                warehouses={warehouses}
            />
        </div>
    )
}
