"use client"

import { useState } from "react"
import { useQueryClient } from "@tanstack/react-query"
import { queryKeys } from "@/lib/query-keys"
import { Button } from "@/components/ui/button"
import { ArrowRightLeft, ArrowRight, Check, X, Truck } from "lucide-react"
import { toast } from "sonner"
import { CreateTransferDialog } from "./create-transfer-dialog"
import { transitionStockTransfer, type StockTransferSummary } from "@/lib/actions/stock-transfers"
import {
    TRANSFER_STATUS_LABELS,
    TRANSFER_STATUS_COLORS,
    getAllowedTransferTransitions,
    isTransferTerminal,
} from "@/lib/stock-transfer-machine"
import type { TransferStatus } from "@prisma/client"

interface StockTransferListProps {
    transfers: StockTransferSummary[]
    warehouses: { id: string; name: string; code: string }[]
    products: { id: string; name: string; code: string }[]
}

const STATUS_FILTERS: { value: string; label: string }[] = [
    { value: '', label: 'Semua' },
    { value: 'DRAFT', label: 'Draft' },
    { value: 'PENDING_APPROVAL', label: 'Menunggu' },
    { value: 'APPROVED', label: 'Disetujui' },
    { value: 'IN_TRANSIT', label: 'Dalam Perjalanan' },
    { value: 'RECEIVED', label: 'Diterima' },
    { value: 'CANCELLED', label: 'Dibatalkan' },
]

