"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import {
    AlertTriangle,
    ChevronLeft,
    ChevronRight,
    MoreVertical,
    CheckCircle2,
    FileText,
    Clock,
    Mail,
    Search
} from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import {
    Card,
    CardContent,
    CardFooter,
    CardHeader,
} from "@/components/ui/card"
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
import {
    getInvoiceKanbanData,
    getInvoiceCustomers,
    type InvoiceKanbanData,
    type InvoiceKanbanItem,
    createCustomerInvoice,
    getPendingSalesOrders,
    getPendingPurchaseOrders,
    createInvoiceFromSalesOrder,
    createBillFromPOId,
    moveInvoiceToSent,
    recordInvoicePayment,
} from "@/lib/actions/finance"

import { DndContext, useDraggable, useDroppable, type DragEndEvent } from "@dnd-kit/core"

import { formatIDR } from "@/lib/utils"
import { toast } from "sonner"

const emptyKanban: InvoiceKanbanData = { draft: [], sent: [], overdue: [], paid: [] }
const PAGE_SIZE = 8

type LaneKey = keyof InvoiceKanbanData

type DuplicateWarningState = {
    open: boolean
    sourceType: 'SO' | 'PO' | null
    orderId: string
    existingInvoiceNumber: string
    existingInvoiceStatus: string
}

const parseDateInput = (value: string) => {
    if (!value) return undefined
    const parts = value.split("-").map(Number)
    if (parts.length !== 3 || parts.some((part) => Number.isNaN(part))) return undefined
    const [year, month, day] = parts
    return new Date(year, month - 1, day, 12, 0, 0, 0)
}

