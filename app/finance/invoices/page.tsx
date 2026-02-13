"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import {
    AlertTriangle,
    ChevronLeft,
    ChevronRight,
    FileText,
    Search,
    Send,
    Banknote,
    Loader2,
    Receipt,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog"
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
} from "@/lib/actions/finance-invoices"

import { formatIDR } from "@/lib/utils"
import { toast } from "sonner"
import { CreateInvoiceDialog } from "@/components/finance/create-invoice-dialog"

const emptyKanban: InvoiceKanbanData = { draft: [], sent: [], overdue: [], paid: [] }
const PAGE_SIZE = 15

type StatusTab = 'ALL' | 'DRAFT' | 'SENT' | 'OVERDUE' | 'PAID'

const parseDateInput = (value: string) => {
    if (!value) return undefined
    const parts = value.split("-").map(Number)
    if (parts.length !== 3 || parts.some((part) => Number.isNaN(part))) return undefined
    const [year, month, day] = parts
    return new Date(year, month - 1, day, 12, 0, 0, 0)
}

export default function InvoicesPage() {
    const [invoices, setInvoices] = useState<InvoiceKanbanData>(emptyKanban)
    const [loading, setLoading] = useState(true)
    const [activeTab, setActiveTab] = useState<StatusTab>('ALL')
    const [page, setPage] = useState(1)

    // Create invoice dialog
    const [isCreatorOpen, setIsCreatorOpen] = useState(false)

    // Workflow dialogs
    const [activeInvoice, setActiveInvoice] = useState<InvoiceKanbanItem | null>(null)
    const [isSendDialogOpen, setIsSendDialogOpen] = useState(false)
    const [isPayDialogOpen, setIsPayDialogOpen] = useState(false)

    // Send form
    const [sendMethod, setSendMethod] = useState<'WHATSAPP' | 'EMAIL'>('WHATSAPP')
    const [sendMessage, setSendMessage] = useState("")
    const [recipientContact, setRecipientContact] = useState("")

    // Pay form
    const [payMethod, setPayMethod] = useState<'TRANSFER' | 'CASH' | 'CHECK'>('TRANSFER')
    const [payDate, setPayDate] = useState(new Date().toISOString().split('T')[0])
    const [payReference, setPayReference] = useState("")
    const [payAmount, setPayAmount] = useState("")

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

    const loadInvoices = useCallback(async () => {
        const q = (searchParams.get("q") || "").trim()
        const type = (searchParams.get("type") as 'ALL' | 'INV_OUT' | 'INV_IN' | null) || "ALL"
        setSearchText(q)
        setInvoiceTypeFilter(type)

        const kanban = await getInvoiceKanbanData({ q: q || null, type })
        setInvoices(kanban)
    }, [searchParams])

    useEffect(() => {
        let active = true
        async function load() {
            setLoading(true)
            try {
                if (!active) return
                await loadInvoices()
            } catch {
                // ignore
            } finally {
                if (active) setLoading(false)
            }
        }
        load()
        return () => { active = false }
    }, [loadInvoices])

    useEffect(() => {
        const refresh = () => {
            if (document.visibilityState === "visible") void loadInvoices()
        }
        const id = window.setInterval(refresh, 15000)
        window.addEventListener("focus", refresh)
        document.addEventListener("visibilitychange", refresh)
        return () => {
            window.clearInterval(id)
            window.removeEventListener("focus", refresh)
            document.removeEventListener("visibilitychange", refresh)
        }
    }, [loadInvoices])

    // Flatten all invoices for the table
    const allInvoices = useMemo(() => {
        const tag = (items: InvoiceKanbanItem[], status: string) => items.map(i => ({ ...i, _tab: status }))
        return [
            ...tag(invoices.draft, 'DRAFT'),
            ...tag(invoices.sent, 'SENT'),
            ...tag(invoices.overdue, 'OVERDUE'),
            ...tag(invoices.paid, 'PAID'),
        ]
    }, [invoices])

    const filteredInvoices = useMemo(() => {
        if (activeTab === 'ALL') return allInvoices
        return allInvoices.filter(i => i._tab === activeTab)
    }, [allInvoices, activeTab])

    const totalPages = Math.max(1, Math.ceil(filteredInvoices.length / PAGE_SIZE))
    const pagedInvoices = filteredInvoices.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

    useEffect(() => { setPage(1) }, [activeTab])

    const counts = useMemo(() => ({
        all: allInvoices.length,
        draft: invoices.draft.length,
        sent: invoices.sent.length,
        overdue: invoices.overdue.length,
        paid: invoices.paid.length,
    }), [allInvoices, invoices])

    // Workflow handlers
    const openSendDialog = (invoice: InvoiceKanbanItem) => {
        setActiveInvoice(invoice)
        setSendMessage(`Hi ${invoice.partyName}, here is invoice ${invoice.number} for ${formatIDR(invoice.amount)}. Please make payment by ${new Date(invoice.dueDate).toLocaleDateString()}. View Invoice: https://erp.orico.com/invoices/${invoice.id}`)
        setRecipientContact("")
        setIsSendDialogOpen(true)
    }

    const openPayDialog = (invoice: InvoiceKanbanItem) => {
        setActiveInvoice(invoice)
        setPayAmount(String(invoice.amount))
        setPayDate(new Date().toISOString().split('T')[0])
        setPayReference("")
        setIsPayDialogOpen(true)
    }

    const handleConfirmSend = async () => {
        if (!activeInvoice) return
        if (sendMethod === 'WHATSAPP') {
            if (!recipientContact) {
                toast.error("Masukkan nomor WhatsApp")
                return
            }
            const phone = recipientContact.replace(/\D/g, '')
            const text = encodeURIComponent(sendMessage)
            window.open(`https://wa.me/${phone}?text=${text}`, '_blank')
        }
        setLoading(true)
        try {
            const result: any = await moveInvoiceToSent(activeInvoice.id, sendMessage, sendMethod)
            if (!result.success) throw new Error(result.error || "Gagal mengirim invoice")
            toast.success(result.status === 'OVERDUE' ? "Invoice dipindahkan ke Jatuh Tempo." : "Invoice terkirim!")
            setIsSendDialogOpen(false)
            await loadInvoices()
        } catch {
            toast.error("Gagal mengirim invoice")
        } finally {
            setLoading(false)
            setActiveInvoice(null)
        }
    }

    const handleConfirmPayment = async () => {
        if (!activeInvoice) return
        setLoading(true)
        try {
            const result: any = await recordInvoicePayment({
                invoiceId: activeInvoice.id,
                amount: parseFloat(payAmount),
                paymentMethod: payMethod,
                paymentDate: new Date(payDate),
                reference: payReference,
                notes: "Pembayaran dari Invoice Center"
            })
            if (!result.success) throw new Error(result.error || "Gagal mencatat pembayaran")
            toast.success("Pembayaran berhasil dicatat")
            setIsPayDialogOpen(false)
            await loadInvoices()
        } catch {
            toast.error("Gagal mencatat pembayaran")
        } finally {
            setLoading(false)
            setActiveInvoice(null)
        }
    }

    const applyFilters = () => {
        pushSearchParams((params) => {
            const q = searchText.trim()
            if (q) params.set("q", q)
            else params.delete("q")
            if (invoiceTypeFilter === "ALL") params.delete("type")
            else params.set("type", invoiceTypeFilter)
        })
    }

    const resetFilters = () => {
        setSearchText("")
        setInvoiceTypeFilter("ALL")
        pushSearchParams((params) => {
            params.delete("q")
            params.delete("type")
        })
    }

    const statusConfig: Record<string, { label: string; bg: string; text: string; dot: string }> = {
        DRAFT: { label: 'Draft', bg: 'bg-zinc-100 border-zinc-300', text: 'text-zinc-700', dot: 'bg-zinc-400' },
        ISSUED: { label: 'Terkirim', bg: 'bg-blue-50 border-blue-300', text: 'text-blue-700', dot: 'bg-blue-500' },
        OVERDUE: { label: 'Jatuh Tempo', bg: 'bg-red-50 border-red-300', text: 'text-red-700', dot: 'bg-red-500' },
        PARTIAL: { label: 'Sebagian', bg: 'bg-amber-50 border-amber-300', text: 'text-amber-700', dot: 'bg-amber-500' },
        PAID: { label: 'Lunas', bg: 'bg-emerald-50 border-emerald-300', text: 'text-emerald-700', dot: 'bg-emerald-500' },
    }

    const tabs: { key: StatusTab; label: string; count: number; color: string }[] = [
        { key: 'ALL', label: 'Semua', count: counts.all, color: 'orange' },
        { key: 'DRAFT', label: 'Draft', count: counts.draft, color: 'zinc' },
        { key: 'SENT', label: 'Terkirim', count: counts.sent, color: 'blue' },
        { key: 'OVERDUE', label: 'Jatuh Tempo', count: counts.overdue, color: 'red' },
        { key: 'PAID', label: 'Lunas', count: counts.paid, color: 'emerald' },
    ]

    return (
        <div className="flex-1 p-4 md:p-8 pt-6 max-w-7xl mx-auto space-y-4">
            {/* Page Header */}
            <div className="border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] overflow-hidden bg-white dark:bg-zinc-900">
                <div className="px-6 py-4 flex items-center justify-between border-l-[6px] border-l-orange-400">
                    <div className="flex items-center gap-3">
                        <Receipt className="h-5 w-5 text-orange-500" />
                        <div>
                            <h1 className="text-xl font-black uppercase tracking-tight text-zinc-900 dark:text-white">
                                Invoice Command Center
                            </h1>
                            <p className="text-zinc-400 text-xs font-medium mt-0.5">
                                Kelola invoice, kirim tagihan, dan catat pembayaran
                            </p>
                        </div>
                    </div>
                    <Button
                        onClick={() => setIsCreatorOpen(true)}
                        className="bg-orange-500 text-white hover:bg-orange-600 border-2 border-orange-600 font-black uppercase text-[10px] tracking-wide h-10 px-5 shadow-[3px_3px_0px_0px_rgba(0,0,0,0.2)] active:shadow-none active:translate-y-[1px] transition-all"
                    >
                        <FileText className="h-3.5 w-3.5 mr-1.5" /> Buat Invoice
                    </Button>
                </div>
            </div>

            {/* Search & Filter Bar */}
            <div className="border-2 border-black shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] bg-white dark:bg-zinc-900 overflow-hidden">
                <div className="p-4">
                    <div className="flex flex-col md:flex-row gap-3">
                        <div className="relative flex-1">
                            <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400" />
                            <Input
                                className="border-2 border-black h-10 pl-9 font-medium"
                                placeholder="Cari nomor invoice / customer / supplier..."
                                value={searchText}
                                onChange={(e) => setSearchText(e.target.value)}
                                onKeyDown={(e) => e.key === 'Enter' && applyFilters()}
                            />
                        </div>
                        <Select value={invoiceTypeFilter} onValueChange={(v: any) => setInvoiceTypeFilter(v)}>
                            <SelectTrigger className="border-2 border-black h-10 font-medium w-full md:w-[180px]">
                                <SelectValue placeholder="Semua Tipe" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="ALL">Semua Tipe</SelectItem>
                                <SelectItem value="INV_OUT">Customer Invoice</SelectItem>
                                <SelectItem value="INV_IN">Vendor Bill</SelectItem>
                            </SelectContent>
                        </Select>
                        <Button
                            onClick={applyFilters}
                            className="bg-orange-500 text-white hover:bg-orange-600 border-2 border-orange-600 font-black uppercase text-[10px] tracking-wide h-10 px-4"
                        >
                            Terapkan
                        </Button>
                        <Button
                            variant="outline"
                            onClick={resetFilters}
                            className="border-2 border-zinc-300 font-bold uppercase text-[10px] tracking-wide h-10 px-4"
                        >
                            Reset
                        </Button>
                    </div>
                </div>
            </div>

            {/* Status Tabs */}
            <div className="flex gap-2 flex-wrap">
                {tabs.map((tab) => {
                    const isActive = activeTab === tab.key
                    return (
                        <button
                            key={tab.key}
                            onClick={() => setActiveTab(tab.key)}
                            className={`
                                flex items-center gap-2 px-4 py-2 border-2 text-[11px] font-black uppercase tracking-widest transition-all
                                ${isActive
                                    ? 'border-black bg-white shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] text-zinc-900'
                                    : 'border-zinc-200 bg-zinc-50 text-zinc-400 hover:border-zinc-400 hover:text-zinc-600'
                                }
                            `}
                        >
                            {tab.label}
                            <span className={`
                                text-[10px] font-black px-1.5 py-0.5 min-w-[22px] text-center rounded-sm
                                ${isActive ? 'bg-orange-500 text-white' : 'bg-zinc-200 text-zinc-500'}
                            `}>
                                {tab.count}
                            </span>
                        </button>
                    )
                })}
            </div>

            {/* Invoice Table */}
            <div className="border-2 border-black shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] bg-white dark:bg-zinc-900 overflow-hidden flex flex-col" style={{ minHeight: 480 }}>
                <div className="bg-orange-50 dark:bg-orange-950/20 px-5 py-2.5 border-b-2 border-black flex items-center gap-2 border-l-[5px] border-l-orange-400">
                    <Receipt className="h-4 w-4 text-orange-600" />
                    <h3 className="text-[11px] font-black uppercase tracking-widest text-zinc-700 dark:text-zinc-200">
                        Daftar Invoice
                    </h3>
                    <span className="bg-orange-500 text-white text-[10px] font-black px-2 py-0.5 min-w-[20px] text-center rounded-sm">
                        {filteredInvoices.length}
                    </span>
                </div>

                {/* Table — uses CSS table for stable column widths regardless of row count */}
                <div className="w-full flex-1 flex flex-col">
                    {/* Table Header */}
                    <div className="hidden md:grid grid-cols-[1fr_1.2fr_100px_140px_120px_120px_100px] gap-2 px-5 py-2.5 bg-zinc-50 dark:bg-zinc-800/50 border-b border-zinc-200 dark:border-zinc-700">
                        {['No. Invoice', 'Pihak', 'Tipe', 'Jumlah', 'Status', 'Jatuh Tempo', 'Aksi'].map((h) => (
                            <span key={h} className="text-[10px] font-black uppercase tracking-widest text-zinc-400">{h}</span>
                        ))}
                    </div>

                    {/* Table Rows */}
                    {loading && pagedInvoices.length === 0 ? (
                        <div className="flex items-center justify-center py-16 text-zinc-400">
                            <Loader2 className="h-5 w-5 animate-spin mr-2" />
                            <span className="text-xs font-bold uppercase tracking-widest">Memuat data...</span>
                        </div>
                    ) : pagedInvoices.length === 0 ? (
                        <div className="flex-1 flex items-center justify-center text-zinc-400 text-xs font-bold uppercase tracking-widest">
                            Tidak ada invoice ditemukan
                        </div>
                    ) : (
                        <div className="divide-y divide-zinc-100 dark:divide-zinc-800">
                            {pagedInvoices.map((invoice, idx) => {
                                const cfg = statusConfig[invoice.status] || statusConfig.DRAFT
                                const isDraft = invoice.status === 'DRAFT'
                                const canPay = invoice.status === 'ISSUED' || invoice.status === 'OVERDUE' || invoice.status === 'PARTIAL'

                                return (
                                    <div
                                        key={invoice.id}
                                        className={`grid grid-cols-1 md:grid-cols-[1fr_1.2fr_100px_140px_120px_120px_100px] gap-2 px-5 py-3 items-center transition-colors hover:bg-orange-50/40 dark:hover:bg-orange-950/10 ${idx % 2 === 0 ? '' : 'bg-zinc-50/30 dark:bg-zinc-800/10'}`}
                                    >
                                        {/* Invoice Number */}
                                        <div>
                                            <span className="font-mono text-sm font-bold text-zinc-900 dark:text-zinc-100">{invoice.number}</span>
                                        </div>

                                        {/* Party */}
                                        <div className="truncate">
                                            <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">{invoice.partyName}</span>
                                        </div>

                                        {/* Type */}
                                        <div>
                                            <span className={`text-[10px] font-black uppercase tracking-wide px-2 py-0.5 border rounded-sm ${invoice.type === 'INV_OUT'
                                                ? 'bg-blue-50 border-blue-200 text-blue-600'
                                                : 'bg-purple-50 border-purple-200 text-purple-600'
                                                }`}>
                                                {invoice.type === 'INV_OUT' ? 'Invoice' : 'Bill'}
                                            </span>
                                        </div>

                                        {/* Amount */}
                                        <div>
                                            <span className={`font-mono font-black text-sm ${invoice.status === 'OVERDUE' ? 'text-red-700' :
                                                invoice.status === 'PAID' ? 'text-emerald-700' : 'text-zinc-900 dark:text-zinc-100'
                                                }`}>
                                                {formatIDR(invoice.amount)}
                                            </span>
                                        </div>

                                        {/* Status Badge */}
                                        <div>
                                            <span className={`inline-flex items-center gap-1.5 text-[10px] font-black uppercase tracking-wide px-2.5 py-1 border rounded-sm ${cfg.bg} ${cfg.text}`}>
                                                <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
                                                {cfg.label}
                                            </span>
                                        </div>

                                        {/* Due Date */}
                                        <div>
                                            <span className={`text-xs font-medium ${invoice.status === 'OVERDUE' ? 'text-red-600 font-bold' : 'text-zinc-500'}`}>
                                                {new Date(invoice.dueDate).toLocaleDateString('id-ID')}
                                            </span>
                                        </div>

                                        {/* Actions */}
                                        <div className="flex gap-1.5">
                                            {isDraft && (
                                                <button
                                                    onClick={() => openSendDialog(invoice)}
                                                    title="Kirim Invoice"
                                                    className="h-8 w-8 flex items-center justify-center border-2 border-blue-300 text-blue-500 hover:bg-blue-50 hover:border-blue-500 hover:text-blue-700 transition-colors rounded-sm"
                                                >
                                                    <Send className="h-3.5 w-3.5" />
                                                </button>
                                            )}
                                            {canPay && (
                                                <button
                                                    onClick={() => openPayDialog(invoice)}
                                                    title="Catat Pembayaran"
                                                    className="h-8 w-8 flex items-center justify-center border-2 border-emerald-300 text-emerald-500 hover:bg-emerald-50 hover:border-emerald-500 hover:text-emerald-700 transition-colors rounded-sm"
                                                >
                                                    <Banknote className="h-3.5 w-3.5" />
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                )
                            })}
                        </div>
                    )}
                </div>

                {/* Pagination — always render to maintain consistent card height */}
                <div className="px-5 py-3 border-t-2 border-black flex items-center justify-between bg-zinc-50 dark:bg-zinc-800/50">
                    <span className="text-[10px] font-black uppercase tracking-widest text-zinc-400">
                        {filteredInvoices.length} total
                    </span>
                    {filteredInvoices.length > PAGE_SIZE ? (
                        <div className="flex items-center gap-2">
                            <Button
                                variant="outline"
                                size="icon"
                                className="h-8 w-8 border-2 border-black"
                                disabled={page <= 1}
                                onClick={() => setPage(p => p - 1)}
                            >
                                <ChevronLeft className="h-3.5 w-3.5" />
                            </Button>
                            <span className="text-xs font-black min-w-[50px] text-center">{page}/{totalPages}</span>
                            <Button
                                variant="outline"
                                size="icon"
                                className="h-8 w-8 border-2 border-black"
                                disabled={page >= totalPages}
                                onClick={() => setPage(p => p + 1)}
                            >
                                <ChevronRight className="h-3.5 w-3.5" />
                            </Button>
                        </div>
                    ) : (
                        <div />
                    )}
                </div>
            </div>

            {/* Create Invoice Dialog */}
            <CreateInvoiceDialog open={isCreatorOpen} onOpenChange={setIsCreatorOpen} />

            {/* SEND DIALOG */}
            <Dialog open={isSendDialogOpen} onOpenChange={setIsSendDialogOpen}>
                <DialogContent className="max-w-md border-2 border-black shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] p-0 overflow-hidden bg-white">
                    <DialogHeader className="p-6 pb-2 border-b border-black/10 bg-zinc-50">
                        <DialogTitle className="text-lg font-black uppercase flex items-center gap-2">
                            <Send className="h-5 w-5" /> Kirim Invoice {activeInvoice?.number}
                        </DialogTitle>
                        <DialogDescription className="font-medium text-black/60">
                            Pilih metode pengiriman dan konfirmasi pesan.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="p-6 space-y-4">
                        <div className="flex gap-3">
                            <button
                                onClick={() => setSendMethod('WHATSAPP')}
                                className={`flex-1 py-2 text-[10px] font-black uppercase tracking-wider border-2 transition-all ${sendMethod === 'WHATSAPP' ? 'border-green-600 bg-green-50 text-green-700' : 'border-zinc-200 text-zinc-400'}`}
                            >
                                WhatsApp
                            </button>
                            <button
                                onClick={() => setSendMethod('EMAIL')}
                                className={`flex-1 py-2 text-[10px] font-black uppercase tracking-wider border-2 transition-all ${sendMethod === 'EMAIL' ? 'border-blue-600 bg-blue-50 text-blue-700' : 'border-zinc-200 text-zinc-400'}`}
                            >
                                Email
                            </button>
                        </div>

                        <div className="space-y-1.5">
                            <Label className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Template</Label>
                            <Select onValueChange={(val) => {
                                if (!activeInvoice) return
                                const link = `https://erp.orico.com/invoices/${activeInvoice.id}`
                                const due = new Date(activeInvoice.dueDate).toLocaleDateString()
                                const map: Record<string, string> = {
                                    default: `Hi ${activeInvoice.partyName}, here is invoice ${activeInvoice.number} for ${formatIDR(activeInvoice.amount)}. Please make payment by ${due}. View: ${link}`,
                                    formal: `Dear ${activeInvoice.partyName},\n\nPlease find invoice ${activeInvoice.number} amounting to ${formatIDR(activeInvoice.amount)}. Payment due ${due}.\n\nView: ${link}\n\nSincerely,\nFinance Team`,
                                    friendly: `Hey ${activeInvoice.partyName}! Reminder about invoice ${activeInvoice.number} for ${formatIDR(activeInvoice.amount)}. Thanks! View: ${link}`,
                                    urgent: `URGENT: Invoice ${activeInvoice.number} for ${formatIDR(activeInvoice.amount)} is ready. Please process immediately. View: ${link}`,
                                }
                                setSendMessage(map[val] || '')
                            }}>
                                <SelectTrigger className="border-2 border-black h-10 font-medium">
                                    <SelectValue placeholder="Pilih template" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="default">Standard</SelectItem>
                                    <SelectItem value="formal">Formal</SelectItem>
                                    <SelectItem value="friendly">Friendly</SelectItem>
                                    <SelectItem value="urgent">Urgent</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="space-y-1.5">
                            <Label className="text-[10px] font-black uppercase tracking-widest text-zinc-500">
                                {sendMethod === 'WHATSAPP' ? 'Nomor WhatsApp' : 'Alamat Email'}
                            </Label>
                            {sendMethod === 'WHATSAPP' ? (
                                <div className="flex">
                                    <span className="flex items-center px-3 border-2 border-r-0 border-black bg-zinc-100 text-xs font-bold text-zinc-500">+62</span>
                                    <Input
                                        className="border-2 border-black h-10 font-medium rounded-l-none"
                                        placeholder="812-3456-7890"
                                        value={recipientContact}
                                        onChange={(e) => setRecipientContact(e.target.value)}
                                    />
                                </div>
                            ) : (
                                <Input
                                    className="border-2 border-black h-10 font-medium"
                                    placeholder="client@company.com"
                                    value={recipientContact}
                                    onChange={(e) => setRecipientContact(e.target.value)}
                                />
                            )}
                        </div>

                        <div className="space-y-1.5">
                            <Label className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Preview Pesan</Label>
                            <textarea
                                className="w-full h-28 p-3 border-2 border-black text-sm font-medium resize-none"
                                value={sendMessage}
                                onChange={(e) => setSendMessage(e.target.value)}
                            />
                        </div>
                    </div>
                    <DialogFooter className="p-6 pt-2 border-t border-black/10 bg-zinc-50 flex gap-2">
                        <Button variant="outline" className="border-2 border-zinc-300 font-bold uppercase text-xs" onClick={() => setIsSendDialogOpen(false)}>Batal</Button>
                        {sendMethod === 'WHATSAPP' ? (
                            <Button onClick={handleConfirmSend} className="bg-green-500 hover:bg-green-600 border-2 border-green-600 text-white font-black uppercase text-xs shadow-[3px_3px_0px_0px_rgba(0,0,0,0.2)] active:shadow-none active:translate-y-[1px] transition-all">
                                Kirim via WhatsApp
                            </Button>
                        ) : (
                            <Button onClick={handleConfirmSend} className="bg-blue-500 hover:bg-blue-600 border-2 border-blue-600 text-white font-black uppercase text-xs shadow-[3px_3px_0px_0px_rgba(0,0,0,0.2)] active:shadow-none active:translate-y-[1px] transition-all">
                                Kirim via Email
                            </Button>
                        )}
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* PAY DIALOG */}
            <Dialog open={isPayDialogOpen} onOpenChange={setIsPayDialogOpen}>
                <DialogContent className="max-w-md border-2 border-black shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] p-0 overflow-hidden bg-white">
                    <DialogHeader className="p-6 pb-2 border-b border-black/10 bg-zinc-50">
                        <DialogTitle className="text-lg font-black uppercase flex items-center gap-2">
                            <Banknote className="h-5 w-5" /> Catat Pembayaran {activeInvoice?.number}
                        </DialogTitle>
                        <DialogDescription className="font-medium text-black/60">
                            Konfirmasi detail penerimaan pembayaran.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="p-6 space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-1.5">
                                <Label className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Tanggal Terima</Label>
                                <Input type="date" className="border-2 border-black h-10 font-medium" value={payDate} onChange={(e) => setPayDate(e.target.value)} />
                            </div>
                            <div className="space-y-1.5">
                                <Label className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Jumlah Diterima</Label>
                                <div className="relative">
                                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-zinc-400">Rp</span>
                                    <Input type="number" className="border-2 border-black h-10 font-bold pl-9" value={payAmount} onChange={(e) => setPayAmount(e.target.value)} />
                                </div>
                            </div>
                        </div>
                        <div className="space-y-1.5">
                            <Label className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Metode Pembayaran</Label>
                            <Select value={payMethod} onValueChange={(v: any) => setPayMethod(v)}>
                                <SelectTrigger className="border-2 border-black h-10 font-medium">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="TRANSFER">Bank Transfer</SelectItem>
                                    <SelectItem value="CASH">Cash</SelectItem>
                                    <SelectItem value="CHECK">Check/Giro</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-1.5">
                            <Label className="text-[10px] font-black uppercase tracking-widest text-zinc-500">No. Referensi (Opsional)</Label>
                            <Input className="border-2 border-black h-10 font-medium" placeholder="Ref #123456" value={payReference} onChange={(e) => setPayReference(e.target.value)} />
                        </div>
                    </div>
                    <DialogFooter className="p-6 pt-2 border-t border-black/10 bg-zinc-50 flex gap-2">
                        <Button variant="outline" className="border-2 border-zinc-300 font-bold uppercase text-xs" onClick={() => setIsPayDialogOpen(false)}>Batal</Button>
                        <Button
                            onClick={handleConfirmPayment}
                            className="bg-emerald-500 hover:bg-emerald-600 border-2 border-emerald-600 text-white font-black uppercase text-xs shadow-[3px_3px_0px_0px_rgba(0,0,0,0.2)] active:shadow-none active:translate-y-[1px] transition-all"
                        >
                            Konfirmasi Pembayaran
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    )
}
