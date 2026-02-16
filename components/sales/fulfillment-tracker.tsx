"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Package, Truck, FileText, Check } from "lucide-react"
import { toast } from "sonner"
import type { SOFulfillmentData } from "@/lib/actions/sales"

interface FulfillmentTrackerProps {
    fulfillment: SOFulfillmentData
    onRecordShipment: (salesOrderItemId: string, qtyShipped: number) => Promise<{ success: boolean; error?: string }>
}

export function FulfillmentTracker({ fulfillment, onRecordShipment }: FulfillmentTrackerProps) {
    const [shipQty, setShipQty] = useState<Record<string, string>>({})
    const [loading, setLoading] = useState<string | null>(null)

    const handleShip = async (itemId: string) => {
        const qty = parseFloat(shipQty[itemId] || '0')
        if (qty <= 0) {
            toast.error("Qty kirim harus > 0")
            return
        }

        setLoading(itemId)
        const result = await onRecordShipment(itemId, qty)
        setLoading(null)

        if (result.success) {
            toast.success("Pengiriman berhasil dicatat")
            setShipQty((prev) => ({ ...prev, [itemId]: '' }))
        } else {
            toast.error(result.error || "Gagal mencatat pengiriman")
        }
    }

    const statusColor = fulfillment.overallFulfillmentPct >= 100
        ? 'bg-emerald-500'
        : fulfillment.overallFulfillmentPct > 0
        ? 'bg-amber-500'
        : 'bg-zinc-300'

    return (
        <div className="bg-white border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-2.5 border-b-2 border-black bg-zinc-50">
                <div className="flex items-center gap-2">
                    <Truck className="h-4 w-4 text-zinc-500" />
                    <span className="text-[10px] font-black uppercase tracking-widest text-zinc-500">
                        Fulfillment Tracker
                    </span>
                </div>
                <div className="flex items-center gap-2">
                    <span className="text-[10px] font-bold text-zinc-400">{fulfillment.orderNumber}</span>
                    <span className={`text-[10px] font-black px-2 py-0.5 border-2 border-black ${
                        fulfillment.overallFulfillmentPct >= 100
                            ? 'bg-emerald-100 text-emerald-700'
                            : fulfillment.overallFulfillmentPct > 0
                            ? 'bg-amber-100 text-amber-700'
                            : 'bg-zinc-100 text-zinc-600'
                    }`}>
                        {fulfillment.overallFulfillmentPct}%
                    </span>
                </div>
            </div>

            {/* Overall progress */}
            <div className="px-4 py-3 border-b border-zinc-200">
                <div className="flex items-center justify-between text-[9px] font-bold mb-1.5">
                    <span className="text-zinc-500 uppercase tracking-widest">Progress Keseluruhan</span>
                    <span className="font-black">{fulfillment.overallFulfillmentPct}%</span>
                </div>
                <div className="h-3 bg-zinc-100 border-2 border-black overflow-hidden">
                    <div
                        className={`h-full ${statusColor} transition-all`}
                        style={{ width: `${Math.min(100, fulfillment.overallFulfillmentPct)}%` }}
                    />
                </div>
            </div>

            {/* Items */}
            <div className="divide-y divide-zinc-100">
                {fulfillment.items.map((item) => {
                    const remaining = item.qtyOrdered - item.qtyDelivered
                    const isComplete = remaining <= 0

                    return (
                        <div key={item.id} className="px-4 py-3">
                            {/* Item header */}
                            <div className="flex items-start justify-between mb-2">
                                <div>
                                    <div className="flex items-center gap-2">
                                        <Package className="h-3.5 w-3.5 text-zinc-400" />
                                        <span className="text-xs font-bold">{item.productName}</span>
                                        {item.color && (
                                            <span className="text-[9px] px-1 py-0.5 bg-zinc-100 border font-bold">{item.color}</span>
                                        )}
                                        {item.size && (
                                            <span className="text-[9px] px-1 py-0.5 bg-zinc-100 border font-bold">{item.size}</span>
                                        )}
                                    </div>
                                    <span className="text-[10px] text-zinc-400 font-mono">{item.productCode}</span>
                                </div>
                                {isComplete ? (
                                    <span className="text-[9px] font-black px-1.5 py-0.5 bg-emerald-100 text-emerald-700 border border-emerald-300 flex items-center gap-1">
                                        <Check className="h-3 w-3" /> Lengkap
                                    </span>
                                ) : (
                                    <span className="text-[9px] font-bold text-zinc-400">
                                        Sisa: {remaining}
                                    </span>
                                )}
                            </div>

                            {/* Progress bars */}
                            <div className="grid grid-cols-2 gap-3 mb-2">
                                <div>
                                    <div className="flex items-center justify-between text-[8px] font-bold mb-0.5">
                                        <span className="text-zinc-400 flex items-center gap-1">
                                            <Truck className="h-2.5 w-2.5" /> Dikirim
                                        </span>
                                        <span>{item.qtyDelivered} / {item.qtyOrdered}</span>
                                    </div>
                                    <div className="h-1.5 bg-zinc-100 border border-zinc-200 overflow-hidden">
                                        <div
                                            className={`h-full ${item.fulfillmentPct >= 100 ? 'bg-emerald-500' : 'bg-blue-500'}`}
                                            style={{ width: `${Math.min(100, item.fulfillmentPct)}%` }}
                                        />
                                    </div>
                                </div>
                                <div>
                                    <div className="flex items-center justify-between text-[8px] font-bold mb-0.5">
                                        <span className="text-zinc-400 flex items-center gap-1">
                                            <FileText className="h-2.5 w-2.5" /> Diinvoice
                                        </span>
                                        <span>{item.qtyInvoiced} / {item.qtyOrdered}</span>
                                    </div>
                                    <div className="h-1.5 bg-zinc-100 border border-zinc-200 overflow-hidden">
                                        <div
                                            className="h-full bg-violet-500"
                                            style={{ width: `${item.qtyOrdered > 0 ? Math.min(100, (item.qtyInvoiced / item.qtyOrdered) * 100) : 0}%` }}
                                        />
                                    </div>
                                </div>
                            </div>

                            {/* Ship action */}
                            {!isComplete && (
                                <div className="flex items-center gap-2 mt-2">
                                    <Input
                                        className="border-2 border-black font-mono font-bold h-7 rounded-none text-xs w-20"
                                        type="number"
                                        min={1}
                                        max={remaining}
                                        placeholder="Qty"
                                        value={shipQty[item.id] || ''}
                                        onChange={(e) => setShipQty((prev) => ({ ...prev, [item.id]: e.target.value }))}
                                    />
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        className="h-7 px-2 text-[9px] font-black uppercase border-2 border-black rounded-none"
                                        disabled={loading === item.id}
                                        onClick={() => handleShip(item.id)}
                                    >
                                        <Truck className="h-3 w-3 mr-1" />
                                        {loading === item.id ? 'Mencatat...' : 'Kirim'}
                                    </Button>
                                </div>
                            )}
                        </div>
                    )
                })}
            </div>
        </div>
    )
}