export default function InvoicesKanbanPage() {
    const [invoices, setInvoices] = useState<InvoiceKanbanData>(emptyKanban)
    const [customers, setCustomers] = useState<Array<{ id: string; name: string; type?: 'CUSTOMER' | 'SUPPLIER' }>>([])
    const [, setLoading] = useState(true)
    const [, setLoadError] = useState<string | null>(null)
    const [isCreatorOpen, setIsCreatorOpen] = useState(false)

    // Invoice Form State
    const [selectedCustomer, setSelectedCustomer] = useState("")
    const [issueDate, setIssueDate] = useState(new Date().toISOString().split('T')[0])
    const [dueDate, setDueDate] = useState("")
    const [invoiceNotes, setInvoiceNotes] = useState("")
    const [creating, setCreating] = useState(false)

    const [sourceType, setSourceType] = useState<'SO' | 'PO' | 'MANUAL'>('MANUAL')
    const [pendingOrders, setPendingOrders] = useState<any[]>([])
    const [selectedOrderId, setSelectedOrderId] = useState("")

    // Manual Item State
    const [manualType, setManualType] = useState<'CUSTOMER' | 'SUPPLIER'>('CUSTOMER')
    const [manualProduct, setManualProduct] = useState("")
    const [manualCode, setManualCode] = useState("")
    const [manualQty, setManualQty] = useState(1)
    const [manualPrice, setManualPrice] = useState("")

    // DnD & Workflow State
    const [activeInvoice, setActiveInvoice] = useState<InvoiceKanbanItem | null>(null)
    const [isSendDialogOpen, setIsSendDialogOpen] = useState(false)
    const [isPayDialogOpen, setIsPayDialogOpen] = useState(false)

    // Send Form
    const [sendMethod, setSendMethod] = useState<'WHATSAPP' | 'EMAIL'>('WHATSAPP')
    const [sendMessage, setSendMessage] = useState("")
    const [recipientContact, setRecipientContact] = useState("")

    // Pay Form
    const [payMethod, setPayMethod] = useState<'TRANSFER' | 'CASH' | 'CHECK'>('TRANSFER')
    const [payDate, setPayDate] = useState(new Date().toISOString().split('T')[0])
    const [payReference, setPayReference] = useState("")
    const [payAmount, setPayAmount] = useState("")
    const [lanePage, setLanePage] = useState<Record<LaneKey, number>>({
        draft: 1,
        sent: 1,
        overdue: 1,
        paid: 1,
    })
    const [duplicateWarning, setDuplicateWarning] = useState<DuplicateWarningState>({
        open: false,
        sourceType: null,
        orderId: "",
        existingInvoiceNumber: "",
        existingInvoiceStatus: "",
    })
    const [searchText, setSearchText] = useState("")
    const [invoiceTypeFilter, setInvoiceTypeFilter] = useState<'ALL' | 'INV_OUT' | 'INV_IN'>('ALL')
    const router = useRouter()
    const pathname = usePathname()
    const searchParams = useSearchParams()

    const pushSearchParams = (mutator: (params: URLSearchParams) => void) => {
        const next = new URLSearchParams(searchParams.toString())
        mutator(next)
        const qs = next.toString()
        router.replace(qs ? `${pathname}?${qs}` : pathname)
    }

    const loadInvoiceKanban = useCallback(async () => {
        const q = (searchParams.get("q") || "").trim()
        const type = (searchParams.get("type") as 'ALL' | 'INV_OUT' | 'INV_IN' | null) || "ALL"
        setSearchText(q)
        setInvoiceTypeFilter(type)

        const [kanban, customerList] = await Promise.all([
            getInvoiceKanbanData({ q: q || null, type }),
            getInvoiceCustomers(),
        ])
        setInvoices(kanban)
        setCustomers(customerList)
    }, [searchParams])

    // Drag Handler
    const handleDragEnd = (event: DragEndEvent) => {
        const { active, over } = event
        if (!over) return

        const invoice = active.data.current as InvoiceKanbanItem
        const targetColumn = over.id as string

        // Draft -> Sent
        if (invoice.status === 'DRAFT' && targetColumn === 'sent') {
            setActiveInvoice(invoice)
            // Default message with Link
            setSendMessage(`Hi ${invoice.partyName}, here is invoice ${invoice.number} for ${formatIDR(invoice.amount)}. Please make payment by ${new Date(invoice.dueDate).toLocaleDateString()}. View Invoice: https://erp.orico.com/invoices/${invoice.id}`)
            setRecipientContact("") // Reset or set to customer phone if available
            setIsSendDialogOpen(true)
        }
        // Sent/Overdue -> Paid
        else if ((invoice.status === 'ISSUED' || invoice.status === 'OVERDUE' || invoice.status === 'PARTIAL') && targetColumn === 'paid') {
            setActiveInvoice(invoice)
            setPayAmount(String(invoice.amount))
            setIsPayDialogOpen(true)
        }
    }

    const handleConfirmSend = async () => {
        if (!activeInvoice) return

        // Validate WhatsApp Number
        if (sendMethod === 'WHATSAPP') {
            if (!recipientContact) {
                toast.error("Please enter a valid WhatsApp number.")
                return
            }
            // Trigger Redirection immediately to avoid popup blockers
            const phone = recipientContact.replace(/\D/g, '') // Remove non-digits
            const text = encodeURIComponent(sendMessage)
            window.open(`https://wa.me/${phone}?text=${text}`, '_blank')
        }

        setLoading(true)
        try {
            const result: any = await moveInvoiceToSent(activeInvoice.id, sendMessage, sendMethod)
            if (!result.success) {
                throw new Error(result.error || "Failed to send invoice")
            }
            toast.success(result.status === 'OVERDUE' ? "Invoice moved to Overdue (past due date)." : "Invoice sent and countdown started!")
            setIsSendDialogOpen(false)
            await loadInvoiceKanban()
        } catch {
            toast.error("Failed to process send")
        } finally {
            setLoading(false)
            setActiveInvoice(null)
        }
    }

    const handleConfirmPayment = async () => {
        if (!activeInvoice) return
        setLoading(true)
        try {
            const paymentResult: any = await recordInvoicePayment({
                invoiceId: activeInvoice.id,
                amount: parseFloat(payAmount),
                paymentMethod: payMethod,
                paymentDate: new Date(payDate),
                reference: payReference,
                notes: "Manual Payment from Kanban"
            })
            if (!paymentResult.success) {
                throw new Error(paymentResult.error || "Failed to record payment")
            }
            toast.success("Payment recorded successfully")
            setIsPayDialogOpen(false)
            // Reload
            await loadInvoiceKanban()
        } catch {
            toast.error("Failed to record payment")
        } finally {
            setLoading(false)
            setActiveInvoice(null)
        }
    }

    const loadOrders = async (type: 'SO' | 'PO') => {
        setLoading(true)
        try {
            if (type === 'SO') {
                const data = await getPendingSalesOrders()
                setPendingOrders(data)
            } else {
                const data = await getPendingPurchaseOrders()
                setPendingOrders(data)
            }
        } catch {
            toast.error("Failed to load pending orders")
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        if (isCreatorOpen && sourceType !== 'MANUAL') {
            loadOrders(sourceType as any)
        }
    }, [isCreatorOpen, sourceType])

    const handleCreateInvoice = async (forceDuplicate = false) => {
        if (sourceType !== 'MANUAL' && !selectedOrderId) return
        if (sourceType === 'MANUAL' && (!selectedCustomer || !manualPrice || manualQty <= 0)) return

        setCreating(true)
        try {
            let result: any
            if (sourceType === 'SO') {
                result = await createInvoiceFromSalesOrder(selectedOrderId, { forceCreate: forceDuplicate })
            } else if (sourceType === 'PO') {
                result = await createBillFromPOId(selectedOrderId, { forceCreate: forceDuplicate })
            } else {
                result = await createCustomerInvoice({
                    customerId: selectedCustomer,
                    amount: parseFloat(manualPrice) * manualQty,
                    issueDate: parseDateInput(issueDate),
                    dueDate: parseDateInput(dueDate),
                    items: [{
                        description: manualProduct || invoiceNotes || 'Manual Item',
                        productCode: manualCode,
                        quantity: manualQty,
                        unitPrice: parseFloat(manualPrice) || 0
                    }],
                    type: manualType
                })
            }

            if (!result.success && result.requiresConfirmation && !forceDuplicate && sourceType !== 'MANUAL') {
                setDuplicateWarning({
                    open: true,
                    sourceType,
                    orderId: selectedOrderId,
                    existingInvoiceNumber: result.existingInvoiceNumber || "-",
                    existingInvoiceStatus: result.existingInvoiceStatus || "UNKNOWN",
                })
                return
            }

            if (result.success) {
                setDuplicateWarning({
                    open: false,
                    sourceType: null,
                    orderId: "",
                    existingInvoiceNumber: "",
                    existingInvoiceStatus: "",
                })
                toast.success(result.alreadyExists ? `Using existing document ${result.billNumber || result.invoiceNumber}` : "Document created successfully")
                setIsCreatorOpen(false)
                // Reset form
                setSelectedOrderId("")
                setSelectedCustomer("")
                setInvoiceNotes("")
                setManualProduct("")
                setManualCode("")
                setManualQty(1)
                setManualPrice("")
                setDueDate("")
                if (sourceType !== 'MANUAL') {
                    await loadOrders(sourceType as 'SO' | 'PO')
                }
                // Reload data
                await loadInvoiceKanban()
                router.refresh()
            } else {
                toast.error(('error' in result ? result.error : "Failed to create invoice") || "Failed to create invoice")
            }
        } catch {
            toast.error("An error occurred")
        } finally {
            setCreating(false)
        }
    }


    useEffect(() => {
        let active = true
        async function load() {
            setLoading(true)
            setLoadError(null)
            try {
                if (!active) return
                await loadInvoiceKanban()
            } catch (error) {
                if (!active) return
                setLoadError(error instanceof Error ? error.message : "Failed to load invoices")
            } finally {
                if (active) setLoading(false)
            }
        }
        load()
        return () => {
            active = false
        }
    }, [loadInvoiceKanban])

    useEffect(() => {
        const refreshFromServer = () => {
            if (document.visibilityState === "visible") {
                void loadInvoiceKanban()
            }
        }

        const intervalId = window.setInterval(refreshFromServer, 15000)
        window.addEventListener("focus", refreshFromServer)
        document.addEventListener("visibilitychange", refreshFromServer)

        return () => {
            window.clearInterval(intervalId)
            window.removeEventListener("focus", refreshFromServer)
            document.removeEventListener("visibilitychange", refreshFromServer)
        }
    }, [loadInvoiceKanban])

    const laneItems = useMemo<Record<LaneKey, InvoiceKanbanItem[]>>(() => ({
        draft: invoices.draft,
        sent: invoices.sent,
        overdue: invoices.overdue,
        paid: invoices.paid,
    }), [invoices])

    useEffect(() => {
        setLanePage((prev) => {
            const next = { ...prev }
            ;(['draft', 'sent', 'overdue', 'paid'] as LaneKey[]).forEach((lane) => {
                const totalPages = Math.max(1, Math.ceil((laneItems[lane]?.length || 0) / PAGE_SIZE))
                next[lane] = Math.min(prev[lane], totalPages)
            })
            return next
        })
    }, [laneItems])

    const pagedLanes = useMemo(() => {
        const getPageSlice = (lane: LaneKey) => {
            const items = laneItems[lane] || []
            const totalPages = Math.max(1, Math.ceil(items.length / PAGE_SIZE))
            const page = Math.min(lanePage[lane], totalPages)
            const start = (page - 1) * PAGE_SIZE
            return {
                items: items.slice(start, start + PAGE_SIZE),
                page,
                totalPages,
                totalItems: items.length,
            }
        }

        return {
            draft: getPageSlice('draft'),
            sent: getPageSlice('sent'),
            overdue: getPageSlice('overdue'),
            paid: getPageSlice('paid'),
        }
    }, [laneItems, lanePage])

    const updateLanePage = (lane: LaneKey, page: number) => {
        setLanePage((prev) => ({ ...prev, [lane]: Math.max(1, page) }))
    }

    const isManualDueDatePast = useMemo(() => {
        if (!dueDate) return false
        const selectedDate = parseDateInput(dueDate)
        if (!selectedDate) return false
        const today = new Date()
        today.setHours(0, 0, 0, 0)
        return selectedDate < today
    }, [dueDate])

    const applyKanbanFilters = () => {
        pushSearchParams((params) => {
            const normalizedQ = searchText.trim()
            if (normalizedQ) params.set("q", normalizedQ)
            else params.delete("q")

            if (invoiceTypeFilter === "ALL") params.delete("type")
            else params.set("type", invoiceTypeFilter)
        })
    }

    const resetKanbanFilters = () => {
        setSearchText("")
        setInvoiceTypeFilter("ALL")
        pushSearchParams((params) => {
            params.delete("q")
            params.delete("type")
        })
    }

    return (
        <div className="flex-1 space-y-6 p-4 md:p-8 pt-6 font-sans h-[calc(100vh-theme(spacing.16))] flex flex-col">

            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 shrink-0">
                <div>
                    <h2 className="text-3xl font-black font-serif tracking-tight text-black flex items-center gap-2">
                        Invoice Command Center
                    </h2>
                    <p className="text-muted-foreground mt-1 font-medium">Kanban flow & otomatisasi penagihan.</p>
                </div>

                <Dialog open={isCreatorOpen} onOpenChange={setIsCreatorOpen}>
                    <DialogTrigger asChild>
                        <Button className="bg-black text-white hover:bg-zinc-800 border border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] uppercase font-bold tracking-wide transition-all active:translate-y-1 active:shadow-none h-12 px-6">
                            <FileText className="mr-2 h-4 w-4" /> Create Invoice
                        </Button>
                    </DialogTrigger>
                    <DialogContent className="max-w-md border-2 border-black shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] p-0 overflow-hidden bg-white">
                        <DialogHeader className="p-6 pb-2 border-b border-black/10 bg-zinc-50">
                            <DialogTitle className="text-2xl font-black uppercase flex items-center gap-2">
                                <FileText className="h-6 w-6" /> Create Invoice
                            </DialogTitle>
                            <DialogDescription className="font-medium text-black/60">
                                Create a new invoice or bill manually or from an existing order.
                            </DialogDescription>
                        </DialogHeader>

                        <div className="p-6 space-y-4">
                            {/* Source Type Toggle */}
                            <div className="flex p-1 bg-zinc-100 rounded-lg border border-black/10">
                                {(['SO', 'PO', 'MANUAL'] as const).map((type) => (
                                    <button
                                        key={type}
                                        onClick={() => { setSourceType(type); setSelectedOrderId(""); }}
                                        className={`flex-1 py-1.5 text-[10px] font-black uppercase tracking-wider rounded-md transition-all ${sourceType === type ? 'bg-black text-white shadow-sm' : 'text-zinc-500 hover:text-black'}`}
                                    >
                                        {type === 'SO' ? 'Sales Order' : type === 'PO' ? 'Purchase Order' : 'Manual'}
                                    </button>
                                ))}
                            </div>

                            {sourceType !== 'MANUAL' ? (
                                <div className="space-y-2">
                                    <Label className="uppercase font-bold text-xs">Select {sourceType === 'SO' ? 'Sales Order' : 'Purchase Order'}</Label>
                                    <Select value={selectedOrderId} onValueChange={setSelectedOrderId}>
                                        <SelectTrigger className="border-black font-medium h-10 shadow-sm">
                                            <SelectValue placeholder={`Select ${sourceType === 'SO' ? 'Order' : 'PO'}`} />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {pendingOrders.length === 0 ? (
                                                <div className="p-2 text-xs text-center italic text-muted-foreground">No pending {sourceType === 'SO' ? 'orders' : 'POs'} found</div>
                                            ) : pendingOrders.map((order) => (
                                                <SelectItem key={order.id} value={order.id}>
                                                    {order.number} - {order.customerName || order.vendorName} ({formatIDR(order.amount)})
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                    <p className="text-[10px] text-zinc-400 italic font-medium">Only orders without active invoice/bill are listed. Existing docs require explicit override.</p>
                                </div>
                            ) : (
                                <div className="space-y-4">
                                    {/* Manual Entry Fields */}
                                    {/* Manual type toggle */}
                                    <div className="flex gap-4">
                                        <div className="flex items-center space-x-2">
                                            <input type="radio" id="type-cust" checked={manualType === 'CUSTOMER'} onChange={() => setManualType('CUSTOMER')} className="accent-black" />
                                            <Label htmlFor="type-cust">Customer Invoice</Label>
                                        </div>
                                        <div className="flex items-center space-x-2">
                                            <input type="radio" id="type-supp" checked={manualType === 'SUPPLIER'} onChange={() => setManualType('SUPPLIER')} className="accent-black" />
                                            <Label htmlFor="type-supp">Vendor Bill</Label>
                                        </div>
                                    </div>

                                    {/* Customer Entry Fields */}
                                    <div className="space-y-2">
                                        <Label className="uppercase font-bold text-xs">{manualType === 'CUSTOMER' ? 'Customer' : 'Vendor'}</Label>
                                        <Select value={selectedCustomer} onValueChange={setSelectedCustomer}>
                                            <SelectTrigger className="border-black font-medium h-10 shadow-sm">
                                                <SelectValue placeholder="Select Party" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {customers.filter(c => (c as any).type === manualType).length === 0 ? (
                                                    <SelectItem value="empty" disabled>
                                                        No active {manualType.toLowerCase()}s
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
                                            <Label className="uppercase font-bold text-xs">Issue Date</Label>
                                            <Input
                                                type="date"
                                                className="border-black font-medium h-10 shadow-sm"
                                                value={issueDate}
                                                onChange={(e) => setIssueDate(e.target.value)}
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <Label className="uppercase font-bold text-xs">Due Date</Label>
                                            <Input
                                                type="date"
                                                className="border-black font-medium h-10 shadow-sm"
                                                value={dueDate}
                                                onChange={(e) => setDueDate(e.target.value)}
                                            />
                                        </div>
                                    </div>
                                    {isManualDueDatePast && (
                                        <p className="text-[11px] font-semibold text-red-600">
                                            Due date is in the past. Once sent, this invoice will be marked Overdue immediately.
                                        </p>
                                    )}

                                    <div className="space-y-2">
                                        <Label className="uppercase font-bold text-xs">Description / Product</Label>
                                        <Input
                                            className="border-black font-medium h-10 shadow-sm"
                                            placeholder="e.g. Consulting Services"
                                            value={manualProduct}
                                            onChange={(e) => setManualProduct(e.target.value)}
                                        />
                                    </div>

                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="space-y-2">
                                            <Label className="uppercase font-bold text-xs">Product Code (Opt)</Label>
                                            <Input
                                                className="border-black font-medium h-10 shadow-sm"
                                                placeholder="e.g. SERV-001"
                                                value={manualCode}
                                                onChange={(e) => setManualCode(e.target.value)}
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <Label className="uppercase font-bold text-xs">Quantity</Label>
                                            <Input
                                                type="number"
                                                className="border-black font-medium h-10 shadow-sm"
                                                placeholder="1"
                                                value={manualQty}
                                                onChange={(e) => setManualQty(Math.max(1, Number(e.target.value) || 1))}
                                            />
                                        </div>
                                    </div>

                                    <div className="space-y-2">
                                        <Label className="uppercase font-bold text-xs">Unit Price</Label>
                                        <div className="relative">
                                            <span className="absolute left-3 top-1/2 -translate-y-1/2 font-bold text-muted-foreground">Rp</span>
                                            <Input
                                                className="pl-9 border-black font-black h-10 shadow-sm"
                                                placeholder="0"
                                                type="number"
                                                value={manualPrice}
                                                onChange={(e) => setManualPrice(e.target.value)}
                                            />
                                        </div>
                                    </div>

                                    <div className="p-2 bg-zinc-100 rounded text-right font-mono font-bold">
                                        Total: {formatIDR((parseFloat(manualPrice) || 0) * manualQty)}
                                    </div>
                                </div>
                            )}
                        </div>

                        <DialogFooter className="p-6 pt-2 border-t border-black/10 bg-zinc-50 flex gap-2">
                            <Button variant="outline" className="border-black uppercase font-bold" onClick={() => setIsCreatorOpen(false)}>Cancel</Button>
                            <Button
                                className="bg-black text-white hover:bg-zinc-800 border-black uppercase font-bold shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] active:shadow-none active:translate-y-[2px] transition-all"
                                onClick={() => { void handleCreateInvoice() }}
                                disabled={creating || (sourceType !== 'MANUAL' && !selectedOrderId) || (sourceType === 'MANUAL' && (!selectedCustomer || !manualPrice || manualQty <= 0))}
                            >
                                {creating ? "Creating..." : "Generate Invoice"}
                            </Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>
            </div>

            <div className="rounded-lg border bg-white p-3">
                <div className="grid gap-2 md:grid-cols-[1.6fr_220px_auto_auto]">
                    <div className="relative">
                        <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-zinc-400" />
                        <Input
                            className="pl-9"
                            placeholder="Cari nomor invoice / customer / supplier..."
                            value={searchText}
                            onChange={(event) => setSearchText(event.target.value)}
                        />
                    </div>
                    <Select value={invoiceTypeFilter} onValueChange={(value: 'ALL' | 'INV_OUT' | 'INV_IN') => setInvoiceTypeFilter(value)}>
                        <SelectTrigger>
                            <SelectValue placeholder="Semua tipe" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="ALL">Semua Tipe</SelectItem>
                            <SelectItem value="INV_OUT">Customer Invoice</SelectItem>
                            <SelectItem value="INV_IN">Vendor Bill</SelectItem>
                        </SelectContent>
                    </Select>
                    <Button variant="secondary" onClick={applyKanbanFilters}>Terapkan</Button>
                    <Button variant="outline" onClick={resetKanbanFilters}>Reset</Button>
                </div>
            </div>

            <Dialog
                open={duplicateWarning.open}
                onOpenChange={(open) => setDuplicateWarning((prev) => ({ ...prev, open }))}
            >
                <DialogContent className="max-w-md border-2 border-black shadow-[8px_8px_0px_0px_rgba(0,0,0,1)]">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2 text-lg font-black uppercase">
                            <AlertTriangle className="h-5 w-5 text-amber-500" />
                            Invoice Already Exists
                        </DialogTitle>
                        <DialogDescription className="text-sm text-zinc-600">
                            Order ini sudah punya invoice <span className="font-bold text-black">{duplicateWarning.existingInvoiceNumber}</span> ({duplicateWarning.existingInvoiceStatus}).
                            Buat invoice baru hanya jika memang dibutuhkan untuk case khusus.
                        </DialogDescription>
                    </DialogHeader>
                    <DialogFooter className="gap-2 sm:justify-end">
                        <Button
                            variant="outline"
                            className="border-black font-bold uppercase"
                            onClick={() => setDuplicateWarning((prev) => ({ ...prev, open: false }))}
                        >
                            Cancel
                        </Button>
                        <Button
                            className="bg-black text-white hover:bg-zinc-800 font-bold uppercase"
                            onClick={async () => {
                                setDuplicateWarning((prev) => ({ ...prev, open: false }))
                                await handleCreateInvoice(true)
                            }}
                        >
                            Create New Anyway
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>


            {/* DnD Context */}
            <DndContext onDragEnd={handleDragEnd}>
                <div className="grid flex-1 min-h-0 gap-6 xl:grid-cols-[2fr_1fr]">
                    <Card className="border-2 border-black shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] min-h-0 flex flex-col overflow-hidden">
                        <CardHeader className="border-b border-black/10 bg-zinc-50 px-6 py-4">
                            <div className="flex flex-wrap items-center gap-2">
                                <h3 className="text-sm font-black uppercase tracking-wide">Open Workflow</h3>
                                <Badge variant="outline" className="bg-white">{invoices.draft.length + invoices.sent.length + invoices.overdue.length} Invoices</Badge>
                            </div>
                            <p className="text-xs text-zinc-500 font-medium">Drag draft to Sent, then drop Sent/Overdue to Paid.</p>
                        </CardHeader>
                        <CardContent className="grid min-h-0 gap-4 p-4 md:grid-cols-2 xl:grid-cols-3 overflow-y-auto">
                            <LanePanel
                                id="draft"
                                title="Drafts"
                                color="zinc"
                                lane={pagedLanes.draft}
                                onPageChange={(page) => updateLanePage('draft', page)}
                            />
                            <LanePanel
                                id="sent"
                                title="Sent to Client"
                                color="blue"
                                lane={pagedLanes.sent}
                                onPageChange={(page) => updateLanePage('sent', page)}
                            />
                            <LanePanel
                                id="overdue"
                                title="Overdue"
                                color="red"
                                lane={pagedLanes.overdue}
                                onPageChange={(page) => updateLanePage('overdue', page)}
                            />
                        </CardContent>
                    </Card>

                    <Card className="border-2 border-black shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] min-h-0 flex flex-col overflow-hidden">
                        <CardHeader className="border-b border-black/10 bg-emerald-50 px-6 py-4">
                            <div className="flex items-center gap-2">
                                <h3 className="text-sm font-black uppercase tracking-wide text-emerald-800">Paid Ledger</h3>
                                <Badge variant="outline" className="bg-white border-emerald-200 text-emerald-700">{invoices.paid.length}</Badge>
                            </div>
                            <p className="text-xs text-emerald-700/80 font-medium">Keep completed settlements searchable and paginated.</p>
                        </CardHeader>
                        <CardContent className="min-h-0 p-4 overflow-y-auto">
                            <LanePanel
                                id="paid"
                                title="Paid"
                                color="emerald"
                                lane={pagedLanes.paid}
                                onPageChange={(page) => updateLanePage('paid', page)}
                            />
                        </CardContent>
                    </Card>
                </div>
            </DndContext>

            {/* SEND DIALOG */}
            <Dialog open={isSendDialogOpen} onOpenChange={setIsSendDialogOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Send Invoice {activeInvoice?.number}</DialogTitle>
                        <DialogDescription>Select method and confirm message to start 30-day countdown.</DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-2">
                        <div className="flex gap-4">
                            <Button variant={sendMethod === 'WHATSAPP' ? 'default' : 'outline'} onClick={() => setSendMethod('WHATSAPP')} className="flex-1">WhatsApp</Button>
                            <Button variant={sendMethod === 'EMAIL' ? 'default' : 'outline'} onClick={() => setSendMethod('EMAIL')} className="flex-1">Email</Button>
                        </div>

                        <div className="space-y-2">
                            <Label>Length / Template</Label>
                            <Select onValueChange={(val) => {
                                if (!activeInvoice) return
                                const link = `https://erp.orico.com/invoices/${activeInvoice.id}`
                                let text = ""
                                const dueDateText = new Date(activeInvoice.dueDate).toLocaleDateString()
                                if (val === 'default') text = `Hi ${activeInvoice.partyName}, here is invoice ${activeInvoice.number} for ${formatIDR(activeInvoice.amount)}. Please make payment by ${dueDateText}. View Invoice: ${link}`
                                if (val === 'formal') text = `Dear ${activeInvoice.partyName},\n\nPlease find the invoice ${activeInvoice.number} amounting to ${formatIDR(activeInvoice.amount)}. Payment is due by ${dueDateText}.\n\nView Invoice: ${link}\n\nSincerely,\nFinance Team`
                                if (val === 'friendly') text = `Hey ${activeInvoice.partyName}! Just a friendly reminder about invoice ${activeInvoice.number} for ${formatIDR(activeInvoice.amount)}. Thanks for your business! View Invoice: ${link}`
                                if (val === 'urgent') text = `URGENT: Invoice ${activeInvoice.number} for ${formatIDR(activeInvoice.amount)} is ready. Please process payment immediately. View Invoice: ${link}`
                                setSendMessage(text)
                            }}>
                                <SelectTrigger><SelectValue placeholder="Select Template" /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="default">Standard</SelectItem>
                                    <SelectItem value="formal">Formal</SelectItem>
                                    <SelectItem value="friendly">Friendly</SelectItem>
                                    <SelectItem value="urgent">Urgent</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="space-y-2">
                            <Label>Recipient contact</Label>
                            {sendMethod === 'WHATSAPP' ? (
                                <div className="flex items-center border rounded-md overflow-hidden focus-within:ring-2 ring-black">
                                    <div className="bg-zinc-100 px-3 py-2 border-r text-sm font-medium text-zinc-600 flex items-center gap-1">
                                        <div className="w-4 h-4 bg-red-500 rounded-sm" /> {/* Indonesia Flag Mock */}
                                        +62
                                    </div>
                                    <Input
                                        className="border-0 focus-visible:ring-0 rounded-none shadow-none"
                                        placeholder="812-3456-7890"
                                        value={recipientContact}
                                        onChange={(e) => setRecipientContact(e.target.value)}
                                    />
                                </div>
                            ) : (
                                <Input
                                    placeholder="client@company.com"
                                    value={recipientContact}
                                    onChange={(e) => setRecipientContact(e.target.value)}
                                />
                            )}
                            <p className="text-[10px] text-muted-foreground">
                                {sendMethod === 'WHATSAPP' ? 'Enter WhatsApp number without country code.' : 'Enter recipient email address.'}
                            </p>
                        </div>

                        <div className="space-y-2">
                            <Label>Message Preview</Label>
                            <textarea
                                className="w-full h-32 p-2 border rounded-md text-sm font-sans"
                                value={sendMessage}
                                onChange={(e) => setSendMessage(e.target.value)}
                            />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsSendDialogOpen(false)}>Cancel</Button>
                        {sendMethod === 'WHATSAPP' ? (
                            <Button onClick={handleConfirmSend} className="bg-[#25D366] hover:bg-[#128C7E] text-white gap-2 font-bold">
                                <span className="w-4 h-4 rounded-full bg-white flex items-center justify-center">
                                    <span className="text-[10px] font-bold text-[#25D366]">W</span>
                                </span>
                                Send to WhatsApp
                            </Button>
                        ) : (
                            <Button onClick={handleConfirmSend}>Send & Start Timer</Button>
                        )}
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* PAY DIALOG */}
            <Dialog open={isPayDialogOpen} onOpenChange={setIsPayDialogOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Record Payment for {activeInvoice?.number}</DialogTitle>
                        <DialogDescription>Confirm payment receipt details.</DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-2">
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label>Date Received</Label>
                                <Input type="date" value={payDate} onChange={(e) => setPayDate(e.target.value)} />
                            </div>
                            <div className="space-y-2">
                                <Label>Amount Received</Label>
                                <Input type="number" value={payAmount} onChange={(e) => setPayAmount(e.target.value)} />
                            </div>
                        </div>
                        <div className="space-y-2">
                            <Label>Payment Method</Label>
                            <Select value={payMethod} onValueChange={(v: any) => setPayMethod(v)}>
                                <SelectTrigger><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="TRANSFER">Bank Transfer</SelectItem>
                                    <SelectItem value="CASH">Cash</SelectItem>
                                    <SelectItem value="CHECK">Check/Giro</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-2">
                            <Label>Reference No. (Optional)</Label>
                            <Input placeholder="Ref #123456" value={payReference} onChange={(e) => setPayReference(e.target.value)} />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsPayDialogOpen(false)}>Cancel</Button>
                        <Button onClick={handleConfirmPayment} className="bg-emerald-600 hover:bg-emerald-700 text-white">Confirm Payment</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

        </div>
    )
}

function DraggableInvoiceCard({ invoice }: { invoice: InvoiceKanbanItem }) {
    const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
        id: invoice.id,
        data: invoice
    })
    const style = transform ? {
        transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`,
        zIndex: 999,
        position: 'relative' as const
    } : undefined

    // Apply color logic based on status/column context if needed
    // Copied existing card logic but wrapped
    return (
        <div ref={setNodeRef} style={style} {...listeners} {...attributes} className={`touch-none ${isDragging ? 'opacity-50 rotate-2 scale-105' : ''}`}>
            <Card className="cursor-grab active:cursor-grabbing border border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:translate-x-[2px] hover:translate-y-[2px] transition-all bg-white group relative overflow-hidden">
                {/* Status Badges */}
                {invoice.status === 'OVERDUE' && (
                    <div className="absolute -right-2 top-4 rotate-12 border-2 border-red-600 px-2 py-1 rounded opacity-30 group-hover:opacity-100 transition-opacity">
                        <span className="text-[10px] font-black text-red-600 uppercase">LATE</span>
                    </div>
                )}
                {invoice.status === 'ISSUED' && (
                    <div className="absolute top-0 right-0 p-1 bg-blue-500 text-white rounded-bl-lg">
                        <Mail className="h-3 w-3" />
                    </div>
                )}
                {invoice.status === 'PAID' && (
                    <div className="absolute right-4 top-1/2 -translate-y-1/2 opacity-10">
                        <CheckCircle2 className="h-16 w-16 text-emerald-600" />
                    </div>
                )}

                <CardHeader className="p-4 pb-2 flex-row justify-between items-start space-y-0">
                    <span className={`font-mono text-xs font-bold ${invoice.status === 'OVERDUE' ? 'text-red-600' : 'text-muted-foreground'}`}>{invoice.number}</span>
                    <MoreVertical className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100" />
                </CardHeader>
                <CardContent className="p-4 pt-0">
                    <h4 className="font-bold text-sm mb-1">{invoice.partyName}</h4>
                    <p className={`text-lg font-black ${invoice.status === 'OVERDUE' ? 'text-red-700' : invoice.status === 'PAID' ? 'text-emerald-800' : ''}`}>{formatIDR(invoice.amount)}</p>
                </CardContent>
                <CardFooter className="p-4 pt-0 text-[10px] text-muted-foreground flex items-center gap-1">
                    {invoice.status === 'DRAFT' && <><Clock className="h-3 w-3" /> Created {new Date(invoice.issueDate).toLocaleDateString()}</>}
                    {(invoice.status === 'ISSUED' || invoice.status === 'OVERDUE' || invoice.status === 'PARTIAL') && `Due: ${new Date(invoice.dueDate).toLocaleDateString()}`}
                    {invoice.status === 'PAID' && `Paid`}
                </CardFooter>
            </Card>
        </div>
    )
}

function LanePanel({
    id,
    title,
    color,
    lane,
    onPageChange,
}: {
    id: string
    title: string
    color: string
    lane: { items: InvoiceKanbanItem[]; page: number; totalPages: number; totalItems: number }
    onPageChange: (page: number) => void
}) {
    const { setNodeRef, isOver } = useDroppable({ id })

    const bgMap: Record<string, string> = {
        zinc: 'bg-zinc-100/50 border-zinc-200',
        blue: 'bg-blue-50/50 border-blue-100',
        red: 'bg-red-50/50 border-red-100',
        emerald: 'bg-emerald-50/50 border-emerald-100',
    }
    const textMap: Record<string, string> = {
        zinc: 'text-zinc-600',
        blue: 'text-blue-700',
        red: 'text-red-700',
        emerald: 'text-emerald-700',
    }
    const indicatorMap: Record<string, string> = {
        zinc: 'bg-zinc-400',
        blue: 'bg-blue-500',
        red: 'bg-red-500',
        emerald: 'bg-emerald-500',
    }

    return (
        <div ref={setNodeRef} className={`rounded-2xl border p-4 transition-colors ${bgMap[color]} ${isOver ? 'ring-2 ring-black ring-offset-1 bg-white' : ''}`}>
            <div className="mb-3 flex items-center gap-2 border-b border-black/10 pb-2">
                <div className={`h-3 w-3 rounded-full ${indicatorMap[color]} ${id === 'overdue' ? 'animate-pulse' : ''}`} />
                <h3 className={`font-black uppercase text-sm ${textMap[color]}`}>{title}</h3>
                <Badge variant="outline" className="ml-auto bg-white text-xs">{lane.totalItems}</Badge>
            </div>
            <div className="min-h-[240px] space-y-3">
                {lane.items.length === 0 ? (
                    <div className="rounded-xl border border-dashed border-zinc-300 bg-white/70 p-5 text-center text-xs font-medium text-zinc-500">
                        No invoices in this stage.
                    </div>
                ) : (
                    lane.items.map((invoice) => (
                        <DraggableInvoiceCard key={invoice.id} invoice={invoice} />
                    ))
                )}
            </div>
            <PaginationControls
                page={lane.page}
                totalPages={lane.totalPages}
                totalItems={lane.totalItems}
                onPageChange={onPageChange}
            />
        </div>
    )
}

function PaginationControls({
    page,
    totalPages,
    totalItems,
    onPageChange,
}: {
    page: number
    totalPages: number
    totalItems: number
    onPageChange: (page: number) => void
}) {
    return (
        <div className="mt-3 flex items-center justify-between border-t border-black/10 pt-2">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-zinc-500">
                {totalItems} total
            </p>
            <div className="flex items-center gap-1">
                <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    className="h-7 w-7 border-zinc-300"
                    disabled={page <= 1}
                    onClick={() => onPageChange(page - 1)}
                >
                    <ChevronLeft className="h-3.5 w-3.5" />
                </Button>
                <span className="min-w-14 text-center text-xs font-semibold text-zinc-600">
                    {page}/{totalPages}
                </span>
                <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    className="h-7 w-7 border-zinc-300"
                    disabled={page >= totalPages}
                    onClick={() => onPageChange(page + 1)}
                >
                    <ChevronRight className="h-3.5 w-3.5" />
                </Button>
            </div>
        </div>
    )
}
