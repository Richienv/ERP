"use client"

import { useState, useEffect, useCallback } from "react"
import { toast } from "sonner"
import { useQueryClient } from "@tanstack/react-query"
import { queryKeys } from "@/lib/query-keys"
import {
    getSalesOrderForReturn,
    createSalesReturn,
    type CreateSalesReturnInput,
} from "@/lib/actions/sales"

import {
    NBDialog,
    NBDialogHeader,
    NBDialogBody,
    NBDialogFooter,
    NBSection,
    NBSelect,
    NBTextarea,
} from "@/components/ui/nb-dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
import { Loader2, Undo2, PackageCheck, AlertTriangle, ClipboardList, FileText } from "lucide-react"

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
        <NBDialog open={open} onOpenChange={onOpenChange} size="wide">
            <NBDialogHeader
                icon={Undo2}
                title="Retur Penjualan"
                subtitle={`Proses pengembalian barang dari pelanggan - ${salesOrderNumber}`}
            />

            <NBDialogBody>
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
                        <NBSection icon={FileText} title="Informasi Retur">
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="text-[11px] font-bold uppercase tracking-wider text-zinc-600 dark:text-zinc-400 mb-1 block">Pelanggan</label>
                                    <p className="font-bold text-sm">
                                        {soData.customer.name}
                                    </p>
                                    <p className="text-[10px] text-zinc-500 font-mono">
                                        {soData.customer.code}
                                    </p>
                                </div>
                                <div>
                                    {soData.invoices.length > 0 ? (
                                        <NBSelect
                                            label="Invoice Terkait"
                                            value={selectedInvoiceId}
                                            onValueChange={setSelectedInvoiceId}
                                            placeholder="Pilih invoice..."
                                            options={soData.invoices.map((inv) => ({
                                                value: inv.id,
                                                label: `${inv.number} - ${formatCurrency(inv.totalAmount)}`,
                                            }))}
                                        />
                                    ) : (
                                        <div>
                                            <label className="text-[11px] font-bold uppercase tracking-wider text-zinc-600 dark:text-zinc-400 mb-1 block">Invoice Terkait</label>
                                            <p className="text-xs text-zinc-500 font-bold">
                                                Belum ada invoice
                                            </p>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </NBSection>

                        {/* Items Table — complex, keep as-is */}
                        <NBSection icon={ClipboardList} title="Pilih Item Retur">
                            <div className="overflow-x-auto border border-zinc-200 dark:border-zinc-700">
                                <table className="w-full text-left">
                                    <thead className="bg-zinc-100 dark:bg-zinc-800 border-b border-zinc-200 dark:border-zinc-700">
                                        <tr>
                                            <th className="px-3 py-2 text-[10px] font-black uppercase tracking-widest text-zinc-500">Produk</th>
                                            <th className="px-3 py-2 text-[10px] font-black uppercase tracking-widest text-zinc-500 text-center">Terkirim</th>
                                            <th className="px-3 py-2 text-[10px] font-black uppercase tracking-widest text-zinc-500 text-center">Qty Retur</th>
                                            <th className="px-3 py-2 text-[10px] font-black uppercase tracking-widest text-zinc-500">Alasan</th>
                                            <th className="px-3 py-2 text-[10px] font-black uppercase tracking-widest text-zinc-500 text-right">Subtotal</th>
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
                                                    className="border-b border-zinc-100 dark:border-zinc-800"
                                                >
                                                    <td className="px-3 py-2">
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
                                                    <td className="px-3 py-2 text-center">
                                                        <span className="font-bold text-sm">
                                                            {item.qtyDelivered}
                                                        </span>
                                                    </td>
                                                    <td className="px-3 py-2 text-center">
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
                                                            className="w-20 mx-auto border border-zinc-300 rounded-none text-center font-bold h-8 text-sm"
                                                            placeholder="0"
                                                        />
                                                    </td>
                                                    <td className="px-3 py-2">
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
                                                            <SelectTrigger className="border border-zinc-300 rounded-none h-8 text-xs font-bold w-[180px]">
                                                                <SelectValue />
                                                            </SelectTrigger>
                                                            <SelectContent className="rounded-none">
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
                                                    <td className="px-3 py-2 text-right">
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
                        </NBSection>

                        {/* Notes */}
                        <NBTextarea
                            label="Catatan Retur"
                            value={notes}
                            onChange={setNotes}
                            placeholder="Catatan tambahan..."
                            rows={2}
                        />

                        {/* Summary */}
                        {selectedItems.length > 0 && (
                            <div className="bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-700 p-4">
                                <div className="flex justify-between items-center mb-2">
                                    <span className="text-[11px] font-bold uppercase tracking-wider text-zinc-600">Subtotal Retur</span>
                                    <span className="font-bold">
                                        {formatCurrency(subtotal)}
                                    </span>
                                </div>
                                <div className="flex justify-between items-center mb-2">
                                    <span className="text-[11px] font-bold uppercase tracking-wider text-zinc-600">PPN 11%</span>
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
                    </>
                )}
            </NBDialogBody>

            <NBDialogFooter
                onCancel={() => onOpenChange(false)}
                onSubmit={handleSubmit}
                submitting={submitting}
                submitLabel="Proses Retur"
                disabled={selectedItems.length === 0}
            />
        </NBDialog>
    )
}
