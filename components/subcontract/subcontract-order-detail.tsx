"use client"

import { useState } from "react"
import { useQueryClient } from "@tanstack/react-query"
import { ClipboardList, ArrowRight, DollarSign } from "lucide-react"
import { toast } from "sonner"
import type { SubcontractOrderDetail, WarehouseOption } from "@/lib/actions/subcontract"
import { updateSubcontractOrderStatus, updateItemReturnQty } from "@/lib/actions/subcontract"
import { queryKeys } from "@/lib/query-keys"
import {
    subcontractStatusLabels,
    subcontractStatusColors,
    getNextStatuses,
    isTerminal,
} from "@/lib/subcontract-state-machine"
import { ShipmentTracking } from "./shipment-tracking"
import { Input } from "@/components/ui/input"
import { NB } from "@/lib/dialog-styles"
import type { SubcontractOrderStatus } from "@prisma/client"

interface SubcontractOrderDetailViewProps {
    order: SubcontractOrderDetail
    warehouses: WarehouseOption[]
}

export function SubcontractOrderDetailView({ order, warehouses }: SubcontractOrderDetailViewProps) {
    const [loading, setLoading] = useState(false)
    const queryClient = useQueryClient()

    const handleStatusChange = async (newStatus: SubcontractOrderStatus) => {
        setLoading(true)
        const result = await updateSubcontractOrderStatus(order.id, newStatus)
        setLoading(false)

        if (result.success) {
            toast.success(`Status diubah ke ${subcontractStatusLabels[newStatus]}`)
            queryClient.invalidateQueries({ queryKey: queryKeys.subcontractOrders.all })
            queryClient.invalidateQueries({ queryKey: queryKeys.subcontractDashboard.all })
            queryClient.invalidateQueries({ queryKey: queryKeys.subcontractRegistry.all })
        } else {
            toast.error(result.error || "Gagal mengubah status")
        }
    }

    const handleUpdateReturn = async (
        itemId: string,
        returnedQty: number,
        defectQty: number,
        wastageQty: number
    ) => {
        const result = await updateItemReturnQty(itemId, returnedQty, defectQty, wastageQty)
        if (result.success) {
            toast.success("Qty pengembalian diperbarui")
            queryClient.invalidateQueries({ queryKey: queryKeys.subcontractOrders.all })
            queryClient.invalidateQueries({ queryKey: queryKeys.subcontractDashboard.all })
            queryClient.invalidateQueries({ queryKey: queryKeys.subcontractRegistry.all })
        } else {
            toast.error(result.error || "Gagal memperbarui")
        }
    }

    const nextStatuses = getNextStatuses(order.status)
    const terminal = isTerminal(order.status)

    const formatCurrency = (value: number) =>
        new Intl.NumberFormat("id-ID", {
            style: "currency",
            currency: "IDR",
            minimumFractionDigits: 0,
        }).format(value)

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="bg-white border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
                <div className="px-4 py-3 border-b-2 border-black bg-zinc-50 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <ClipboardList className="h-4 w-4" />
                        <span className="text-sm font-black">{order.number}</span>
                    </div>
                    <span
                        className={`text-[9px] font-black px-2 py-0.5 border ${subcontractStatusColors[order.status]}`}
                    >
                        {subcontractStatusLabels[order.status]}
                    </span>
                </div>

                <div className="px-4 py-3 grid grid-cols-2 md:grid-cols-5 gap-4">
                    <div>
                        <div className="text-[9px] font-bold text-zinc-400 uppercase">
                            Subkontraktor
                        </div>
                        <div className="text-xs font-black">{order.subcontractorName}</div>
                    </div>
                    <div>
                        <div className="text-[9px] font-bold text-zinc-400 uppercase">
                            Operasi
                        </div>
                        <div className="text-xs font-black">{order.operation}</div>
                    </div>
                    <div>
                        <div className="text-[9px] font-bold text-zinc-400 uppercase">
                            Tanggal Kirim
                        </div>
                        <div className="text-xs font-bold">
                            {new Date(order.issuedDate).toLocaleDateString("id-ID")}
                        </div>
                    </div>
                    <div>
                        <div className="text-[9px] font-bold text-zinc-400 uppercase">
                            Target Kembali
                        </div>
                        <div className="text-xs font-bold">
                            {order.expectedReturnDate
                                ? new Date(order.expectedReturnDate).toLocaleDateString("id-ID")
                                : "—"}
                        </div>
                    </div>
                    {order.estimatedCost !== null && (
                        <div>
                            <div className="text-[9px] font-bold text-zinc-400 uppercase">
                                Estimasi Biaya
                            </div>
                            <div className="text-xs font-black text-emerald-700 flex items-center gap-1">
                                <DollarSign className="h-3 w-3" />
                                {formatCurrency(order.estimatedCost)}
                            </div>
                        </div>
                    )}
                </div>

                {/* Status transitions */}
                {!terminal && nextStatuses.length > 0 && (
                    <div className="px-4 py-3 border-t border-zinc-200 flex items-center gap-2">
                        <span className="text-[9px] font-bold text-zinc-400 uppercase">
                            Ubah status:
                        </span>
                        {nextStatuses.map((ns) => (
                            <button
                                key={ns}
                                onClick={() => handleStatusChange(ns)}
                                disabled={loading}
                                className={`flex items-center gap-1 text-[9px] font-black uppercase tracking-wider px-2.5 py-1 border-2 border-black rounded-none transition-all hover:translate-y-[1px] ${
                                    ns === "SC_CANCELLED"
                                        ? "bg-red-50 text-red-700 hover:bg-red-100"
                                        : "bg-white hover:bg-zinc-100"
                                }`}
                            >
                                <ArrowRight className="h-3 w-3" />
                                {subcontractStatusLabels[ns]}
                            </button>
                        ))}
                    </div>
                )}
            </div>

            {/* Items table */}
            <div className="bg-white border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
                <div className="px-4 py-2.5 border-b-2 border-black bg-zinc-50">
                    <span className="text-[10px] font-black uppercase tracking-widest text-zinc-500">
                        Item Order
                    </span>
                </div>
                <div className={NB.tableWrap}>
                    <table className="w-full">
                        <thead className={NB.tableHead}>
                            <tr>
                                <th className={`${NB.tableHeadCell} text-left`}>Produk</th>
                                <th className={`${NB.tableHeadCell} text-right`}>Kirim</th>
                                <th className={`${NB.tableHeadCell} text-right`}>Kembali</th>
                                <th className={`${NB.tableHeadCell} text-right`}>Cacat</th>
                                <th className={`${NB.tableHeadCell} text-right`}>Sisa</th>
                            </tr>
                        </thead>
                        <tbody>
                            {order.items.map((item) => (
                                <ItemRow
                                    key={item.id}
                                    item={item}
                                    editable={!terminal}
                                    onSave={handleUpdateReturn}
                                />
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Shipments */}
            <div className="bg-white border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] p-4">
                <ShipmentTracking
                    orderId={order.id}
                    orderNumber={order.number}
                    shipments={order.shipments}
                    orderItems={order.items}
                    warehouses={warehouses}
                />
            </div>
        </div>
    )
}

// ==============================================================================
// Item row with inline editing
// ==============================================================================

function ItemRow({
    item,
    editable,
    onSave,
}: {
    item: SubcontractOrderDetail["items"][number]
    editable: boolean
    onSave: (id: string, returned: number, defect: number, wastage: number) => void
}) {
    const [returnedQty, setReturnedQty] = useState(item.returnedQty)
    const [defectQty, setDefectQty] = useState(item.defectQty)
    const [wastageQty, setWastageQty] = useState(item.wastageQty)
    const [dirty, setDirty] = useState(false)

    const handleBlur = () => {
        if (dirty) {
            onSave(item.id, returnedQty, defectQty, wastageQty)
            setDirty(false)
        }
    }

    const remaining = item.issuedQty - returnedQty - defectQty - wastageQty

    return (
        <tr className={NB.tableRow}>
            <td className={NB.tableCell}>
                <div className="text-xs font-bold">{item.productName}</div>
                <div className="text-[9px] text-zinc-400 font-mono">{item.productCode}</div>
            </td>
            <td className={`${NB.tableCell} text-right font-mono`}>
                {item.issuedQty.toLocaleString()}
            </td>
            <td className={`${NB.tableCell} text-right`}>
                {editable ? (
                    <Input
                        type="number"
                        className="border-2 border-black rounded-none h-7 w-20 text-right font-mono text-xs ml-auto"
                        value={returnedQty}
                        onChange={(e) => {
                            setReturnedQty(parseInt(e.target.value) || 0)
                            setDirty(true)
                        }}
                        onBlur={handleBlur}
                    />
                ) : (
                    <span className="font-mono">{returnedQty.toLocaleString()}</span>
                )}
            </td>
            <td className={`${NB.tableCell} text-right`}>
                {editable ? (
                    <Input
                        type="number"
                        className="border-2 border-black rounded-none h-7 w-20 text-right font-mono text-xs ml-auto"
                        value={defectQty}
                        onChange={(e) => {
                            setDefectQty(parseInt(e.target.value) || 0)
                            setDirty(true)
                        }}
                        onBlur={handleBlur}
                    />
                ) : (
                    <span className="font-mono">{defectQty.toLocaleString()}</span>
                )}
            </td>
            <td className={`${NB.tableCell} text-right`}>
                <span
                    className={`font-mono font-bold ${remaining < 0 ? "text-red-600" : ""}`}
                >
                    {remaining.toLocaleString()}
                </span>
            </td>
        </tr>
    )
}
