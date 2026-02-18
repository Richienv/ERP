"use client"

import { useState } from "react"
import { Package, Plus, Minus, Loader2, Warehouse, ClipboardList } from "lucide-react"
import { useQueryClient } from "@tanstack/react-query"
import { Button } from "@/components/ui/button"
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { ScrollArea } from "@/components/ui/scroll-area"
import { toast } from "sonner"
import { createGRN } from "@/lib/actions/grn"
import { useAuth } from "@/lib/auth-context"
import { NB } from "@/lib/dialog-styles"
import { queryKeys } from "@/lib/query-keys"

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
                toast.success(`GRN ${result.grnNumber} berhasil dibuat`)
                setOpen(false)
                queryClient.invalidateQueries({ queryKey: queryKeys.receiving.all })
                queryClient.invalidateQueries({ queryKey: queryKeys.purchaseOrders.all })
                queryClient.invalidateQueries({ queryKey: queryKeys.procurementDashboard.all })
            } else {
                toast.error(result.error || "Gagal membuat GRN")
            }
        } catch (error) {
            toast.error("Terjadi kesalahan")
        } finally {
            setLoading(false)
        }
    }

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button className={NB.triggerBtn + " text-xs px-3 py-1 h-8"}>
                    <Package className="h-3.5 w-3.5 mr-1" /> Terima
                </Button>
            </DialogTrigger>
            <DialogContent className={NB.contentWide}>
                <DialogHeader className={NB.header}>
                    <DialogTitle className={NB.title}>
                        <Package className="h-5 w-5" /> Penerimaan Barang — {purchaseOrder.number}
                    </DialogTitle>
                    <p className={NB.subtitle}>Vendor: {purchaseOrder.vendorName}</p>
                </DialogHeader>

                <ScrollArea className={NB.scroll}>
                    <div className="p-5 space-y-4">
                        {/* Receiving Info */}
                        <div className={NB.section}>
                            <div className={`${NB.sectionHead} border-l-4 border-l-violet-400 bg-violet-50`}>
                                <Warehouse className="h-4 w-4" />
                                <span className={NB.sectionTitle}>Info Penerimaan</span>
                            </div>
                            <div className={NB.sectionBody}>
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className={NB.label}>Penerima</label>
                                        <Input
                                            value={user?.name || user?.email || "Current User"}
                                            disabled
                                            className={`${NB.input} bg-zinc-100 text-zinc-500`}
                                        />
                                        <p className="text-[9px] text-zinc-400 font-bold mt-0.5">Otomatis dari user yang login</p>
                                    </div>
                                    <div>
                                        <label className={NB.label}>Gudang Tujuan <span className={NB.labelRequired}>*</span></label>
                                        <Select value={warehouseId} onValueChange={setWarehouseId}>
                                            <SelectTrigger className={NB.select}>
                                                <SelectValue placeholder="Pilih gudang..." />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {warehouses.map(wh => (
                                                    <SelectItem key={wh.id} value={wh.id}>
                                                        {wh.name} ({wh.code})
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Items Table */}
                        <div className={NB.section}>
                            <div className={`${NB.sectionHead} border-l-4 border-l-violet-400 bg-violet-50`}>
                                <ClipboardList className="h-4 w-4" />
                                <span className={NB.sectionTitle}>Item Penerimaan</span>
                            </div>
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
                        </div>

                        {/* Notes */}
                        <div className={NB.section}>
                            <div className={`${NB.sectionHead} border-l-4 border-l-violet-400 bg-violet-50`}>
                                <span className={NB.sectionTitle}>Catatan Umum</span>
                            </div>
                            <div className={NB.sectionBody}>
                                <Textarea
                                    placeholder="Catatan penerimaan..."
                                    value={notes}
                                    onChange={(e) => setNotes(e.target.value)}
                                    rows={2}
                                    className={NB.textarea}
                                />
                            </div>
                        </div>

                        {/* Footer */}
                        <div className={NB.footer}>
                            <Button variant="outline" onClick={() => setOpen(false)} disabled={loading} className={NB.cancelBtn}>
                                Batal
                            </Button>
                            <Button
                                onClick={handleSubmit}
                                disabled={loading}
                                className={NB.submitBtn}
                            >
                                {loading ? (
                                    <><Loader2 className="h-4 w-4 animate-spin mr-2" /> Memproses...</>
                                ) : (
                                    <><Package className="h-4 w-4 mr-2" /> Buat GRN</>
                                )}
                            </Button>
                        </div>
                    </div>
                </ScrollArea>
            </DialogContent>
        </Dialog>
    )
}
