"use client"

import { useState } from "react"
import { useQueryClient } from "@tanstack/react-query"
import { Truck, ArrowUpRight, ArrowDownLeft, Plus } from "lucide-react"
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { NB } from "@/lib/dialog-styles"
import { ScrollArea } from "@/components/ui/scroll-area"
import { toast } from "sonner"
import { recordShipment } from "@/lib/actions/subcontract"
import type { WarehouseOption } from "@/lib/actions/subcontract"
import { queryKeys } from "@/lib/query-keys"

interface Shipment {
    id: string
    direction: "OUTBOUND" | "INBOUND"
    date: string
    deliveryNoteNumber: string | null
    items: unknown
}

interface OrderItem {
    id: string
    productId: string
    productName: string
    productCode: string
    issuedQty: number
    returnedQty: number
    defectQty: number
    wastageQty: number
}

interface ShipmentTrackingProps {
    orderId: string
    orderNumber: string
    shipments: Shipment[]
    orderItems: OrderItem[]
    warehouses: WarehouseOption[]
}

interface ShipmentItem {
    productId: string
    productName: string
    quantity: number
    defectQty: number
    wastageQty: number
    maxQty: number
}

export function ShipmentTracking({
    orderId,
    orderNumber,
    shipments,
    orderItems,
    warehouses,
}: ShipmentTrackingProps) {
    const [showDialog, setShowDialog] = useState(false)
    const [direction, setDirection] = useState<"OUTBOUND" | "INBOUND">("OUTBOUND")
    const [warehouseId, setWarehouseId] = useState("")
    const [deliveryNote, setDeliveryNote] = useState("")
    const [loading, setLoading] = useState(false)
    const [items, setItems] = useState<ShipmentItem[]>([])
    const queryClient = useQueryClient()

    const openDialog = () => {
        // Pre-populate items from order items
        const shipmentItems: ShipmentItem[] = orderItems.map((oi) => {
            const remaining = oi.issuedQty - oi.returnedQty - oi.defectQty - oi.wastageQty
            return {
                productId: oi.productId,
                productName: oi.productName,
                quantity: 0,
                defectQty: 0,
                wastageQty: 0,
                maxQty: direction === "INBOUND" ? Math.max(0, remaining) : oi.issuedQty,
            }
        })
        setItems(shipmentItems)
        setShowDialog(true)
    }

    const handleRecord = async () => {
        if (!warehouseId) {
            toast.error("Pilih gudang terlebih dahulu")
            return
        }

        const activeItems = items.filter((i) => i.quantity > 0)
        if (activeItems.length === 0) {
            toast.error("Masukkan qty minimal untuk 1 item")
            return
        }

        setLoading(true)
        const result = await recordShipment({
            orderId,
            direction,
            warehouseId,
            deliveryNoteNumber: deliveryNote || undefined,
            items: activeItems.map((i) => ({
                productId: i.productId,
                quantity: i.quantity,
                defectQty: direction === "INBOUND" ? i.defectQty : undefined,
                wastageQty: direction === "INBOUND" ? i.wastageQty : undefined,
            })),
        })
        setLoading(false)

        if (result.success) {
            toast.success(
                direction === "OUTBOUND"
                    ? "Pengiriman ke CMT dicatat"
                    : "Pengembalian dari CMT dicatat"
            )
            queryClient.invalidateQueries({ queryKey: queryKeys.subcontractOrders.all })
            setShowDialog(false)
            setDeliveryNote("")
            setWarehouseId("")
            setItems([])
        } else {
            toast.error(result.error || "Gagal mencatat pengiriman")
        }
    }

    const updateItem = (idx: number, field: keyof ShipmentItem, value: number) => {
        setItems((prev) =>
            prev.map((item, i) =>
                i === idx ? { ...item, [field]: value } : item
            )
        )
    }

    return (
        <div>
            <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                    <Truck className="h-4 w-4 text-zinc-500" />
                    <span className="text-[10px] font-black uppercase tracking-widest text-zinc-500">
                        Riwayat Pengiriman
                    </span>
                </div>
                <button
                    onClick={openDialog}
                    className="flex items-center gap-1 text-[9px] font-black uppercase tracking-wider px-2.5 py-1 border-2 border-black bg-white hover:bg-zinc-100 rounded-none"
                >
                    <Plus className="h-3 w-3" />
                    Catat
                </button>
            </div>

            {shipments.length === 0 ? (
                <div className="text-center py-4">
                    <Truck className="h-6 w-6 mx-auto text-zinc-200 mb-1" />
                    <span className="text-[9px] font-bold text-zinc-400">
                        Belum ada pengiriman
                    </span>
                </div>
            ) : (
                <div className="space-y-2">
                    {shipments.map((s) => (
                        <div
                            key={s.id}
                            className={`flex items-center gap-3 px-3 py-2 border-2 ${
                                s.direction === "OUTBOUND"
                                    ? "border-blue-300 bg-blue-50"
                                    : "border-emerald-300 bg-emerald-50"
                            }`}
                        >
                            {s.direction === "OUTBOUND" ? (
                                <ArrowUpRight className="h-4 w-4 text-blue-600 shrink-0" />
                            ) : (
                                <ArrowDownLeft className="h-4 w-4 text-emerald-600 shrink-0" />
                            )}
                            <div className="flex-1 min-w-0">
                                <div className="text-[10px] font-black">
                                    {s.direction === "OUTBOUND"
                                        ? "Kirim ke CMT"
                                        : "Terima dari CMT"}
                                </div>
                                <div className="text-[9px] text-zinc-500 font-bold">
                                    {new Date(s.date).toLocaleDateString("id-ID", {
                                        day: "numeric",
                                        month: "short",
                                        year: "numeric",
                                    })}
                                    {s.deliveryNoteNumber && (
                                        <> — SJ: {s.deliveryNoteNumber}</>
                                    )}
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Record shipment dialog */}
            <Dialog open={showDialog} onOpenChange={setShowDialog}>
                <DialogContent className={NB.contentWide}>
                    <DialogHeader className={NB.header}>
                        <DialogTitle className={NB.title}>
                            <Truck className="h-5 w-5" />
                            Catat Pengiriman
                        </DialogTitle>
                        <p className={NB.subtitle}>{orderNumber}</p>
                    </DialogHeader>

                    <ScrollArea className={NB.scroll}>
                        <div className="p-6 space-y-6">
                            {/* Direction */}
                            <div>
                                <label className={NB.label}>Arah</label>
                                <div className="flex gap-2">
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setDirection("OUTBOUND")
                                            // Recalculate max quantities
                                            setItems((prev) =>
                                                prev.map((item) => ({
                                                    ...item,
                                                    maxQty: orderItems.find(
                                                        (oi) => oi.productId === item.productId
                                                    )?.issuedQty || 0,
                                                }))
                                            )
                                        }}
                                        className={`flex-1 flex items-center justify-center gap-2 px-3 py-2 border-2 border-black text-xs font-black uppercase tracking-wider ${
                                            direction === "OUTBOUND"
                                                ? "bg-blue-500 text-white"
                                                : "bg-white"
                                        }`}
                                    >
                                        <ArrowUpRight className="h-3.5 w-3.5" />
                                        Kirim
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setDirection("INBOUND")
                                            setItems((prev) =>
                                                prev.map((item) => {
                                                    const oi = orderItems.find(
                                                        (o) => o.productId === item.productId
                                                    )
                                                    const remaining = oi
                                                        ? oi.issuedQty -
                                                          oi.returnedQty -
                                                          oi.defectQty -
                                                          oi.wastageQty
                                                        : 0
                                                    return {
                                                        ...item,
                                                        maxQty: Math.max(0, remaining),
                                                    }
                                                })
                                            )
                                        }}
                                        className={`flex-1 flex items-center justify-center gap-2 px-3 py-2 border-2 border-black text-xs font-black uppercase tracking-wider ${
                                            direction === "INBOUND"
                                                ? "bg-emerald-500 text-white"
                                                : "bg-white"
                                        }`}
                                    >
                                        <ArrowDownLeft className="h-3.5 w-3.5" />
                                        Terima
                                    </button>
                                </div>
                            </div>

                            {/* Warehouse */}
                            <div>
                                <label className={NB.label}>
                                    Gudang <span className={NB.labelRequired}>*</span>
                                </label>
                                <select
                                    className={NB.select}
                                    value={warehouseId}
                                    onChange={(e) => setWarehouseId(e.target.value)}
                                >
                                    <option value="">Pilih gudang...</option>
                                    {warehouses.map((w) => (
                                        <option key={w.id} value={w.id}>
                                            [{w.code}] {w.name}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            {/* Delivery note */}
                            <div>
                                <label className={NB.label}>No. Surat Jalan</label>
                                <Input
                                    className={NB.input}
                                    value={deliveryNote}
                                    onChange={(e) => setDeliveryNote(e.target.value)}
                                    placeholder="SJ-001"
                                />
                            </div>

                            {/* Item quantities */}
                            <div className={NB.section}>
                                <div className={NB.sectionHead}>
                                    <span className={NB.sectionTitle}>Item</span>
                                </div>
                                <div className={NB.sectionBody}>
                                    <div className={NB.tableWrap}>
                                        <table className="w-full">
                                            <thead className={NB.tableHead}>
                                                <tr>
                                                    <th className={`${NB.tableHeadCell} text-left`}>
                                                        Produk
                                                    </th>
                                                    <th className={`${NB.tableHeadCell} text-right w-20`}>
                                                        Maks
                                                    </th>
                                                    <th className={`${NB.tableHeadCell} text-right w-24`}>
                                                        Qty
                                                    </th>
                                                    {direction === "INBOUND" && (
                                                        <>
                                                            <th className={`${NB.tableHeadCell} text-right w-20`}>
                                                                Cacat
                                                            </th>
                                                            <th className={`${NB.tableHeadCell} text-right w-20`}>
                                                                Sisa
                                                            </th>
                                                        </>
                                                    )}
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {items.map((item, idx) => (
                                                    <tr key={item.productId} className={NB.tableRow}>
                                                        <td className={NB.tableCell}>
                                                            <div className="text-xs font-bold">
                                                                {item.productName}
                                                            </div>
                                                        </td>
                                                        <td className={`${NB.tableCell} text-right font-mono text-zinc-400`}>
                                                            {item.maxQty.toLocaleString()}
                                                        </td>
                                                        <td className={`${NB.tableCell} text-right`}>
                                                            <Input
                                                                type="number"
                                                                min={0}
                                                                max={item.maxQty}
                                                                className="border-2 border-black rounded-none h-7 w-20 text-right font-mono text-xs ml-auto"
                                                                value={item.quantity || ""}
                                                                onChange={(e) =>
                                                                    updateItem(
                                                                        idx,
                                                                        "quantity",
                                                                        parseInt(e.target.value) || 0
                                                                    )
                                                                }
                                                            />
                                                        </td>
                                                        {direction === "INBOUND" && (
                                                            <>
                                                                <td className={`${NB.tableCell} text-right`}>
                                                                    <Input
                                                                        type="number"
                                                                        min={0}
                                                                        className="border-2 border-black rounded-none h-7 w-20 text-right font-mono text-xs ml-auto"
                                                                        value={item.defectQty || ""}
                                                                        onChange={(e) =>
                                                                            updateItem(
                                                                                idx,
                                                                                "defectQty",
                                                                                parseInt(e.target.value) || 0
                                                                            )
                                                                        }
                                                                    />
                                                                </td>
                                                                <td className={`${NB.tableCell} text-right`}>
                                                                    <Input
                                                                        type="number"
                                                                        min={0}
                                                                        className="border-2 border-black rounded-none h-7 w-20 text-right font-mono text-xs ml-auto"
                                                                        value={item.wastageQty || ""}
                                                                        onChange={(e) =>
                                                                            updateItem(
                                                                                idx,
                                                                                "wastageQty",
                                                                                parseInt(e.target.value) || 0
                                                                            )
                                                                        }
                                                                    />
                                                                </td>
                                                            </>
                                                        )}
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            </div>

                            {/* Footer */}
                            <div className={NB.footer}>
                                <button
                                    type="button"
                                    onClick={() => setShowDialog(false)}
                                    className={NB.cancelBtn}
                                >
                                    Batal
                                </button>
                                <button
                                    type="button"
                                    onClick={handleRecord}
                                    disabled={loading}
                                    className={NB.submitBtn}
                                >
                                    {loading ? "Menyimpan..." : "Simpan"}
                                </button>
                            </div>
                        </div>
                    </ScrollArea>
                </DialogContent>
            </Dialog>
        </div>
    )
}
