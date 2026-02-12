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
} from "lucide-react"
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from "@/components/ui/tooltip"

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
    notes?: string
}

interface OrderExecutionCardProps {
    order: SalesOrder
    onWorkOrdersCreated?: (orderId: string, count: number) => void
}

export function OrderExecutionCard({ order, onWorkOrdersCreated }: OrderExecutionCardProps) {
    const [isCreatingWO, setIsCreatingWO] = useState(false)
    const [woCreated, setWoCreated] = useState(false)
    const [woError, setWoError] = useState<string | null>(null)

    // Production progress estimation based on sales order status
    const getProgress = (status: string) => {
        switch (status) {
            case 'DRAFT': return 0
            case 'CONFIRMED': return 10
            case 'IN_PROGRESS': return 45 // Weaving/Dyeing
            case 'PROCESSING': return 45 // Legacy backward compatibility
            case 'SHIPPED': return 90
            case 'DELIVERED': return 100
            case 'INVOICED': return 100
            case 'COMPLETED': return 100
            default: return 0
        }
    }

    const progress = getProgress(order.status)

    // Mock Margin (Random for demo)
    const margin = Math.floor(Math.random() * (25 - 10) + 10)

    // Check if we can create work orders
    const canCreateWorkOrders = ['CONFIRMED', 'IN_PROGRESS', 'PROCESSING'].includes(order.status)

    const handleCreateWorkOrders = async () => {
        setIsCreatingWO(true)
        setWoError(null)

        try {
            const response = await fetch(`/api/sales/orders/${order.id}/create-work-orders`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    priority: 'NORMAL',
                }),
            })

            const data = await response.json()

            if (data.success) {
                setWoCreated(true)
                if (onWorkOrdersCreated) {
                    onWorkOrdersCreated(order.id, data.data?.length || 0)
                }
            } else {
                setWoError(data.error || 'Failed to create work orders')
            }
        } catch {
            setWoError('Network error. Please try again.')
        } finally {
            setIsCreatingWO(false)
        }
    }

    return (
        <div className="bg-white border border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] rounded-xl overflow-hidden mb-4 hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] transition-all">
            <div className="p-4 grid grid-cols-12 gap-4 items-center">

                {/* 1. ID & Customer (Col 3) */}
                <div className="col-span-12 md:col-span-3">
                    <div className="flex items-center gap-2 mb-1">
                        <Badge variant="outline" className="border-black font-mono text-[10px] bg-zinc-100">
                            {order.number}
                        </Badge>
                        <span className="text-[10px] text-muted-foreground">{order.orderDate}</span>
                    </div>
                    <h3 className="font-black text-sm uppercase truncate">{order.customer.name}</h3>
                    <p className="text-xs text-muted-foreground truncate">{order.notes || '-'}</p>
                </div>

                {/* 2. Value & Margin (Col 2) */}
                <div className="col-span-6 md:col-span-2 border-l border-dashed border-zinc-300 pl-4">
                    <p className="text-[10px] font-bold text-muted-foreground uppercase">Total Value</p>
                    <p className="font-black text-sm">
                        {new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', notation: 'compact' }).format(order.total)}
                    </p>
                    <div className="flex items-center gap-1 mt-1">
                        <span className={`text-[10px] font-bold ${margin < 15 ? 'text-orange-600' : 'text-emerald-600'}`}>
                            Margin: {margin}%
                        </span>
                        {margin < 15 && <AlertCircle className="h-3 w-3 text-orange-600" />}
                    </div>
                </div>

                {/* 3. Production Pipeline (Col 5) */}
                <div className="col-span-12 md:col-span-5 px-4">
                    <div className="flex justify-between items-center mb-1">
                        <span className="text-[10px] font-bold uppercase tracking-wider">Production Status</span>
                        <span className="text-[10px] font-bold">{progress}%</span>
                    </div>
                    <div className="relative h-2 w-full bg-zinc-100 rounded-full border border-black/10 overflow-hidden">
                        <div
                            className="absolute top-0 left-0 h-full bg-black transition-all duration-1000"
                            style={{ width: `${progress}%` }}
                        />
                    </div>
                    <div className="flex justify-between mt-1 text-[10px] text-muted-foreground font-medium">
                        <span className={progress >= 10 ? "text-black" : ""}>Confirmed</span>
                        <span className={progress >= 45 ? "text-black" : ""}>Weaving</span>
                        <span className={progress >= 90 ? "text-black" : ""}>Packing</span>
                        <span className={progress >= 100 ? "text-black" : ""}>Delivered</span>
                    </div>
                </div>

                {/* 4. Actions (Col 2) */}
                <div className="col-span-6 md:col-span-2 flex justify-end gap-2">
                    {/* Create Work Orders Button */}
                    {canCreateWorkOrders && !woCreated && (
                        <TooltipProvider>
                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        className={`h-8 w-8 p-0 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-none ${woError ? 'border-red-500' : ''}`}
                                        onClick={handleCreateWorkOrders}
                                        disabled={isCreatingWO}
                                    >
                                        {isCreatingWO ? (
                                            <Loader2 className="h-4 w-4 animate-spin" />
                                        ) : (
                                            <Factory className="h-4 w-4" />
                                        )}
                                    </Button>
                                </TooltipTrigger>
                                <TooltipContent>
                                    <p>Create Work Orders</p>
                                </TooltipContent>
                            </Tooltip>
                        </TooltipProvider>
                    )}

                    {/* Work Orders Created Success */}
                    {woCreated && (
                        <Badge className="bg-emerald-100 text-emerald-800 border-emerald-300 text-[10px]">
                            <CheckCircle2 className="h-3 w-3 mr-1" />
                            WO Created
                        </Badge>
                    )}

                    <Button variant="outline" size="sm" className="h-8 w-8 p-0 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-none">
                        <Truck className="h-4 w-4" />
                    </Button>
                    <Button variant="outline" size="sm" className="h-8 w-8 p-0 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-none">
                        <FileText className="h-4 w-4" />
                    </Button>
                </div>
            </div>

            {/* Error message */}
            {woError && (
                <div className="px-4 pb-3 -mt-2">
                    <p className="text-xs text-red-600 flex items-center gap-1">
                        <AlertCircle className="h-3 w-3" />
                        {woError}
                    </p>
                </div>
            )}
        </div>
    )
}
