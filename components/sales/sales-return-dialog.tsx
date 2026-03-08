"use client"

import { useState, useEffect, useCallback } from "react"
import { toast } from "sonner"
import { useQueryClient } from "@tanstack/react-query"
import { queryKeys } from "@/lib/query-keys"
import { NB } from "@/lib/dialog-styles"
import {
    getSalesOrderForReturn,
    createSalesReturn,
    type CreateSalesReturnInput,
} from "@/lib/actions/sales"

import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
} from "@/components/ui/dialog"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
import { Loader2, Undo2, PackageCheck, AlertTriangle } from "lucide-react"

interface SalesReturnDialogProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    salesOrderId: string
    salesOrderNumber: string
    onSuccess?: () => void
}

interface SOForReturn {
    id: string
    number: string
    customer: { id: string; name: string; code: string }
    status: string
    items: {
        id: string
        productId: string
        productName: string
        productCode: string
        unit: string
        qtyOrdered: number
        qtyDelivered: number
        unitPrice: number
        color: string | null
        size: string | null
    }[]
    invoices: {
        id: string
        number: string
        totalAmount: number
        balanceDue: number
        status: string
    }[]
}

const RETURN_REASONS = [
    { value: "cacat", label: "Barang Cacat / Rusak" },
    { value: "salah", label: "Barang Tidak Sesuai Pesanan" },
    { value: "kualitas", label: "Kualitas Tidak Standar" },
    { value: "kelebihan", label: "Kelebihan Kirim" },
    { value: "kadaluarsa", label: "Barang Kadaluarsa" },
]

function formatCurrency(value: number) {
    return new Intl.NumberFormat("id-ID", {
        style: "currency",
        currency: "IDR",
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
    }).format(value)
}

