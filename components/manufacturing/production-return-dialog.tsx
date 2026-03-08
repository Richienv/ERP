"use client"

import { useState } from "react"
import { useQueryClient } from "@tanstack/react-query"
import { queryKeys } from "@/lib/query-keys"
import { Undo2, AlertTriangle, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
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
import { NB } from "@/lib/dialog-styles"
import { toast } from "sonner"

interface WarehouseOption {
    id: string
    code: string
    name: string
}

interface ProductionReturnDialogProps {
    workOrderId: string
    workOrderNumber: string
    productName: string
    productCode: string
    productUnit: string
    actualQty: number
    warehouseOptions: WarehouseOption[]
    defaultWarehouseId?: string
    onSuccess?: () => void
}

export function ProductionReturnDialog({
    workOrderId,
    workOrderNumber,
    productName,
    productCode,
    productUnit,
    actualQty,
    warehouseOptions,
    defaultWarehouseId,
    onSuccess,
}: ProductionReturnDialogProps) {
    const queryClient = useQueryClient()
    const [open, setOpen] = useState(false)
    const [returnQty, setReturnQty] = useState("")
    const [warehouseId, setWarehouseId] = useState(defaultWarehouseId || "")
    const [reason, setReason] = useState("")
    const [performedBy, setPerformedBy] = useState("")
    const [submitting, setSubmitting] = useState(false)

    const handleSubmit = async () => {
        const qty = Number(returnQty)
        if (!qty || qty <= 0) {
            toast.error("Qty retur harus lebih dari 0")
            return
        }
        if (qty > actualQty) {
            toast.error(`Qty retur (${qty}) melebihi qty aktual (${actualQty})`)
            return
        }
        if (!warehouseId) {
            toast.error("Pilih gudang terlebih dahulu")
            return
        }
        if (!reason.trim()) {
            toast.error("Alasan retur wajib diisi")
            return
        }

        setSubmitting(true)
        try {
            const res = await fetch(`/api/manufacturing/work-orders/${workOrderId}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    action: "PRODUCTION_RETURN",
                    returnQty: qty,
                    warehouseId,
                    reason: reason.trim(),
                    performedBy: performedBy || undefined,
                }),
            })
            const data = await res.json()
            if (!data.success) {
                toast.error(data.error || "Gagal memproses retur produksi")
                return
            }

            toast.success("Retur produksi berhasil. Stok & jurnal diperbarui.")

            // Invalidate all affected caches
            queryClient.invalidateQueries({ queryKey: queryKeys.workOrders.all })
            queryClient.invalidateQueries({ queryKey: queryKeys.mfgDashboard.all })
            queryClient.invalidateQueries({ queryKey: queryKeys.inventoryDashboard.all })
            queryClient.invalidateQueries({ queryKey: queryKeys.products.all })
            queryClient.invalidateQueries({ queryKey: queryKeys.stockMovements.all })
            queryClient.invalidateQueries({ queryKey: queryKeys.journal.all })
            queryClient.invalidateQueries({ queryKey: queryKeys.chartAccounts.all })

            setOpen(false)
            setReturnQty("")
            setReason("")
            setPerformedBy("")
            onSuccess?.()
        } catch {
            toast.error("Terjadi kesalahan jaringan")
        } finally {
            setSubmitting(false)
        }
    }

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button
                    variant="outline"
                    className="flex-1 border-2 border-red-400 text-red-700 font-black uppercase text-[10px] tracking-wide h-10 hover:bg-red-50 transition-colors rounded-none"
                    disabled={actualQty <= 0}
                >
                    <Undo2 className="h-3.5 w-3.5 mr-1.5" />
                    Retur Produksi
                </Button>
            </DialogTrigger>
            <DialogContent className={NB.contentNarrow}>
                <DialogHeader className={NB.header}>
                    <DialogTitle className={NB.title}>
                        <Undo2 className="h-5 w-5" />
                        Retur Produksi
                    </DialogTitle>
                    <p className={NB.subtitle}>
                        Kembalikan barang jadi ke bahan baku — untuk batch defective / cacat.
                    </p>
                </DialogHeader>

                <div className="p-5 space-y-4">
                    {/* Warning banner */}
                    <div className="border-2 border-amber-400 bg-amber-50 p-3 flex items-start gap-3">
                        <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
                        <div>
                            <p className="text-xs font-black text-amber-800 uppercase tracking-wide">
                                Perhatian
                            </p>
                            <p className="text-[10px] text-amber-700 mt-0.5">
                                Retur produksi akan mengurangi stok barang jadi, mengembalikan
                                bahan baku, dan membuat jurnal balik. Pastikan qty benar.
                            </p>
                        </div>
                    </div>

                    {/* WO Info */}
                    <div className="border-2 border-black bg-zinc-50 p-3">
                        <div className="flex items-center justify-between">
                            <div>
                                <span className="text-[10px] font-black uppercase tracking-widest text-zinc-400 block">
                                    Work Order
                                </span>
                                <span className="font-mono text-sm font-bold text-zinc-900">
                                    {workOrderNumber}
                                </span>
                            </div>
                            <div className="text-right">
                                <span className="text-[10px] font-black uppercase tracking-widest text-zinc-400 block">
                                    Qty Aktual
                                </span>
                                <span className="text-sm font-black text-zinc-900">
                                    {actualQty} {productUnit}
                                </span>
                            </div>
                        </div>
                        <div className="mt-1">
                            <span className="text-[10px] text-zinc-500">
                                {productCode} — {productName}
                            </span>
                        </div>
                    </div>

                    {/* Return Qty */}
                    <div className="space-y-1.5">
                        <label className={NB.label}>
                            Qty Retur <span className={NB.labelRequired}>*</span>
                        </label>
                        <Input
                            type="number"
                            min={1}
                            max={actualQty}
                            value={returnQty}
                            onChange={(e) => setReturnQty(e.target.value)}
                            placeholder={`Maks ${actualQty}`}
                            className={NB.input}
                        />
                    </div>

                    {/* Warehouse */}
                    <div className="space-y-1.5">
                        <label className={NB.label}>
                            Gudang <span className={NB.labelRequired}>*</span>
                        </label>
                        <Select value={warehouseId} onValueChange={setWarehouseId}>
                            <SelectTrigger className={NB.select}>
                                <SelectValue placeholder="Pilih gudang" />
                            </SelectTrigger>
                            <SelectContent>
                                {warehouseOptions.map((wh) => (
                                    <SelectItem key={wh.id} value={wh.id}>
                                        {wh.code} - {wh.name}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    {/* Reason */}
                    <div className="space-y-1.5">
                        <label className={NB.label}>
                            Alasan Retur <span className={NB.labelRequired}>*</span>
                        </label>
                        <Textarea
                            value={reason}
                            onChange={(e) => setReason(e.target.value)}
                            placeholder="Batch cacat, gagal QC..."
                            className={NB.textarea}
                        />
                    </div>

                    {/* Performed By */}
                    <div className="space-y-1.5">
                        <label className={NB.label}>Dilakukan Oleh (opsional)</label>
                        <Input
                            value={performedBy}
                            onChange={(e) => setPerformedBy(e.target.value)}
                            placeholder="Nama operator"
                            className={NB.input}
                        />
                    </div>

                    {/* Footer */}
                    <div className={NB.footer}>
                        <Button
                            variant="outline"
                            className={NB.cancelBtn}
                            onClick={() => setOpen(false)}
                            disabled={submitting}
                        >
                            Batal
                        </Button>
                        <Button
                            onClick={handleSubmit}
                            disabled={submitting}
                            className="bg-red-600 text-white border-2 border-red-700 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:translate-y-[2px] hover:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] transition-all font-black uppercase text-xs tracking-wider px-8 h-9 rounded-none"
                        >
                            {submitting ? (
                                <>
                                    <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                                    Memproses...
                                </>
                            ) : (
                                <>
                                    <Undo2 className="h-3.5 w-3.5 mr-1.5" />
                                    Proses Retur
                                </>
                            )}
                        </Button>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    )
}
