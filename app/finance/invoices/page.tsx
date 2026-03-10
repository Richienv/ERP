"use client"

import { useEffect, useMemo, useState } from "react"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import {
    ChevronLeft,
    ChevronRight,
    FileText,
    Search,
    Send,
    Banknote,
    Loader2,
    Receipt,
    Pencil,
    BookOpen,
    Download,
    Paperclip,
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
import { CheckboxFilter } from "@/components/ui/checkbox-filter"
import {
    type InvoiceKanbanData,
    type InvoiceKanbanItem,
    moveInvoiceToSent,
    recordInvoicePayment,
    getInvoiceDetail,
    updateDraftInvoice,
    getInvoiceCustomers,
} from "@/lib/actions/finance-invoices"

import { useInvoiceKanban } from "@/hooks/use-invoices"
import { formatIDR } from "@/lib/utils"
import { toast } from "sonner"
import { CreateInvoiceDialog } from "@/components/finance/create-invoice-dialog"
import { InvoiceAttachmentSection } from "@/components/finance/invoice-attachments"
import { useQueryClient } from "@tanstack/react-query"
import { queryKeys } from "@/lib/query-keys"

const emptyKanban: InvoiceKanbanData = { draft: [], sent: [], overdue: [], paid: [] }
const PAGE_SIZE = 15

// Status filtering is handled by CheckboxFilter components

export default function InvoicesPage() {
    const [selectedTypes, setSelectedTypes] = useState<string[]>([])
    const [selectedStatuses, setSelectedStatuses] = useState<string[]>([])
    const [page, setPage] = useState(1)

    // Create invoice dialog
    const [isCreatorOpen, setIsCreatorOpen] = useState(false)

    // Workflow dialogs
    const [activeInvoice, setActiveInvoice] = useState<InvoiceKanbanItem | null>(null)
    const [isSendDialogOpen, setIsSendDialogOpen] = useState(false)
    const [isPayDialogOpen, setIsPayDialogOpen] = useState(false)
    const [attachmentInvoiceId, setAttachmentInvoiceId] = useState<string | null>(null)

    // Send form
    const [sendMethod, setSendMethod] = useState<'WHATSAPP' | 'EMAIL'>('WHATSAPP')
    const [sendMessage, setSendMessage] = useState("")
    const [recipientContact, setRecipientContact] = useState("")

    // Pay form
    const [payMethod, setPayMethod] = useState<'TRANSFER' | 'CASH' | 'CHECK'>('TRANSFER')
    const [payDate, setPayDate] = useState(new Date().toISOString().split('T')[0])
    const [payReference, setPayReference] = useState("")
    const [payAmount, setPayAmount] = useState("")
    const [paying, setPaying] = useState(false)
    const [sending, setSending] = useState(false)

    // Edit form (DRAFT only)
    const [isEditDialogOpen, setIsEditDialogOpen] = useState(false)
    const [editLoading, setEditLoading] = useState(false)
    const [editSaving, setEditSaving] = useState(false)
    const [editItems, setEditItems] = useState<Array<{ description: string; quantity: number; unitPrice: number }>>([])
    const [editIncludeTax, setEditIncludeTax] = useState(true)
    const [editIssueDate, setEditIssueDate] = useState("")
    const [editDueDate, setEditDueDate] = useState("")
    const [editDiscount, setEditDiscount] = useState(0)
    const [editPartyId, setEditPartyId] = useState("")
    const [editInvoiceType, setEditInvoiceType] = useState<'INV_OUT' | 'INV_IN'>('INV_OUT')
    const [editParties, setEditParties] = useState<Array<{ id: string; name: string; type: 'CUSTOMER' | 'SUPPLIER' }>>([])
    const [editNumber, setEditNumber] = useState("")

    const [searchText, setSearchText] = useState("")
    const router = useRouter()
    const pathname = usePathname()
    const searchParams = useSearchParams()
    const queryClient = useQueryClient()

    const q = (searchParams.get("q") || "").trim()
    const { data: invoices = emptyKanban, isLoading: loading } = useInvoiceKanban({ q: q || undefined })

    const pushSearchParams = (mutator: (params: URLSearchParams) => void) => {
        const next = new URLSearchParams(searchParams.toString())
        mutator(next)
        const qs = next.toString()
        router.replace(qs ? `${pathname}?${qs}` : pathname)
    }

    const invalidateInvoices = () => {
        queryClient.invalidateQueries({ queryKey: queryKeys.invoices.all })
    }

    const invalidateAfterSend = () => {
        queryClient.invalidateQueries({ queryKey: queryKeys.invoices.all })
        queryClient.invalidateQueries({ queryKey: queryKeys.financeDashboard.all })
    }

    const invalidateAfterPayment = () => {
        queryClient.invalidateQueries({ queryKey: queryKeys.invoices.all })
        queryClient.invalidateQueries({ queryKey: queryKeys.financeDashboard.all })
        queryClient.invalidateQueries({ queryKey: queryKeys.vendorPayments.all })
        queryClient.invalidateQueries({ queryKey: queryKeys.bills.all })
    }

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
        return allInvoices.filter(i => {
            // Type filter: empty = show all
            if (selectedTypes.length > 0 && !selectedTypes.includes(i.type)) return false
            // Status filter: empty = show all
            // Map ISSUED status to match _tab "SENT" bucket, and handle OVERDUE which is a _tab but maps to ISSUED/OVERDUE status
            if (selectedStatuses.length > 0) {
                // Use _tab for matching since that's how invoices are bucketed
                const tabToStatus: Record<string, string> = { DRAFT: 'DRAFT', SENT: 'ISSUED', OVERDUE: 'OVERDUE', PAID: 'PAID' }
                const mappedStatus = tabToStatus[i._tab] || i.status
                if (!selectedStatuses.includes(mappedStatus)) return false
            }
            return true
        })
    }, [allInvoices, selectedTypes, selectedStatuses])

    const totalPages = Math.max(1, Math.ceil(filteredInvoices.length / PAGE_SIZE))
    const pagedInvoices = filteredInvoices.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

    useEffect(() => { setPage(1) }, [selectedTypes, selectedStatuses])

    // Handle ?highlight={invoiceId} — auto-open detail dialog for linked invoice
    const highlightId = searchParams.get("highlight")
    useEffect(() => {
        if (!highlightId || loading || allInvoices.length === 0) return
        const invoice = allInvoices.find(i => i.id === highlightId)
        if (invoice) {
            openEditDialog(invoice)
            // Clear highlight from URL to prevent re-triggering
            const next = new URLSearchParams(searchParams.toString())
            next.delete("highlight")
            const qs = next.toString()
            router.replace(qs ? `${pathname}?${qs}` : pathname)
        }
    }, [highlightId, loading, allInvoices]) // eslint-disable-line react-hooks/exhaustive-deps

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
        setSendMessage(invoice.partyName ? `Hi ${invoice.partyName}, here is invoice ${invoice.number} for ${formatIDR(invoice.amount)}. Please make payment by ${new Date(invoice.dueDate).toLocaleDateString()}. View Invoice: https://erp.orico.com/invoices/${invoice.id}` : "")
        setRecipientContact("")
        setIsSendDialogOpen(true)
    }

    const openPayDialog = (invoice: InvoiceKanbanItem) => {
        setActiveInvoice(invoice)
        setPayAmount(String(invoice.balanceDue ?? invoice.amount))
        setPayDate(new Date().toISOString().split('T')[0])
        setPayReference("")
        setIsPayDialogOpen(true)
    }

    const openEditDialog = async (invoice: InvoiceKanbanItem) => {
        setActiveInvoice(invoice)
        setEditLoading(true)
        setIsEditDialogOpen(true)
        try {
            const [detailResult, parties] = await Promise.all([
                getInvoiceDetail(invoice.id) as any,
                getInvoiceCustomers(),
            ])
            if (detailResult.success && detailResult.data) {
                const inv = detailResult.data as any
                setEditItems(inv.items.map((item: any) => ({
                    description: item.description || '',
                    quantity: Number(item.quantity),
                    unitPrice: Number(item.unitPrice),
                })))
                setEditIncludeTax(Number(inv.taxAmount) > 0)
                setEditIssueDate(new Date(inv.issueDate).toISOString().split('T')[0])
                setEditDueDate(new Date(inv.dueDate).toISOString().split('T')[0])
                setEditDiscount(Number(inv.discountAmount) || 0)
                setEditInvoiceType(inv.type)
                setEditPartyId(inv.customerId || inv.supplierId || "")
                setEditNumber(inv.number || "")
            }
            setEditParties(parties || [])
        } catch {
            toast.error("Gagal memuat detail invoice")
        } finally {
            setEditLoading(false)
        }
    }

    const handleSaveEdit = async () => {
        if (!activeInvoice || editSaving) return
        if (editItems.length === 0 || editItems.some(i => !i.description || i.quantity <= 0 || i.unitPrice <= 0)) {
            toast.error("Lengkapi semua item dengan benar")
            return
        }
        if (!editPartyId) {
            toast.error("Pilih customer/vendor terlebih dahulu")
            return
        }
        setEditSaving(true)
        try {
            const result = await updateDraftInvoice({
                invoiceId: activeInvoice.id,
                customerId: editPartyId,
                items: editItems,
                includeTax: editIncludeTax,
                discountAmount: editDiscount,
                issueDate: new Date(editIssueDate + 'T12:00:00'),
                dueDate: new Date(editDueDate + 'T12:00:00'),
            })
            if (result.success) {
                toast.success("Invoice berhasil diupdate")
                setIsEditDialogOpen(false)
                invalidateInvoices()
            } else {
                toast.error(result.error || "Gagal mengupdate invoice")
            }
        } catch {
            toast.error("Terjadi kesalahan")
        } finally {
            setEditSaving(false)
        }
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
        if (sendMethod === 'EMAIL') {
            toast.info("Email akan dikirim ke pelanggan (fitur SMTP belum aktif — status invoice tetap diupdate)")
        }
        setSending(true)
        try {
            const result: any = await moveInvoiceToSent(activeInvoice.id, sendMessage, sendMethod)
            if (!result.success) throw new Error(result.error || "Gagal mengirim invoice")
            toast.success(result.status === 'OVERDUE' ? "Invoice dipindahkan ke Jatuh Tempo." : "Invoice terkirim!")
            setIsSendDialogOpen(false)
            invalidateAfterSend()
        } catch {
            toast.error("Gagal mengirim invoice")
        } finally {
            setSending(false)
            setActiveInvoice(null)
        }
    }

    const handleConfirmPayment = async () => {
        if (!activeInvoice || paying) return
        const amount = parseFloat(payAmount)
        if (!amount || amount <= 0) {
            toast.error("Masukkan jumlah pembayaran yang valid")
            return
        }
        const balanceDue = activeInvoice.balanceDue ?? activeInvoice.amount
        if (amount > balanceDue) {
            toast.error("Jumlah pembayaran tidak boleh melebihi sisa tagihan")
            return
        }
        setPaying(true)
        try {
            const result: any = await recordInvoicePayment({
                invoiceId: activeInvoice.id,
                amount,
                paymentMethod: payMethod,
                paymentDate: new Date(payDate),
                reference: payReference,
                notes: "Pembayaran dari Invoice Center"
            })
            if (!result.success) {
                toast.error(result.error || "Gagal mencatat pembayaran")
                return
            }
            toast.success("Pembayaran berhasil dicatat")
            setIsPayDialogOpen(false)
            setActiveInvoice(null)
            invalidateAfterPayment()
        } catch (err: any) {
            toast.error(err?.message || "Gagal mencatat pembayaran")
        } finally {
            setPaying(false)
        }
    }

    const applyFilters = () => {
        pushSearchParams((params) => {
            const q = searchText.trim()
            if (q) params.set("q", q)
            else params.delete("q")
        })
    }

    const resetFilters = () => {
        setSearchText("")
        setSelectedTypes([])
        setSelectedStatuses([])
        pushSearchParams((params) => {
            params.delete("q")
        })
    }

    const statusConfig: Record<string, { label: string; bg: string; text: string; dot: string }> = {
        DRAFT: { label: 'Draft', bg: 'bg-zinc-100 border-zinc-300', text: 'text-zinc-700', dot: 'bg-zinc-400' },
        ISSUED: { label: 'Terkirim', bg: 'bg-blue-50 border-blue-300', text: 'text-blue-700', dot: 'bg-blue-500' },
        OVERDUE: { label: 'Jatuh Tempo', bg: 'bg-red-50 border-red-300', text: 'text-red-700', dot: 'bg-red-500' },
        PARTIAL: { label: 'Sebagian', bg: 'bg-amber-50 border-amber-300', text: 'text-amber-700', dot: 'bg-amber-500' },
        PAID: { label: 'Lunas', bg: 'bg-emerald-50 border-emerald-300', text: 'text-emerald-700', dot: 'bg-emerald-500' },
    }


    return (
        <div className="mf-page">
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
                    <div className="flex gap-2">
                        <Button
                            onClick={() => router.push('/finance/transactions')}
                            variant="outline"
                            className="border-2 border-black font-black uppercase text-[10px] tracking-wide h-10 px-4 rounded-none shadow-[3px_3px_0px_0px_rgba(0,0,0,0.2)] active:shadow-none active:translate-y-[1px] transition-all"
                        >
                            <BookOpen className="h-3.5 w-3.5 mr-1.5" /> Transaksi Akun
                        </Button>
                        <Button
                            onClick={() => setIsCreatorOpen(true)}
                            className="bg-orange-500 text-white hover:bg-orange-600 border-2 border-orange-600 font-black uppercase text-[10px] tracking-wide h-10 px-5 rounded-none shadow-[3px_3px_0px_0px_rgba(0,0,0,0.2)] active:shadow-none active:translate-y-[1px] transition-all"
                        >
                            <FileText className="h-3.5 w-3.5 mr-1.5" /> Buat Invoice
                        </Button>
                    </div>
                </div>
            </div>

            {/* Search & Filter Bar */}
            <div className="border-2 border-black shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] bg-white dark:bg-zinc-900 overflow-hidden">
                <div className="p-4">
                    <div className="flex flex-col md:flex-row md:items-end gap-3">
                        <div className="relative flex-1">
                            <label className="text-[9px] font-black uppercase tracking-widest text-zinc-400 mb-1 block">Pencarian</label>
                            <Search className="pointer-events-none absolute left-3 bottom-3 h-4 w-4 text-zinc-400" />
                            <Input
                                className="border-2 border-black h-10 pl-9 font-medium rounded-none"
                                placeholder="Cari nomor invoice / customer / supplier..."
                                value={searchText}
                                onChange={(e) => setSearchText(e.target.value)}
                                onKeyDown={(e) => e.key === 'Enter' && applyFilters()}
                            />
                        </div>
                        <CheckboxFilter
                            label="Tipe Invoice"
                            options={[
                                { value: "INV_OUT", label: "Invoice Keluar" },
                                { value: "INV_IN", label: "Invoice Masuk" },
                            ]}
                            selected={selectedTypes}
                            onChange={setSelectedTypes}
                        />
                        <CheckboxFilter
                            label="Status"
                            options={[
                                { value: "DRAFT", label: "Draft" },
                                { value: "ISSUED", label: "Terkirim" },
                                { value: "OVERDUE", label: "Jatuh Tempo" },
                                { value: "PAID", label: "Lunas" },
                            ]}
                            selected={selectedStatuses}
                            onChange={setSelectedStatuses}
                        />
                        <div>
                            <label className="text-[9px] font-black uppercase tracking-widest text-transparent mb-1 block">Aksi</label>
                            <div className="flex gap-2">
                                <Button
                                    onClick={applyFilters}
                                    className="bg-orange-500 text-white hover:bg-orange-600 border-2 border-orange-600 font-black uppercase text-[10px] tracking-wide h-10 px-4 rounded-none"
                                >
                                    Terapkan
                                </Button>
                                <Button
                                    variant="outline"
                                    onClick={resetFilters}
                                    className="border-2 border-zinc-300 font-bold uppercase text-[10px] tracking-wide h-10 px-4 rounded-none"
                                >
                                    Reset
                                </Button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Status Summary Chips */}
            <div className="flex gap-2 flex-wrap">
                {[
                    { label: 'Semua', count: counts.all, color: 'orange' },
                    { label: 'Draft', count: counts.draft, color: 'zinc' },
                    { label: 'Terkirim', count: counts.sent, color: 'blue' },
                    { label: 'Jatuh Tempo', count: counts.overdue, color: 'red' },
                    { label: 'Lunas', count: counts.paid, color: 'emerald' },
                ].map((chip) => (
                    <div
                        key={chip.label}
                        className="flex items-center gap-2 px-4 py-2 border-2 border-zinc-200 bg-zinc-50 text-[11px] font-black uppercase tracking-widest"
                    >
                        {chip.label}
                        <span className="text-[10px] font-black px-1.5 py-0.5 min-w-[22px] text-center rounded-none bg-zinc-200 text-zinc-500">
                            {chip.count}
                        </span>
                    </div>
                ))}
            </div>

            {/* Invoice Table */}
            <div className="border-2 border-black shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] bg-white dark:bg-zinc-900 overflow-hidden flex flex-col" style={{ minHeight: 480 }}>
                <div className="bg-orange-50 dark:bg-orange-950/20 px-5 py-2.5 border-b-2 border-black flex items-center gap-2 border-l-[5px] border-l-orange-400">
                    <Receipt className="h-4 w-4 text-orange-600" />
                    <h3 className="text-[11px] font-black uppercase tracking-widest text-zinc-700 dark:text-zinc-200">
                        Daftar Invoice
                    </h3>
                    <span className="bg-orange-500 text-white text-[10px] font-black px-2 py-0.5 min-w-[20px] text-center rounded-none">
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
                                            <span className={`text-[10px] font-black uppercase tracking-wide px-2 py-0.5 border rounded-none ${invoice.type === 'INV_OUT'
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
                                            <span className={`inline-flex items-center gap-1.5 text-[10px] font-black uppercase tracking-wide px-2.5 py-1 border rounded-none ${cfg.bg} ${cfg.text}`}>
                                                <span className={`w-1.5 h-1.5 rounded-none ${cfg.dot}`} />
                                                {cfg.label}
                                            </span>
                                            {invoice.status === 'ISSUED' && invoice.issueDate && (
                                                <p className="text-[9px] text-zinc-400 mt-0.5 font-medium">
                                                    Dikirim {new Date(invoice.issueDate).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                                                </p>
                                            )}
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
                                                <>
                                                    <button
                                                        onClick={() => openEditDialog(invoice)}
                                                        title="Edit Invoice"
                                                        className="h-8 w-8 flex items-center justify-center border-2 border-orange-300 text-orange-500 hover:bg-orange-50 hover:border-orange-500 hover:text-orange-700 transition-colors rounded-none"
                                                    >
                                                        <Pencil className="h-3.5 w-3.5" />
                                                    </button>
                                                    <button
                                                        onClick={() => openSendDialog(invoice)}
                                                        title="Kirim Invoice"
                                                        className="h-8 w-8 flex items-center justify-center border-2 border-blue-300 text-blue-500 hover:bg-blue-50 hover:border-blue-500 hover:text-blue-700 transition-colors rounded-none"
                                                    >
                                                        <Send className="h-3.5 w-3.5" />
                                                    </button>
                                                </>
                                            )}
                                            {canPay && (
                                                <button
                                                    onClick={() => openPayDialog(invoice)}
                                                    title="Catat Pembayaran"
                                                    className="h-8 w-8 flex items-center justify-center border-2 border-emerald-300 text-emerald-500 hover:bg-emerald-50 hover:border-emerald-500 hover:text-emerald-700 transition-colors rounded-none"
                                                >
                                                    <Banknote className="h-3.5 w-3.5" />
                                                </button>
                                            )}
                                            <button
                                                onClick={() => window.open(`/api/documents/invoice/${invoice.id}?disposition=inline`, '_blank')}
                                                title="Cetak Invoice PDF"
                                                className="h-8 w-8 flex items-center justify-center border-2 border-zinc-300 text-zinc-500 hover:bg-zinc-50 hover:border-zinc-500 hover:text-zinc-700 transition-colors rounded-none"
                                            >
                                                <Download className="h-3.5 w-3.5" />
                                            </button>
                                            <button
                                                onClick={() => setAttachmentInvoiceId(attachmentInvoiceId === invoice.id ? null : invoice.id)}
                                                title="Lampiran"
                                                className={`h-8 w-8 flex items-center justify-center border-2 transition-colors rounded-none ${
                                                    attachmentInvoiceId === invoice.id
                                                        ? "border-violet-500 text-violet-700 bg-violet-50"
                                                        : "border-zinc-300 text-zinc-500 hover:bg-zinc-50 hover:border-zinc-500 hover:text-zinc-700"
                                                }`}
                                            >
                                                <Paperclip className="h-3.5 w-3.5" />
                                            </button>
                                        </div>
                                        {/* Inline Attachment Section */}
                                        {attachmentInvoiceId === invoice.id && (
                                            <div className="col-span-full mt-2 pt-2 border-t border-zinc-200">
                                                <InvoiceAttachmentSection invoiceId={invoice.id} />
                                            </div>
                                        )}
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
                                className="h-8 w-8 border-2 border-black rounded-none"
                                disabled={page <= 1}
                                onClick={() => setPage(p => p - 1)}
                            >
                                <ChevronLeft className="h-3.5 w-3.5" />
                            </Button>
                            <span className="text-xs font-black min-w-[50px] text-center">{page}/{totalPages}</span>
                            <Button
                                variant="outline"
                                size="icon"
                                className="h-8 w-8 border-2 border-black rounded-none"
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
                <DialogContent className="max-w-md border-2 border-black shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] rounded-none p-0 overflow-hidden bg-white">
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
                                const name = activeInvoice.partyName || "Pelanggan"
                                const map: Record<string, string> = {
                                    default: `Hi ${name}, here is invoice ${activeInvoice.number} for ${formatIDR(activeInvoice.amount)}. Please make payment by ${due}. View: ${link}`,
                                    formal: `Dear ${name},\n\nPlease find invoice ${activeInvoice.number} amounting to ${formatIDR(activeInvoice.amount)}. Payment due ${due}.\n\nView: ${link}\n\nSincerely,\nFinance Team`,
                                    friendly: `Hey ${name}! Reminder about invoice ${activeInvoice.number} for ${formatIDR(activeInvoice.amount)}. Thanks! View: ${link}`,
                                    urgent: `URGENT: Invoice ${activeInvoice.number} for ${formatIDR(activeInvoice.amount)} is ready. Please process immediately. View: ${link}`,
                                }
                                setSendMessage(map[val] || '')
                            }}>
                                <SelectTrigger className="border-2 border-black h-10 font-medium rounded-none">
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
                                    <span className="flex items-center px-3 border-2 border-r-0 border-black bg-zinc-100 text-xs font-bold text-zinc-500 rounded-none">+62</span>
                                    <Input
                                        className="border-2 border-black h-10 font-medium rounded-none"
                                        placeholder="Masukkan nomor WhatsApp"
                                        value={recipientContact}
                                        onChange={(e) => setRecipientContact(e.target.value)}
                                    />
                                </div>
                            ) : (
                                <Input
                                    className="border-2 border-black h-10 font-medium rounded-none"
                                    placeholder="Masukkan alamat email"
                                    value={recipientContact}
                                    onChange={(e) => setRecipientContact(e.target.value)}
                                />
                            )}
                        </div>

                        <div className="space-y-1.5">
                            <Label className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Preview Pesan</Label>
                            <textarea
                                className="w-full h-28 p-3 border-2 border-black text-sm font-medium resize-none rounded-none"
                                value={sendMessage}
                                onChange={(e) => setSendMessage(e.target.value)}
                            />
                        </div>
                    </div>
                    <DialogFooter className="p-6 pt-2 border-t border-black/10 bg-zinc-50 flex gap-2">
                        <Button variant="outline" className="border-2 border-zinc-300 font-bold uppercase text-xs rounded-none" onClick={() => setIsSendDialogOpen(false)}>Batal</Button>
                        {sendMethod === 'WHATSAPP' ? (
                            <Button onClick={handleConfirmSend} className="bg-green-500 hover:bg-green-600 border-2 border-green-600 text-white font-black uppercase text-xs rounded-none shadow-[3px_3px_0px_0px_rgba(0,0,0,0.2)] active:shadow-none active:translate-y-[1px] transition-all">
                                Kirim via WhatsApp
                            </Button>
                        ) : (
                            <Button onClick={handleConfirmSend} className="bg-blue-500 hover:bg-blue-600 border-2 border-blue-600 text-white font-black uppercase text-xs rounded-none shadow-[3px_3px_0px_0px_rgba(0,0,0,0.2)] active:shadow-none active:translate-y-[1px] transition-all">
                                Kirim via Email
                            </Button>
                        )}
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* EDIT DRAFT DIALOG */}
            <Dialog open={isEditDialogOpen} onOpenChange={(open) => { if (!editSaving) setIsEditDialogOpen(open) }}>
                <DialogContent className="max-w-2xl border-2 border-black shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] rounded-none p-0 overflow-y-auto max-h-[90vh] bg-white">
                    <DialogHeader className="p-6 pb-3 border-b-2 border-black bg-orange-50">
                        <DialogTitle className="text-lg font-black uppercase flex items-center gap-2">
                            <Pencil className="h-5 w-5" /> Edit Invoice Draft
                        </DialogTitle>
                        <DialogDescription className="font-medium text-black/60">
                            Edit semua detail invoice sebelum dikirim ke klien.
                        </DialogDescription>
                        {editNumber && (
                            <div className="flex items-center gap-2 mt-2">
                                <span className="font-mono text-sm font-black bg-white border-2 border-black px-3 py-1">{editNumber}</span>
                                <span className={`text-[10px] font-black uppercase tracking-wide px-2 py-0.5 border rounded-none ${editInvoiceType === 'INV_OUT' ? 'bg-blue-50 border-blue-200 text-blue-600' : 'bg-purple-50 border-purple-200 text-purple-600'}`}>
                                    {editInvoiceType === 'INV_OUT' ? 'Invoice' : 'Bill'}
                                </span>
                            </div>
                        )}
                    </DialogHeader>
                    <div className="p-6 space-y-5">
                        {editLoading ? (
                            <div className="flex items-center justify-center py-12 text-zinc-400">
                                <Loader2 className="h-5 w-5 animate-spin mr-2" />
                                <span className="text-xs font-bold uppercase tracking-widest">Memuat detail invoice...</span>
                            </div>
                        ) : (
                            <>
                                {/* Party (Customer/Vendor) Selector */}
                                <div className="space-y-1.5">
                                    <Label className="text-[10px] font-black uppercase tracking-widest text-zinc-500">
                                        {editInvoiceType === 'INV_OUT' ? 'Customer' : 'Vendor / Supplier'} <span className="text-red-500">*</span>
                                    </Label>
                                    <Select value={editPartyId} onValueChange={setEditPartyId}>
                                        <SelectTrigger className="border-2 border-black h-10 font-medium rounded-none">
                                            <SelectValue placeholder={`Pilih ${editInvoiceType === 'INV_OUT' ? 'customer' : 'vendor'}`} />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {editParties
                                                .filter(p => editInvoiceType === 'INV_OUT' ? p.type === 'CUSTOMER' : p.type === 'SUPPLIER')
                                                .map((party) => (
                                                    <SelectItem key={party.id} value={party.id}>
                                                        {party.name}
                                                    </SelectItem>
                                                ))
                                            }
                                        </SelectContent>
                                    </Select>
                                </div>

                                {/* Items Table */}
                                <div className="space-y-3">
                                    <Label className="text-[10px] font-black uppercase tracking-widest text-zinc-500">
                                        Item Invoice <span className="text-red-500">*</span>
                                    </Label>
                                    <div className="border-2 border-black overflow-hidden">
                                        {/* Table header */}
                                        <div className="grid grid-cols-[1fr_80px_120px_100px_36px] gap-0 bg-zinc-100 border-b-2 border-black">
                                            <span className="text-[9px] font-black uppercase tracking-widest text-zinc-500 px-3 py-2">Deskripsi</span>
                                            <span className="text-[9px] font-black uppercase tracking-widest text-zinc-500 px-3 py-2">Qty</span>
                                            <span className="text-[9px] font-black uppercase tracking-widest text-zinc-500 px-3 py-2">Harga Satuan</span>
                                            <span className="text-[9px] font-black uppercase tracking-widest text-zinc-500 px-3 py-2 text-right">Jumlah</span>
                                            <span />
                                        </div>
                                        {/* Table rows */}
                                        {editItems.map((item, idx) => (
                                            <div key={idx} className="grid grid-cols-[1fr_80px_120px_100px_36px] gap-0 border-b border-zinc-200 last:border-b-0 items-center">
                                                <div className="px-1.5 py-1">
                                                    <Input
                                                        className="border border-zinc-200 h-8 text-sm font-medium rounded-none focus:border-orange-400"
                                                        placeholder="Deskripsi item..."
                                                        value={item.description}
                                                        onChange={(e) => {
                                                            const next = [...editItems]
                                                            next[idx] = { ...next[idx], description: e.target.value }
                                                            setEditItems(next)
                                                        }}
                                                    />
                                                </div>
                                                <div className="px-1.5 py-1">
                                                    <Input
                                                        type="number"
                                                        className="border border-zinc-200 h-8 text-sm font-mono rounded-sm text-center focus:border-orange-400"
                                                        value={item.quantity}
                                                        onChange={(e) => {
                                                            const next = [...editItems]
                                                            next[idx] = { ...next[idx], quantity: Math.max(1, Number(e.target.value) || 1) }
                                                            setEditItems(next)
                                                        }}
                                                    />
                                                </div>
                                                <div className="px-1.5 py-1">
                                                    <Input
                                                        type="number"
                                                        className="border border-zinc-200 h-8 text-sm font-mono rounded-none focus:border-orange-400"
                                                        value={item.unitPrice}
                                                        onChange={(e) => {
                                                            const next = [...editItems]
                                                            next[idx] = { ...next[idx], unitPrice: Number(e.target.value) || 0 }
                                                            setEditItems(next)
                                                        }}
                                                    />
                                                </div>
                                                <div className="px-3 py-1 text-right">
                                                    <span className="text-sm font-mono font-bold text-zinc-700">
                                                        {formatIDR(item.quantity * item.unitPrice)}
                                                    </span>
                                                </div>
                                                <div className="px-1 py-1">
                                                    <button
                                                        className="h-8 w-8 flex items-center justify-center border border-red-200 text-red-400 hover:bg-red-50 hover:text-red-600 rounded-none transition-colors"
                                                        onClick={() => setEditItems(editItems.filter((_, i) => i !== idx))}
                                                        disabled={editItems.length <= 1}
                                                    >
                                                        ×
                                                    </button>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        className="border-dashed border-2 text-[10px] font-bold uppercase w-full hover:bg-orange-50 hover:border-orange-300 rounded-none"
                                        onClick={() => setEditItems([...editItems, { description: '', quantity: 1, unitPrice: 0 }])}
                                    >
                                        + Tambah Item
                                    </Button>
                                </div>

                                {/* Dates */}
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-1.5">
                                        <Label className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Tanggal Terbit</Label>
                                        <Input type="date" className="border-2 border-black h-9 rounded-none" value={editIssueDate} onChange={(e) => setEditIssueDate(e.target.value)} />
                                    </div>
                                    <div className="space-y-1.5">
                                        <Label className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Jatuh Tempo</Label>
                                        <Input type="date" className="border-2 border-black h-9 rounded-none" value={editDueDate} onChange={(e) => setEditDueDate(e.target.value)} />
                                    </div>
                                </div>

                                {/* Discount */}
                                <div className="space-y-1.5">
                                    <Label className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Diskon (Rp)</Label>
                                    <div className="relative">
                                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-zinc-400">Rp</span>
                                        <Input
                                            type="number"
                                            className="border-2 border-black h-9 font-mono pl-9 rounded-none"
                                            value={editDiscount || ''}
                                            placeholder="0"
                                            onChange={(e) => setEditDiscount(Math.max(0, Number(e.target.value) || 0))}
                                        />
                                    </div>
                                </div>

                                {/* PPN Toggle */}
                                <div className="flex items-center justify-between border-2 border-zinc-200 px-4 py-2.5">
                                    <div>
                                        <span className="text-[10px] font-black uppercase tracking-widest text-zinc-500">PPN 11%</span>
                                        <p className="text-[9px] text-zinc-400 font-medium">Pajak Pertambahan Nilai</p>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => setEditIncludeTax(!editIncludeTax)}
                                        className={`relative w-11 h-6 rounded-none border-2 transition-colors ${editIncludeTax ? 'bg-emerald-500 border-emerald-600' : 'bg-zinc-200 border-zinc-300'}`}
                                    >
                                        <span className={`absolute top-0.5 w-4 h-4 bg-white rounded-none shadow transition-transform ${editIncludeTax ? 'left-5' : 'left-0.5'}`} />
                                    </button>
                                </div>

                                {/* Totals Summary */}
                                {(() => {
                                    const subtotal = editItems.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0)
                                    const afterDiscount = subtotal - editDiscount
                                    const tax = editIncludeTax ? Math.round(afterDiscount * 0.11) : 0
                                    const total = afterDiscount + tax
                                    return (
                                        <div className="border-2 border-black bg-zinc-50 px-4 py-3 space-y-1.5">
                                            <div className="flex justify-between items-center text-xs text-zinc-500">
                                                <span>Subtotal ({editItems.length} item)</span>
                                                <span className="font-mono font-bold">{formatIDR(subtotal)}</span>
                                            </div>
                                            {editDiscount > 0 && (
                                                <div className="flex justify-between items-center text-xs text-red-500">
                                                    <span>Diskon</span>
                                                    <span className="font-mono font-bold">- {formatIDR(editDiscount)}</span>
                                                </div>
                                            )}
                                            {editIncludeTax && (
                                                <div className="flex justify-between items-center text-xs text-zinc-500">
                                                    <span>PPN 11%</span>
                                                    <span className="font-mono font-bold">{formatIDR(tax)}</span>
                                                </div>
                                            )}
                                            <div className="flex justify-between items-center border-t-2 border-black pt-2 mt-1">
                                                <span className="text-[10px] font-black uppercase tracking-widest">Total Tagihan</span>
                                                <span className="font-mono font-black text-xl">{formatIDR(total)}</span>
                                            </div>
                                        </div>
                                    )
                                })()}
                                {/* Attachments */}
                                {activeInvoice && (
                                    <div className="border-t-2 border-zinc-200 pt-4">
                                        <InvoiceAttachmentSection invoiceId={activeInvoice.id} />
                                    </div>
                                )}
                            </>
                        )}
                    </div>
                    <DialogFooter className="p-6 pt-3 border-t-2 border-black bg-zinc-50 flex gap-2">
                        <Button
                            variant="outline"
                            className="border-2 border-zinc-300 font-bold uppercase text-xs rounded-none"
                            onClick={() => activeInvoice && window.open(`/api/documents/invoice/${activeInvoice.id}?disposition=inline`, '_blank')}
                            disabled={!activeInvoice}
                        >
                            <Download className="h-3.5 w-3.5 mr-1.5" /> Cetak PDF
                        </Button>
                        <div className="flex-1" />
                        <Button variant="outline" className="border-2 border-zinc-300 font-bold uppercase text-xs rounded-none" onClick={() => setIsEditDialogOpen(false)} disabled={editSaving}>Batal</Button>
                        <Button
                            onClick={handleSaveEdit}
                            disabled={editSaving || editLoading}
                            className="bg-orange-500 hover:bg-orange-600 border-2 border-orange-600 text-white font-black uppercase text-xs rounded-none shadow-[3px_3px_0px_0px_rgba(0,0,0,0.2)] active:shadow-none active:translate-y-[1px] transition-all"
                        >
                            {editSaving ? <><Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> Menyimpan...</> : "Simpan Perubahan"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* PAY DIALOG */}
            <Dialog open={isPayDialogOpen} onOpenChange={(open) => { if (!paying) setIsPayDialogOpen(open) }}>
                <DialogContent className="max-w-md border-2 border-black shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] rounded-none p-0 overflow-y-auto max-h-[90vh] bg-white">
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
                                <Input type="date" className="border-2 border-black h-10 font-medium rounded-none" value={payDate} onChange={(e) => setPayDate(e.target.value)} />
                            </div>
                            <div className="space-y-1.5">
                                <Label className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Jumlah Diterima</Label>
                                <div className="relative">
                                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-zinc-400">Rp</span>
                                    <Input type="number" className="border-2 border-black h-10 font-bold pl-9 rounded-none" value={payAmount} onChange={(e) => setPayAmount(e.target.value)} />
                                </div>
                            </div>
                        </div>
                        <div className="space-y-1.5">
                            <Label className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Metode Pembayaran</Label>
                            <Select value={payMethod} onValueChange={(v: any) => setPayMethod(v)}>
                                <SelectTrigger className="border-2 border-black h-10 font-medium rounded-none">
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
                            <Input className="border-2 border-black h-10 font-medium rounded-none" placeholder="Ref #123456" value={payReference} onChange={(e) => setPayReference(e.target.value)} />
                        </div>
                    </div>
                    <DialogFooter className="p-6 pt-2 border-t border-black/10 bg-zinc-50 flex gap-2">
                        <Button variant="outline" className="border-2 border-zinc-300 font-bold uppercase text-xs rounded-none" onClick={() => setIsPayDialogOpen(false)} disabled={paying}>Batal</Button>
                        <Button
                            onClick={handleConfirmPayment}
                            disabled={paying}
                            className="bg-emerald-500 hover:bg-emerald-600 border-2 border-emerald-600 text-white font-black uppercase text-xs rounded-none shadow-[3px_3px_0px_0px_rgba(0,0,0,0.2)] active:shadow-none active:translate-y-[1px] transition-all disabled:opacity-50"
                        >
                            {paying ? (
                                <><Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> Memproses...</>
                            ) : (
                                "Konfirmasi Pembayaran"
                            )}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    )
}
