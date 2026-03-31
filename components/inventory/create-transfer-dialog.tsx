"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
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
import { ComboboxWithCreate } from "@/components/ui/combobox-with-create"
import { ArrowRightLeft, Package } from "lucide-react"
import { toast } from "sonner"
import { createStockTransfer } from "@/lib/actions/stock-transfers"
import { useQueryClient } from "@tanstack/react-query"
import { queryKeys } from "@/lib/query-keys"

interface CreateTransferDialogProps {
    warehouses: { id: string; name: string; code: string }[]
    products: { id: string; name: string; code: string }[]
    trigger?: React.ReactNode
}

export function CreateTransferDialog({ warehouses, products, trigger }: CreateTransferDialogProps) {
    const [open, setOpen] = useState(false)
    const [loading, setLoading] = useState(false)
    const queryClient = useQueryClient()

    const productOptions = products.map(p => ({ value: p.id, label: p.name, subtitle: p.code }))

    const [fromWarehouseId, setFromWarehouseId] = useState("")
    const [toWarehouseId, setToWarehouseId] = useState("")
    const [productId, setProductId] = useState("")
    const [quantity, setQuantity] = useState("")
    const [notes, setNotes] = useState("")

    const resetForm = () => {
        setFromWarehouseId("")
        setToWarehouseId("")
        setProductId("")
        setQuantity("")
        setNotes("")
    }

    const handleSubmit = async () => {
        if (!fromWarehouseId || !toWarehouseId || !productId || !quantity) {
            toast.error("Lengkapi semua field wajib")
            return
        }

        if (fromWarehouseId === toWarehouseId) {
            toast.error("Gudang asal dan tujuan tidak boleh sama")
            return
        }

        const qty = parseInt(quantity)
        if (isNaN(qty) || qty <= 0) {
            toast.error("Qty harus > 0")
            return
        }

        setLoading(true)
        try {
            const result = await createStockTransfer({
                fromWarehouseId,
                toWarehouseId,
                productId,
                quantity: qty,
                notes: notes || undefined,
            })

            if (result.success) {
                toast.success("Transfer berhasil dibuat")
                queryClient.invalidateQueries({ queryKey: queryKeys.inventoryDashboard.all })
                queryClient.invalidateQueries({ queryKey: queryKeys.products.all })
                queryClient.invalidateQueries({ queryKey: queryKeys.stockTransfers.all })
                queryClient.invalidateQueries({ queryKey: queryKeys.stockMovements.all })
                queryClient.invalidateQueries({ queryKey: queryKeys.warehouses.all })
                resetForm()
                setOpen(false)
            } else {
                toast.error(result.error || "Gagal membuat transfer")
            }
        } catch (err: any) {
            toast.error(err.message || "Gagal membuat transfer")
        } finally {
            setLoading(false)
        }
    }

    return (
        <>
            {trigger ? (
                <span onClick={() => setOpen(true)}>{trigger}</span>
            ) : (
                <Button
                    onClick={() => setOpen(true)}
                    className="bg-black text-white border border-black hover:bg-zinc-800 font-black uppercase text-[10px] tracking-wider px-4 h-8 rounded-none"
                >
                    <ArrowRightLeft className="mr-2 h-4 w-4" /> Transfer Baru
                </Button>
            )}

            <NBDialog open={open} onOpenChange={setOpen}>
                <NBDialogHeader
                    icon={ArrowRightLeft}
                    title="Buat Stock Transfer"
                    subtitle="Pindahkan stok antar gudang"
                />

                <NBDialogBody>
                    <NBSection icon={Package} title="Detail Transfer">
                        <div className="grid grid-cols-2 gap-3">
                            <NBSelect
                                label="Gudang Asal"
                                required
                                value={fromWarehouseId}
                                onValueChange={setFromWarehouseId}
                                placeholder="Pilih gudang..."
                                options={warehouses.map((w) => ({
                                    value: w.id,
                                    label: `${w.code} — ${w.name}`,
                                }))}
                            />
                            <NBSelect
                                label="Gudang Tujuan"
                                required
                                value={toWarehouseId}
                                onValueChange={setToWarehouseId}
                                placeholder="Pilih gudang..."
                                options={warehouses
                                    .filter((w) => w.id !== fromWarehouseId)
                                    .map((w) => ({
                                        value: w.id,
                                        label: `${w.code} — ${w.name}`,
                                    }))}
                            />
                            <div>
                                <label className="text-[11px] font-bold uppercase tracking-wider text-zinc-600 dark:text-zinc-400 mb-1 block">
                                    Produk <span className="text-red-500">*</span>
                                </label>
                                <ComboboxWithCreate
                                    options={productOptions}
                                    value={productId}
                                    onChange={setProductId}
                                    placeholder="Pilih produk..."
                                    searchPlaceholder="Cari produk..."
                                    emptyMessage="Produk tidak ditemukan."
                                />
                            </div>
                            <NBInput
                                label="Jumlah"
                                required
                                type="number"
                                value={quantity}
                                onChange={setQuantity}
                                placeholder="100"
                            />
                        </div>
                        <NBTextarea
                            label="Catatan"
                            value={notes}
                            onChange={setNotes}
                            placeholder="Alasan transfer..."
                        />
                    </NBSection>
                </NBDialogBody>

                <NBDialogFooter
                    onCancel={() => setOpen(false)}
                    onSubmit={handleSubmit}
                    submitting={loading}
                    submitLabel="Buat Transfer"
                />
            </NBDialog>
        </>
    )
}
