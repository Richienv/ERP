"use client"

import { useState } from "react"
import { Package, Plus, Minus, Warehouse, ClipboardList } from "lucide-react"
import { useQueryClient } from "@tanstack/react-query"
import { Button } from "@/components/ui/button"
import { toast } from "sonner"
import { createGRN } from "@/lib/actions/grn"
import { useAuth } from "@/lib/auth-context"
import { NB } from "@/lib/dialog-styles"
import { queryKeys } from "@/lib/query-keys"
import {
    NBDialog,
    NBDialogHeader,
    NBDialogBody,
    NBSection,
    NBInput,
    NBSelect,
    NBTextarea,
} from "@/components/ui/nb-dialog"
import { Loader2 } from "lucide-react"

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

// ── NB Stepper Button ──
const STEPPER_BTN =
    "w-8 h-8 border-2 border-black flex items-center justify-center font-bold text-sm " +
    "shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] " +
    "hover:shadow-none hover:translate-x-[2px] hover:translate-y-[2px] " +
    "active:translate-x-[2px] active:translate-y-[2px] active:shadow-none " +
    "transition-all bg-white"

// ── Emerald quantity input (active when value > 0) ──
const QTY_INPUT_ACTIVE =
    "w-16 text-center font-mono font-bold h-8 border-2 rounded-none outline-none transition-colors " +
    "border-emerald-400 bg-emerald-50/50 text-emerald-700 " +
    "focus:ring-2 focus:ring-emerald-400/50 focus:border-emerald-500"
const QTY_INPUT_EMPTY =
    "w-16 text-center font-mono font-bold h-8 border-2 rounded-none outline-none transition-colors " +
    "border-zinc-300 bg-white text-zinc-900"

// ── ACC (emerald) / REJ (red) inputs ──
const ACC_INPUT =
    "w-14 text-center font-mono h-7 text-xs font-bold border-2 rounded-none outline-none transition-colors " +
    "border-emerald-500 bg-emerald-50/50 text-emerald-700 " +
    "focus:ring-2 focus:ring-emerald-400/50"
const REJ_DISPLAY =
    "w-14 h-7 flex items-center justify-center bg-red-50 border-2 border-red-400 " +
    "font-mono text-xs text-red-600 font-bold rounded-none"

// ── Item notes input (orange glow when has value) ──
const NOTES_INPUT_ACTIVE =
    "h-8 text-xs border-2 rounded-none outline-none transition-colors font-medium " +
    "border-orange-400 bg-orange-50/50 placeholder:text-zinc-400"
const NOTES_INPUT_EMPTY =
    "h-8 text-xs border-2 rounded-none outline-none transition-colors font-medium " +
    "border-zinc-300 bg-white placeholder:text-zinc-400"

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
                    {/* ── Section 1: Info Penerimaan ── */}
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

                    {/* ── Section 2: Item Penerimaan ── */}
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
                                            {/* Product info */}
                                            <td className={NB.tableCell}>
                                                <div className="font-bold">{item.productName}</div>
                                                <div className="text-[10px] text-zinc-400 font-mono">
                                                    {item.productCode} &bull; {item.unit}
                                                </div>
                                            </td>

                                            {/* Sisa (remaining) */}
                                            <td className={NB.tableCell + " text-center"}>
                                                <span className="font-mono font-black">{item.remainingQty}</span>
                                            </td>

                                            {/* Diterima — NB stepper with emerald glow */}
                                            <td className={NB.tableCell}>
                                                <div className="flex items-center justify-center gap-1">
                                                    <button
                                                        type="button"
                                                        className={STEPPER_BTN}
                                                        onClick={() => updateItem(index, 'receivingQty', Math.max(0, item.receivingQty - 1))}
                                                    >
                                                        <Minus className="h-3 w-3" />
                                                    </button>
                                                    <input
                                                        type="number"
                                                        step="0.01"
                                                        min={0}
                                                        max={item.remainingQty}
                                                        value={item.receivingQty}
                                                        onChange={(e) => updateItem(index, 'receivingQty', Math.min(item.remainingQty, parseFloat(e.target.value) || 0))}
                                                        className={item.receivingQty > 0 ? QTY_INPUT_ACTIVE : QTY_INPUT_EMPTY}
                                                    />
                                                    <button
                                                        type="button"
                                                        className={STEPPER_BTN}
                                                        onClick={() => updateItem(index, 'receivingQty', Math.min(item.remainingQty, item.receivingQty + 1))}
                                                    >
                                                        <Plus className="h-3 w-3" />
                                                    </button>
                                                </div>
                                            </td>

                                            {/* ACC / REJ — emerald & red */}
                                            <td className={NB.tableCell}>
                                                <div className="flex items-center justify-center gap-2">
                                                    <div className="text-center">
                                                        <input
                                                            type="number"
                                                            step="0.01"
                                                            min={0}
                                                            max={item.receivingQty}
                                                            value={item.acceptedQty}
                                                            onChange={(e) => updateItem(index, 'acceptedQty', Math.min(item.receivingQty, parseFloat(e.target.value) || 0))}
                                                            className={ACC_INPUT}
                                                        />
                                                        <div className="text-[9px] text-emerald-600 font-black uppercase mt-0.5">Acc</div>
                                                    </div>
                                                    <div className="text-center">
                                                        <div className={REJ_DISPLAY}>
                                                            {item.rejectedQty}
                                                        </div>
                                                        <div className="text-[9px] text-red-600 font-black uppercase mt-0.5">Rej</div>
                                                    </div>
                                                </div>
                                            </td>

                                            {/* Item notes — orange glow when has value */}
                                            <td className={NB.tableCell}>
                                                <input
                                                    placeholder="Catatan..."
                                                    value={item.notes}
                                                    onChange={(e) => updateItem(index, 'notes', e.target.value)}
                                                    className={`w-full px-2 ${item.notes ? NOTES_INPUT_ACTIVE : NOTES_INPUT_EMPTY}`}
                                                />
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </NBSection>

                    {/* ── Section 3: Catatan Umum ── */}
                    <NBTextarea
                        label="Catatan Umum"
                        value={notes}
                        onChange={setNotes}
                        placeholder="Catatan penerimaan..."
                        rows={2}
                    />
                </NBDialogBody>

                {/* ── NB Footer with shadow/press animation buttons ── */}
                <div className="border-t-2 border-black bg-zinc-50 dark:bg-zinc-800/50 px-5 py-3 flex items-center justify-end gap-3">
                    <button
                        type="button"
                        onClick={() => setOpen(false)}
                        disabled={loading}
                        className={NB.cancelBtn}
                    >
                        Batal
                    </button>
                    <button
                        type="button"
                        onClick={handleSubmit}
                        disabled={loading || !warehouseId}
                        className={NB.submitBtn + " disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5"}
                    >
                        {loading ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                            <Package className="h-3.5 w-3.5" />
                        )}
                        {loading ? "Memproses..." : "Buat Surat Jalan"}
                    </button>
                </div>
            </NBDialog>
        </>
    )
}
