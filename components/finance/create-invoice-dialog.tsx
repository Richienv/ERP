"use client"

import { useEffect, useState } from "react"
import { FileText, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
import { toast } from "sonner"
import { formatIDR } from "@/lib/utils"
import {
    getInvoiceCustomers,
    createCustomerInvoice,
    getPendingSalesOrders,
    getPendingPurchaseOrders,
    createInvoiceFromSalesOrder,
    createBillFromPOId,
} from "@/lib/actions/finance"
import { useRouter } from "next/navigation"

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
    const router = useRouter()
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
                router.refresh()
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
            <DialogContent className="max-w-md border-2 border-black shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] p-0 overflow-hidden bg-white">
                <DialogHeader className="p-6 pb-2 border-b border-black/10 bg-zinc-50">
                    <DialogTitle className="text-2xl font-black uppercase flex items-center gap-2">
                        <FileText className="h-6 w-6" /> Buat Invoice
                    </DialogTitle>
                    <DialogDescription className="font-medium text-black/60">
                        Buat invoice/bill baru dari order atau manual.
                    </DialogDescription>
                </DialogHeader>

                <div className="p-6 space-y-4">
                    {/* Source Type Toggle */}
                    <div className="flex p-1 bg-zinc-100 rounded-lg border border-black/10">
                        {(['SO', 'PO', 'MANUAL'] as const).map((type) => (
                            <button
                                key={type}
                                onClick={() => { setSourceType(type); setSelectedOrderId("") }}
                                className={`flex-1 py-1.5 text-[10px] font-black uppercase tracking-wider rounded-md transition-all ${sourceType === type ? 'bg-black text-white shadow-sm' : 'text-zinc-500 hover:text-black'}`}
                            >
                                {type === 'SO' ? 'Sales Order' : type === 'PO' ? 'Purchase Order' : 'Manual'}
                            </button>
                        ))}
                    </div>

                    {sourceType !== 'MANUAL' ? (
                        <div className="space-y-2">
                            <Label className="uppercase font-bold text-xs">Pilih {sourceType === 'SO' ? 'Sales Order' : 'Purchase Order'}</Label>
                            <Select value={selectedOrderId} onValueChange={setSelectedOrderId}>
                                <SelectTrigger className="border-black font-medium h-10 shadow-sm">
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
                    ) : (
                        <div className="space-y-4">
                            <div className="flex gap-4">
                                <div className="flex items-center space-x-2">
                                    <input type="radio" id="inv-type-cust" checked={manualType === 'CUSTOMER'} onChange={() => setManualType('CUSTOMER')} className="accent-black" />
                                    <Label htmlFor="inv-type-cust">Customer Invoice</Label>
                                </div>
                                <div className="flex items-center space-x-2">
                                    <input type="radio" id="inv-type-supp" checked={manualType === 'SUPPLIER'} onChange={() => setManualType('SUPPLIER')} className="accent-black" />
                                    <Label htmlFor="inv-type-supp">Vendor Bill</Label>
                                </div>
                            </div>

                            <div className="space-y-2">
                                <Label className="uppercase font-bold text-xs">{manualType === 'CUSTOMER' ? 'Customer' : 'Vendor'}</Label>
                                <Select value={selectedCustomer} onValueChange={setSelectedCustomer}>
                                    <SelectTrigger className="border-black font-medium h-10 shadow-sm">
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

                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label className="uppercase font-bold text-xs">Tanggal Terbit</Label>
                                    <Input type="date" className="border-black font-medium h-10 shadow-sm" value={issueDate} onChange={(e) => setIssueDate(e.target.value)} />
                                </div>
                                <div className="space-y-2">
                                    <Label className="uppercase font-bold text-xs">Jatuh Tempo</Label>
                                    <Input type="date" className="border-black font-medium h-10 shadow-sm" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
                                </div>
                            </div>

                            <div className="space-y-2">
                                <Label className="uppercase font-bold text-xs">Deskripsi / Produk</Label>
                                <Input className="border-black font-medium h-10 shadow-sm" placeholder="e.g. Jasa Konsultasi" value={manualProduct} onChange={(e) => setManualProduct(e.target.value)} />
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label className="uppercase font-bold text-xs">Jumlah</Label>
                                    <Input type="number" className="border-black font-medium h-10 shadow-sm" value={manualQty} onChange={(e) => setManualQty(Math.max(1, Number(e.target.value) || 1))} />
                                </div>
                                <div className="space-y-2">
                                    <Label className="uppercase font-bold text-xs">Harga Satuan</Label>
                                    <div className="relative">
                                        <span className="absolute left-3 top-1/2 -translate-y-1/2 font-bold text-muted-foreground">Rp</span>
                                        <Input className="pl-9 border-black font-black h-10 shadow-sm" placeholder="0" type="number" value={manualPrice} onChange={(e) => setManualPrice(e.target.value)} />
                                    </div>
                                </div>
                            </div>

                            <div className="p-2 bg-zinc-100 rounded text-right font-mono font-bold">
                                Total: {formatIDR((parseFloat(manualPrice) || 0) * manualQty)}
                            </div>
                        </div>
                    )}
                </div>

                <DialogFooter className="p-6 pt-2 border-t border-black/10 bg-zinc-50 flex gap-2">
                    <Button variant="outline" className="border-black uppercase font-bold" onClick={() => { resetForm(); onOpenChange(false) }}>Batal</Button>
                    <Button
                        className="bg-black text-white hover:bg-zinc-800 border-black uppercase font-bold shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] active:shadow-none active:translate-y-[2px] transition-all"
                        onClick={handleCreate}
                        disabled={creating || (sourceType !== 'MANUAL' && !selectedOrderId) || (sourceType === 'MANUAL' && (!selectedCustomer || !manualPrice || manualQty <= 0))}
                    >
                        {creating ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Membuat...</> : "Buat Invoice"}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}
