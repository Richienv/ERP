"use client"

import { useState } from "react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
    Truck,
    FileText,
    AlertCircle,
    CheckCircle2,
    Factory,
    Loader2,
    Clock,
    MoreHorizontal,
    Package
} from "lucide-react"
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from "@/components/ui/tooltip"
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import Link from "next/link"

interface SalesOrder {
    id: string
    number: string
    customer: {
        name: string
        code: string
    }
    orderDate: string
    requestedDate: string | null
    status: string
    total: number
    itemCount: number
    paymentTerm?: string
    notes?: string
    quotationNumber?: string | null
    workOrders?: { id: string; status: string; woNumber: string }[]
}

interface OrderExecutionCardProps {
    order: SalesOrder
    onWorkOrdersCreated?: (orderId: string, count: number) => void
}

const STATUS_BAR_COLORS: Record<string, string> = {
    DRAFT: "bg-zinc-300",
    CONFIRMED: "bg-blue-500",
    IN_PROGRESS: "bg-amber-500",
    PROCESSING: "bg-amber-500",
    SHIPPED: "bg-purple-500",
    DELIVERED: "bg-emerald-500",
    INVOICED: "bg-emerald-500",
    COMPLETED: "bg-emerald-600",
    CANCELLED: "bg-red-500",
}

const STATUS_BADGE_STYLES: Record<string, string> = {
    DRAFT: "bg-zinc-100 text-zinc-700 border-zinc-300",
    CONFIRMED: "bg-blue-50 text-blue-700 border-blue-300",
    IN_PROGRESS: "bg-amber-50 text-amber-700 border-amber-300",
    PROCESSING: "bg-amber-50 text-amber-700 border-amber-300",
    SHIPPED: "bg-purple-50 text-purple-700 border-purple-300",
    DELIVERED: "bg-emerald-50 text-emerald-700 border-emerald-300",
    INVOICED: "bg-emerald-50 text-emerald-700 border-emerald-300",
    COMPLETED: "bg-emerald-100 text-emerald-800 border-emerald-400",
    CANCELLED: "bg-red-50 text-red-700 border-red-300",
}

const STATUS_LABELS: Record<string, string> = {
    DRAFT: "Draft",
    CONFIRMED: "Dikonfirmasi",
    IN_PROGRESS: "Dalam Proses",
    PROCESSING: "Dalam Proses",
    SHIPPED: "Dikirim",
    DELIVERED: "Terkirim",
    INVOICED: "Ditagih",
    COMPLETED: "Selesai",
    CANCELLED: "Dibatalkan",
}

function getProgress(status: string) {
    switch (status) {
        case "DRAFT": return 0
        case "CONFIRMED": return 15
        case "IN_PROGRESS": case "PROCESSING": return 50
        case "SHIPPED": return 80
        case "DELIVERED": return 95
        case "INVOICED": case "COMPLETED": return 100
        default: return 0
    }
}

