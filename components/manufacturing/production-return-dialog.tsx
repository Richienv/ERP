"use client"

import { useState } from "react"
import { useQueryClient } from "@tanstack/react-query"
import { queryKeys } from "@/lib/query-keys"
import { Undo2, AlertTriangle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { SelectItem } from "@/components/ui/select"
import { toast } from "sonner"
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
        <>
            <Button
                variant="outline"
                className="flex-1 border-2 border-red-400 text-red-700 font-black uppercase text-[10px] tracking-wide h-10 hover:bg-red-50 transition-colors rounded-none"
                disabled={actualQty <= 0}
                onClick={() => setOpen(true)}
            >
                <Undo2 className="h-3.5 w-3.5 mr-1.5" />
                Retur Produksi
            </Button>

            <NBDialog open={open} onOpenChange={setOpen} size="narrow">
                <NBDialogHeader
                    icon={Undo2}
                    title="Retur Produksi"
                    subtitle="Kembalikan barang jadi ke bahan baku — untuk batch defective / cacat."
                />

                <NBDialogBody>
                    {/* Warning banner */}
                    <div className="border border-amber-400 bg-amber-50 p-3 flex items-start gap-3">
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
                    <NBSection icon={Undo2} title="Info Work Order">
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
                    </NBSection>

                    <NBInput
                        label="Qty Retur"
                        required
                        type="number"
                        value={returnQty}
                        onChange={setReturnQty}
                        placeholder={`Maks ${actualQty}`}
                    />

                    <NBSelect
                        label="Gudang"
                        required
                        value={warehouseId}
                        onValueChange={setWarehouseId}
                        placeholder="Pilih gudang"
                    >
                        {warehouseOptions.map((wh) => (
                            <SelectItem key={wh.id} value={wh.id}>
                                {wh.code} - {wh.name}
                            </SelectItem>
                        ))}
                    </NBSelect>

                    <NBTextarea
                        label="Alasan Retur"
                        required
                        value={reason}
                        onChange={setReason}
                        placeholder="Batch cacat, gagal QC..."
                    />

                    <NBInput
                        label="Dilakukan Oleh (opsional)"
                        value={performedBy}
                        onChange={setPerformedBy}
                        placeholder="Nama operator"
                    />
                </NBDialogBody>

                <NBDialogFooter
                    onCancel={() => setOpen(false)}
                    onSubmit={handleSubmit}
                    submitting={submitting}
                    submitLabel="Proses Retur"
                />
            </NBDialog>
        </>
    )
}
