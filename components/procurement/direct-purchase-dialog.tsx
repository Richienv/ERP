"use client"

import { useState, useCallback } from "react"
import { ShoppingCart, Plus, Trash2, Loader2, Package, Warehouse } from "lucide-react"
import { useQueryClient } from "@tanstack/react-query"
import { Button } from "@/components/ui/button"
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
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { ScrollArea } from "@/components/ui/scroll-area"
import { toast } from "sonner"
import { NB } from "@/lib/dialog-styles"
import { queryKeys } from "@/lib/query-keys"
import { createDirectPurchase } from "@/lib/actions/procurement"
import { formatIDR } from "@/lib/utils"

interface Vendor {
    id: string
    name: string
    code: string
}

interface Product {
    id: string
    name: string
    code: string
    unit?: string
    price?: number
}

interface WarehouseOption {
    id: string
    name: string
    code: string
}

interface LineItem {
    key: string
    productId: string
    productName: string
    quantity: number
    unitPrice: number
}

interface Props {
    vendors: Vendor[]
    products: Product[]
    warehouses: WarehouseOption[]
    trigger?: React.ReactNode
}

export function DirectPurchaseDialog({ vendors, products, warehouses, trigger }: Props) {
    const [open, setOpen] = useState(false)
    const [saving, setSaving] = useState(false)
    const queryClient = useQueryClient()

    // Form state
    const [supplierId, setSupplierId] = useState("")
    const [warehouseId, setWarehouseId] = useState("")
    const [notes, setNotes] = useState("")
    const [items, setItems] = useState<LineItem[]>([
        { key: crypto.randomUUID(), productId: "", productName: "", quantity: 1, unitPrice: 0 },
    ])

    const resetForm = useCallback(() => {
        setSupplierId("")
        setWarehouseId("")
        setNotes("")
        setItems([{ key: crypto.randomUUID(), productId: "", productName: "", quantity: 1, unitPrice: 0 }])
    }, [])

    const addItem = () => {
        setItems(prev => [
            ...prev,
            { key: crypto.randomUUID(), productId: "", productName: "", quantity: 1, unitPrice: 0 },
        ])
    }

    const removeItem = (key: string) => {
        if (items.length <= 1) return
        setItems(prev => prev.filter(i => i.key !== key))
    }

    const updateItem = (key: string, field: keyof LineItem, value: string | number) => {
        setItems(prev => prev.map(item => {
            if (item.key !== key) return item
            if (field === "productId") {
                const product = products.find(p => p.id === value)
                return {
                    ...item,
                    productId: value as string,
                    productName: product?.name || "",
                    unitPrice: item.unitPrice || product?.price || 0,
                }
            }
            return { ...item, [field]: value }
        }))
    }

    const subtotal = items.reduce((sum, i) => sum + (i.quantity * i.unitPrice), 0)
    const taxAmount = Math.round(subtotal * 0.11)
    const total = subtotal + taxAmount

    const handleSubmit = async () => {
        if (!supplierId) { toast.error("Pilih vendor terlebih dahulu"); return }
        if (!warehouseId) { toast.error("Pilih gudang tujuan"); return }

        const validItems = items.filter(i => i.productId && i.quantity > 0 && i.unitPrice > 0)
        if (validItems.length === 0) {
            toast.error("Tambahkan minimal 1 item dengan produk, kuantitas, dan harga")
            return
        }

        setSaving(true)
        try {
            const result = await createDirectPurchase({
                supplierId,
                warehouseId,
                notes: notes || undefined,
                items: validItems.map(i => ({
                    productId: i.productId,
                    quantity: i.quantity,
                    unitPrice: i.unitPrice,
                })),
            })

            if (!result.success) {
                toast.error(result.error || "Gagal membuat pembelian langsung")
                return
            }

            // Show success with details
            const r = result as { success: true; poNumber: string; grnNumber: string; billNumber: string; glWarning?: string }
            const msg = `Pembelian langsung berhasil!\nPO: ${r.poNumber}\nGRN: ${r.grnNumber}\nBill: ${r.billNumber}`
            if (r.glWarning) {
                toast.warning(msg + `\n\n${r.glWarning}`)
            } else {
                toast.success(msg)
            }

            // Invalidate all affected caches
            await Promise.all([
                queryClient.invalidateQueries({ queryKey: queryKeys.procurementDashboard.all }),
                queryClient.invalidateQueries({ queryKey: queryKeys.purchaseOrders.all }),
                queryClient.invalidateQueries({ queryKey: queryKeys.receiving.all }),
                queryClient.invalidateQueries({ queryKey: queryKeys.invoices.all }),
                queryClient.invalidateQueries({ queryKey: queryKeys.bills.all }),
                queryClient.invalidateQueries({ queryKey: queryKeys.products.all }),
                queryClient.invalidateQueries({ queryKey: queryKeys.inventoryDashboard.all }),
                queryClient.invalidateQueries({ queryKey: queryKeys.stockMovements.all }),
                queryClient.invalidateQueries({ queryKey: queryKeys.journal.all }),
                queryClient.invalidateQueries({ queryKey: queryKeys.financeDashboard.all }),
            ])

            resetForm()
            setOpen(false)
        } catch (err: any) {
            toast.error(err.message || "Terjadi kesalahan")
        } finally {
            setSaving(false)
        }
    }

    return (
        <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) resetForm() }}>
            <DialogTrigger asChild>
                {trigger || (
                    <Button className="bg-emerald-500 text-white hover:bg-emerald-600 border-2 border-emerald-600 font-black uppercase text-[10px] tracking-wide h-10 px-5 shadow-[3px_3px_0px_0px_rgba(0,0,0,0.2)] active:shadow-none active:translate-y-[1px] transition-all">
                        <ShoppingCart className="h-3.5 w-3.5 mr-1.5" /> Pembelian Langsung
                    </Button>
                )}
            </DialogTrigger>

            <DialogContent className={NB.contentWide}>
                <DialogHeader className={NB.header}>
                    <DialogTitle className={NB.title}>
                        <ShoppingCart className="h-5 w-5" />
                        Pembelian Langsung
                    </DialogTitle>
                    <p className={NB.subtitle}>
                        Buat PO + Penerimaan + Tagihan sekaligus — untuk pembelian langsung / walk-in
                    </p>
                </DialogHeader>

                <ScrollArea className={NB.scroll}>
                    <div className="p-6 space-y-5">

                        {/* Vendor & Warehouse */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label className={NB.label}>
                                    Vendor <span className={NB.labelRequired}>*</span>
                                </label>
                                <Select value={supplierId} onValueChange={setSupplierId}>
                                    <SelectTrigger className={NB.select}>
                                        <SelectValue placeholder="Pilih vendor..." />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {vendors.map(v => (
                                            <SelectItem key={v.id} value={v.id}>
                                                {v.code ? `[${v.code}] ` : ""}{v.name}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>

                            <div>
                                <label className={NB.label}>
                                    <Warehouse className="inline h-3 w-3 mr-1" />
                                    Gudang Tujuan <span className={NB.labelRequired}>*</span>
                                </label>
                                <Select value={warehouseId} onValueChange={setWarehouseId}>
                                    <SelectTrigger className={NB.select}>
                                        <SelectValue placeholder="Pilih gudang..." />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {warehouses.map(w => (
                                            <SelectItem key={w.id} value={w.id}>
                                                {w.code ? `[${w.code}] ` : ""}{w.name}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>

                        {/* Items Table */}
                        <div className={NB.section}>
                            <div className={NB.sectionHead}>
                                <Package className="h-3.5 w-3.5" />
                                <span className={NB.sectionTitle}>Item Pembelian</span>
                                <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    onClick={addItem}
                                    className="ml-auto border-2 border-black font-black uppercase text-[9px] tracking-wider h-7 px-3 rounded-none"
                                >
                                    <Plus className="h-3 w-3 mr-1" /> Tambah
                                </Button>
                            </div>

                            <div className={NB.tableWrap}>
                                <table className="w-full">
                                    <thead className={NB.tableHead}>
                                        <tr>
                                            <th className={`${NB.tableHeadCell} w-[40%]`}>Produk</th>
                                            <th className={`${NB.tableHeadCell} w-[15%] text-right`}>Qty</th>
                                            <th className={`${NB.tableHeadCell} w-[20%] text-right`}>Harga Satuan</th>
                                            <th className={`${NB.tableHeadCell} w-[20%] text-right`}>Subtotal</th>
                                            <th className={`${NB.tableHeadCell} w-[5%]`}></th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {items.map((item) => (
                                            <tr key={item.key} className={NB.tableRow}>
                                                <td className={NB.tableCell}>
                                                    <Select
                                                        value={item.productId}
                                                        onValueChange={(v) => updateItem(item.key, "productId", v)}
                                                    >
                                                        <SelectTrigger className="border-2 border-zinc-300 h-8 text-xs font-bold rounded-none">
                                                            <SelectValue placeholder="Pilih produk..." />
                                                        </SelectTrigger>
                                                        <SelectContent>
                                                            {products.map(p => (
                                                                <SelectItem key={p.id} value={p.id}>
                                                                    {p.code ? `[${p.code}] ` : ""}{p.name}
                                                                </SelectItem>
                                                            ))}
                                                        </SelectContent>
                                                    </Select>
                                                </td>
                                                <td className={NB.tableCell}>
                                                    <Input
                                                        type="number"
                                                        min={1}
                                                        value={item.quantity}
                                                        onChange={(e) => updateItem(item.key, "quantity", parseInt(e.target.value) || 0)}
                                                        className="border-2 border-zinc-300 h-8 text-xs font-bold text-right rounded-none w-full"
                                                    />
                                                </td>
                                                <td className={NB.tableCell}>
                                                    <Input
                                                        type="number"
                                                        min={0}
                                                        value={item.unitPrice}
                                                        onChange={(e) => updateItem(item.key, "unitPrice", parseFloat(e.target.value) || 0)}
                                                        className="border-2 border-zinc-300 h-8 text-xs font-bold text-right rounded-none w-full"
                                                    />
                                                </td>
                                                <td className={`${NB.tableCell} text-right font-mono text-xs font-bold`}>
                                                    {formatIDR(item.quantity * item.unitPrice)}
                                                </td>
                                                <td className={NB.tableCell}>
                                                    <Button
                                                        type="button"
                                                        variant="ghost"
                                                        size="icon"
                                                        onClick={() => removeItem(item.key)}
                                                        disabled={items.length <= 1}
                                                        className="h-7 w-7 text-red-500 hover:text-red-700 hover:bg-red-50"
                                                    >
                                                        <Trash2 className="h-3.5 w-3.5" />
                                                    </Button>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>

                            {/* Totals */}
                            <div className="bg-zinc-50 px-4 py-3 border-t-2 border-black space-y-1">
                                <div className="flex justify-between text-xs font-bold text-zinc-500">
                                    <span>Subtotal</span>
                                    <span className="font-mono">{formatIDR(subtotal)}</span>
                                </div>
                                <div className="flex justify-between text-xs font-bold text-zinc-500">
                                    <span>PPN 11%</span>
                                    <span className="font-mono">{formatIDR(taxAmount)}</span>
                                </div>
                                <div className="flex justify-between text-sm font-black text-zinc-900 pt-1 border-t border-zinc-300">
                                    <span>TOTAL</span>
                                    <span className="font-mono">{formatIDR(total)}</span>
                                </div>
                            </div>
                        </div>

                        {/* Notes */}
                        <div>
                            <label className={NB.label}>Catatan</label>
                            <Textarea
                                value={notes}
                                onChange={(e) => setNotes(e.target.value)}
                                placeholder="Opsional..."
                                className={NB.textarea}
                                rows={2}
                            />
                        </div>

                        {/* Info box */}
                        <div className="border-2 border-emerald-300 bg-emerald-50 p-3 text-xs text-emerald-800 font-medium space-y-1">
                            <p className="font-black uppercase text-[10px] tracking-wider mb-1">Yang akan dibuat otomatis:</p>
                            <ul className="list-disc list-inside space-y-0.5">
                                <li>Purchase Order (status: <span className="font-bold">COMPLETED</span>)</li>
                                <li>Surat Jalan Masuk / GRN (status: <span className="font-bold">ACCEPTED</span>)</li>
                                <li>Tagihan Vendor / Bill (status: <span className="font-bold">DRAFT</span>)</li>
                                <li>Stok gudang langsung bertambah</li>
                                <li>Jurnal: DR Persediaan, CR Hutang Usaha</li>
                            </ul>
                        </div>

                        {/* Actions */}
                        <div className={NB.footer}>
                            <Button
                                type="button"
                                variant="outline"
                                onClick={() => setOpen(false)}
                                className={NB.cancelBtn}
                                disabled={saving}
                            >
                                Batal
                            </Button>
                            <Button
                                type="button"
                                onClick={handleSubmit}
                                className={NB.submitBtn}
                                disabled={saving || !supplierId || !warehouseId || items.every(i => !i.productId)}
                            >
                                {saving ? (
                                    <><Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> Memproses...</>
                                ) : (
                                    <><ShoppingCart className="h-3.5 w-3.5 mr-1.5" /> Simpan Pembelian</>
                                )}
                            </Button>
                        </div>
                    </div>
                </ScrollArea>
            </DialogContent>
        </Dialog>
    )
}