export function SalesReturnDialog({
    open,
    onOpenChange,
    salesOrderId,
    salesOrderNumber,
    onSuccess,
}: SalesReturnDialogProps) {
    const queryClient = useQueryClient()
    const [loading, setLoading] = useState(false)
    const [submitting, setSubmitting] = useState(false)
    const [soData, setSoData] = useState<SOForReturn | null>(null)
    const [selectedInvoiceId, setSelectedInvoiceId] = useState<string>("")
    const [notes, setNotes] = useState("")

    // Per-item return state: { [itemId]: { qty, reason } }
    const [returnItems, setReturnItems] = useState<
        Record<string, { qty: number; reason: string }>
    >({})

    // Load SO data when dialog opens
    useEffect(() => {
        if (!open || !salesOrderId) return
        setLoading(true)
        getSalesOrderForReturn(salesOrderId)
            .then((data) => {
                setSoData(data)
                if (data?.invoices?.[0]) {
                    setSelectedInvoiceId(data.invoices[0].id)
                }
                // Initialize return items with 0 qty
                const initial: Record<string, { qty: number; reason: string }> = {}
                data?.items?.forEach((item) => {
                    initial[item.id] = { qty: 0, reason: "cacat" }
                })
                setReturnItems(initial)
            })
            .finally(() => setLoading(false))
    }, [open, salesOrderId])

    const updateReturnItem = useCallback(
        (itemId: string, field: "qty" | "reason", value: number | string) => {
            setReturnItems((prev) => ({
                ...prev,
                [itemId]: { ...prev[itemId], [field]: value },
            }))
        },
        []
    )

    const selectedItems = soData?.items?.filter(
        (item) => (returnItems[item.id]?.qty || 0) > 0
    ) || []

    const subtotal = selectedItems.reduce((sum, item) => {
        const qty = returnItems[item.id]?.qty || 0
        return sum + qty * item.unitPrice
    }, 0)

    const ppn = Math.round(subtotal * 0.11)
    const total = subtotal + ppn

    const handleSubmit = async () => {
        if (selectedItems.length === 0) {
            toast.error("Pilih minimal 1 item untuk diretur")
            return
        }

        // Validate quantities
        for (const item of selectedItems) {
            const qty = returnItems[item.id]?.qty || 0
            if (qty > item.qtyDelivered) {
                toast.error(
                    `Qty retur ${item.productName} (${qty}) melebihi qty terkirim (${item.qtyDelivered})`
                )
                return
            }
        }

        setSubmitting(true)
        try {
            const payload: CreateSalesReturnInput = {
                salesOrderId,
                invoiceId: selectedInvoiceId || undefined,
                notes,
                items: selectedItems.map((item) => ({
                    salesOrderItemId: item.id,
                    productId: item.productId,
                    quantity: returnItems[item.id].qty,
                    unitPrice: item.unitPrice,
                    reason: returnItems[item.id].reason,
                })),
            }

            const result = await createSalesReturn(payload)
            if (result.success) {
                toast.success(
                    `Retur berhasil! Nota Kredit ${result.creditNoteNumber} telah dibuat.`
                )
                // Invalidate all affected caches
                queryClient.invalidateQueries({ queryKey: queryKeys.salesOrders.all })
                queryClient.invalidateQueries({ queryKey: queryKeys.invoices.all })
                queryClient.invalidateQueries({ queryKey: queryKeys.inventoryDashboard.all })
                queryClient.invalidateQueries({ queryKey: queryKeys.financeDashboard.all })
                queryClient.invalidateQueries({ queryKey: queryKeys.dcNotes.all })
                queryClient.invalidateQueries({ queryKey: queryKeys.journal.all })
                queryClient.invalidateQueries({ queryKey: queryKeys.stockMovements.all })
                onSuccess?.()
                onOpenChange(false)
            } else {
                toast.error(result.error || "Gagal memproses retur")
            }
        } catch {
            toast.error("Terjadi kesalahan saat memproses retur")
        } finally {
            setSubmitting(false)
        }
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className={NB.contentWide}>
                {/* Header */}
                <DialogHeader className={NB.header}>
                    <DialogTitle className={NB.title}>
                        <Undo2 className="h-5 w-5" />
                        Retur Penjualan
                    </DialogTitle>
                    <DialogDescription className={NB.subtitle}>
                        Proses pengembalian barang dari pelanggan - {salesOrderNumber}
                    </DialogDescription>
                </DialogHeader>

                <ScrollArea className={NB.scroll}>
                    <div className="p-6 space-y-5">
                        {loading ? (
                            <div className="flex flex-col items-center justify-center py-16">
                                <Loader2 className="h-8 w-8 animate-spin text-zinc-400 mb-3" />
                                <p className="text-sm font-bold text-zinc-500">
                                    Memuat data pesanan...
                                </p>
                            </div>
                        ) : !soData ? (
                            <div className="text-center py-16">
                                <AlertTriangle className="h-8 w-8 text-amber-500 mx-auto mb-3" />
                                <p className="font-bold text-zinc-700">
                                    Data pesanan tidak ditemukan
                                </p>
                            </div>
                        ) : soData.items.length === 0 ? (
                            <div className="text-center py-16">
                                <PackageCheck className="h-8 w-8 text-zinc-400 mx-auto mb-3" />
                                <p className="font-bold text-zinc-700">
                                    Tidak ada item yang bisa diretur
                                </p>
                                <p className="text-xs text-zinc-500 mt-1">
                                    Hanya item yang sudah dikirim (qty terkirim &gt; 0) yang bisa
                                    diretur.
                                </p>
                            </div>
                        ) : (
                            <>
                                {/* Customer & Invoice Info */}
                                <div className={NB.section}>
                                    <div className={NB.sectionHead}>
                                        <span className={NB.sectionTitle}>Informasi Retur</span>
                                    </div>
                                    <div className={NB.sectionBody}>
                                        <div className="grid grid-cols-2 gap-4">
                                            <div>
                                                <label className={NB.label}>Pelanggan</label>
                                                <p className="font-bold text-sm">
                                                    {soData.customer.name}
                                                </p>
                                                <p className="text-[10px] text-zinc-500 font-mono">
                                                    {soData.customer.code}
                                                </p>
                                            </div>
                                            <div>
                                                <label className={NB.label}>Invoice Terkait</label>
                                                {soData.invoices.length > 0 ? (
                                                    <Select
                                                        value={selectedInvoiceId}
                                                        onValueChange={setSelectedInvoiceId}
                                                    >
                                                        <SelectTrigger className={NB.select}>
                                                            <SelectValue placeholder="Pilih invoice..." />
                                                        </SelectTrigger>
                                                        <SelectContent className="border-2 border-black rounded-none">
                                                            {soData.invoices.map((inv) => (
                                                                <SelectItem
                                                                    key={inv.id}
                                                                    value={inv.id}
                                                                    className="rounded-none"
                                                                >
                                                                    {inv.number} -{" "}
                                                                    {formatCurrency(inv.totalAmount)}
                                                                </SelectItem>
                                                            ))}
                                                        </SelectContent>
                                                    </Select>
                                                ) : (
                                                    <p className="text-xs text-zinc-500 font-bold">
                                                        Belum ada invoice
                                                    </p>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* Items Table */}
                                <div className={NB.section}>
                                    <div className={NB.sectionHead}>
                                        <span className={NB.sectionTitle}>
                                            Pilih Item Retur
                                        </span>
                                    </div>
                                    <div className={NB.tableWrap}>
                                        <table className="w-full text-left">
                                            <thead className={NB.tableHead}>
                                                <tr>
                                                    <th className={NB.tableHeadCell}>Produk</th>
                                                    <th className={`${NB.tableHeadCell} text-center`}>
                                                        Terkirim
                                                    </th>
                                                    <th className={`${NB.tableHeadCell} text-center`}>
                                                        Qty Retur
                                                    </th>
                                                    <th className={NB.tableHeadCell}>Alasan</th>
                                                    <th className={`${NB.tableHeadCell} text-right`}>
                                                        Subtotal
                                                    </th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {soData.items.map((item) => {
                                                    const ri = returnItems[item.id] || {
                                                        qty: 0,
                                                        reason: "cacat",
                                                    }
                                                    const lineTotal = ri.qty * item.unitPrice
                                                    return (
                                                        <tr
                                                            key={item.id}
                                                            className={NB.tableRow}
                                                        >
                                                            <td className={NB.tableCell}>
                                                                <p className="font-bold text-sm">
                                                                    {item.productName}
                                                                </p>
                                                                <p className="text-[10px] text-zinc-500 font-mono">
                                                                    {item.productCode}
                                                                    {item.color &&
                                                                        ` | ${item.color}`}
                                                                    {item.size && ` | ${item.size}`}
                                                                </p>
                                                                <p className="text-[10px] text-zinc-400">
                                                                    @{" "}
                                                                    {formatCurrency(item.unitPrice)}{" "}
                                                                    / {item.unit}
                                                                </p>
                                                            </td>
                                                            <td
                                                                className={`${NB.tableCell} text-center`}
                                                            >
                                                                <span className="font-bold text-sm">
                                                                    {item.qtyDelivered}
                                                                </span>
                                                            </td>
                                                            <td className={`${NB.tableCell} text-center`}>
                                                                <Input
                                                                    type="number"
                                                                    min={0}
                                                                    max={item.qtyDelivered}
                                                                    value={ri.qty || ""}
                                                                    onChange={(e) =>
                                                                        updateReturnItem(
                                                                            item.id,
                                                                            "qty",
                                                                            Math.min(
                                                                                Number(
                                                                                    e.target.value
                                                                                ),
                                                                                item.qtyDelivered
                                                                            )
                                                                        )
                                                                    }
                                                                    className="w-20 mx-auto border-2 border-black rounded-none text-center font-bold h-8 text-sm"
                                                                    placeholder="0"
                                                                />
                                                            </td>
                                                            <td className={NB.tableCell}>
                                                                <Select
                                                                    value={ri.reason}
                                                                    onValueChange={(v) =>
                                                                        updateReturnItem(
                                                                            item.id,
                                                                            "reason",
                                                                            v
                                                                        )
                                                                    }
                                                                >
                                                                    <SelectTrigger className="border-2 border-black rounded-none h-8 text-xs font-bold w-[180px]">
                                                                        <SelectValue />
                                                                    </SelectTrigger>
                                                                    <SelectContent className="border-2 border-black rounded-none">
                                                                        {RETURN_REASONS.map((r) => (
                                                                            <SelectItem
                                                                                key={r.value}
                                                                                value={r.value}
                                                                                className="rounded-none text-xs"
                                                                            >
                                                                                {r.label}
                                                                            </SelectItem>
                                                                        ))}
                                                                    </SelectContent>
                                                                </Select>
                                                            </td>
                                                            <td
                                                                className={`${NB.tableCell} text-right`}
                                                            >
                                                                <span className="font-bold text-sm">
                                                                    {lineTotal > 0
                                                                        ? formatCurrency(lineTotal)
                                                                        : "-"}
                                                                </span>
                                                            </td>
                                                        </tr>
                                                    )
                                                })}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>

                                {/* Notes */}
                                <div>
                                    <label className={NB.label}>Catatan Retur</label>
                                    <Textarea
                                        value={notes}
                                        onChange={(e) => setNotes(e.target.value)}
                                        className={NB.textarea}
                                        placeholder="Catatan tambahan..."
                                        rows={2}
                                    />
                                </div>

                                {/* Summary */}
                                {selectedItems.length > 0 && (
                                    <div className="bg-zinc-50 border-2 border-black p-4">
                                        <div className="flex justify-between items-center mb-2">
                                            <span className={NB.label}>Subtotal Retur</span>
                                            <span className="font-bold">
                                                {formatCurrency(subtotal)}
                                            </span>
                                        </div>
                                        <div className="flex justify-between items-center mb-2">
                                            <span className={NB.label}>PPN 11%</span>
                                            <span className="font-bold">
                                                {formatCurrency(ppn)}
                                            </span>
                                        </div>
                                        <div className="flex justify-between items-center border-t-2 border-black pt-2">
                                            <span className="text-sm font-black uppercase">
                                                Total Nota Kredit
                                            </span>
                                            <span className="text-lg font-black">
                                                {formatCurrency(total)}
                                            </span>
                                        </div>
                                    </div>
                                )}

                                {/* Actions */}
                                <div className={NB.footer}>
                                    <Button
                                        variant="outline"
                                        onClick={() => onOpenChange(false)}
                                        className={NB.cancelBtn}
                                        disabled={submitting}
                                    >
                                        Batal
                                    </Button>
                                    <Button
                                        onClick={handleSubmit}
                                        className={NB.submitBtn}
                                        disabled={submitting || selectedItems.length === 0}
                                    >
                                        {submitting ? (
                                            <Loader2 className="h-4 w-4 animate-spin mr-2" />
                                        ) : (
                                            <Undo2 className="h-4 w-4 mr-2" />
                                        )}
                                        Proses Retur
                                    </Button>
                                </div>
                            </>
                        )}
                    </div>
                </ScrollArea>
            </DialogContent>
        </Dialog>
    )
}