export function StockTransferList({ transfers, warehouses, products }: StockTransferListProps) {
    const [statusFilter, setStatusFilter] = useState("")
    const [transitioning, setTransitioning] = useState<string | null>(null)
    const queryClient = useQueryClient()

    const filtered = statusFilter
        ? transfers.filter((t) => t.status === statusFilter)
        : transfers

    const handleTransition = async (transferId: string, newStatus: TransferStatus) => {
        setTransitioning(transferId)
        const result = await transitionStockTransfer(transferId, newStatus)
        setTransitioning(null)

        if (result.success) {
            toast.success(`Transfer berhasil diubah ke ${TRANSFER_STATUS_LABELS[newStatus]}`)
            queryClient.invalidateQueries({ queryKey: queryKeys.stockTransfers.all })
            queryClient.invalidateQueries({ queryKey: queryKeys.products.all })
            queryClient.invalidateQueries({ queryKey: queryKeys.stockMovements.all })
            queryClient.invalidateQueries({ queryKey: queryKeys.warehouses.all })
            queryClient.invalidateQueries({ queryKey: queryKeys.inventoryDashboard.all })
        } else {
            toast.error(result.error || "Gagal mengubah status")
        }
    }

    // Summary
    const pending = transfers.filter((t) => t.status === 'PENDING_APPROVAL').length
    const inTransit = transfers.filter((t) => t.status === 'IN_TRANSIT').length

    return (
        <div className="space-y-4">
            {/* Summary */}
            <div className="grid grid-cols-4 gap-4">
                <div className="border-2 border-black p-3 bg-white shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
                    <span className="text-[9px] font-black uppercase tracking-widest text-zinc-400 block">Total Transfer</span>
                    <span className="text-2xl font-black">{transfers.length}</span>
                </div>
                <div className="border-2 border-black p-3 bg-white shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
                    <span className="text-[9px] font-black uppercase tracking-widest text-amber-500 block">Menunggu Approval</span>
                    <span className="text-2xl font-black text-amber-600">{pending}</span>
                </div>
                <div className="border-2 border-black p-3 bg-white shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
                    <span className="text-[9px] font-black uppercase tracking-widest text-violet-500 block">Dalam Perjalanan</span>
                    <span className="text-2xl font-black text-violet-600">{inTransit}</span>
                </div>
                <div className="flex items-center justify-center">
                    <CreateTransferDialog warehouses={warehouses} products={products} />
                </div>
            </div>

            {/* Filters */}
            <div className="flex gap-1 flex-wrap">
                {STATUS_FILTERS.map((f) => (
                    <Button
                        key={f.value}
                        variant="outline"
                        size="sm"
                        className={`h-8 text-[10px] font-black uppercase tracking-wider border-2 border-black rounded-none ${
                            statusFilter === f.value ? 'bg-black text-white' : 'bg-white hover:bg-zinc-100'
                        }`}
                        onClick={() => setStatusFilter(f.value)}
                    >
                        {f.label}
                    </Button>
                ))}
            </div>

            {/* Transfer List */}
            {filtered.length === 0 ? (
                <div className="border-2 border-dashed border-zinc-300 p-12 text-center">
                    <ArrowRightLeft className="h-10 w-10 mx-auto text-zinc-300 mb-3" />
                    <span className="text-[10px] font-black uppercase tracking-widest text-zinc-400 block">
                        Belum ada transfer
                    </span>
                </div>
            ) : (
                <div className="border-2 border-black overflow-hidden">
                    <table className="w-full">
                        <thead className="bg-zinc-100 border-b-2 border-black">
                            <tr>
                                <th className="text-[9px] font-black uppercase tracking-widest text-zinc-500 px-3 py-2 text-left">No.</th>
                                <th className="text-[9px] font-black uppercase tracking-widest text-zinc-500 px-3 py-2 text-left">Produk</th>
                                <th className="text-[9px] font-black uppercase tracking-widest text-zinc-500 px-3 py-2 text-center">Dari → Ke</th>
                                <th className="text-[9px] font-black uppercase tracking-widest text-zinc-500 px-3 py-2 text-center">Qty</th>
                                <th className="text-[9px] font-black uppercase tracking-widest text-zinc-500 px-3 py-2 text-center">Status</th>
                                <th className="text-[9px] font-black uppercase tracking-widest text-zinc-500 px-3 py-2 text-left">Peminta</th>
                                <th className="text-[9px] font-black uppercase tracking-widest text-zinc-500 px-3 py-2 text-center">Aksi</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filtered.map((t) => {
                                const colors = TRANSFER_STATUS_COLORS[t.status]
                                const allowed = getAllowedTransferTransitions(t.status)
                                const terminal = isTransferTerminal(t.status)

                                return (
                                    <tr key={t.id} className="border-b border-zinc-100 last:border-b-0 hover:bg-zinc-50">
                                        <td className="px-3 py-2 font-mono font-black text-xs">{t.number}</td>
                                        <td className="px-3 py-2">
                                            <div className="text-xs font-bold">{t.productName}</div>
                                            <div className="text-[10px] text-zinc-400 font-mono">{t.productCode}</div>
                                        </td>
                                        <td className="px-3 py-2 text-center">
                                            <div className="flex items-center justify-center gap-1 text-xs">
                                                <span className="font-bold">{t.fromWarehouse}</span>
                                                <ArrowRight className="h-3 w-3 text-zinc-400" />
                                                <span className="font-bold">{t.toWarehouse}</span>
                                            </div>
                                        </td>
                                        <td className="px-3 py-2 text-center font-mono font-bold text-xs">{t.quantity}</td>
                                        <td className="px-3 py-2 text-center">
                                            <span className={`text-[9px] font-black px-1.5 py-0.5 border ${colors.bg} ${colors.text}`}>
                                                {TRANSFER_STATUS_LABELS[t.status]}
                                            </span>
                                        </td>
                                        <td className="px-3 py-2 text-xs">{t.requesterName}</td>
                                        <td className="px-3 py-2 text-center">
                                            {!terminal && allowed.length > 0 && (
                                                <div className="flex items-center justify-center gap-1">
                                                    {allowed.filter((s) => s !== 'CANCELLED').map((nextStatus) => (
                                                        <Button
                                                            key={nextStatus}
                                                            variant="outline"
                                                            size="sm"
                                                            className="h-6 px-2 text-[9px] font-black uppercase border border-black rounded-none"
                                                            disabled={transitioning === t.id}
                                                            onClick={() => handleTransition(t.id, nextStatus)}
                                                        >
                                                            {nextStatus === 'APPROVED' && <Check className="h-3 w-3 mr-1" />}
                                                            {nextStatus === 'IN_TRANSIT' && <Truck className="h-3 w-3 mr-1" />}
                                                            {nextStatus === 'RECEIVED' && <Check className="h-3 w-3 mr-1" />}
                                                            {TRANSFER_STATUS_LABELS[nextStatus]}
                                                        </Button>
                                                    ))}
                                                    <Button
                                                        variant="outline"
                                                        size="sm"
                                                        className="h-6 px-2 text-[9px] font-black uppercase border border-red-300 text-red-600 rounded-none hover:bg-red-50"
                                                        disabled={transitioning === t.id}
                                                        onClick={() => handleTransition(t.id, 'CANCELLED')}
                                                    >
                                                        <X className="h-3 w-3" />
                                                    </Button>
                                                </div>
                                            )}
                                        </td>
                                    </tr>
                                )
                            })}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    )
}
