"use client"

import { useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import {
    Calculator, Plus, Save, Trash2, Loader2, ShoppingCart, Package
} from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
} from "@/components/ui/dialog"
import { ScrollArea } from "@/components/ui/scroll-area"
import { NB } from "@/lib/dialog-styles"

interface QuickOrderDialogProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    customerId: string
    customerName: string
    customerCode: string
}

interface ProductOption {
    id: string
    code: string
    name: string
    unit: string
    sellingPrice: number
}

interface OrderLine {
    productId: string
    description: string
    quantity: number
    unitPrice: number
    discount: number
    taxRate: number
}

const formatCurrency = (amount: number) =>
    new Intl.NumberFormat("id-ID", {
        style: "currency",
        currency: "IDR",
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
    }).format(amount)

export function QuickOrderDialog({
    open,
    onOpenChange,
    customerId,
    customerName,
    customerCode,
}: QuickOrderDialogProps) {
    const router = useRouter()
    const [loading, setLoading] = useState(true)
    const [submitting, setSubmitting] = useState(false)
    const [products, setProducts] = useState<ProductOption[]>([])
    const [notes, setNotes] = useState("")
    const [items, setItems] = useState<OrderLine[]>([
        { productId: "", description: "", quantity: 1, unitPrice: 0, discount: 0, taxRate: 11 },
    ])

    useEffect(() => {
        if (!open) return
        setLoading(true)
        setItems([{ productId: "", description: "", quantity: 1, unitPrice: 0, discount: 0, taxRate: 11 }])
        setNotes("")

        fetch("/api/sales/options", { cache: "no-store" })
            .then((r) => r.json())
            .then((payload) => {
                if (payload.success && payload.data?.products) {
                    setProducts(payload.data.products)
                }
            })
            .catch(() => toast.error("Gagal memuat data produk"))
            .finally(() => setLoading(false))
    }, [open])

    const totals = useMemo(() => {
        return items.reduce(
            (acc, item) => {
                const qty = Number(item.quantity || 0)
                const price = Number(item.unitPrice || 0)
                const disc = Number(item.discount || 0)
                const tax = Number(item.taxRate || 0)
                const sub = qty * price
                const discAmt = sub * (disc / 100)
                const after = sub - discAmt
                const taxAmt = after * (tax / 100)
                return {
                    subtotal: acc.subtotal + sub,
                    discount: acc.discount + discAmt,
                    tax: acc.tax + taxAmt,
                    total: acc.total + after + taxAmt,
                }
            },
            { subtotal: 0, discount: 0, tax: 0, total: 0 }
        )
    }, [items])

    const updateItem = (index: number, patch: Partial<OrderLine>) => {
        setItems((cur) => cur.map((item, i) => (i === index ? { ...item, ...patch } : item)))
    }

    const onProductChange = (index: number, productId: string) => {
        const product = products.find((p) => p.id === productId)
        if (!product) return
        updateItem(index, {
            productId,
            description: product.name,
            unitPrice: product.sellingPrice,
        })
    }

    const addItem = () => {
        setItems((cur) => [
            ...cur,
            { productId: "", description: "", quantity: 1, unitPrice: 0, discount: 0, taxRate: 11 },
        ])
    }

    const removeItem = (index: number) => {
        setItems((cur) => (cur.length === 1 ? cur : cur.filter((_, i) => i !== index)))
    }

    const onSubmit = async () => {
        const validItems = items.filter((item) => item.productId && Number(item.quantity) > 0)
        if (validItems.length === 0) {
            toast.error("Tambahkan minimal 1 produk")
            return
        }

        setSubmitting(true)
        try {
            const response = await fetch("/api/sales/orders", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    salesOrder: {
                        customerId,
                        orderDate: new Date().toISOString().slice(0, 10),
                        paymentTerm: "NET_30",
                        notes: notes || undefined,
                    },
                    items: validItems,
                }),
            })

            const payload = await response.json()
            if (!payload.success) {
                throw new Error(payload.error || "Gagal membuat sales order")
            }

            toast.success(`Sales Order ${payload.data?.number || "baru"} berhasil dibuat`)
            onOpenChange(false)
            router.refresh()
        } catch (error: any) {
            toast.error(error?.message || "Gagal membuat sales order")
        } finally {
            setSubmitting(false)
        }
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className={NB.contentWide}>
                <DialogHeader className={NB.header}>
                    <DialogTitle className={NB.title}>
                        <ShoppingCart className="h-5 w-5" />
                        Order Cepat
                    </DialogTitle>
                    <DialogDescription className={NB.subtitle}>
                        {customerCode} — {customerName}
                    </DialogDescription>
                </DialogHeader>

                <ScrollArea className={NB.scroll}>
                    <div className="p-5 space-y-4">
                        {/* Customer Info Strip */}
                        <div className="bg-amber-50 border-2 border-amber-300 px-4 py-3 flex items-center justify-between">
                            <div>
                                <p className="text-[9px] font-black uppercase tracking-widest text-amber-600">Pelanggan</p>
                                <p className="text-sm font-black uppercase">{customerName}</p>
                            </div>
                            <span className="text-[10px] font-mono font-bold text-amber-700 bg-amber-100 border border-amber-300 px-2 py-0.5">
                                {customerCode}
                            </span>
                        </div>

                        {/* Item List */}
                        <div className={NB.section}>
                            <div className={`${NB.sectionHead} justify-between`}>
                                <div className="flex items-center gap-2">
                                    <Package className="h-4 w-4" />
                                    <span className={NB.sectionTitle}>Item Pesanan</span>
                                    <span className="bg-black text-white text-[10px] font-black px-2 py-0.5 min-w-[20px] text-center">
                                        {items.length}
                                    </span>
                                </div>
                                <Button
                                    type="button"
                                    onClick={addItem}
                                    className="bg-black text-white border-2 border-black text-[10px] font-black uppercase tracking-wide h-7 px-3 rounded-none shadow-[2px_2px_0px_0px_rgba(0,0,0,0.3)] hover:shadow-none hover:translate-y-[1px] transition-all"
                                >
                                    <Plus className="h-3 w-3 mr-1" /> Tambah
                                </Button>
                            </div>

                            {loading ? (
                                <div className="p-8 text-center">
                                    <Loader2 className="h-6 w-6 animate-spin mx-auto text-zinc-400" />
                                    <p className="text-[10px] font-bold text-zinc-400 mt-2">Memuat produk...</p>
                                </div>
                            ) : (
                                <div className="divide-y divide-zinc-200">
                                    {items.map((item, index) => {
                                        const lineSub = item.quantity * item.unitPrice
                                        const lineDisc = lineSub * (item.discount / 100)
                                        const afterDisc = lineSub - lineDisc
                                        const lineTax = afterDisc * (item.taxRate / 100)
                                        const lineTotal = afterDisc + lineTax

                                        return (
                                            <div key={index} className={`p-4 ${index % 2 === 1 ? "bg-zinc-50/50" : ""}`}>
                                                {/* Product select + delete */}
                                                <div className="flex items-start gap-3 mb-3">
                                                    <div className="flex-none w-6 h-6 bg-zinc-100 border border-zinc-300 text-zinc-500 flex items-center justify-center text-[10px] font-black">
                                                        {index + 1}
                                                    </div>
                                                    <div className="flex-1">
                                                        <Select
                                                            value={item.productId || "none"}
                                                            onValueChange={(v) => onProductChange(index, v === "none" ? "" : v)}
                                                        >
                                                            <SelectTrigger className={NB.select}>
                                                                <SelectValue placeholder="Pilih produk" />
                                                            </SelectTrigger>
                                                            <SelectContent>
                                                                <SelectItem value="none">Pilih produk</SelectItem>
                                                                {products.map((p) => (
                                                                    <SelectItem key={p.id} value={p.id}>
                                                                        <span className="font-mono text-xs text-zinc-400 mr-1">{p.code}</span> {p.name}
                                                                        <span className="text-zinc-400 ml-1">({p.unit})</span>
                                                                    </SelectItem>
                                                                ))}
                                                            </SelectContent>
                                                        </Select>
                                                    </div>
                                                    <Button
                                                        type="button"
                                                        variant="ghost"
                                                        size="icon"
                                                        onClick={() => removeItem(index)}
                                                        disabled={items.length === 1}
                                                        className="h-10 w-10 border border-red-200 text-red-400 hover:bg-red-50 hover:text-red-600 disabled:opacity-30 rounded-none"
                                                    >
                                                        <Trash2 className="h-4 w-4" />
                                                    </Button>
                                                </div>

                                                {/* Qty, Price, Disc, Tax, Total */}
                                                <div className="ml-9 grid grid-cols-5 gap-2">
                                                    <div className="space-y-1">
                                                        <Label className="text-[9px] font-black uppercase tracking-widest text-zinc-400">Qty</Label>
                                                        <Input
                                                            type="number"
                                                            min="0.001"
                                                            step="0.001"
                                                            value={item.quantity}
                                                            onChange={(e) => updateItem(index, { quantity: Number(e.target.value || 0) })}
                                                            className="border-2 border-black h-9 font-bold text-center text-sm rounded-none"
                                                        />
                                                    </div>
                                                    <div className="space-y-1">
                                                        <Label className="text-[9px] font-black uppercase tracking-widest text-zinc-400">Harga</Label>
                                                        <Input
                                                            type="number"
                                                            min="0"
                                                            value={item.unitPrice}
                                                            onChange={(e) => updateItem(index, { unitPrice: Number(e.target.value || 0) })}
                                                            className="border-2 border-black h-9 font-bold text-sm rounded-none"
                                                        />
                                                    </div>
                                                    <div className="space-y-1">
                                                        <Label className="text-[9px] font-black uppercase tracking-widest text-zinc-400">Disc %</Label>
                                                        <Input
                                                            type="number"
                                                            min="0"
                                                            max="100"
                                                            value={item.discount}
                                                            onChange={(e) => updateItem(index, { discount: Number(e.target.value || 0) })}
                                                            className="border border-zinc-300 h-9 text-center text-sm rounded-none"
                                                        />
                                                    </div>
                                                    <div className="space-y-1">
                                                        <Label className="text-[9px] font-black uppercase tracking-widest text-zinc-400">PPN %</Label>
                                                        <Input
                                                            type="number"
                                                            min="0"
                                                            max="100"
                                                            value={item.taxRate}
                                                            onChange={(e) => updateItem(index, { taxRate: Number(e.target.value || 0) })}
                                                            className="border border-zinc-300 h-9 text-center text-sm rounded-none"
                                                        />
                                                    </div>
                                                    <div className="space-y-1">
                                                        <Label className="text-[9px] font-black uppercase tracking-widest text-zinc-400">Total</Label>
                                                        <div className="h-9 bg-amber-50 border-2 border-amber-300 flex items-center justify-end px-2 font-black text-xs font-mono text-amber-900">
                                                            {formatCurrency(lineTotal)}
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        )
                                    })}
                                </div>
                            )}
                        </div>

                        {/* Notes */}
                        <div className="space-y-1.5">
                            <Label className={NB.label}>Catatan (Opsional)</Label>
                            <Textarea
                                value={notes}
                                onChange={(e) => setNotes(e.target.value)}
                                placeholder="Catatan untuk pesanan ini..."
                                className={NB.textarea}
                                rows={2}
                            />
                        </div>

                        {/* Totals */}
                        <div className="border-2 border-black bg-zinc-50 p-4">
                            <div className="space-y-2">
                                <div className="flex justify-between text-sm">
                                    <span className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Subtotal</span>
                                    <span className="font-mono font-bold">{formatCurrency(totals.subtotal)}</span>
                                </div>
                                {totals.discount > 0 && (
                                    <div className="flex justify-between text-sm">
                                        <span className="text-[10px] font-black uppercase tracking-widest text-red-500">Diskon</span>
                                        <span className="font-mono font-bold text-red-600">- {formatCurrency(totals.discount)}</span>
                                    </div>
                                )}
                                <div className="flex justify-between text-sm">
                                    <span className="text-[10px] font-black uppercase tracking-widest text-zinc-500">PPN</span>
                                    <span className="font-mono font-bold">{formatCurrency(totals.tax)}</span>
                                </div>
                                <div className="border-t-2 border-black pt-2 flex justify-between items-center">
                                    <span className="text-sm font-black uppercase tracking-widest">Grand Total</span>
                                    <span className="text-xl font-black font-mono text-amber-700">
                                        {formatCurrency(totals.total)}
                                    </span>
                                </div>
                            </div>
                        </div>
                    </div>
                </ScrollArea>

                {/* Footer */}
                <div className="px-5 py-4 border-t-2 border-black bg-zinc-50 flex items-center justify-end gap-3">
                    <Button
                        type="button"
                        onClick={() => onOpenChange(false)}
                        className={NB.cancelBtn}
                    >
                        Batal
                    </Button>
                    <Button
                        onClick={onSubmit}
                        disabled={submitting || loading}
                        className={NB.submitBtn}
                    >
                        {submitting ? (
                            <>
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Menyimpan...
                            </>
                        ) : (
                            <>
                                <Save className="mr-2 h-4 w-4" /> Buat Sales Order
                            </>
                        )}
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    )
}
