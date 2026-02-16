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
import { ClipboardList, Plus, Trash2 } from "lucide-react"
import { toast } from "sonner"
import { createSubcontractOrder } from "@/lib/actions/subcontract"
import type { SubcontractorSummary } from "@/lib/actions/subcontract"

const OPERATIONS = [
    { value: "CUT", label: "Potong" },
    { value: "SEW", label: "Jahit" },
    { value: "WASH", label: "Cuci" },
    { value: "PRINT", label: "Cetak" },
    { value: "EMBROIDERY", label: "Bordir" },
    { value: "FINISHING", label: "Finishing" },
]

interface OrderItem {
    productId: string
    productName: string
    issuedQty: number
}

interface SubcontractOrderFormProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    subcontractors: SubcontractorSummary[]
    products: { id: string; name: string; code: string }[]
}

export function SubcontractOrderForm({
    open,
    onOpenChange,
    subcontractors,
    products,
}: SubcontractOrderFormProps) {
    const [loading, setLoading] = useState(false)
    const [subcontractorId, setSubcontractorId] = useState("")
    const [operation, setOperation] = useState("")
    const [expectedReturnDate, setExpectedReturnDate] = useState("")
    const [items, setItems] = useState<OrderItem[]>([])
    const [selectedProduct, setSelectedProduct] = useState("")
    const [selectedQty, setSelectedQty] = useState("")

    const addItem = () => {
        if (!selectedProduct || !selectedQty) return
        const product = products.find((p) => p.id === selectedProduct)
        if (!product) return

        setItems((prev) => [
            ...prev,
            { productId: product.id, productName: product.name, issuedQty: parseInt(selectedQty) },
        ])
        setSelectedProduct("")
        setSelectedQty("")
    }

    const removeItem = (idx: number) => {
        setItems((prev) => prev.filter((_, i) => i !== idx))
    }

    const handleSubmit = async () => {
        if (!subcontractorId) {
            toast.error("Pilih subkontraktor")
            return
        }
        if (!operation) {
            toast.error("Pilih operasi")
            return
        }
        if (items.length === 0) {
            toast.error("Tambahkan minimal 1 item")
            return
        }

        setLoading(true)
        const result = await createSubcontractOrder({
            subcontractorId,
            operation,
            expectedReturnDate: expectedReturnDate || undefined,
            items: items.map((i) => ({ productId: i.productId, issuedQty: i.issuedQty })),
        })
        setLoading(false)

        if (result.success) {
            toast.success("Order subkontrak berhasil dibuat")
            onOpenChange(false)
            setSubcontractorId("")
            setOperation("")
            setExpectedReturnDate("")
            setItems([])
        } else {
            toast.error(result.error || "Gagal membuat order")
        }
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className={NB.contentWide}>
                <DialogHeader className={NB.header}>
                    <DialogTitle className={NB.title}>
                        <ClipboardList className="h-5 w-5" />
                        Order Subkontrak Baru
                    </DialogTitle>
                    <p className={NB.subtitle}>Kirim pekerjaan ke mitra CMT</p>
                </DialogHeader>

                <ScrollArea className={NB.scroll}>
                    <div className="p-6 space-y-6">
                        {/* Order header */}
                        <div className={NB.section}>
                            <div className={NB.sectionHead}>
                                <span className={NB.sectionTitle}>Detail Order</span>
                            </div>
                            <div className={NB.sectionBody}>
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className={NB.label}>
                                            Subkontraktor <span className={NB.labelRequired}>*</span>
                                        </label>
                                        <select
                                            className={NB.select}
                                            value={subcontractorId}
                                            onChange={(e) => setSubcontractorId(e.target.value)}
                                        >
                                            <option value="">Pilih subkontraktor...</option>
                                            {subcontractors
                                                .filter((s) => s.isActive)
                                                .map((s) => (
                                                    <option key={s.id} value={s.id}>
                                                        {s.name}
                                                    </option>
                                                ))}
                                        </select>
                                    </div>
                                    <div>
                                        <label className={NB.label}>
                                            Operasi <span className={NB.labelRequired}>*</span>
                                        </label>
                                        <select
                                            className={NB.select}
                                            value={operation}
                                            onChange={(e) => setOperation(e.target.value)}
                                        >
                                            <option value="">Pilih operasi...</option>
                                            {OPERATIONS.map((op) => (
                                                <option key={op.value} value={op.value}>
                                                    {op.label}
                                                </option>
                                            ))}
                                        </select>
                                    </div>
                                </div>
                                <div>
                                    <label className={NB.label}>Tanggal Pengembalian</label>
                                    <Input
                                        className={NB.input}
                                        type="date"
                                        value={expectedReturnDate}
                                        onChange={(e) => setExpectedReturnDate(e.target.value)}
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Items */}
                        <div className={NB.section}>
                            <div className={NB.sectionHead}>
                                <span className={NB.sectionTitle}>
                                    Item <span className={NB.labelRequired}>*</span>
                                </span>
                            </div>
                            <div className={NB.sectionBody}>
                                {/* Add item row */}
                                <div className="flex gap-2">
                                    <select
                                        className={`${NB.select} flex-1`}
                                        value={selectedProduct}
                                        onChange={(e) => setSelectedProduct(e.target.value)}
                                    >
                                        <option value="">Pilih produk...</option>
                                        {products.map((p) => (
                                            <option key={p.id} value={p.id}>
                                                [{p.code}] {p.name}
                                            </option>
                                        ))}
                                    </select>
                                    <Input
                                        className={`${NB.inputMono} w-28`}
                                        type="number"
                                        placeholder="Qty"
                                        value={selectedQty}
                                        onChange={(e) => setSelectedQty(e.target.value)}
                                    />
                                    <button
                                        type="button"
                                        onClick={addItem}
                                        className="border-2 border-black bg-zinc-100 hover:bg-zinc-200 px-3 h-10 rounded-none"
                                    >
                                        <Plus className="h-4 w-4" />
                                    </button>
                                </div>

                                {/* Item list */}
                                {items.length > 0 && (
                                    <div className={NB.tableWrap}>
                                        <table className="w-full">
                                            <thead className={NB.tableHead}>
                                                <tr>
                                                    <th className={`${NB.tableHeadCell} text-left`}>Produk</th>
                                                    <th className={`${NB.tableHeadCell} text-right`}>Qty</th>
                                                    <th className={`${NB.tableHeadCell} w-10`}></th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {items.map((item, idx) => (
                                                    <tr key={idx} className={NB.tableRow}>
                                                        <td className={NB.tableCell}>{item.productName}</td>
                                                        <td className={`${NB.tableCell} text-right font-mono`}>
                                                            {item.issuedQty.toLocaleString()}
                                                        </td>
                                                        <td className={NB.tableCell}>
                                                            <button
                                                                type="button"
                                                                onClick={() => removeItem(idx)}
                                                                className="text-red-500 hover:text-red-700"
                                                            >
                                                                <Trash2 className="h-3.5 w-3.5" />
                                                            </button>
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Footer */}
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
                                {loading ? "Menyimpan..." : "Buat Order"}
                            </button>
                        </div>
                    </div>
                </ScrollArea>
            </DialogContent>
        </Dialog>
    )
}
