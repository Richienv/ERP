"use client"

import { useState } from "react"
import { Package, Plus, Minus, Warehouse, ClipboardList } from "lucide-react"
import { useQueryClient } from "@tanstack/react-query"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { toast } from "sonner"
import { createGRN } from "@/lib/actions/grn"
import { useAuth } from "@/lib/auth-context"
import { NB } from "@/lib/dialog-styles"
import { queryKeys } from "@/lib/query-keys"
import {
    NBDialog,
    NBDialogHeader,
    NBDialogBody,
    NBDialogFooter,
    NBSection,
    NBInput,
    NBSelect,
    NBTextarea,
} from "@/components/ui/nb-dialog"

interface POItem {
    id: string
    productId: string
    productName: string
    productCode: string
    unit: string
    orderedQty: number
    receivedQty: number
    remainingQty: number
    unitPrice: number
}

interface PurchaseOrder {
    id: string
    number: string
    vendorName: string
    items: POItem[]
}

interface Warehouse {
    id: string
    name: string
    code: string
}

interface Employee {
    id: string
    name: string
    department: string
}

interface Props {
    purchaseOrder: PurchaseOrder
    warehouses: Warehouse[]
    employees: Employee[]
}

interface ReceivingItem {
    poItemId: string
    productId: string
    productName: string
    productCode: string
    unit: string
    orderedQty: number
    remainingQty: number
    receivingQty: number
    acceptedQty: number
    rejectedQty: number
    unitPrice: number
    notes: string
}

