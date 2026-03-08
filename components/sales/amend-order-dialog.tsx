"use client"

import { useState } from "react"
import { useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { Edit3, Loader2, Plus, Trash2 } from "lucide-react"
import { queryKeys } from "@/lib/query-keys"
import { amendSalesOrder } from "@/lib/actions/order-amendments"
import { NB } from "@/lib/dialog-styles"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog"

interface OrderItem {
    id: string
    productId: string
    product: {
        name: string
        code: string
        unit?: string
    }
    quantity: number
    unitPrice: number
    discount?: number
    taxRate?: number
    lineTotal: number
    description?: string
}

interface AmendOrderDialogProps {
    orderId: string
    orderNumber: string
    currentItems: OrderItem[]
    status: string
}

interface EditableItem {
    productId: string
    productName: string
    productCode: string
    quantity: number
    unitPrice: number
    discount: number
    taxRate: number
    description: string
}

const formatIDR = (value: number) =>
    new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(value)

export function AmendOrderDialog({ orderId, orderNumber, currentItems, status }: AmendOrderDialogProps) {
    const [open, setOpen] = useState(false)
    const [reason, setReason] = useState("")
    const [items, setItems] = useState<EditableItem[]>([])
    const [submitting, setSubmitting] = useState(false)
    const queryClient = useQueryClient()

    const canAmend = ["DRAFT", "CONFIRMED"].includes(status)
    if (!canAmend) return null

    const handleOpen = (isOpen: boolean) => {
        if (isOpen) {
            // Initialize items from current order
            setItems(
                currentItems.map((item) => ({
                    productId: item.productId,
                    productName: item.product.name,
                    productCode: item.product.code,
                    quantity: item.quantity,
                    unitPrice: item.unitPrice,
                    discount: Number(item.discount || 0),
                    taxRate: Number(item.taxRate || 11),
                    description: item.description || item.product.name,
                }))
            )
            setReason("")
        }
        setOpen(isOpen)
    }

    const updateItem = (idx: number, field: keyof EditableItem, value: number | string) => {
        setItems((prev) =>
            prev.map((item, i) => (i === idx ? { ...item, [field]: value } : item))
        )
    }

    const removeItem = (idx: number) => {
        if (items.length <= 1) {
            toast.error("Minimal satu item wajib ada")
            return
        }
        setItems((prev) => prev.filter((_, i) => i !== idx))
    }

    const calcLineTotal = (item: EditableItem) => {
        const sub = item.quantity * item.unitPrice
        const discAmt = sub * (item.discount / 100)
        const afterDisc = sub - discAmt
        const tax = afterDisc * (item.taxRate / 100)
        return afterDisc + tax
    }

    const grandTotal = items.reduce((s, item) => s + calcLineTotal(item), 0)

    const handleSubmit = async () => {
        if (!reason.trim()) {
            toast.error("Alasan revisi wajib diisi")
            return
        }
        if (items.length === 0) {
            toast.error("Minimal satu item wajib ada")
            return
        }

        setSubmitting(true)
        try {
            const result = await amendSalesOrder({
                salesOrderId: orderId,
                reason: reason.trim(),
                items: items.map((item) => ({
                    productId: item.productId,
                    quantity: item.quantity,
                    unitPrice: item.unitPrice,
                    discount: item.discount,
                    taxRate: item.taxRate,
                    description: item.description,
                })),
            })

            if (result.success) {
                toast.success(`Order berhasil diamandemen ke Rev.${result.newRevision}`)
                queryClient.invalidateQueries({ queryKey: queryKeys.salesOrders.all })
                setOpen(false)
            } else {
                toast.error(result.error || "Gagal mengamandemen order")
            }
        } catch (err: any) {
            toast.error(err?.message || "Terjadi kesalahan")
        } finally {
            setSubmitting(false)
        }
    }

    return (
        <Dialog open={open} onOpenChange={handleOpen}>
            <DialogTrigger asChild>
                <Button
                    variant="outline"
                    className="border-2 border-black rounded-none shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:translate-y-[1px] hover:shadow-none font-black uppercase text-[10px] tracking-wider h-9 px-4 hover:bg-amber-50"
                >
                    <Edit3 className="h-3.5 w-3.5 mr-1.5" />
                    Amandemen
                </Button>
            </DialogTrigger>
            <DialogContent className={NB.contentWide}>
                <DialogHeader className={NB.header}>
                    <DialogTitle className={NB.title}>
                        <Edit3 className="h-5 w-5" />
                        Amandemen {orderNumber}
                    </DialogTitle>
                    <DialogDescription className={NB.subtitle}>
                        Ubah item atau nilai order. Revisi sebelumnya akan tersimpan dalam riwayat.
                    </DialogDescription>
                </DialogHeader>

                <div className="p-6 space-y-5 max-h-[70vh] overflow-y-auto">
                    {/* Reason */}
                    <div>
                        <label className={NB.label}>
                            Alasan Revisi <span className={NB.labelRequired}>*</span>
                        </label>
                        <Textarea
                            value={reason}
                            onChange={(e) => setReason(e.target.value)}
                            placeholder="Perubahan harga, qty, atau kesepakatan baru..."
                            className={NB.textarea}
                        />
                    </div>

                    {/* Items table */}
                    <div>
                        <label className={NB.label}>Item Order</label>
                        <div className={NB.tableWrap}>
                            <table className="w-full text-xs">
                                <thead>
                                    <tr className={NB.tableHead}>
                                        <th className={`${NB.tableHeadCell} text-left`}>Produk</th>
                                        <th className={`${NB.tableHeadCell} text-right w-24`}>Qty</th>
                                        <th className={`${NB.tableHeadCell} text-right w-32`}>Harga Satuan</th>
                                        <th className={`${NB.tableHeadCell} text-right w-20`}>Disc %</th>
                                        <th className={`${NB.tableHeadCell} text-right w-32`}>Total</th>
                                        <th className={`${NB.tableHeadCell} w-10`}></th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {items.map((item, idx) => (
                                        <tr key={idx} className={NB.tableRow}>
                                            <td className={NB.tableCell}>
                                                <span className="font-bold">{item.productName}</span>
                                                <span className="text-zinc-400 font-mono ml-1 text-[10px]">
                                                    {item.productCode}
                                                </span>
                                            </td>
                                            <td className={NB.tableCell}>
                                                <Input
                                                    type="number"
                                                    value={item.quantity}
                                                    onChange={(e) =>
                                                        updateItem(idx, "quantity", Math.max(0.001, Number(e.target.value)))
                                                    }
                                                    className="border-2 border-black font-bold h-8 rounded-none text-right text-xs w-full"
                                                    min={0.001}
                                                    step="any"
                                                />
                                            </td>
                                            <td className={NB.tableCell}>
                                                <Input
                                                    type="number"
                                                    value={item.unitPrice}
                                                    onChange={(e) =>
                                                        updateItem(idx, "unitPrice", Math.max(0, Number(e.target.value)))
                                                    }
                                                    className="border-2 border-black font-bold h-8 rounded-none text-right text-xs w-full"
                                                    min={0}
                                                />
                                            </td>
                                            <td className={NB.tableCell}>
                                                <Input
                                                    type="number"
                                                    value={item.discount}
                                                    onChange={(e) =>
                                                        updateItem(
                                                            idx,
                                                            "discount",
                                                            Math.max(0, Math.min(100, Number(e.target.value)))
                                                        )
                                                    }
                                                    className="border-2 border-black font-bold h-8 rounded-none text-right text-xs w-full"
                                                    min={0}
                                                    max={100}
                                                />
                                            </td>
                                            <td className={`${NB.tableCell} text-right font-black`}>
                                                {formatIDR(calcLineTotal(item))}
                                            </td>
                                            <td className={NB.tableCell}>
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    className="h-7 w-7 hover:bg-red-50 hover:text-red-600"
                                                    onClick={() => removeItem(idx)}
                                                >
                                                    <Trash2 className="h-3.5 w-3.5" />
                                                </Button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                                <tfoot>
                                    <tr className="border-t-2 border-black bg-zinc-50">
                                        <td colSpan={4} className="px-3 py-2 text-right font-black uppercase text-[10px] tracking-widest">
                                            Grand Total
                                        </td>
                                        <td className="px-3 py-2 text-right font-black text-sm">
                                            {formatIDR(grandTotal)}
                                        </td>
                                        <td></td>
                                    </tr>
                                </tfoot>
                            </table>
                        </div>
                    </div>

                    {/* Actions */}
                    <div className={NB.footer}>
                        <Button
                            variant="outline"
                            onClick={() => setOpen(false)}
                            className={NB.cancelBtn}
                            disabled={submitting}
                        >
                            Batal
                        </Button>
                        <Button
                            onClick={handleSubmit}
                            disabled={submitting || !reason.trim()}
                            className={NB.submitBtn}
                        >
                            {submitting ? (
                                <Loader2 className="h-4 w-4 animate-spin mr-1.5" />
                            ) : (
                                <Edit3 className="h-4 w-4 mr-1.5" />
                            )}
                            Simpan Amandemen
                        </Button>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    )
}
