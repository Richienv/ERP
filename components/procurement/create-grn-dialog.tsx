"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Package, Plus, Minus, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
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
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { toast } from "sonner"
import { createGRN } from "@/lib/actions/grn"

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

export function CreateGRNDialog({ purchaseOrder, warehouses, employees }: Props) {
    const [open, setOpen] = useState(false)
    const [loading, setLoading] = useState(false)
    const [warehouseId, setWarehouseId] = useState("")
    const [receivedById, setReceivedById] = useState("")
    const [notes, setNotes] = useState("")
    const router = useRouter()

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
            
            // Auto-calculate accepted/rejected based on receiving qty
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
        if (!receivedById) {
            toast.error("Pilih penerima barang")
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
                receivedById,
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
                router.refresh()
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
                <Button 
                    size="sm" 
                    className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]"
                >
                    <Package className="h-3.5 w-3.5 mr-1" /> Terima
                </Button>
            </DialogTrigger>
            <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle className="font-black uppercase flex items-center gap-2">
                        <Package className="h-5 w-5 text-emerald-600" />
                        Penerimaan Barang - {purchaseOrder.number}
                    </DialogTitle>
                    <DialogDescription>
                        Vendor: <span className="font-bold text-black">{purchaseOrder.vendorName}</span>
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-6 py-4">
                    {/* Receiving Info */}
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label className="font-bold uppercase text-xs">Gudang Tujuan *</Label>
                            <Select value={warehouseId} onValueChange={setWarehouseId}>
                                <SelectTrigger>
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

                        <div className="space-y-2">
                            <Label className="font-bold uppercase text-xs">Penerima *</Label>
                            <Select value={receivedById} onValueChange={setReceivedById}>
                                <SelectTrigger>
                                    <SelectValue placeholder="Pilih penerima..." />
                                </SelectTrigger>
                                <SelectContent>
                                    {employees.map(emp => (
                                        <SelectItem key={emp.id} value={emp.id}>
                                            {emp.name} ({emp.department})
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    </div>

                    {/* Items Table */}
                    <div className="border border-black rounded-lg overflow-hidden">
                        <table className="w-full text-sm">
                            <thead className="bg-zinc-100 border-b border-black">
                                <tr>
                                    <th className="p-3 text-left font-black uppercase text-xs">Produk</th>
                                    <th className="p-3 text-center font-black uppercase text-xs w-20">Sisa</th>
                                    <th className="p-3 text-center font-black uppercase text-xs w-28">Diterima</th>
                                    <th className="p-3 text-center font-black uppercase text-xs w-28">Acc/Reject</th>
                                    <th className="p-3 text-left font-black uppercase text-xs w-40">Catatan</th>
                                </tr>
                            </thead>
                            <tbody>
                                {items.map((item, index) => (
                                    <tr key={item.poItemId} className="border-b border-zinc-200 last:border-0">
                                        <td className="p-3">
                                            <div className="font-bold">{item.productName}</div>
                                            <div className="text-xs text-muted-foreground">
                                                {item.productCode} • {item.unit}
                                            </div>
                                        </td>
                                        <td className="p-3 text-center">
                                            <span className="font-mono font-bold">{item.remainingQty}</span>
                                        </td>
                                        <td className="p-3">
                                            <div className="flex items-center justify-center gap-1">
                                                <Button
                                                    type="button"
                                                    variant="outline"
                                                    size="icon"
                                                    className="h-7 w-7"
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
                                                    className="w-16 text-center font-mono h-8"
                                                />
                                                <Button
                                                    type="button"
                                                    variant="outline"
                                                    size="icon"
                                                    className="h-7 w-7"
                                                    onClick={() => updateItem(index, 'receivingQty', Math.min(item.remainingQty, item.receivingQty + 1))}
                                                >
                                                    <Plus className="h-3 w-3" />
                                                </Button>
                                            </div>
                                        </td>
                                        <td className="p-3">
                                            <div className="flex items-center justify-center gap-2">
                                                <div className="text-center">
                                                    <Input
                                                        type="number"
                                                        min={0}
                                                        max={item.receivingQty}
                                                        value={item.acceptedQty}
                                                        onChange={(e) => updateItem(index, 'acceptedQty', Math.min(item.receivingQty, parseInt(e.target.value) || 0))}
                                                        className="w-14 text-center font-mono h-7 text-xs border-emerald-300"
                                                    />
                                                    <div className="text-[9px] text-emerald-600 font-bold">ACC</div>
                                                </div>
                                                <div className="text-center">
                                                    <div className="w-14 h-7 flex items-center justify-center bg-red-50 rounded border border-red-200 font-mono text-xs text-red-600">
                                                        {item.rejectedQty}
                                                    </div>
                                                    <div className="text-[9px] text-red-600 font-bold">REJ</div>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="p-3">
                                            <Input
                                                placeholder="Catatan..."
                                                value={item.notes}
                                                onChange={(e) => updateItem(index, 'notes', e.target.value)}
                                                className="h-8 text-xs"
                                            />
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>

                    {/* Notes */}
                    <div className="space-y-2">
                        <Label className="font-bold uppercase text-xs">Catatan Umum</Label>
                        <Textarea
                            placeholder="Catatan penerimaan..."
                            value={notes}
                            onChange={(e) => setNotes(e.target.value)}
                            rows={2}
                        />
                    </div>
                </div>

                <DialogFooter>
                    <Button variant="outline" onClick={() => setOpen(false)} disabled={loading}>
                        Batal
                    </Button>
                    <Button 
                        onClick={handleSubmit} 
                        disabled={loading}
                        className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold"
                    >
                        {loading ? (
                            <Loader2 className="h-4 w-4 animate-spin mr-2" />
                        ) : (
                            <Package className="h-4 w-4 mr-2" />
                        )}
                        Buat GRN
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}
