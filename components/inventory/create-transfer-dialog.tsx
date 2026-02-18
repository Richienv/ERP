"use client"

import { useState } from "react"
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
import { NB } from "@/lib/dialog-styles"
import { ComboboxWithCreate } from "@/components/ui/combobox-with-create"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
import { ArrowRightLeft } from "lucide-react"
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
        const result = await createStockTransfer({
            fromWarehouseId,
            toWarehouseId,
            productId,
            quantity: qty,
            notes: notes || undefined,
        })
        setLoading(false)

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
    }

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                {trigger ?? (
                    <Button className={NB.triggerBtn}>
                        <ArrowRightLeft className="mr-2 h-4 w-4" /> Transfer Baru
                    </Button>
                )}
            </DialogTrigger>
            <DialogContent className={NB.content}>
                <DialogHeader className={NB.header}>
                    <DialogTitle className={NB.title}>
                        <ArrowRightLeft className="h-5 w-5" /> Buat Stock Transfer
                    </DialogTitle>
                    <p className={NB.subtitle}>Pindahkan stok antar gudang</p>
                </DialogHeader>

                <div className="p-6 space-y-4">
                    <div className={NB.section}>
                        <div className={NB.sectionHead}>
                            <span className={NB.sectionTitle}>Detail Transfer</span>
                        </div>
                        <div className={NB.sectionBody}>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className={NB.label}>Gudang Asal <span className={NB.labelRequired}>*</span></label>
                                    <Select value={fromWarehouseId} onValueChange={setFromWarehouseId}>
                                        <SelectTrigger className={NB.select}>
                                            <SelectValue placeholder="Pilih gudang..." />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {warehouses.map((w) => (
                                                <SelectItem key={w.id} value={w.id}>{w.code} — {w.name}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div>
                                    <label className={NB.label}>Gudang Tujuan <span className={NB.labelRequired}>*</span></label>
                                    <Select value={toWarehouseId} onValueChange={setToWarehouseId}>
                                        <SelectTrigger className={NB.select}>
                                            <SelectValue placeholder="Pilih gudang..." />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {warehouses.filter((w) => w.id !== fromWarehouseId).map((w) => (
                                                <SelectItem key={w.id} value={w.id}>{w.code} — {w.name}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div>
                                    <label className={NB.label}>Produk <span className={NB.labelRequired}>*</span></label>
                                    <ComboboxWithCreate
                                        options={productOptions}
                                        value={productId}
                                        onChange={setProductId}
                                        placeholder="Pilih produk..."
                                        searchPlaceholder="Cari produk..."
                                        emptyMessage="Produk tidak ditemukan."
                                    />
                                </div>
                                <div>
                                    <label className={NB.label}>Jumlah <span className={NB.labelRequired}>*</span></label>
                                    <Input className={NB.inputMono} type="number" min={1} value={quantity} onChange={(e) => setQuantity(e.target.value)} placeholder="100" />
                                </div>
                            </div>

                            <div>
                                <label className={NB.label}>Catatan</label>
                                <Textarea className={NB.textarea} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Alasan transfer..." />
                            </div>
                        </div>
                    </div>

                    <div className={NB.footer}>
                        <Button variant="outline" onClick={() => setOpen(false)} className={NB.cancelBtn}>Batal</Button>
                        <Button onClick={handleSubmit} disabled={loading} className={NB.submitBtn}>
                            {loading ? "Membuat..." : "Buat Transfer"}
                        </Button>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    )
}
