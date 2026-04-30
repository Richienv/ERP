"use client"

import { useState, useEffect } from "react"
import { RotateCcw, Loader2, Package, AlertTriangle } from "lucide-react"
import { useQueryClient } from "@tanstack/react-query"
import { Button } from "@/components/ui/button"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
import { Input } from "@/components/ui/input"
import { toast } from "sonner"
import { getReturnablePurchaseOrders, createPurchaseReturn } from "@/lib/actions/procurement"
import { NB } from "@/lib/dialog-styles"
import { queryKeys } from "@/lib/query-keys"
import { TAX_RATES, TAX_PERCENT } from "@/lib/tax-rates"
import { formatIDR } from "@/lib/utils"
import {
    NBDialog,
    NBDialogHeader,
    NBDialogBody,
    NBDialogFooter,
    NBSection,
    NBSelect,
    NBTextarea,
} from "@/components/ui/nb-dialog"

interface ReturnablePO {
    id: string
    number: string
    supplierName: string
    supplierId: string
    orderDate: string
    items: ReturnablePOItem[]
}

interface ReturnablePOItem {
    id: string
    productId: string
    productName: string
    productCode: string
    quantity: number
    receivedQty: number
    returnedQty: number
    returnableQty: number
    unitPrice: number
}

interface ReturnLineItem {
    poItemId: string
    productId: string
    productName: string
    productCode: string
    maxQty: number
    quantity: number
    unitPrice: number
    reason: string
}

const REASON_OPTIONS = [
    { value: "RET_DEFECT", label: "Barang cacat/rusak" },
    { value: "RET_WRONG", label: "Barang tidak sesuai pesanan" },
    { value: "RET_QUALITY", label: "Kualitas tidak standar" },
    { value: "RET_EXCESS", label: "Kelebihan kirim" },
    { value: "RET_EXPIRED", label: "Barang kadaluarsa" },
]

interface WarehouseOption {
    id: string
    name: string
}

interface Props {
    warehouses: WarehouseOption[]
}

