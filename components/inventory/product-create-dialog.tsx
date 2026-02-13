"use client"

import { useState } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
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
import { ScrollArea } from "@/components/ui/scroll-area"
import { Plus, Package, DollarSign, BarChart3, Save, Loader2 } from "lucide-react"
import { createProduct } from "@/app/actions/inventory"
import { createProductSchema, type CreateProductInput } from "@/lib/validations"
import { INDONESIAN_UNITS } from "@/lib/inventory-utils"
import { toast } from "sonner"
import { useRouter } from "next/navigation"

interface ProductCreateDialogProps {
    categories: { id: string; name: string; code: string }[]
}

export function ProductCreateDialog({ categories }: ProductCreateDialogProps) {
    const [open, setOpen] = useState(false)
    const [isSubmitting, setIsSubmitting] = useState(false)
    const router = useRouter()

    const form = useForm<CreateProductInput>({
        resolver: zodResolver(createProductSchema),
        defaultValues: {
            code: "", name: "", description: "", categoryId: "",
            unit: "pcs", costPrice: 0, sellingPrice: 0,
            minStock: 0, maxStock: 0, reorderLevel: 0, barcode: "",
        },
    })

    const handleSubmit = async (data: CreateProductInput) => {
        setIsSubmitting(true)
        try {
            const result = await createProduct(data)
            if (result.success) {
                toast.success("Produk berhasil dibuat")
                form.reset()
                setOpen(false)
                router.refresh()
            } else {
                toast.error((result as any).error || "Gagal membuat produk")
            }
        } catch (error) {
            toast.error("Terjadi kesalahan saat menyimpan produk")
        } finally {
            setIsSubmitting(false)
        }
    }

    const watchCost = form.watch("costPrice") ?? 0
    const watchSell = form.watch("sellingPrice") ?? 0
    const margin = watchCost > 0 ? ((watchSell - watchCost) / watchCost) * 100 : 0

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button className="bg-black text-white border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:translate-y-[2px] hover:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] transition-all font-black uppercase text-xs tracking-wider">
                    <Plus className="mr-2 h-4 w-4" /> New Product
                </Button>
            </DialogTrigger>
            <DialogContent className="max-w-3xl p-0 border-2 border-black shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] rounded-none overflow-hidden gap-0">
                {/* Header */}
                <DialogHeader className="bg-black text-white px-6 py-5">
                    <DialogTitle className="text-xl font-black uppercase tracking-wider text-white flex items-center gap-2">
                        <Plus className="h-5 w-5" />
                        Tambah Produk Baru
                    </DialogTitle>
                    <p className="text-zinc-400 text-xs font-bold mt-1">
                        Masukkan detail produk baru ke dalam sistem inventori
                    </p>
                </DialogHeader>

                <ScrollArea className="max-h-[70vh]">
                    <form onSubmit={form.handleSubmit(handleSubmit)} className="p-6 space-y-6">
                        {/* Section 1: Basic Info */}
                        <div className="border-2 border-black">
                            <div className="bg-zinc-100 px-4 py-2.5 border-b-2 border-black flex items-center gap-2">
                                <Package className="h-4 w-4" />
                                <span className="text-xs font-black uppercase tracking-widest">Informasi Dasar</span>
                            </div>
                            <div className="p-4 space-y-4">
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="text-[10px] font-black uppercase tracking-wider text-zinc-500 mb-1 block">
                                            Kode Produk <span className="text-red-500">*</span>
                                        </label>
                                        <Input
                                            placeholder="Contoh: ELK001"
                                            {...form.register("code")}
                                            onChange={e => form.setValue("code", e.target.value.toUpperCase())}
                                            className="border-2 border-black font-mono font-bold uppercase h-10"
                                        />
                                        <p className="text-[9px] text-zinc-400 mt-1">Format: 3 huruf + 3 angka</p>
                                        {form.formState.errors.code && (
                                            <p className="text-[10px] text-red-500 font-bold mt-0.5">{form.formState.errors.code.message}</p>
                                        )}
                                    </div>
                                    <div>
                                        <label className="text-[10px] font-black uppercase tracking-wider text-zinc-500 mb-1 block">
                                            Nama Produk <span className="text-red-500">*</span>
                                        </label>
                                        <Input
                                            placeholder="Nama produk"
                                            {...form.register("name")}
                                            className="border-2 border-black font-bold h-10"
                                        />
                                        {form.formState.errors.name && (
                                            <p className="text-[10px] text-red-500 font-bold mt-0.5">{form.formState.errors.name.message}</p>
                                        )}
                                    </div>
                                </div>
                                <div>
                                    <label className="text-[10px] font-black uppercase tracking-wider text-zinc-500 mb-1 block">Deskripsi</label>
                                    <Textarea
                                        placeholder="Deskripsi produk (opsional)"
                                        {...form.register("description")}
                                        className="border-2 border-black font-medium min-h-[70px]"
                                    />
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="text-[10px] font-black uppercase tracking-wider text-zinc-500 mb-1 block">Kategori</label>
                                        <Select
                                            value={form.watch("categoryId") || "none"}
                                            onValueChange={v => form.setValue("categoryId", v === "none" ? "" : v)}
                                        >
                                            <SelectTrigger className="border-2 border-black font-bold h-10 w-full truncate">
                                                <SelectValue placeholder="Pilih kategori" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="none">Tanpa Kategori</SelectItem>
                                                {categories.map(c => (
                                                    <SelectItem key={c.id} value={c.id}>{c.code} - {c.name}</SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    <div>
                                        <label className="text-[10px] font-black uppercase tracking-wider text-zinc-500 mb-1 block">
                                            Satuan <span className="text-red-500">*</span>
                                        </label>
                                        <Select
                                            value={form.watch("unit") || "pcs"}
                                            onValueChange={v => form.setValue("unit", v)}
                                        >
                                            <SelectTrigger className="border-2 border-black font-bold h-10 w-full">
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {INDONESIAN_UNITS.map(u => <SelectItem key={u} value={u}>{u}</SelectItem>)}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                </div>
                                <div>
                                    <label className="text-[10px] font-black uppercase tracking-wider text-zinc-500 mb-1 block">Barcode</label>
                                    <Input
                                        placeholder="Opsional"
                                        {...form.register("barcode")}
                                        className="border-2 border-black font-mono h-10"
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Section 2: Pricing */}
                        <div className="border-2 border-black">
                            <div className="bg-zinc-100 px-4 py-2.5 border-b-2 border-black flex items-center gap-2">
                                <DollarSign className="h-4 w-4" />
                                <span className="text-xs font-black uppercase tracking-widest">Informasi Harga</span>
                            </div>
                            <div className="p-4">
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="text-[10px] font-black uppercase tracking-wider text-zinc-500 mb-1 block">Harga Beli (Rp)</label>
                                        <Input
                                            type="number"
                                            placeholder="0"
                                            {...form.register("costPrice", { valueAsNumber: true })}
                                            className="border-2 border-black font-mono font-bold h-10"
                                        />
                                    </div>
                                    <div>
                                        <label className="text-[10px] font-black uppercase tracking-wider text-zinc-500 mb-1 block">Harga Jual (Rp)</label>
                                        <Input
                                            type="number"
                                            placeholder="0"
                                            {...form.register("sellingPrice", { valueAsNumber: true })}
                                            className="border-2 border-black font-mono font-bold h-10"
                                        />
                                    </div>
                                </div>
                                {watchCost > 0 && watchSell > 0 && (
                                    <div className="mt-3 bg-emerald-50 border-2 border-emerald-200 p-3 flex items-center justify-between">
                                        <span className="text-xs font-bold text-emerald-700">Margin Keuntungan</span>
                                        <span className={`font-black text-sm ${margin >= 0 ? 'text-emerald-700' : 'text-red-600'}`}>
                                            {margin.toFixed(1)}% &middot; Rp {(watchSell - watchCost).toLocaleString('id-ID')}/unit
                                        </span>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Section 3: Stock Management */}
                        <div className="border-2 border-black">
                            <div className="bg-zinc-100 px-4 py-2.5 border-b-2 border-black flex items-center gap-2">
                                <BarChart3 className="h-4 w-4" />
                                <span className="text-xs font-black uppercase tracking-widest">Manajemen Stok</span>
                            </div>
                            <div className="p-4">
                                <div className="grid grid-cols-3 gap-4">
                                    <div>
                                        <label className="text-[10px] font-black uppercase tracking-wider text-zinc-500 mb-1 block">Stok Minimum</label>
                                        <Input
                                            type="number"
                                            placeholder="0"
                                            {...form.register("minStock", { valueAsNumber: true })}
                                            className="border-2 border-black font-mono font-bold h-10"
                                        />
                                    </div>
                                    <div>
                                        <label className="text-[10px] font-black uppercase tracking-wider text-zinc-500 mb-1 block">Stok Maksimum</label>
                                        <Input
                                            type="number"
                                            placeholder="0"
                                            {...form.register("maxStock", { valueAsNumber: true })}
                                            className="border-2 border-black font-mono font-bold h-10"
                                        />
                                    </div>
                                    <div>
                                        <label className="text-[10px] font-black uppercase tracking-wider text-zinc-500 mb-1 block">Reorder Point</label>
                                        <Input
                                            type="number"
                                            placeholder="0"
                                            {...form.register("reorderLevel", { valueAsNumber: true })}
                                            className="border-2 border-black font-mono font-bold h-10"
                                        />
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Actions */}
                        <div className="flex items-center justify-end gap-3 pt-2">
                            <Button
                                type="button"
                                variant="outline"
                                onClick={() => setOpen(false)}
                                className="border-2 border-black font-black uppercase text-xs tracking-wider px-6"
                            >
                                Batal
                            </Button>
                            <Button
                                type="submit"
                                disabled={isSubmitting}
                                className="bg-black text-white border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:translate-y-[2px] hover:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] transition-all font-black uppercase text-xs tracking-wider px-8"
                            >
                                {isSubmitting ? (
                                    <><Loader2 className="h-4 w-4 animate-spin mr-2" /> Menyimpan...</>
                                ) : (
                                    <><Save className="h-4 w-4 mr-2" /> Simpan Produk</>
                                )}
                            </Button>
                        </div>
                    </form>
                </ScrollArea>
            </DialogContent>
        </Dialog>
    )
}