export function CreateGRNDialog({ purchaseOrder, warehouses, employees: _employees }: Props) {
    const { user } = useAuth()
    const [open, setOpen] = useState(false)
    const [loading, setLoading] = useState(false)
    const [warehouseId, setWarehouseId] = useState("")
    const [notes, setNotes] = useState("")
    const queryClient = useQueryClient()

    const [items, setItems] = useState<ReceivingItem[]>(
        purchaseOrder.items
            .filter(i => i.remainingQty > 0)
            .map(item => ({
                poItemId: item.id,
                productId: item.productId,
                productName: item.productName,
                productCode: item.productCode,
                unit: item.unit,
                orderedQty: item.orderedQty,
                remainingQty: item.remainingQty,
                receivingQty: item.remainingQty,
                acceptedQty: item.remainingQty,
                rejectedQty: 0,
                unitPrice: item.unitPrice,
                notes: ""
            }))
    )

    const updateItem = (index: number, field: keyof ReceivingItem, value: number | string) => {
        setItems(prev => {
            const updated = [...prev]
            updated[index] = { ...updated[index], [field]: value }

            if (field === 'receivingQty') {
                const receivingQty = value as number
                updated[index].acceptedQty = receivingQty
                updated[index].rejectedQty = 0
            }
            if (field === 'acceptedQty') {
                const acceptedQty = value as number
                updated[index].rejectedQty = updated[index].receivingQty - acceptedQty
            }

            return updated
        })
    }

    const handleSubmit = async () => {
        if (!warehouseId) {
            toast.error("Pilih gudang tujuan")
            return
        }

        const validItems = items.filter(i => i.receivingQty > 0)
        if (validItems.length === 0) {
            toast.error("Minimal satu item harus diterima")
            return
        }

        setLoading(true)
        try {
            const result = await createGRN({
                purchaseOrderId: purchaseOrder.id,
                warehouseId,
                notes,
                items: validItems.map(item => ({
                    poItemId: item.poItemId,
                    productId: item.productId,
                    quantityOrdered: item.orderedQty,
                    quantityReceived: item.receivingQty,
                    quantityAccepted: item.acceptedQty,
                    quantityRejected: item.rejectedQty,
                    unitCost: item.unitPrice,
                    inspectionNotes: item.notes || undefined
                }))
            })

            if (result.success) {
                toast.success(`Surat Jalan Masuk ${result.grnNumber} berhasil dibuat`)
                setOpen(false)
                queryClient.invalidateQueries({ queryKey: queryKeys.receiving.all })
                queryClient.invalidateQueries({ queryKey: queryKeys.purchaseOrders.all })
                queryClient.invalidateQueries({ queryKey: queryKeys.procurementDashboard.all })
                // GRN changes inventory — invalidate all inventory-related caches
                queryClient.invalidateQueries({ queryKey: queryKeys.inventoryDashboard.all })
                queryClient.invalidateQueries({ queryKey: queryKeys.products.all })
                queryClient.invalidateQueries({ queryKey: queryKeys.stockMovements.all })
                queryClient.invalidateQueries({ queryKey: queryKeys.warehouses.all })
            } else {
                toast.error(result.error || "Gagal membuat Surat Jalan Masuk")
            }
        } catch (error) {
            toast.error("Terjadi kesalahan")
        } finally {
            setLoading(false)
        }
    }

    return (
        <>
            <Button className={NB.triggerBtn + " text-xs px-3 py-1 h-8"} onClick={() => setOpen(true)}>
                <Package className="h-3.5 w-3.5 mr-1" /> Terima
            </Button>
            <NBDialog open={open} onOpenChange={setOpen} size="wide">
                <NBDialogHeader
                    icon={Package}
                    title={`Surat Jalan Masuk — ${purchaseOrder.number}`}
                    subtitle={`Vendor: ${purchaseOrder.vendorName}`}
                />

                <NBDialogBody>
                    {/* Receiving Info */}
                    <NBSection icon={Warehouse} title="Info Penerimaan">
                        <div className="grid grid-cols-2 gap-4">
                            <NBInput
                                label="Penerima"
                                value={user?.name || user?.email || "Current User"}
                                onChange={() => {}}
                                disabled
                            />
                            <NBSelect
                                label="Gudang Tujuan"
                                required
                                value={warehouseId}
                                onValueChange={setWarehouseId}
                                placeholder="Pilih gudang..."
                                options={warehouses.map(wh => ({
                                    value: wh.id,
                                    label: `${wh.name} (${wh.code})`,
                                }))}
                            />
                        </div>
                    </NBSection>

                    {/* Items Table — complex, kept as-is */}
                    <NBSection icon={ClipboardList} title="Item Penerimaan">
                        <div className={NB.tableWrap}>
                            <table className="w-full text-sm">
                                <thead className={NB.tableHead}>
                                    <tr>
                                        <th className={NB.tableHeadCell + " text-left"}>Produk</th>
                                        <th className={NB.tableHeadCell + " text-center w-20"}>Sisa</th>
                                        <th className={NB.tableHeadCell + " text-center w-28"}>Diterima</th>
                                        <th className={NB.tableHeadCell + " text-center w-28"}>Acc/Reject</th>
                                        <th className={NB.tableHeadCell + " text-left w-40"}>Catatan</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {items.map((item, index) => (
                                        <tr key={item.poItemId} className={NB.tableRow}>
                                            <td className={NB.tableCell}>
                                                <div className="font-bold">{item.productName}</div>
                                                <div className="text-[10px] text-zinc-400 font-mono">
                                                    {item.productCode} &bull; {item.unit}
                                                </div>
                                            </td>
                                            <td className={NB.tableCell + " text-center"}>
                                                <span className="font-mono font-black">{item.remainingQty}</span>
                                            </td>
                                            <td className={NB.tableCell}>
                                                <div className="flex items-center justify-center gap-1">
                                                    <Button
                                                        type="button"
                                                        variant="outline"
                                                        size="icon"
                                                        className="h-7 w-7 border-2 border-black"
                                                        onClick={() => updateItem(index, 'receivingQty', Math.max(0, item.receivingQty - 1))}
                                                    >
                                                        <Minus className="h-3 w-3" />
                                                    </Button>
                                                    <Input
                                                        type="number"
                                                        min={0}
                                                        max={item.remainingQty}
                                                        value={item.receivingQty}
                                                        onChange={(e) => updateItem(index, 'receivingQty', Math.min(item.remainingQty, parseInt(e.target.value) || 0))}
                                                        className="w-16 text-center font-mono font-bold h-8 border-2 border-black"
                                                    />
                                                    <Button
                                                        type="button"
                                                        variant="outline"
                                                        size="icon"
                                                        className="h-7 w-7 border-2 border-black"
                                                        onClick={() => updateItem(index, 'receivingQty', Math.min(item.remainingQty, item.receivingQty + 1))}
                                                    >
                                                        <Plus className="h-3 w-3" />
                                                    </Button>
                                                </div>
                                            </td>
                                            <td className={NB.tableCell}>
                                                <div className="flex items-center justify-center gap-2">
                                                    <div className="text-center">
                                                        <Input
                                                            type="number"
                                                            min={0}
                                                            max={item.receivingQty}
                                                            value={item.acceptedQty}
                                                            onChange={(e) => updateItem(index, 'acceptedQty', Math.min(item.receivingQty, parseInt(e.target.value) || 0))}
                                                            className="w-14 text-center font-mono h-7 text-xs border-2 border-emerald-400"
                                                        />
                                                        <div className="text-[9px] text-emerald-600 font-black uppercase">Acc</div>
                                                    </div>
                                                    <div className="text-center">
                                                        <div className="w-14 h-7 flex items-center justify-center bg-red-50 border-2 border-red-300 font-mono text-xs text-red-600 font-bold">
                                                            {item.rejectedQty}
                                                        </div>
                                                        <div className="text-[9px] text-red-600 font-black uppercase">Rej</div>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className={NB.tableCell}>
                                                <Input
                                                    placeholder="Catatan..."
                                                    value={item.notes}
                                                    onChange={(e) => updateItem(index, 'notes', e.target.value)}
                                                    className="h-8 text-xs border-2 border-black"
                                                />
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </NBSection>

                    {/* Notes */}
                    <NBTextarea
                        label="Catatan Umum"
                        value={notes}
                        onChange={setNotes}
                        placeholder="Catatan penerimaan..."
                        rows={2}
                    />
                </NBDialogBody>

                <NBDialogFooter
                    onCancel={() => setOpen(false)}
                    onSubmit={handleSubmit}
                    submitting={loading}
                    submitLabel="Buat Surat Jalan"
                />
            </NBDialog>
        </>
    )
}
