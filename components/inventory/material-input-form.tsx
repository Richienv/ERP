"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
    DialogFooter,
} from "@/components/ui/dialog"
import { Plus } from "lucide-react"

export function MaterialInputForm() {
    const [open, setOpen] = useState(false)

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button className="h-10 border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] bg-white text-black font-black hover:bg-zinc-50 hover:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:translate-y-[2px] transition-all rounded-full px-6">
                    <Plus className="mr-2 h-4 w-4 text-emerald-600" /> ADD MATERIAL
                </Button>
            </DialogTrigger>
            <DialogContent className="max-w-xl bg-white border-2 border-black shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] rounded-[2rem] p-0 overflow-hidden font-sans">
                <DialogHeader className="p-8 pb-4">
                    <DialogTitle className="text-3xl font-black uppercase tracking-tighter flex items-center gap-3">
                        <span className="bg-black text-white px-3 py-1 text-xs rounded-full tracking-widest">NEW</span>
                        Input Material Baru
                    </DialogTitle>
                    <DialogDescription className="font-bold text-black/60 text-base">
                        Masukkan data material inventory baru secara manual.
                    </DialogDescription>
                </DialogHeader>

                <div className="px-8 pb-8 space-y-6 max-h-[70vh] overflow-y-auto">
                    {/* Basic Info */}
                    <div className="bg-zinc-100/50 border border-zinc-200 p-6 rounded-3xl space-y-4">
                        <h3 className="font-black uppercase text-xs text-zinc-500 tracking-widest mb-2">Informasi Dasar</h3>

                        <div className="space-y-3">
                            <Label htmlFor="name" className="font-bold text-sm">Nama Material</Label>
                            <Input
                                id="name"
                                placeholder="Contoh: Benang Katun Putih Grade A"
                                className="h-12 rounded-xl border-2 border-black/10 focus:border-black bg-white shadow-sm font-bold text-lg placeholder:font-normal placeholder:text-zinc-400 focus-visible:ring-0 focus-visible:shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] transition-all"
                            />
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label htmlFor="sku" className="font-bold text-sm">SKU / Kode</Label>
                                <Input
                                    id="sku"
                                    placeholder="MAT-001"
                                    className="h-11 rounded-xl border-2 border-black/10 focus:border-black bg-white shadow-sm font-mono font-medium focus-visible:ring-0 transition-all"
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="category" className="font-bold text-sm">Kategori</Label>
                                <Input
                                    id="category"
                                    placeholder="Raw Material"
                                    className="h-11 rounded-xl border-2 border-black/10 focus:border-black bg-white shadow-sm font-medium focus-visible:ring-0 transition-all"
                                />
                            </div>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {/* Stock & Unit */}
                        <div className="bg-zinc-100/50 border border-zinc-200 p-6 rounded-3xl space-y-4 h-full">
                            <h3 className="font-black uppercase text-xs text-zinc-500 tracking-widest mb-2">Stok & Satuan</h3>

                            <div className="space-y-3">
                                <div className="space-y-2">
                                    <Label htmlFor="unit" className="font-bold text-sm">Satuan (Unit)</Label>
                                    <Input
                                        id="unit"
                                        placeholder="Pcs / Kg / Roll"
                                        className="h-11 rounded-xl border-2 border-black/10 focus:border-black bg-white shadow-sm font-medium focus-visible:ring-0 transition-all"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="stock" className="font-bold text-sm">Stok Awal</Label>
                                    <Input
                                        id="stock"
                                        type="number"
                                        placeholder="0"
                                        className="h-11 rounded-xl border-2 border-black/10 focus:border-black bg-white shadow-sm font-mono font-bold text-lg focus-visible:ring-0 transition-all"
                                    />
                                </div>
                                <div className="space-y-2 pt-1">
                                    <Label htmlFor="min_stock" className="font-bold text-sm text-red-600">Min. Stock Alert</Label>
                                    <Input
                                        id="min_stock"
                                        type="number"
                                        placeholder="10"
                                        className="h-11 rounded-xl border-2 border-red-100 focus:border-red-500 bg-red-50/50 shadow-sm font-mono font-bold text-red-600 focus-visible:ring-0 transition-all placeholder:text-red-300"
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Pricing */}
                        <div className="bg-zinc-100/50 border border-zinc-200 p-6 rounded-3xl space-y-4 h-full">
                            <h3 className="font-black uppercase text-xs text-zinc-500 tracking-widest mb-2">Harga & Modal</h3>

                            <div className="space-y-3">
                                <div className="space-y-2">
                                    <Label htmlFor="cost" className="font-bold text-sm">Harga Beli (Satuan)</Label>
                                    <div className="relative">
                                        <span className="absolute left-4 top-2.5 font-black text-zinc-400">Rp</span>
                                        <Input
                                            id="cost"
                                            type="number"
                                            className="h-11 pl-10 rounded-xl border-2 border-black/10 focus:border-black bg-white shadow-sm font-mono font-bold text-lg focus-visible:ring-0 transition-all"
                                            placeholder="0"
                                        />
                                    </div>
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="supplier" className="font-bold text-sm">Supplier Utama</Label>
                                    <Input
                                        id="supplier"
                                        placeholder="Nama Vendor"
                                        className="h-11 rounded-xl border-2 border-black/10 focus:border-black bg-white shadow-sm font-medium focus-visible:ring-0 transition-all"
                                    />
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                <DialogFooter className="p-6 border-t border-zinc-100 bg-zinc-50/50 gap-3">
                    <Button
                        variant="outline"
                        onClick={() => setOpen(false)}
                        className="rounded-full px-6 h-12 font-bold border-2 border-zinc-200 hover:bg-zinc-100 hover:text-black"
                    >
                        Batal
                    </Button>
                    <Button
                        onClick={() => setOpen(false)}
                        className="rounded-full px-8 h-12 bg-black text-white font-black text-base border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:translate-y-[2px] hover:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:bg-zinc-900 transition-all"
                    >
                        Simpan Material
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}