export function PurchaseReturnDialog({ warehouses }: Props) {
    const [open, setOpen] = useState(false)
    const [loading, setLoading] = useState(false)
    const [submitting, setSubmitting] = useState(false)
    const [purchaseOrders, setPurchaseOrders] = useState<ReturnablePO[]>([])
    const [selectedPOId, setSelectedPOId] = useState<string>("")
    const [selectedWarehouseId, setSelectedWarehouseId] = useState<string>("")
    const [notes, setNotes] = useState("")
    const [returnItems, setReturnItems] = useState<ReturnLineItem[]>([])
    const queryClient = useQueryClient()

    const selectedPO = purchaseOrders.find(po => po.id === selectedPOId)

    // Load returnable POs when dialog opens
    useEffect(() => {
        if (open) {
            setLoading(true)
            getReturnablePurchaseOrders().then(result => {
                if (result.success && result.data) {
                    setPurchaseOrders(result.data)
                }
                setLoading(false)
            })
        } else {
            // Reset state on close
            setSelectedPOId("")
            setSelectedWarehouseId("")
            setNotes("")
            setReturnItems([])
        }
    }, [open])

    // When PO is selected, initialize return items
    useEffect(() => {
        if (selectedPO) {
            setReturnItems(
                selectedPO.items
                    .filter(item => item.returnableQty > 0)
                    .map(item => ({
                        poItemId: item.id,
                        productId: item.productId,
                        productName: item.productName,
                        productCode: item.productCode,
                        maxQty: item.returnableQty,
                        quantity: 0,
                        unitPrice: item.unitPrice,
                        reason: "RET_DEFECT",
                    }))
            )
        } else {
            setReturnItems([])
        }
    }, [selectedPOId, selectedPO])

    const updateItemQty = (idx: number, qty: number) => {
        setReturnItems(prev => prev.map((item, i) =>
            i === idx ? { ...item, quantity: Math.min(Math.max(0, qty), item.maxQty) } : item
        ))
    }

    const updateItemReason = (idx: number, reason: string) => {
        setReturnItems(prev => prev.map((item, i) =>
            i === idx ? { ...item, reason } : item
        ))
    }

    const activeItems = returnItems.filter(item => item.quantity > 0)
    const totalReturn = activeItems.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0)

    const handleSubmit = async () => {
        if (!selectedPOId) return toast.error("Pilih PO terlebih dahulu")
        if (!selectedWarehouseId) return toast.error("Pilih gudang asal")
        if (activeItems.length === 0) return toast.error("Masukkan jumlah retur minimal 1 item")

        setSubmitting(true)
        try {
            const result = await createPurchaseReturn({
                purchaseOrderId: selectedPOId,
                warehouseId: selectedWarehouseId,
                notes,
                items: activeItems.map(item => ({
                    poItemId: item.poItemId,
                    productId: item.productId,
                    quantity: item.quantity,
                    unitPrice: item.unitPrice,
                    reason: item.reason,
                }))
            }) as { success: boolean; data?: { debitNoteId: string; debitNoteNumber: string; totalAmount: number } }

            if (result.success) {
                toast.success(`Retur berhasil dibuat — ${result.data?.debitNoteNumber}`)
                queryClient.invalidateQueries({ queryKey: queryKeys.purchaseOrders.all })
                queryClient.invalidateQueries({ queryKey: queryKeys.procurementDashboard.all })
                queryClient.invalidateQueries({ queryKey: queryKeys.inventoryDashboard.all })
                queryClient.invalidateQueries({ queryKey: queryKeys.dcNotes.all })
                queryClient.invalidateQueries({ queryKey: queryKeys.journal.all })
                queryClient.invalidateQueries({ queryKey: queryKeys.bills.all })
                setOpen(false)
            } else {
                toast.error("Gagal membuat retur")
            }
        } catch (error: any) {
            toast.error(error?.message || "Terjadi kesalahan")
        } finally {
            setSubmitting(false)
        }
    }

    return (
        <>
            <Button
                variant="outline"
                onClick={() => setOpen(true)}
                className="border-2 border-black font-black uppercase text-xs tracking-wider h-9 rounded-none hover:bg-red-50 hover:text-red-700 gap-2"
            >
                <RotateCcw className="h-3.5 w-3.5" />
                Retur Pembelian
            </Button>

            <NBDialog open={open} onOpenChange={setOpen} size="wide">
                <NBDialogHeader
                    icon={RotateCcw}
                    title="Retur Pembelian"
                    subtitle="Kembalikan barang ke supplier dan buat nota debit"
                />

                <NBDialogBody>
                    {loading ? (
                        <div className="flex items-center justify-center py-12">
                            <Loader2 className="h-6 w-6 animate-spin text-zinc-400" />
                            <span className="ml-2 text-sm font-bold text-zinc-400">Memuat data PO...</span>
                        </div>
                    ) : (
                        <>
                            {/* PO & Warehouse Selection */}
                            <NBSection icon={Package} title="Pilih PO & Gudang">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <NBSelect
                                        label="Purchase Order"
                                        required
                                        value={selectedPOId}
                                        onValueChange={setSelectedPOId}
                                        placeholder="Pilih PO..."
                                        emptyLabel="Pilih PO..."
                                    >
                                        {purchaseOrders.length === 0 && (
                                            <SelectItem value="__none" disabled>
                                                Tidak ada PO yang bisa diretur
                                            </SelectItem>
                                        )}
                                        {purchaseOrders.map(po => (
                                            <SelectItem key={po.id} value={po.id}>
                                                {po.number} — {po.supplierName}
                                            </SelectItem>
                                        ))}
                                    </NBSelect>
                                    <NBSelect
                                        label="Gudang Asal"
                                        required
                                        value={selectedWarehouseId}
                                        onValueChange={setSelectedWarehouseId}
                                        placeholder="Pilih gudang..."
                                        options={warehouses.map(wh => ({
                                            value: wh.id,
                                            label: wh.name,
                                        }))}
                                    />
                                </div>
                            </NBSection>

                            {/* Return Items — complex table, kept as-is */}
                            {selectedPO && returnItems.length > 0 && (
                                <NBSection icon={RotateCcw} title="Item Retur">
                                    <div className="overflow-x-auto">
                                        <table className="w-full text-sm">
                                            <thead className={NB.tableHead}>
                                                <tr>
                                                    <th className={NB.tableHeadCell}>Produk</th>
                                                    <th className={NB.tableHeadCell + " text-center"}>Diterima</th>
                                                    <th className={NB.tableHeadCell + " text-center"}>Maks Retur</th>
                                                    <th className={NB.tableHeadCell + " text-center w-[100px]"}>Qty Retur</th>
                                                    <th className={NB.tableHeadCell + " w-[180px]"}>Alasan</th>
                                                    <th className={NB.tableHeadCell + " text-right"}>Subtotal</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {returnItems.map((item, idx) => (
                                                    <tr key={item.poItemId} className={NB.tableRow}>
                                                        <td className={NB.tableCell}>
                                                            <div className="font-bold text-xs text-zinc-900">{item.productName}</div>
                                                            <div className="text-[10px] text-zinc-400 font-medium">{item.productCode}</div>
                                                        </td>
                                                        <td className={NB.tableCell + " text-center font-bold"}>{item.maxQty + (returnItems.find(r => r.poItemId === item.poItemId) ? 0 : 0)}</td>
                                                        <td className={NB.tableCell + " text-center"}>
                                                            <span className="text-xs font-black text-amber-600">{item.maxQty}</span>
                                                        </td>
                                                        <td className={NB.tableCell + " text-center"}>
                                                            <Input
                                                                type="number"
                                                                step="0.01"
                                                                min={0}
                                                                max={item.maxQty}
                                                                value={item.quantity || ""}
                                                                onChange={(e) => updateItemQty(idx, parseFloat(e.target.value) || 0)}
                                                                className="border-2 border-black font-bold h-8 w-20 text-center rounded-none mx-auto"
                                                                placeholder="0"
                                                            />
                                                        </td>
                                                        <td className={NB.tableCell}>
                                                            <Select value={item.reason} onValueChange={(val) => updateItemReason(idx, val)}>
                                                                <SelectTrigger className="border-2 border-black font-bold h-8 text-[10px] rounded-none">
                                                                    <SelectValue />
                                                                </SelectTrigger>
                                                                <SelectContent>
                                                                    {REASON_OPTIONS.map(r => (
                                                                        <SelectItem key={r.value} value={r.value} className="text-xs">
                                                                            {r.label}
                                                                        </SelectItem>
                                                                    ))}
                                                                </SelectContent>
                                                            </Select>
                                                        </td>
                                                        <td className={NB.tableCell + " text-right font-bold text-xs"}>
                                                            {item.quantity > 0 ? formatIDR(item.quantity * item.unitPrice) : "—"}
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                </NBSection>
                            )}

                            {selectedPO && returnItems.length === 0 && (
                                <div className="flex items-center gap-2 p-4 bg-amber-50 border-2 border-amber-300">
                                    <AlertTriangle className="h-4 w-4 text-amber-600" />
                                    <span className="text-xs font-bold text-amber-700">
                                        Semua item dari PO ini sudah diretur sepenuhnya
                                    </span>
                                </div>
                            )}

                            {/* Notes */}
                            <NBTextarea
                                label="Catatan"
                                value={notes}
                                onChange={setNotes}
                                placeholder="Catatan retur..."
                                rows={2}
                            />

                            {/* Summary */}
                            {activeItems.length > 0 && (
                                <div className="bg-zinc-50 border-2 border-black p-4">
                                    <div className="flex items-center justify-between">
                                        <div>
                                            <div className="text-[10px] font-black uppercase tracking-widest text-zinc-500">
                                                Total Retur ({activeItems.length} item)
                                            </div>
                                            <div className="text-lg font-black text-zinc-900 mt-1">
                                                {formatIDR(totalReturn)}
                                            </div>
                                            <div className="text-[10px] text-zinc-400 font-medium">
                                                + PPN {TAX_PERCENT.PPN}% = {formatIDR(Math.round(totalReturn * (1 + TAX_RATES.PPN)))}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </>
                    )}
                </NBDialogBody>

                <NBDialogFooter
                    onCancel={() => setOpen(false)}
                    onSubmit={handleSubmit}
                    submitting={submitting}
                    submitLabel="Proses Retur"
                    disabled={activeItems.length === 0 || !selectedPOId || !selectedWarehouseId}
                />
            </NBDialog>
        </>
    )
}