export function OrderExecutionCard({ order, onWorkOrdersCreated }: OrderExecutionCardProps) {
    const [isCreatingWO, setIsCreatingWO] = useState(false)
    const hasExistingWOs = order.workOrders && order.workOrders.length > 0
    const [woCreated, setWoCreated] = useState(hasExistingWOs)
    const [woError, setWoError] = useState<string | null>(null)

    const progress = getProgress(order.status)
    const canCreateWorkOrders = ["CONFIRMED", "IN_PROGRESS", "PROCESSING"].includes(order.status)

    const handleCreateWorkOrders = async () => {
        setIsCreatingWO(true)
        setWoError(null)

        try {
            const response = await fetch(`/api/sales/orders/${order.id}/create-work-orders`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ priority: "NORMAL" }),
            })
            const data = await response.json()
            if (data.success) {
                setWoCreated(true)
                onWorkOrdersCreated?.(order.id, data.data?.length || 0)
            } else {
                setWoError(data.error || "Gagal membuat work order")
            }
        } catch {
            setWoError("Koneksi gagal. Coba lagi.")
        } finally {
            setIsCreatingWO(false)
        }
    }

    const barColor = STATUS_BAR_COLORS[order.status] || "bg-zinc-300"
    const badgeStyle = STATUS_BADGE_STYLES[order.status] || STATUS_BADGE_STYLES.DRAFT
    const statusLabel = STATUS_LABELS[order.status] || order.status

    return (
        <div className="bg-white border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] rounded-none hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] transition-all group overflow-hidden flex flex-col">
            {/* Status color bar */}
            <div className={`h-1.5 w-full ${barColor}`} />

            {/* Header */}
            <div className="p-4 pb-3">
                <div className="flex items-center justify-between mb-2">
                    <div className="bg-black text-white px-2 py-0.5 text-[9px] font-black font-mono tracking-widest">
                        {order.number}
                    </div>
                    <Badge className={`border text-[9px] font-black uppercase tracking-wider rounded-none px-2 py-0.5 ${badgeStyle}`}>
                        {statusLabel}
                    </Badge>
                </div>
                <h3 className="font-black text-sm uppercase truncate group-hover:text-blue-600 transition-colors" title={order.customer.name}>
                    {order.customer.name}
                </h3>
                <div className="flex items-center gap-2 mt-1.5">
                    <span className="text-[10px] text-zinc-500 font-mono flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {new Date(order.orderDate).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" })}
                    </span>
                    {order.itemCount > 0 && (
                        <span className="text-[10px] font-bold bg-zinc-100 px-1.5 py-0.5 border border-zinc-200">
                            {order.itemCount} Item
                        </span>
                    )}
                </div>
            </div>

            {/* Metrics */}
            <div className="border-t-2 border-dashed border-zinc-200 px-4 py-3">
                <div className="grid grid-cols-2 gap-3">
                    <div>
                        <p className="text-[9px] font-black text-zinc-400 uppercase tracking-wider mb-0.5">Nilai Order</p>
                        <p className="font-black text-lg leading-none tracking-tight">
                            {new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", notation: "compact", maximumFractionDigits: 1 }).format(order.total)}
                        </p>
                    </div>
                    <div>
                        <p className="text-[9px] font-black text-zinc-400 uppercase tracking-wider mb-0.5">Status Bayar</p>
                        <p className="text-[10px] font-bold text-zinc-600 uppercase">{order.paymentTerm || "—"}</p>
                    </div>
                </div>
            </div>

            {/* Production Progress */}
            <div className="px-4 pb-3">
                <div className="flex justify-between items-center mb-1.5">
                    <span className="text-[9px] font-black uppercase tracking-widest text-zinc-500 flex items-center gap-1">
                        <Factory className="h-3 w-3" /> Progres
                    </span>
                    <span className="text-[10px] font-black bg-black text-white px-1.5 py-0.5">{progress}%</span>
                </div>
                <div className="relative h-3 w-full bg-zinc-100 border-2 border-black rounded-none overflow-hidden">
                    <div
                        className="absolute top-0 left-0 h-full bg-blue-500 transition-all duration-1000 border-r-2 border-black"
                        style={{ width: `${Math.max(progress, 2)}%` }}
                    />
                    <div
                        className="absolute top-0 left-0 w-full h-full opacity-10"
                        style={{ backgroundImage: "repeating-linear-gradient(45deg, #000 0, #000 1px, transparent 0, transparent 50%)", backgroundSize: "10px 10px" }}
                    />
                </div>
                <div className="flex justify-between mt-1 text-[9px] text-zinc-400 font-bold uppercase tracking-wider">
                    <span className={progress >= 15 ? "text-blue-600" : ""}>Konfirmasi</span>
                    <span className={progress >= 50 ? "text-blue-600" : ""}>Produksi</span>
                    <span className={progress >= 80 ? "text-blue-600" : ""}>Kirim</span>
                    <span className={progress >= 100 ? "text-blue-600" : ""}>Selesai</span>
                </div>
            </div>

            {/* Error */}
            {woError && (
                <div className="px-4 pb-2">
                    <p className="text-[10px] font-bold text-red-600 flex items-center gap-1.5 bg-red-50 border border-red-200 px-2 py-1">
                        <AlertCircle className="h-3 w-3 flex-shrink-0" />
                        {woError}
                    </p>
                </div>
            )}

            {/* Footer */}
            <div className="mt-auto border-t-2 border-black p-3 flex items-center gap-2">
                {canCreateWorkOrders && !woCreated && (
                    <TooltipProvider>
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    className={`flex-1 h-8 border-2 border-black rounded-none shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-none text-[10px] font-black uppercase tracking-wider ${woError ? "border-red-500 text-red-500" : "hover:bg-blue-50"}`}
                                    onClick={handleCreateWorkOrders}
                                    disabled={isCreatingWO}
                                >
                                    {isCreatingWO ? (
                                        <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />
                                    ) : (
                                        <Factory className="h-3.5 w-3.5 mr-1.5" />
                                    )}
                                    Produksi
                                </Button>
                            </TooltipTrigger>
                            <TooltipContent className="border-2 border-black rounded-none font-bold text-xs bg-white text-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
                                <p>Buat Work Order dari pesanan ini</p>
                            </TooltipContent>
                        </Tooltip>
                    </TooltipProvider>
                )}

                {woCreated && (
                    <Badge className="flex-1 justify-center bg-emerald-100 text-emerald-800 border-2 border-emerald-600 rounded-none text-[9px] font-black uppercase h-8 flex items-center">
                        <CheckCircle2 className="h-3.5 w-3.5 mr-1.5" />
                        WO Aktif
                    </Badge>
                )}

                <Button
                    variant="outline"
                    size="sm"
                    asChild
                    className="flex-1 h-8 border-2 border-black rounded-none shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-none text-[10px] font-black uppercase tracking-wider hover:bg-zinc-100"
                >
                    <Link href={`/sales/orders/${order.id}`}>
                        <FileText className="h-3.5 w-3.5 mr-1.5" />
                        Detail
                    </Link>
                </Button>

                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <Button variant="outline" size="sm" className="h-8 w-8 p-0 border-2 border-black rounded-none shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-none hover:bg-zinc-100">
                            <MoreHorizontal className="h-4 w-4" />
                        </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="border-2 border-black rounded-none shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] w-44">
                        <DropdownMenuLabel className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Aksi</DropdownMenuLabel>
                        <DropdownMenuSeparator className="bg-zinc-200" />
                        <DropdownMenuItem className="text-xs font-bold cursor-pointer focus:bg-zinc-100 rounded-none" asChild>
                            <Link href={`/sales/orders/${order.id}`}>
                                <FileText className="mr-2 h-3.5 w-3.5" /> Lihat Detail
                            </Link>
                        </DropdownMenuItem>
                        <DropdownMenuItem className="text-xs font-bold cursor-pointer focus:bg-zinc-100 rounded-none">
                            <Truck className="mr-2 h-3.5 w-3.5" /> Pengiriman
                        </DropdownMenuItem>
                        <DropdownMenuItem className="text-xs font-bold cursor-pointer focus:bg-zinc-100 rounded-none">
                            <Package className="mr-2 h-3.5 w-3.5" /> Invoice
                        </DropdownMenuItem>
                        <DropdownMenuSeparator className="bg-zinc-200" />
                        <DropdownMenuItem className="text-xs font-bold text-red-600 cursor-pointer focus:bg-red-50 focus:text-red-700 rounded-none">
                            Batalkan Pesanan
                        </DropdownMenuItem>
                    </DropdownMenuContent>
                </DropdownMenu>
            </div>
        </div>
    )
}
