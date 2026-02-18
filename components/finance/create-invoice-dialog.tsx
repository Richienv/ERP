"use client"

import { useEffect, useState } from "react"
import { FileText, Loader2, Receipt, CreditCard, CalendarDays } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
import { ScrollArea } from "@/components/ui/scroll-area"
import { toast } from "sonner"
import { useQueryClient } from "@tanstack/react-query"
import { queryKeys } from "@/lib/query-keys"
import { formatIDR } from "@/lib/utils"
import {
    getInvoiceCustomers,
    createCustomerInvoice,
    getPendingSalesOrders,
    getPendingPurchaseOrders,
    createInvoiceFromSalesOrder,
    createBillFromPOId,
} from "@/lib/actions/finance"
import { NB } from "@/lib/dialog-styles"

interface CreateInvoiceDialogProps {
    open: boolean
    onOpenChange: (open: boolean) => void
}

const parseDateInput = (value: string) => {
    if (!value) return undefined
    const parts = value.split("-").map(Number)
    if (parts.length !== 3 || parts.some((part) => Number.isNaN(part))) return undefined
    const [year, month, day] = parts
    return new Date(year, month - 1, day, 12, 0, 0, 0)
}

export function CreateInvoiceDialog({ open, onOpenChange }: CreateInvoiceDialogProps) {
    const queryClient = useQueryClient()
    const [customers, setCustomers] = useState<Array<{ id: string; name: string; type?: string }>>([])
    const [pendingOrders, setPendingOrders] = useState<any[]>([])
    const [loading, setLoading] = useState(false)
    const [creating, setCreating] = useState(false)

    const [sourceType, setSourceType] = useState<'SO' | 'PO' | 'MANUAL'>('MANUAL')
    const [selectedOrderId, setSelectedOrderId] = useState("")
    const [selectedCustomer, setSelectedCustomer] = useState("")
    const [manualType, setManualType] = useState<'CUSTOMER' | 'SUPPLIER'>('CUSTOMER')
    const [manualProduct, setManualProduct] = useState("")
    const [manualQty, setManualQty] = useState(1)
    const [manualPrice, setManualPrice] = useState("")
    const [issueDate, setIssueDate] = useState(new Date().toISOString().split('T')[0])
    const [dueDate, setDueDate] = useState("")

    useEffect(() => {
        if (!open) return
        let active = true
        const loadData = async () => {
            setLoading(true)
            try {
                const customerList = await getInvoiceCustomers()
                if (active) setCustomers(customerList)
            } catch {
                console.error("Failed to load customers")
            } finally {
                if (active) setLoading(false)
            }
        }
        loadData()
        return () => { active = false }
    }, [open])

    useEffect(() => {
        if (!open || sourceType === 'MANUAL') return
        let active = true
        const loadOrders = async () => {
            setLoading(true)
            try {
                const data = sourceType === 'SO'
                    ? await getPendingSalesOrders()
                    : await getPendingPurchaseOrders()
                if (active) setPendingOrders(data)
            } catch {
                toast.error("Gagal memuat data pesanan")
            } finally {
                if (active) setLoading(false)
            }
        }
        loadOrders()
        return () => { active = false }
    }, [open, sourceType])

    const resetForm = () => {
        setSourceType('MANUAL')
        setSelectedOrderId("")
        setSelectedCustomer("")
        setManualProduct("")
        setManualQty(1)
        setManualPrice("")
        setDueDate("")
        setIssueDate(new Date().toISOString().split('T')[0])
    }

    const handleCreate = async () => {
        if (sourceType !== 'MANUAL' && !selectedOrderId) return
        if (sourceType === 'MANUAL' && (!selectedCustomer || !manualPrice || manualQty <= 0)) return

        setCreating(true)
        try {
            let result: any
            if (sourceType === 'SO') {
                result = await createInvoiceFromSalesOrder(selectedOrderId)
            } else if (sourceType === 'PO') {
                result = await createBillFromPOId(selectedOrderId)
            } else {
                result = await createCustomerInvoice({
                    customerId: selectedCustomer,
                    amount: parseFloat(manualPrice) * manualQty,
                    issueDate: parseDateInput(issueDate),
                    dueDate: parseDateInput(dueDate),
                    items: [{
                        description: manualProduct || 'Manual Item',
                        quantity: manualQty,
                        unitPrice: parseFloat(manualPrice) || 0
                    }],
                    type: manualType
                })
            }

            if (result.success) {
                toast.success("Dokumen berhasil dibuat")
                resetForm()
                onOpenChange(false)
                queryClient.invalidateQueries({ queryKey: queryKeys.invoices.all })
            } else {
                toast.error(('error' in result ? result.error : "Gagal membuat invoice") || "Gagal membuat invoice")
            }
        } catch {
            toast.error("Terjadi kesalahan")
        } finally {
            setCreating(false)
        }
    }

    return (
        <Dialog open={open} onOpenChange={(v) => { if (!v) resetForm(); onOpenChange(v) }}>
            <DialogContent className={NB.contentNarrow}>
                <DialogHeader className={NB.header}>
                    <DialogTitle className={NB.title}>
                        <FileText className="h-5 w-5" /> Buat Invoice
                    </DialogTitle>
                    <p className={NB.subtitle}>Buat invoice/bill baru dari order atau manual</p>
                </DialogHeader>

                <ScrollArea className={NB.scroll}>
                    <div className="p-5 space-y-4">
                        {/* Source Type Toggle */}
                        <div className={NB.section}>
                            <div className={`${NB.sectionHead} border-l-4 border-l-orange-400 bg-orange-50`}>
                                <Receipt className="h-4 w-4" />
                                <span className={NB.sectionTitle}>Sumber Invoice</span>
                            </div>
                            <div className={NB.sectionBody}>
                                <div className="flex border-2 border-black overflow-hidden">
                                    {(['SO', 'PO', 'MANUAL'] as const).map((type) => (
                                        <button
                                            key={type}
                                            onClick={() => { setSourceType(type); setSelectedOrderId("") }}
                                            className={`flex-1 py-2 text-[10px] font-black uppercase tracking-wider transition-all ${sourceType === type ? 'bg-black text-white' : 'bg-white text-zinc-500 hover:bg-zinc-100'}`}
                                        >
                                            {type === 'SO' ? 'Sales Order' : type === 'PO' ? 'Purchase Order' : 'Manual'}
                                        </button>
                                    ))}
                                </div>

                                {sourceType !== 'MANUAL' ? (
                                    <div>
                                        <label className={NB.label}>Pilih {sourceType === 'SO' ? 'Sales Order' : 'Purchase Order'} <span className={NB.labelRequired}>*</span></label>
                                        <Select value={selectedOrderId} onValueChange={setSelectedOrderId}>
                                            <SelectTrigger className={NB.select}>
                                                <SelectValue placeholder={`Pilih ${sourceType === 'SO' ? 'Order' : 'PO'}`} />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {pendingOrders.length === 0 ? (
                                                    <div className="p-2 text-xs text-center italic text-muted-foreground">
                                                        {loading ? "Memuat..." : `Tidak ada ${sourceType === 'SO' ? 'order' : 'PO'} pending`}
                                                    </div>
                                                ) : pendingOrders.map((order) => (
                                                    <SelectItem key={order.id} value={order.id}>
                                                        {order.number} - {order.customerName || order.vendorName} ({formatIDR(order.amount)})
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                ) : null}
                            </div>
                        </div>

                        {/* Manual Invoice Form */}
                        {sourceType === 'MANUAL' && (
                            <>
                                <div className={NB.section}>
                                    <div className={`${NB.sectionHead} border-l-4 border-l-orange-400 bg-orange-50`}>
                                        <CreditCard className="h-4 w-4" />
                                        <span className={NB.sectionTitle}>Detail Invoice</span>
                                    </div>
                                    <div className={NB.sectionBody}>
                                        {/* Invoice Type Radio */}
                                        <div className="flex gap-4">
                                            <div className="flex items-center space-x-2">
                                                <input type="radio" id="inv-type-cust" checked={manualType === 'CUSTOMER'} onChange={() => setManualType('CUSTOMER')} className="accent-black" />
                                                <label htmlFor="inv-type-cust" className={NB.label + " !mb-0"}>Customer Invoice</label>
                                            </div>
                                            <div className="flex items-center space-x-2">
                                                <input type="radio" id="inv-type-supp" checked={manualType === 'SUPPLIER'} onChange={() => setManualType('SUPPLIER')} className="accent-black" />
                                                <label htmlFor="inv-type-supp" className={NB.label + " !mb-0"}>Vendor Bill</label>
                                            </div>
                                        </div>

                                        {/* Customer/Vendor Select */}
                                        <div>
                                            <label className={NB.label}>{manualType === 'CUSTOMER' ? 'Customer' : 'Vendor'} <span className={NB.labelRequired}>*</span></label>
                                            <Select value={selectedCustomer} onValueChange={setSelectedCustomer}>
                                                <SelectTrigger className={NB.select}>
                                                    <SelectValue placeholder="Pilih pihak" />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    {customers.filter(c => (c as any).type === manualType).length === 0 ? (
                                                        <SelectItem value="empty" disabled>
                                                            {loading ? "Memuat..." : `Tidak ada ${manualType.toLowerCase()} aktif`}
                                                        </SelectItem>
                                                    ) : customers.filter(c => (c as any).type === manualType).map((customer) => (
                                                        <SelectItem key={customer.id} value={customer.id}>
                                                            {customer.name}
                                                        </SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                        </div>

                                        {/* Product Description */}
                                        <div>
                                            <label className={NB.label}>Deskripsi / Produk</label>
                                            <Input className={NB.input} placeholder="e.g. Jasa Konsultasi" value={manualProduct} onChange={(e) => setManualProduct(e.target.value)} />
                                        </div>

                                        {/* Qty + Price */}
                                        <div className="grid grid-cols-2 gap-4">
                                            <div>
                                                <label className={NB.label}>Jumlah <span className={NB.labelRequired}>*</span></label>
                                                <Input type="number" className={NB.inputMono} value={manualQty} onChange={(e) => setManualQty(Math.max(1, Number(e.target.value) || 1))} />
                                            </div>
                                            <div>
                                                <label className={NB.label}>Harga Satuan <span className={NB.labelRequired}>*</span></label>
                                                <div className="relative">
                                                    <span className="absolute left-3 top-1/2 -translate-y-1/2 font-black text-[10px] text-zinc-400">Rp</span>
                                                    <Input className={`${NB.inputMono} pl-9`} placeholder="0" type="number" value={manualPrice} onChange={(e) => setManualPrice(e.target.value)} />
                                                </div>
                                            </div>
                                        </div>

                                        {/* Total Preview */}
                                        <div className="border-2 border-black bg-zinc-100 px-4 py-2 flex justify-between items-center">
                                            <span className={NB.label + " !mb-0"}>Total</span>
                                            <span className="font-mono font-black text-lg">{formatIDR((parseFloat(manualPrice) || 0) * manualQty)}</span>
                                        </div>
                                    </div>
                                </div>

                                {/* Dates */}
                                <div className={NB.section}>
                                    <div className={`${NB.sectionHead} border-l-4 border-l-orange-400 bg-orange-50`}>
                                        <CalendarDays className="h-4 w-4" />
                                        <span className={NB.sectionTitle}>Tanggal</span>
                                    </div>
                                    <div className={NB.sectionBody}>
                                        <div className="grid grid-cols-2 gap-4">
                                            <div>
                                                <label className={NB.label}>Tanggal Terbit</label>
                                                <Input type="date" className={NB.input} value={issueDate} onChange={(e) => setIssueDate(e.target.value)} />
                                            </div>
                                            <div>
                                                <label className={NB.label}>Jatuh Tempo</label>
                                                <Input type="date" className={NB.input} value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </>
                        )}

                        {/* Footer */}
                        <div className={NB.footer}>
                            <Button variant="outline" className={NB.cancelBtn} onClick={() => { resetForm(); onOpenChange(false) }}>
                                Batal
                            </Button>
                            <Button
                                className={NB.submitBtn}
                                onClick={handleCreate}
                                disabled={creating || (sourceType !== 'MANUAL' && !selectedOrderId) || (sourceType === 'MANUAL' && (!selectedCustomer || !manualPrice || manualQty <= 0))}
                            >
                                {creating ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Membuat...</> : "Buat Invoice"}
                            </Button>
                        </div>
                    </div>
                </ScrollArea>
            </DialogContent>
        </Dialog>
    )
}
