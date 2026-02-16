"use client"

import { useState } from "react"
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { NB } from "@/lib/dialog-styles"
import { ScrollArea } from "@/components/ui/scroll-area"
import { DollarSign } from "lucide-react"
import { toast } from "sonner"
import { createCostSheet } from "@/lib/actions/costing"

interface CostSheetFormProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    products: { id: string; name: string; code: string }[]
}

export function CostSheetForm({ open, onOpenChange, products }: CostSheetFormProps) {
    const [loading, setLoading] = useState(false)
    const [form, setForm] = useState({
        productId: "",
        targetPrice: "",
        targetMargin: "",
    })

    const handleSubmit = async () => {
        if (!form.productId) {
            toast.error("Pilih produk")
            return
        }

        setLoading(true)
        const result = await createCostSheet({
            productId: form.productId,
            targetPrice: form.targetPrice ? parseFloat(form.targetPrice) : undefined,
            targetMargin: form.targetMargin ? parseFloat(form.targetMargin) : undefined,
        })
        setLoading(false)

        if (result.success) {
            toast.success("Cost sheet berhasil dibuat")
            onOpenChange(false)
            setForm({ productId: "", targetPrice: "", targetMargin: "" })
        } else {
            toast.error(result.error || "Gagal membuat cost sheet")
        }
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className={NB.contentNarrow}>
                <DialogHeader className={NB.header}>
                    <DialogTitle className={NB.title}>
                        <DollarSign className="h-5 w-5" />
                        Cost Sheet Baru
                    </DialogTitle>
                    <p className={NB.subtitle}>Buat analisis biaya garmen</p>
                </DialogHeader>

                <ScrollArea className={NB.scroll}>
                    <div className="p-6 space-y-6">
                        <div className={NB.section}>
                            <div className={NB.sectionHead}>
                                <span className={NB.sectionTitle}>Informasi Produk</span>
                            </div>
                            <div className={NB.sectionBody}>
                                <div>
                                    <label className={NB.label}>
                                        Produk <span className={NB.labelRequired}>*</span>
                                    </label>
                                    <select
                                        className={NB.select}
                                        value={form.productId}
                                        onChange={(e) =>
                                            setForm((f) => ({ ...f, productId: e.target.value }))
                                        }
                                    >
                                        <option value="">Pilih produk...</option>
                                        {products.map((p) => (
                                            <option key={p.id} value={p.id}>
                                                [{p.code}] {p.name}
                                            </option>
                                        ))}
                                    </select>
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className={NB.label}>Target Harga (IDR)</label>
                                        <Input
                                            className={NB.inputMono}
                                            type="number"
                                            value={form.targetPrice}
                                            onChange={(e) =>
                                                setForm((f) => ({ ...f, targetPrice: e.target.value }))
                                            }
                                            placeholder="150,000"
                                        />
                                    </div>
                                    <div>
                                        <label className={NB.label}>Target Margin (%)</label>
                                        <Input
                                            className={NB.inputMono}
                                            type="number"
                                            step="0.01"
                                            value={form.targetMargin}
                                            onChange={(e) =>
                                                setForm((f) => ({ ...f, targetMargin: e.target.value }))
                                            }
                                            placeholder="30.00"
                                        />
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className={NB.footer}>
                            <button
                                type="button"
                                onClick={() => onOpenChange(false)}
                                className={NB.cancelBtn}
                            >
                                Batal
                            </button>
                            <button
                                type="button"
                                onClick={handleSubmit}
                                disabled={loading}
                                className={NB.submitBtn}
                            >
                                {loading ? "Menyimpan..." : "Buat Cost Sheet"}
                            </button>
                        </div>
                    </div>
                </ScrollArea>
            </DialogContent>
        </Dialog>
    )
}
