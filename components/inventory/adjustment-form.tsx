"use client"

import { useState } from "react"
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
import { createManualMovement } from "@/app/actions/inventory"
import { toast } from "sonner"
import { Loader2, ArrowRightLeft, Plus, Minus, Box } from "lucide-react"
import { useQueryClient } from "@tanstack/react-query"
import { queryKeys } from "@/lib/query-keys"
import { Dialog, DialogContent } from "@/components/ui/dialog"
import { useTransition, useMemo } from "react"
import { ComboboxWithCreate } from "@/components/ui/combobox-with-create"

interface AdjustmentFormProps {
    products: { id: string, name: string, code: string, unit: string }[]
    warehouses: { id: string, name: string }[]
}

const ADJUSTMENT_REASONS = [
    "Stok Opname (Selisih)",
    "Barang Rusak / Cacat",
    "Barang Kadaluarsa",
    "Hadiah / Promosi",
    "Retur dari Pelanggan",
    "Kesalahan Input Sebelumnya",
    "Sample / Testing",
    "Lainnya",
]

export function AdjustmentForm({ products, warehouses }: AdjustmentFormProps) {
    const [loading, setLoading] = useState(false)
    const queryClient = useQueryClient()

    const [isPending, startTransition] = useTransition()

    const productOptions = useMemo(() =>
        products.map(p => ({ value: p.id, label: p.name, subtitle: p.code })), [products])

    // Form States
    const [type, setType] = useState<'ADJUSTMENT_IN' | 'ADJUSTMENT_OUT' | 'TRANSFER'>('ADJUSTMENT_IN')
    const [productId, setProductId] = useState("")
    const [warehouseId, setWarehouseId] = useState("")
    const [targetWarehouseId, setTargetWarehouseId] = useState("")
    const [quantity, setQuantity] = useState("")
    const [reason, setReason] = useState("")
    const [notes, setNotes] = useState("")

    const handleSubmit = async () => {
        if (!productId || !warehouseId || !quantity) {
            toast.error("Mohon lengkapi semua field yang wajib diisi")
            return
        }

        if (type === 'TRANSFER' && !targetWarehouseId) {
            toast.error("Mohon pilih gudang tujuan")
            return
        }

        if (type === 'TRANSFER' && warehouseId === targetWarehouseId) {
            toast.error("Gudang asal dan tujuan tidak boleh sama")
            return
        }

        setLoading(true)
        try {
            const result = await createManualMovement({
                type,
                productId,
                warehouseId,
                targetWarehouseId: type === 'TRANSFER' ? targetWarehouseId : undefined,
                quantity: Number(quantity),
                notes: reason ? `${reason} - ${notes}` : notes,
                userId: "system-user"
            })

            if (result.success) {
                toast.success("Penyesuaian berhasil disimpan!", {
                    description: "Level inventori telah diperbarui.",
                })

                setProductId("")
                setWarehouseId("")
                setTargetWarehouseId("")
                setQuantity("")
                setReason("")
                setNotes("")

                startTransition(() => {
                    queryClient.invalidateQueries({ queryKey: queryKeys.products.all })
                    queryClient.invalidateQueries({ queryKey: queryKeys.inventoryDashboard.all })
                    queryClient.invalidateQueries({ queryKey: queryKeys.adjustments.all })
                    queryClient.invalidateQueries({ queryKey: queryKeys.stockMovements.all })
                    queryClient.invalidateQueries({ queryKey: queryKeys.warehouses.all })
                    queryClient.invalidateQueries({ queryKey: queryKeys.stockTransfers.all })
                })
            } else {
                toast.error("Gagal menyimpan", { description: ("error" in result && result.error) ? String(result.error) : "Kesalahan tidak diketahui" })
            }
        } catch {
            toast.error("Terjadi kesalahan sistem")
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className="space-y-4">
            {/* Loading Dialog */}
            <Dialog open={loading || isPending} onOpenChange={() => { }}>
                <DialogContent className="max-w-[300px] border-2 border-black p-8 text-center shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] [&>button]:hidden">
                    <Loader2 className="h-10 w-10 animate-spin mx-auto text-black mb-4" />
                    <h3 className="font-black uppercase text-lg">Memproses...</h3>
                    <p className="text-xs text-zinc-500 font-medium">Mohon tunggu sebentar</p>
                </DialogContent>
            </Dialog>

            {/* Type Section */}
            <div>
                <label className="text-[10px] font-black uppercase tracking-wider text-zinc-500 mb-1 block">
                    Tipe Penyesuaian <span className="text-red-500">*</span>
                </label>
                <Select value={type} onValueChange={(val: any) => setType(val)}>
                    <SelectTrigger className="border-2 border-black font-bold h-10 w-full rounded-none">
                        <SelectValue placeholder="Pilih tipe" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="ADJUSTMENT_IN">
                            <div className="flex items-center gap-2 text-emerald-700 font-bold">
                                <Plus className="h-4 w-4" /> Stok Masuk (Penambahan)
                            </div>
                        </SelectItem>
                        <SelectItem value="ADJUSTMENT_OUT">
                            <div className="flex items-center gap-2 text-red-700 font-bold">
                                <Minus className="h-4 w-4" /> Stok Keluar (Pengurangan)
                            </div>
                        </SelectItem>
                        <SelectItem value="TRANSFER">
                            <div className="flex items-center gap-2 text-violet-700 font-bold">
                                <ArrowRightLeft className="h-4 w-4" /> Transfer Gudang
                            </div>
                        </SelectItem>
                    </SelectContent>
                </Select>
            </div>

            {/* Product — Searchable Combobox */}
            <div>
                <label className="text-[10px] font-black uppercase tracking-wider text-zinc-500 mb-1 block">
                    Produk <span className="text-red-500">*</span>
                </label>
                <ComboboxWithCreate
                    options={productOptions}
                    value={productId}
                    onChange={setProductId}
                    placeholder="Pilih produk..."
                    searchPlaceholder="Cari kode atau nama produk..."
                    emptyMessage="Produk tidak ditemukan."
                />
            </div>

            {/* Warehouse(s) */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                    <label className="text-[10px] font-black uppercase tracking-wider text-zinc-500 mb-1 block">
                        {type === 'TRANSFER' ? 'Gudang Asal' : 'Gudang'} <span className="text-red-500">*</span>
                    </label>
                    <Select value={warehouseId} onValueChange={setWarehouseId}>
                        <SelectTrigger className="border-2 border-black font-bold h-10 w-full rounded-none">
                            <SelectValue placeholder="Pilih gudang..." />
                        </SelectTrigger>
                        <SelectContent>
                            {warehouses.map(w => (
                                <SelectItem key={w.id} value={w.id}>{w.name}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>

                {type === 'TRANSFER' && (
                    <div>
                        <label className="text-[10px] font-black uppercase tracking-wider text-zinc-500 mb-1 block">
                            Gudang Tujuan <span className="text-red-500">*</span>
                        </label>
                        <Select value={targetWarehouseId} onValueChange={setTargetWarehouseId}>
                            <SelectTrigger className="border-2 border-black font-bold h-10 w-full rounded-none">
                                <SelectValue placeholder="Pilih tujuan..." />
                            </SelectTrigger>
                            <SelectContent>
                                {warehouses.filter(w => w.id !== warehouseId).map(w => (
                                    <SelectItem key={w.id} value={w.id}>{w.name}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                )}
            </div>

            {/* Quantity */}
            <div>
                <label className="text-[10px] font-black uppercase tracking-wider text-zinc-500 mb-1 block">
                    Jumlah <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                    <Input
                        type="number"
                        value={quantity}
                        onChange={(e) => setQuantity(e.target.value)}
                        placeholder="0"
                        className="border-2 border-black font-mono font-bold h-10 text-lg rounded-none pr-12 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                    />
                    <div className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-black text-zinc-400 uppercase">
                        UNIT
                    </div>
                </div>
            </div>

            {/* Reason */}
            <div>
                <label className="text-[10px] font-black uppercase tracking-wider text-zinc-500 mb-1 block">
                    Alasan
                </label>
                <Select value={reason} onValueChange={setReason}>
                    <SelectTrigger className="border-2 border-black font-bold h-10 w-full rounded-none">
                        <SelectValue placeholder="Pilih alasan..." />
                    </SelectTrigger>
                    <SelectContent>
                        {ADJUSTMENT_REASONS.map(r => (
                            <SelectItem key={r} value={r}>{r}</SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </div>

            {/* Notes */}
            <div>
                <label className="text-[10px] font-black uppercase tracking-wider text-zinc-500 mb-1 block">
                    Catatan Tambahan
                </label>
                <Textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Detail tambahan..."
                    className="border-2 border-black font-medium min-h-[80px] resize-none rounded-none"
                />
            </div>

            {/* Submit */}
            <Button
                onClick={handleSubmit}
                className="w-full bg-black text-white border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:translate-y-[2px] hover:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] transition-all font-black uppercase text-xs tracking-wider h-10 mt-2 rounded-none"
                disabled={loading || isPending}
            >
                {loading || isPending ? <Loader2 className="animate-spin mr-2 h-4 w-4" /> : <Box className="mr-2 h-4 w-4" />}
                Simpan Penyesuaian
            </Button>
        </div>
    )
}
