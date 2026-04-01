"use client"

import { useEffect, useMemo, useState } from "react"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { useActionSignal } from "@/hooks/use-action-signal"
import {
    ChevronLeft,
    ChevronRight,
    Search,
    Send,
    Banknote,
    Loader2,
    Receipt,
    Pencil,
    BookOpen,
    Download,
    Paperclip,
    Clock,
    Plus,
    X,
    Filter,
    RotateCcw,
    Eye,
    EyeOff,
} from "lucide-react"
import { motion, AnimatePresence } from "framer-motion"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
    Dialog,
    DialogContent,
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
import { AuditLogTimeline } from "@/components/audit-log-timeline"
import { InvoiceAttachmentSection } from "@/components/finance/invoice-attachments"
import { useQueryClient } from "@tanstack/react-query"
import { queryKeys } from "@/lib/query-keys"
import { exportToExcel } from "@/lib/table-export"
import { NB } from "@/lib/dialog-styles"
import { getDefaultRate, calculateWithholding } from "@/lib/pph-helpers"
import type { PPhTypeValue } from "@/lib/pph-helpers"

import {
    ModulePageHeader,
    StatusBadge,
    ActionButtonGroup,
    type ActionButton,
} from "@/components/module"

/* ─── Animation variants ─── */
const stagger = {
    hidden: { opacity: 0 },
    show: { opacity: 1, transition: { staggerChildren: 0.07 } },
}
const fadeUp = {
    hidden: { opacity: 0, y: 14 },
    show: { opacity: 1, y: 0, transition: { type: "spring" as const, stiffness: 320, damping: 26 } },
}
const fadeX = {
    hidden: { opacity: 0, x: -12 },
    show: { opacity: 1, x: 0, transition: { type: "spring" as const, stiffness: 320, damping: 26 } },
}

const emptyKanban: InvoiceKanbanData = { draft: [], sent: [], overdue: [], paid: [] }
const PAGE_SIZE = 15

export function InvoicesPageClient() {
    const [selectedTypes, setSelectedTypes] = useState<string[]>([])
    const [selectedStatuses, setSelectedStatuses] = useState<string[]>([])
    const [page, setPage] = useState(1)
    const [showAmounts, setShowAmounts] = useState(false)

    const { triggered: autoOpenCreate, clear: clearAutoOpen } = useActionSignal("new")
    const [isCreatorOpen, setIsCreatorOpen] = useState(false)
    const [activeInvoice, setActiveInvoice] = useState<InvoiceKanbanItem | null>(null)
    const [isSendDialogOpen, setIsSendDialogOpen] = useState(false)
    const [isPayDialogOpen, setIsPayDialogOpen] = useState(false)
    const [attachmentInvoiceId, setAttachmentInvoiceId] = useState<string | null>(null)

    // Send form
    const [sendMethod, setSendMethod] = useState<'WHATSAPP' | 'EMAIL'>('WHATSAPP')
    const [sendMessage, setSendMessage] = useState("")
    const [recipientContact, setRecipientContact] = useState("")

    // Pay form
    const [payMethod, setPayMethod] = useState<'TRANSFER' | 'CASH' | 'CHECK' | 'GIRO' | 'CREDIT_CARD'>('TRANSFER')
    const [payDate, setPayDate] = useState(new Date().toISOString().split('T')[0])
    const [payReference, setPayReference] = useState("")
    const [payAmount, setPayAmount] = useState("")
    const [paying, setPaying] = useState(false)
    const [sending, setSending] = useState(false)

    // PPh withholding (AR — customer withholds)
    const [enablePPh, setEnablePPh] = useState(false)
    const [pphType, setPPhType] = useState<PPhTypeValue>("PPH_23")
    const [pphRate, setPPhRate] = useState(2)
    const [buktiPotongNo, setBuktiPotongNo] = useState("")

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

    // View dialog (non-DRAFT invoices — read-only)
    const [isViewDialogOpen, setIsViewDialogOpen] = useState(false)
    const [viewLoading, setViewLoading] = useState(false)
    const [viewData, setViewData] = useState<{
        number: string; status: string; type: string
        customerName: string; issueDate: string; dueDate: string
        items: Array<{ description: string; quantity: number; unitPrice: number; lineTotal: number }>
        subtotal: number; taxAmount: number; discountAmount: number; totalAmount: number; balanceDue: number
        payments: Array<{ id: string; number: string; amount: number; date: string; method: string }>
        journalEntries: Array<{ id: string; date: string; description: string; reference: string | null; lines: Array<{ accountCode: string; accountName: string; debit: number; credit: number }> }>
    } | null>(null)

    const [searchText, setSearchText] = useState("")
    const router = useRouter()
    const pathname = usePathname()
    const searchParams = useSearchParams()
    const queryClient = useQueryClient()

    const q = (searchParams.get("q") || "").trim()
    const { data: invoices = emptyKanban, isLoading: loading } = useInvoiceKanban({ q: q || undefined })

    // Auto-open create dialog from Cmd+K signal (?new=true)
    useEffect(() => {
        if (autoOpenCreate) {
            setIsCreatorOpen(true)
            clearAutoOpen()
        }
    }, [autoOpenCreate, clearAutoOpen])

    // Auto-update PPh rate when type changes
    useEffect(() => {
        setPPhRate(getDefaultRate(pphType))
    }, [pphType])

    // PPh calculation — base amount is the pay amount (what's being collected)
    const pphBaseAmount = parseFloat(payAmount) || 0
    const pphCalc = enablePPh ? calculateWithholding(pphRate, pphBaseAmount) : null

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
        queryClient.invalidateQueries({ queryKey: queryKeys.arPayments.all })
        queryClient.invalidateQueries({ queryKey: queryKeys.arAging.all })
        queryClient.invalidateQueries({ queryKey: queryKeys.journal.all })
        queryClient.invalidateQueries({ queryKey: queryKeys.chartAccounts.all })
        queryClient.invalidateQueries({ queryKey: queryKeys.financeReports.all })
    }
    const invalidateAfterPayment = () => {
        queryClient.invalidateQueries({ queryKey: queryKeys.invoices.all })
        queryClient.invalidateQueries({ queryKey: queryKeys.financeDashboard.all })
        queryClient.invalidateQueries({ queryKey: queryKeys.vendorPayments.all })
        queryClient.invalidateQueries({ queryKey: queryKeys.bills.all })
        queryClient.invalidateQueries({ queryKey: queryKeys.financeReports.all })
        queryClient.invalidateQueries({ queryKey: queryKeys.journal.all })
        queryClient.invalidateQueries({ queryKey: queryKeys.accountTransactions.all })
        queryClient.invalidateQueries({ queryKey: queryKeys.arPayments.all })
        queryClient.invalidateQueries({ queryKey: queryKeys.arAging.all })
        queryClient.invalidateQueries({ queryKey: queryKeys.chartAccounts.all })
    }

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
            if (selectedTypes.length > 0 && !selectedTypes.includes(i.type)) return false
            if (selectedStatuses.length > 0) {
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

    const highlightId = searchParams.get("highlight")
    useEffect(() => {
        if (!highlightId || loading || allInvoices.length === 0) return
        const invoice = allInvoices.find(i => i.id === highlightId)
        if (invoice) {
            if (invoice.status === "DRAFT") {
                openEditDialog(invoice)
            } else {
                openViewDialog(invoice)
            }
            const next = new URLSearchParams(searchParams.toString())
            next.delete("highlight")
            const qs = next.toString()
            router.replace(qs ? `${pathname}?${qs}` : pathname)
        }
    }, [highlightId, loading, allInvoices])

    const counts = useMemo(() => ({
        all: allInvoices.length,
        draft: invoices.draft.length,
        sent: invoices.sent.length,
        overdue: invoices.overdue.length,
        paid: invoices.paid.length,
    }), [allInvoices, invoices])

    /* ─── Workflow Handlers ─── */
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
        setEnablePPh(false)
        setPPhType("PPH_23")
        setPPhRate(2)
        setBuktiPotongNo("")
        setIsPayDialogOpen(true)
    }

    const openViewDialog = async (invoice: InvoiceKanbanItem) => {
        setActiveInvoice(invoice)
        setViewLoading(true)
        setIsViewDialogOpen(true)
        try {
            const detailResult = await getInvoiceDetail(invoice.id) as any
            if (detailResult.success && detailResult.data) {
                const inv = detailResult.data
                setViewData({
                    number: inv.number,
                    status: inv.status,
                    type: inv.type,
                    customerName: inv.customer?.name || inv.supplier?.name || "—",
                    issueDate: new Date(inv.issueDate).toLocaleDateString("id-ID"),
                    dueDate: new Date(inv.dueDate).toLocaleDateString("id-ID"),
                    items: inv.items.length > 0
                        ? inv.items.map((item: any) => ({
                            description: item.description || "",
                            quantity: Number(item.quantity),
                            unitPrice: Number(item.unitPrice),
                            lineTotal: Number(item.lineTotal),
                        }))
                        : inv.number?.match(/^(DN|CN)-/)
                            ? [{
                                description: ((inv.journalEntries || [])[0]?.description || '').replace(/^\[(CREDIT|DEBIT)_NOTE\]\s*\S+:\s*/, '') || 'Nota Debit/Kredit',
                                quantity: 1,
                                unitPrice: Math.abs(inv.subtotal),
                                lineTotal: Math.abs(inv.subtotal),
                            }]
                            : [],
                    subtotal: inv.subtotal,
                    taxAmount: inv.taxAmount,
                    discountAmount: inv.discountAmount,
                    totalAmount: inv.totalAmount,
                    balanceDue: inv.balanceDue,
                    payments: (inv.payments || []).map((p: any) => ({
                        id: p.id,
                        number: p.number,
                        amount: Number(p.amount),
                        date: new Date(p.date).toLocaleDateString("id-ID"),
                        method: p.method,
                    })),
                    journalEntries: (inv.journalEntries || []).map((je: any) => ({
                        id: je.id,
                        date: new Date(je.date).toLocaleDateString("id-ID"),
                        description: je.description,
                        reference: je.reference,
                        lines: (je.lines || []).map((l: any) => ({
                            accountCode: l.accountCode,
                            accountName: l.accountName,
                            debit: Number(l.debit),
                            credit: Number(l.credit),
                        })),
                    })),
                })
            }
        } catch {
            toast.error("Gagal memuat detail invoice")
        } finally {
            setViewLoading(false)
        }
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
        // Snapshot kanban for rollback on error
        const prevKanbanEdit = queryClient.getQueryData(queryKeys.invoices.kanban())
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
                if (prevKanbanEdit) queryClient.setQueryData(queryKeys.invoices.kanban(), prevKanbanEdit)
                toast.error(result.error || "Gagal mengupdate invoice")
            }
        } catch {
            if (prevKanbanEdit) queryClient.setQueryData(queryKeys.invoices.kanban(), prevKanbanEdit)
            toast.error("Terjadi kesalahan")
        } finally {
            setEditSaving(false)
        }
    }

    const handleConfirmSend = async () => {
        if (!activeInvoice) return
        if (sendMethod === 'WHATSAPP' && !recipientContact) {
            toast.error("Masukkan nomor WhatsApp")
            return
        }
        if (sendMethod === 'EMAIL') {
            toast.info("Email akan dikirim ke pelanggan (fitur SMTP belum aktif — status invoice tetap diupdate)")
        }
        // Optimistic: move invoice from draft to sent column
        const prevKanbanSend = queryClient.getQueryData(queryKeys.invoices.kanban())
        if (prevKanbanSend && activeInvoice) {
            queryClient.setQueryData(queryKeys.invoices.kanban(), (old: any) => {
                if (!old) return old
                const item = old.draft?.find((i: any) => i.id === activeInvoice.id)
                    || old.sent?.find((i: any) => i.id === activeInvoice.id)
                if (!item) return old
                return {
                    ...old,
                    draft: old.draft?.filter((i: any) => i.id !== activeInvoice.id) ?? [],
                    sent: [...(old.sent ?? []), { ...item, status: 'ISSUED' }],
                }
            })
        }
        setSending(true)
        try {
            // Update status FIRST, then redirect to WhatsApp
            const result: any = await moveInvoiceToSent(activeInvoice.id, sendMessage, sendMethod)
            if (!result.success) throw new Error(result.error || "Gagal mengirim invoice")
            toast.success(result.status === 'OVERDUE' ? "Invoice dipindahkan ke Jatuh Tempo." : "Invoice terkirim!")
            setIsSendDialogOpen(false)
            setActiveInvoice(null)
            invalidateAfterSend()
            // Open WhatsApp AFTER status is updated and cache invalidated
            if (sendMethod === 'WHATSAPP' && recipientContact) {
                const phone = recipientContact.replace(/\D/g, '')
                const text = encodeURIComponent(sendMessage)
                window.open(`https://wa.me/${phone}?text=${text}`, '_blank')
            }
        } catch (err: any) {
            if (prevKanbanSend) queryClient.setQueryData(queryKeys.invoices.kanban(), prevKanbanSend)
            console.error("Kirim invoice error:", err)
            toast.error(err?.message || "Gagal mengirim invoice", { duration: 8000 })
        } finally {
            setSending(false)
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
        // Optimistic: move invoice from sent/overdue to paid column
        const prevKanbanPay = queryClient.getQueryData(queryKeys.invoices.kanban())
        if (prevKanbanPay && activeInvoice) {
            queryClient.setQueryData(queryKeys.invoices.kanban(), (old: any) => {
                if (!old) return old
                // Find in sent or overdue columns
                const fromCol = old.sent?.find((i: any) => i.id === activeInvoice.id) ? 'sent'
                    : old.overdue?.find((i: any) => i.id === activeInvoice.id) ? 'overdue'
                    : null
                if (!fromCol) return old
                const item = old[fromCol].find((i: any) => i.id === activeInvoice.id)
                return {
                    ...old,
                    [fromCol]: old[fromCol].filter((i: any) => i.id !== activeInvoice.id),
                    paid: [...(old.paid ?? []), { ...item, status: 'PAID' }],
                }
            })
        }
        setPaying(true)
        try {
            const result: any = await recordInvoicePayment({
                invoiceId: activeInvoice.id,
                amount,
                paymentMethod: payMethod,
                paymentDate: new Date(payDate),
                reference: payReference,
                notes: "Pembayaran dari Invoice Center",
                withholding: enablePPh ? {
                    type: pphType,
                    rate: pphRate,
                    baseAmount: pphBaseAmount,
                    buktiPotongNo: buktiPotongNo || undefined,
                } : undefined,
            })
            if (!result.success) {
                toast.error(result.error || "Gagal mencatat pembayaran")
                return
            }
            toast.success("Pembayaran berhasil dicatat")
            setIsPayDialogOpen(false)
            setActiveInvoice(null)
            setEnablePPh(false)
            setPPhType("PPH_23")
            setPPhRate(2)
            setBuktiPotongNo("")
            invalidateAfterPayment()
        } catch (err: any) {
            if (prevKanbanPay) queryClient.setQueryData(queryKeys.invoices.kanban(), prevKanbanPay)
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
        pushSearchParams((params) => { params.delete("q") })
    }

    const totalAmount = useMemo(() => allInvoices.reduce((s, i) => s + (i.amount || 0), 0), [allInvoices])
    const overdueAmount = useMemo(() => invoices.overdue.reduce((s, i) => s + (i.amount || 0), 0), [invoices.overdue])

    /** Build action button config per invoice based on its status */
    const getInvoiceActions = (invoice: InvoiceKanbanItem): ActionButton[] => {
        const isDraft = invoice.status === 'DRAFT'
        const canPay = invoice.status === 'ISSUED' || invoice.status === 'OVERDUE' || invoice.status === 'PARTIAL'
        const actions: ActionButton[] = []

        // Eye icon — opens detail view for all invoices
        actions.push({ icon: "view", onClick: () => isDraft ? openEditDialog(invoice) : openViewDialog(invoice), tooltip: "Lihat Detail" })

        if (isDraft) {
            actions.push({ icon: "send", onClick: () => openSendDialog(invoice), tooltip: "Kirim Invoice" })
        }
        if (canPay) {
            actions.push({ icon: "pay", onClick: () => openPayDialog(invoice), tooltip: "Catat Pembayaran", variant: "primary" })
        }
        actions.push({ icon: "download", onClick: () => window.open(`/api/documents/invoice/${invoice.id}?disposition=inline`, '_blank'), tooltip: "Download PDF" })

        return actions
    }

    return (
        <motion.div
            className="mf-page"
            variants={stagger}
            initial="hidden"
            animate="show"
        >
            {/* ─── Unified Page Header (ModulePageHeader) ─── */}
            <motion.div variants={fadeUp}>
                <ModulePageHeader
                    icon={<Receipt className="h-4.5 w-4.5 text-white" />}
                    title="Invoice Center"
                    subtitle="Kelola invoice, tagihan, dan pembayaran"
                    secondaryActions={[
                        {
                            label: "Export",
                            icon: <Download className="h-3.5 w-3.5" />,
                            onClick: () => {
                                const cols = [
                                    { header: "No. Invoice", accessorKey: "number" },
                                    { header: "Tipe", accessorKey: "type" },
                                    { header: "Customer/Vendor", accessorKey: "partyName" },
                                    { header: "Jumlah", accessorKey: "amount" },
                                    { header: "Sisa", accessorKey: "balanceDue" },
                                    { header: "Status", accessorKey: "_tab" },
                                    { header: "Jatuh Tempo", accessorKey: "dueDate" },
                                ]
                                exportToExcel(cols, filteredInvoices as unknown as Record<string, unknown>[], { filename: "invoices" })
                            },
                        },
                        {
                            label: "Transaksi",
                            icon: <BookOpen className="h-3.5 w-3.5" />,
                            onClick: () => router.push('/finance/transactions'),
                        },
                    ]}
                    primaryAction={{
                        label: "Buat Invoice",
                        icon: <Plus className="h-3.5 w-3.5" />,
                        onClick: () => setIsCreatorOpen(true),
                    }}
                >
                    {/* Row 2: KPI Summary Strip — label + count side by side */}
                    <div className="flex items-center border-b border-zinc-200 dark:border-zinc-800 divide-x divide-zinc-200 dark:divide-zinc-800">
                        {[
                            { label: 'Semua', count: counts.all, amount: totalAmount, color: 'orange' },
                            { label: 'Draft', count: counts.draft, amount: null, color: 'zinc' },
                            { label: 'Terkirim', count: counts.sent, amount: null, color: 'blue' },
                            { label: 'Jatuh Tempo', count: counts.overdue, amount: overdueAmount, color: 'red' },
                            { label: 'Lunas', count: counts.paid, amount: null, color: 'emerald' },
                        ].map((kpi) => (
                            <div
                                key={kpi.label}
                                className="flex-1 px-4 py-3 flex items-center justify-between gap-3 cursor-default"
                            >
                                <div className="flex items-center gap-1.5">
                                    <span className={`w-2 h-2 ${
                                        kpi.color === 'orange' ? 'bg-orange-500' :
                                        kpi.color === 'zinc' ? 'bg-zinc-400' :
                                        kpi.color === 'blue' ? 'bg-blue-500' :
                                        kpi.color === 'red' ? 'bg-red-500' : 'bg-emerald-500'
                                    }`} />
                                    <span className="text-[11px] font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">{kpi.label}</span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <motion.span
                                        key={kpi.count}
                                        initial={{ scale: 0.8, opacity: 0 }}
                                        animate={{ scale: 1, opacity: 1 }}
                                        transition={{ type: "spring" as const, stiffness: 400, damping: 20 }}
                                        className={`text-xl font-black ${
                                            kpi.color === 'red' && kpi.count > 0
                                                ? 'text-red-600 dark:text-red-400'
                                                : 'text-zinc-900 dark:text-white'
                                        }`}
                                    >
                                        {kpi.count}
                                    </motion.span>
                                    {kpi.amount !== null && kpi.amount > 0 && (
                                        <AnimatePresence>
                                            {showAmounts && (
                                                <motion.span
                                                    initial={{ opacity: 0, x: -8 }}
                                                    animate={{ opacity: 1, x: 0 }}
                                                    exit={{ opacity: 0, x: -8 }}
                                                    transition={{ type: "spring" as const, stiffness: 300, damping: 25 }}
                                                    className="text-xs font-mono font-bold text-zinc-500 dark:text-zinc-400"
                                                >
                                                    {formatIDR(kpi.amount)}
                                                </motion.span>
                                            )}
                                        </AnimatePresence>
                                    )}
                                    {kpi.amount !== null && (
                                        <button
                                            onClick={() => setShowAmounts(!showAmounts)}
                                            className="p-0.5 text-zinc-300 hover:text-zinc-500 dark:text-zinc-600 dark:hover:text-zinc-400 transition-colors"
                                            title={showAmounts ? "Sembunyikan nominal" : "Tampilkan nominal"}
                                        >
                                            {showAmounts ? <Eye className="h-3 w-3" /> : <EyeOff className="h-3 w-3" />}
                                        </button>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>

                    {/* Row 3: Filter Toolbar */}
                    <div className="px-5 py-2.5 flex items-center justify-between bg-zinc-50/80 dark:bg-zinc-800/30">
                        <div className="flex items-center gap-0">
                            <div className="relative">
                                <Search className={`pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 z-10 transition-colors ${searchText ? 'text-orange-500' : 'text-zinc-500 dark:text-zinc-400'}`} />
                                <input
                                    className={`border border-r-0 font-medium h-9 w-[320px] text-xs rounded-none pl-9 pr-8 outline-none placeholder:text-zinc-400 transition-all ${
                                        searchText
                                            ? 'border-orange-400 dark:border-orange-500 bg-orange-50/50 dark:bg-orange-950/20 text-zinc-900 dark:text-white'
                                            : 'border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900'
                                    }`}
                                    placeholder="Cari invoice, customer, supplier..."
                                    value={searchText}
                                    onChange={(e) => setSearchText(e.target.value)}
                                    onKeyDown={(e) => e.key === 'Enter' && applyFilters()}
                                />
                                {searchText && (
                                    <button
                                        onClick={() => { setSearchText(""); resetFilters() }}
                                        className="absolute right-2 top-1/2 -translate-y-1/2 h-4 w-4 flex items-center justify-center text-zinc-400 hover:text-zinc-600 transition-colors z-10"
                                    >
                                        <X className="h-3 w-3" />
                                    </button>
                                )}
                            </div>
                            <CheckboxFilter
                                label="Tipe"
                                hideLabel
                                triggerClassName="flex items-center gap-2 border border-zinc-300 dark:border-zinc-700 border-r-0 h-9 px-3 bg-white dark:bg-zinc-900 text-xs font-medium min-w-[120px] justify-between hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-all rounded-none"
                                triggerActiveClassName="flex items-center gap-2 border border-orange-400 dark:border-orange-500 border-r-0 h-9 px-3 bg-orange-50/50 dark:bg-orange-950/20 text-xs font-medium min-w-[120px] justify-between transition-all rounded-none"
                                options={[
                                    { value: "INV_OUT", label: "Invoice Keluar" },
                                    { value: "INV_IN", label: "Invoice Masuk" },
                                ]}
                                selected={selectedTypes}
                                onChange={setSelectedTypes}
                            />
                            <CheckboxFilter
                                label="Status"
                                hideLabel
                                triggerClassName="flex items-center gap-2 border border-zinc-300 dark:border-zinc-700 border-r-0 h-9 px-3 bg-white dark:bg-zinc-900 text-xs font-medium min-w-[120px] justify-between hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-all rounded-none"
                                triggerActiveClassName="flex items-center gap-2 border border-orange-400 dark:border-orange-500 border-r-0 h-9 px-3 bg-orange-50/50 dark:bg-orange-950/20 text-xs font-medium min-w-[120px] justify-between transition-all rounded-none"
                                options={[
                                    { value: "DRAFT", label: "Draft" },
                                    { value: "ISSUED", label: "Terkirim" },
                                    { value: "OVERDUE", label: "Jatuh Tempo" },
                                    { value: "PAID", label: "Lunas" },
                                ]}
                                selected={selectedStatuses}
                                onChange={setSelectedStatuses}
                            />
                            <Button onClick={applyFilters} variant="outline" className="border border-zinc-300 dark:border-zinc-700 text-zinc-500 dark:text-zinc-400 text-[10px] font-bold uppercase tracking-wider h-9 px-3.5 rounded-none hover:bg-zinc-100 dark:hover:bg-zinc-800 hover:text-zinc-700 dark:hover:text-zinc-200 transition-colors">
                                <Filter className="h-3.5 w-3.5 mr-1.5" /> Terapkan
                            </Button>
                            {(selectedTypes.length > 0 || selectedStatuses.length > 0 || q) && (
                                <Button variant="ghost" onClick={resetFilters} className="text-zinc-400 text-[10px] font-bold uppercase h-9 px-3 rounded-none hover:text-zinc-700 dark:hover:text-zinc-200 ml-1.5">
                                    <RotateCcw className="h-3 w-3 mr-1" /> Reset
                                </Button>
                            )}
                        </div>
                        <span className="hidden md:inline text-[11px] font-medium text-zinc-400">
                            <span className="font-mono font-bold text-zinc-600 dark:text-zinc-300">{filteredInvoices.length}</span> invoice
                        </span>
                    </div>
                </ModulePageHeader>
            </motion.div>

            {/* ─── Invoice Table ─── */}
            <motion.div
                variants={fadeUp}
                className="border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] bg-white dark:bg-zinc-900 overflow-hidden flex flex-col"
                style={{ minHeight: 480 }}
            >
                {/* Table Header */}
                <div className="hidden md:grid grid-cols-[1fr_1.2fr_90px_140px_120px_110px_120px] gap-2 px-5 py-2.5 bg-black dark:bg-zinc-950 border-b-2 border-black">
                    {['No. Invoice', 'Pihak', 'Tipe', 'Jumlah', 'Status', 'Jatuh Tempo', 'Aksi'].map((h) => (
                        <span key={h} className="text-[10px] font-black uppercase tracking-widest text-zinc-400">{h}</span>
                    ))}
                </div>

                {/* Table Body */}
                <div className="w-full flex-1 flex flex-col">
                    {loading && pagedInvoices.length === 0 ? (
                        <div className="divide-y divide-zinc-100 dark:divide-zinc-800">
                            {Array.from({ length: 6 }).map((_, i) => (
                                <div key={i} className="grid grid-cols-[1fr_1.2fr_90px_140px_120px_110px_120px] gap-2 px-5 py-3.5 items-center animate-pulse">
                                    <div className="h-4 w-24 bg-zinc-200 dark:bg-zinc-700 rounded-sm" />
                                    <div className="h-4 w-32 bg-zinc-200 dark:bg-zinc-700 rounded-sm" />
                                    <div className="h-5 w-16 bg-zinc-100 dark:bg-zinc-800 rounded-sm" />
                                    <div className="h-4 w-28 bg-zinc-200 dark:bg-zinc-700 rounded-sm" />
                                    <div className="h-5 w-20 bg-zinc-100 dark:bg-zinc-800 rounded-sm" />
                                    <div className="h-4 w-20 bg-zinc-200 dark:bg-zinc-700 rounded-sm" />
                                    <div className="flex gap-1.5">
                                        <div className="h-8 w-8 bg-zinc-100 dark:bg-zinc-800 rounded-sm" />
                                        <div className="h-8 w-8 bg-zinc-100 dark:bg-zinc-800 rounded-sm" />
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : pagedInvoices.length === 0 ? (
                        <motion.div
                            initial={{ opacity: 0, scale: 0.9 }}
                            animate={{ opacity: 1, scale: 1 }}
                            transition={{ type: "spring" as const, stiffness: 300, damping: 25 }}
                            className="flex-1 flex flex-col items-center justify-center py-16 text-zinc-400"
                        >
                            <div className="w-16 h-16 border-2 border-zinc-200 dark:border-zinc-700 flex items-center justify-center mb-4">
                                <Receipt className="h-7 w-7 text-zinc-200 dark:text-zinc-700" />
                            </div>
                            <span className="text-sm font-bold">Tidak ada invoice ditemukan</span>
                            <span className="text-xs text-zinc-400 mt-1">Coba ubah filter atau buat invoice baru</span>
                        </motion.div>
                    ) : (
                        <div className="divide-y divide-zinc-100 dark:divide-zinc-800">
                            {pagedInvoices.map((invoice, idx) => {
                                const isOverdue = invoice.status === 'OVERDUE'

                                return (
                                    <motion.div
                                        key={invoice.id}
                                        custom={idx}
                                        variants={fadeX}
                                        initial="hidden"
                                        animate="show"
                                        transition={{ delay: idx * 0.03 }}
                                        className={`grid grid-cols-1 md:grid-cols-[1fr_1.2fr_90px_140px_120px_110px_120px] gap-2 px-5 py-3 items-center transition-all hover:bg-orange-50/50 dark:hover:bg-orange-950/10 cursor-pointer ${idx % 2 === 0 ? 'bg-white dark:bg-zinc-900' : 'bg-zinc-50/60 dark:bg-zinc-800/20'} ${isOverdue ? 'border-l-4 border-l-red-500' : ''}`}
                                        onClick={() => invoice.status === 'DRAFT' ? openEditDialog(invoice) : openViewDialog(invoice)}
                                    >
                                        <div>
                                            <span className="font-mono text-sm font-black text-zinc-900 dark:text-zinc-100">{invoice.number}</span>
                                        </div>
                                        <div className="truncate">
                                            <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">{invoice.partyName}</span>
                                        </div>
                                        <div>
                                            <span className={`text-[9px] font-black uppercase tracking-wide px-2 py-0.5 border rounded-none ${invoice.type === 'INV_OUT'
                                                ? 'bg-blue-50 dark:bg-blue-950/30 border-blue-200 dark:border-blue-700 text-blue-600 dark:text-blue-400'
                                                : 'bg-purple-50 dark:bg-purple-950/30 border-purple-200 dark:border-purple-700 text-purple-600 dark:text-purple-400'
                                                }`}>
                                                {invoice.type === 'INV_OUT' ? 'Invoice' : 'Bill'}
                                            </span>
                                        </div>
                                        <div>
                                            <span className={`font-mono font-black text-sm ${isOverdue ? 'text-red-600 dark:text-red-400' :
                                                invoice.status === 'PAID' ? 'text-emerald-600 dark:text-emerald-400' : 'text-zinc-900 dark:text-zinc-100'
                                                }`}>
                                                {formatIDR(invoice.amount)}
                                            </span>
                                            {invoice.balanceDue != null && invoice.balanceDue > 0 && invoice.balanceDue < invoice.amount && (
                                                <span className="text-[9px] text-zinc-400 block font-mono">Sisa {formatIDR(invoice.balanceDue)}</span>
                                            )}
                                        </div>
                                        <div>
                                            <StatusBadge
                                                status={invoice.status}
                                                className={isOverdue ? 'animate-pulse' : ''}
                                            />
                                            {invoice.status === 'ISSUED' && invoice.issueDate && (
                                                <p className="text-[9px] text-zinc-400 mt-0.5 font-medium">
                                                    {new Date(invoice.issueDate).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })}
                                                </p>
                                            )}
                                        </div>
                                        <div>
                                            <span className={`text-xs font-medium ${isOverdue ? 'text-red-600 dark:text-red-400 font-bold' : 'text-zinc-500'}`}>
                                                {new Date(invoice.dueDate).toLocaleDateString('id-ID')}
                                            </span>
                                        </div>
                                        <div className="flex gap-1 items-center" onClick={(e) => e.stopPropagation()}>
                                            <ActionButtonGroup actions={getInvoiceActions(invoice)} size="sm" />
                                            {/* Attachment toggle — custom button (not in standard action set) */}
                                            <motion.button
                                                whileHover={{ y: -1 }}
                                                whileTap={{ scale: 0.92 }}
                                                onClick={() => setAttachmentInvoiceId(attachmentInvoiceId === invoice.id ? null : invoice.id)}
                                                title="Lampiran"
                                                className={`h-7 w-7 flex items-center justify-center border transition-colors rounded-none ${
                                                    attachmentInvoiceId === invoice.id
                                                        ? "border-violet-500 text-violet-700 bg-violet-50 dark:bg-violet-950/30"
                                                        : "border-zinc-200 dark:border-zinc-600 text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-800 hover:border-zinc-400 hover:text-zinc-600"
                                                }`}
                                            >
                                                <Paperclip className="h-3 w-3" />
                                            </motion.button>
                                        </div>

                                        <AnimatePresence>
                                            {attachmentInvoiceId === invoice.id && (
                                                <motion.div
                                                    initial={{ opacity: 0, height: 0 }}
                                                    animate={{ opacity: 1, height: "auto" }}
                                                    exit={{ opacity: 0, height: 0 }}
                                                    transition={{ duration: 0.2 }}
                                                    className="col-span-full overflow-hidden"
                                                >
                                                    <div className="mt-2 pt-2 border-t border-zinc-200 dark:border-zinc-700">
                                                        <InvoiceAttachmentSection invoiceId={invoice.id} />
                                                    </div>
                                                </motion.div>
                                            )}
                                        </AnimatePresence>
                                    </motion.div>
                                )
                            })}
                        </div>
                    )}
                </div>

                {/* Pagination */}
                <div className="px-5 py-3 border-t border-zinc-200 dark:border-zinc-700 flex items-center justify-between bg-zinc-50 dark:bg-zinc-800/50">
                    <span className={NB.label + " !mb-0 !text-[10px]"}>
                        {filteredInvoices.length} invoice
                    </span>
                    {filteredInvoices.length > PAGE_SIZE ? (
                        <div className="flex items-center gap-2">
                            <Button
                                variant="outline"
                                size="icon"
                                className="h-7 w-7 border border-zinc-300 dark:border-zinc-600 rounded-none"
                                disabled={page <= 1}
                                onClick={() => setPage(p => p - 1)}
                            >
                                <ChevronLeft className="h-3.5 w-3.5" />
                            </Button>
                            <span className="text-xs font-black min-w-[50px] text-center">{page}/{totalPages}</span>
                            <Button
                                variant="outline"
                                size="icon"
                                className="h-7 w-7 border border-zinc-300 dark:border-zinc-600 rounded-none"
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
            </motion.div>

            {/* Create Invoice Dialog */}
            <CreateInvoiceDialog open={isCreatorOpen} onOpenChange={setIsCreatorOpen} />

            {/* ─── SEND DIALOG ─── */}
            <Dialog open={isSendDialogOpen} onOpenChange={setIsSendDialogOpen}>
                <DialogContent className={NB.contentNarrow}>
                    <DialogHeader className={NB.header}>
                        <DialogTitle className={NB.title}>
                            <Send className="h-5 w-5" /> Kirim Invoice {activeInvoice?.number}
                        </DialogTitle>
                        <p className={NB.subtitle}>Pilih metode pengiriman dan konfirmasi pesan</p>
                    </DialogHeader>
                    <div className="p-6 space-y-4">
                        {/* Method toggle tiles */}
                        <div className="grid grid-cols-2 gap-2">
                            {([
                                { key: 'WHATSAPP' as const, label: 'WhatsApp', desc: 'Langsung buka chat WA', color: 'green' },
                                { key: 'EMAIL' as const, label: 'Email', desc: 'Kirim via SMTP (segera)', color: 'blue' },
                            ]).map((m) => (
                                <motion.button
                                    key={m.key}
                                    whileHover={{ y: -2 }}
                                    whileTap={{ scale: 0.97 }}
                                    onClick={() => setSendMethod(m.key)}
                                    className={`p-3 border-2 text-left transition-all ${sendMethod === m.key
                                        ? `border-${m.color}-500 bg-${m.color}-50 dark:bg-${m.color}-950/30`
                                        : 'border-zinc-200 dark:border-zinc-600 hover:border-zinc-400'
                                    }`}
                                >
                                    <span className={`text-[11px] font-black uppercase tracking-wider block ${sendMethod === m.key ? `text-${m.color}-700 dark:text-${m.color}-400` : 'text-zinc-500'}`}>{m.label}</span>
                                    <span className="text-[9px] text-zinc-400 mt-0.5 block">{m.desc}</span>
                                </motion.button>
                            ))}
                        </div>

                        <div className="space-y-1.5">
                            <Label className={NB.label}>Template</Label>
                            <span className={NB.labelHint}>Pilih template lalu edit sesuai kebutuhan</span>
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
                                <SelectTrigger className={NB.select}>
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
                            <Label className={NB.label}>
                                {sendMethod === 'WHATSAPP' ? 'Nomor WhatsApp' : 'Alamat Email'}
                            </Label>
                            {sendMethod === 'WHATSAPP' ? (
                                <div className="flex">
                                    <span className="flex items-center px-3 border-2 border-r-0 border-zinc-300 dark:border-zinc-600 bg-zinc-100 dark:bg-zinc-800 text-xs font-bold text-zinc-500 rounded-none">+62</span>
                                    <Input className={NB.input} placeholder="812xxxxxxxx" value={recipientContact} onChange={(e) => setRecipientContact(e.target.value)} />
                                </div>
                            ) : (
                                <Input className={NB.input} placeholder="nama@perusahaan.com" value={recipientContact} onChange={(e) => setRecipientContact(e.target.value)} />
                            )}
                        </div>

                        <div className="space-y-1.5">
                            <Label className={NB.label}>Preview Pesan</Label>
                            <textarea className={`w-full h-28 p-3 text-sm resize-none ${NB.textarea}`} value={sendMessage} onChange={(e) => setSendMessage(e.target.value)} />
                        </div>
                    </div>
                    <DialogFooter className="p-6 pt-2 border-t border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800/50 flex gap-2">
                        <Button type="button" variant="outline" className={NB.cancelBtn} onClick={() => setIsSendDialogOpen(false)}>Batal</Button>
                        {sendMethod === 'WHATSAPP' ? (
                            <Button type="button" onClick={handleConfirmSend} disabled={sending} className={NB.submitBtnGreen}>
                                {sending ? <><Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> Mengirim...</> : "Kirim via WhatsApp"}
                            </Button>
                        ) : (
                            <Button type="button" onClick={handleConfirmSend} disabled={sending} className={NB.submitBtnBlue}>
                                {sending ? <><Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> Mengirim...</> : "Kirim via Email"}
                            </Button>
                        )}
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* ─── EDIT DRAFT DIALOG ─── */}
            <Dialog open={isEditDialogOpen} onOpenChange={(open) => { if (!editSaving) setIsEditDialogOpen(open) }}>
                <DialogContent className={`${NB.content} overflow-y-auto max-h-[90vh]`}>
                    <DialogHeader className={NB.header}>
                        <DialogTitle className={NB.title}>
                            <Pencil className="h-5 w-5" /> Edit Invoice Draft
                        </DialogTitle>
                        <p className={NB.subtitle}>Edit semua detail invoice sebelum dikirim ke klien</p>
                        {editNumber && (
                            <motion.div
                                initial={{ opacity: 0, x: -10 }}
                                animate={{ opacity: 1, x: 0 }}
                                className="flex items-center gap-2 mt-2"
                            >
                                <span className="font-mono text-sm font-black bg-zinc-800 border border-zinc-600 text-white px-3 py-1">{editNumber}</span>
                                <span className={`text-[10px] font-black uppercase tracking-wide px-2 py-0.5 border rounded-none ${editInvoiceType === 'INV_OUT' ? 'bg-blue-900/50 border-blue-400 text-blue-300' : 'bg-purple-900/50 border-purple-400 text-purple-300'}`}>
                                    {editInvoiceType === 'INV_OUT' ? 'Invoice' : 'Bill'}
                                </span>
                            </motion.div>
                        )}
                    </DialogHeader>
                    <div className="p-6 space-y-5">
                        {editLoading ? (
                            <motion.div
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                className="flex items-center justify-center py-12 text-zinc-400"
                            >
                                <Loader2 className="h-5 w-5 animate-spin mr-2" />
                                <span className="text-xs font-bold uppercase tracking-widest">Memuat detail invoice...</span>
                            </motion.div>
                        ) : (
                            <motion.div variants={stagger} initial="hidden" animate="show" className="space-y-5">
                                {/* Party Selector */}
                                <motion.div variants={fadeUp} className="space-y-1.5">
                                    <Label className={NB.label}>
                                        {editInvoiceType === 'INV_OUT' ? 'Customer' : 'Vendor / Supplier'} <span className={NB.labelRequired}>*</span>
                                    </Label>
                                    <Select value={editPartyId} onValueChange={setEditPartyId}>
                                        <SelectTrigger className={NB.select}>
                                            <SelectValue placeholder={`Pilih ${editInvoiceType === 'INV_OUT' ? 'customer' : 'vendor'}`} />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {editParties
                                                .filter(p => editInvoiceType === 'INV_OUT' ? p.type === 'CUSTOMER' : p.type === 'SUPPLIER')
                                                .map((party) => (
                                                    <SelectItem key={party.id} value={party.id}>{party.name}</SelectItem>
                                                ))
                                            }
                                        </SelectContent>
                                    </Select>
                                </motion.div>

                                {/* Items Table */}
                                <motion.div variants={fadeUp} className="space-y-3">
                                    <Label className={NB.label}>
                                        Item Invoice <span className={NB.labelRequired}>*</span>
                                    </Label>
                                    <div className={NB.tableWrap}>
                                        <div className={`grid grid-cols-[1fr_80px_120px_100px_36px] gap-0 ${NB.tableHead}`}>
                                            <span className={NB.tableHeadCell}>Deskripsi</span>
                                            <span className={NB.tableHeadCell}>Qty</span>
                                            <span className={NB.tableHeadCell}>Harga Satuan</span>
                                            <span className={`${NB.tableHeadCell} text-right`}>Jumlah</span>
                                            <span />
                                        </div>
                                        <AnimatePresence>
                                            {editItems.map((item, idx) => (
                                                <motion.div
                                                    key={idx}
                                                    initial={{ opacity: 0, height: 0 }}
                                                    animate={{ opacity: 1, height: "auto" }}
                                                    exit={{ opacity: 0, height: 0, x: -20 }}
                                                    transition={{ duration: 0.2 }}
                                                    className={`grid grid-cols-[1fr_80px_120px_100px_36px] gap-0 ${NB.tableRow} items-center`}
                                                >
                                                    <div className="px-1.5 py-1">
                                                        <Input className={NB.input} placeholder="Deskripsi item..." value={item.description}
                                                            onChange={(e) => { const next = [...editItems]; next[idx] = { ...next[idx], description: e.target.value }; setEditItems(next) }}
                                                        />
                                                    </div>
                                                    <div className="px-1.5 py-1">
                                                        <Input type="number" className={`${NB.input} text-center font-mono`} placeholder="1" value={item.quantity}
                                                            onChange={(e) => { const next = [...editItems]; next[idx] = { ...next[idx], quantity: Math.max(1, Number(e.target.value) || 1) }; setEditItems(next) }}
                                                        />
                                                    </div>
                                                    <div className="px-1.5 py-1">
                                                        <Input type="number" className={`${NB.input} font-mono`} placeholder="0" value={item.unitPrice}
                                                            onChange={(e) => { const next = [...editItems]; next[idx] = { ...next[idx], unitPrice: Number(e.target.value) || 0 }; setEditItems(next) }}
                                                        />
                                                    </div>
                                                    <div className="px-3 py-1 text-right">
                                                        <span className="text-sm font-mono font-bold text-zinc-700 dark:text-zinc-300">{formatIDR(item.quantity * item.unitPrice)}</span>
                                                    </div>
                                                    <div className="px-1 py-1">
                                                        <motion.button
                                                            whileHover={{ scale: 1.1 }}
                                                            whileTap={{ scale: 0.9 }}
                                                            className="h-8 w-8 flex items-center justify-center border border-red-200 text-red-400 hover:bg-red-50 hover:text-red-600 rounded-none transition-colors disabled:opacity-30"
                                                            onClick={() => setEditItems(editItems.filter((_, i) => i !== idx))}
                                                            disabled={editItems.length <= 1}
                                                        >
                                                            <X className="h-3.5 w-3.5" />
                                                        </motion.button>
                                                    </div>
                                                </motion.div>
                                            ))}
                                        </AnimatePresence>
                                    </div>
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        className="border-dashed border-2 text-[10px] font-bold uppercase w-full hover:bg-orange-50 hover:border-orange-300 rounded-none transition-all"
                                        onClick={() => setEditItems([...editItems, { description: '', quantity: 1, unitPrice: 0 }])}
                                    >
                                        <Plus className="h-3 w-3 mr-1" /> Tambah Item
                                    </Button>
                                </motion.div>

                                {/* Dates */}
                                <motion.div variants={fadeUp} className="grid grid-cols-2 gap-4">
                                    <div className="space-y-1.5">
                                        <Label className={NB.label}>Tanggal Terbit</Label>
                                        <Input type="date" className={NB.input} value={editIssueDate} onChange={(e) => setEditIssueDate(e.target.value)} />
                                    </div>
                                    <div className="space-y-1.5">
                                        <Label className={NB.label}>Jatuh Tempo</Label>
                                        <Input type="date" className={NB.input} value={editDueDate} onChange={(e) => setEditDueDate(e.target.value)} />
                                    </div>
                                </motion.div>

                                {/* Discount */}
                                <motion.div variants={fadeUp} className="space-y-1.5">
                                    <Label className={NB.label}>Diskon (Rp)</Label>
                                    <span className={NB.labelHint}>Potongan harga sebelum pajak</span>
                                    <div className="relative">
                                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-zinc-400">Rp</span>
                                        <Input type="number" className={`${NB.inputMono} pl-9`} value={editDiscount || ''} placeholder="0"
                                            onChange={(e) => setEditDiscount(Math.max(0, Number(e.target.value) || 0))}
                                        />
                                    </div>
                                </motion.div>

                                {/* PPN Toggle */}
                                <motion.div variants={fadeUp} className="flex items-center justify-between border-2 border-zinc-200 dark:border-zinc-700 px-4 py-2.5">
                                    <div>
                                        <span className={NB.label + " !mb-0"}>PPN 11%</span>
                                        <span className={NB.labelHint}>Pajak Pertambahan Nilai</span>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => setEditIncludeTax(!editIncludeTax)}
                                        className={`${NB.toggle} ${editIncludeTax ? NB.toggleActive : NB.toggleInactive}`}
                                    >
                                        <motion.span
                                            layout
                                            transition={{ type: "spring" as const, stiffness: 500, damping: 30 }}
                                            className={`${NB.toggleThumb} ${editIncludeTax ? 'left-5' : 'left-0.5'}`}
                                        />
                                    </button>
                                </motion.div>

                                {/* Totals Summary */}
                                <motion.div variants={fadeUp}>
                                    {(() => {
                                        const subtotal = editItems.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0)
                                        const afterDiscount = subtotal - editDiscount
                                        const tax = editIncludeTax ? Math.round(afterDiscount * 0.11) : 0
                                        const total = afterDiscount + tax
                                        return (
                                            <div className="border-2 border-black dark:border-white bg-zinc-900 dark:bg-zinc-100 px-4 py-3 space-y-1.5">
                                                <div className="flex justify-between items-center text-xs text-zinc-400 dark:text-zinc-500">
                                                    <span>Subtotal ({editItems.length} item)</span>
                                                    <span className="font-mono font-bold">{formatIDR(subtotal)}</span>
                                                </div>
                                                {editDiscount > 0 && (
                                                    <div className="flex justify-between items-center text-xs text-red-400 dark:text-red-500">
                                                        <span>Diskon</span>
                                                        <span className="font-mono font-bold">- {formatIDR(editDiscount)}</span>
                                                    </div>
                                                )}
                                                {editIncludeTax && (
                                                    <div className="flex justify-between items-center text-xs text-zinc-400 dark:text-zinc-500">
                                                        <span>PPN 11%</span>
                                                        <span className="font-mono font-bold">{formatIDR(tax)}</span>
                                                    </div>
                                                )}
                                                <div className="flex justify-between items-center border-t border-zinc-700 dark:border-zinc-300 pt-2 mt-1">
                                                    <span className="text-[11px] font-black uppercase tracking-wider text-white dark:text-zinc-900">Total Tagihan</span>
                                                    <motion.span
                                                        key={total}
                                                        initial={{ scale: 1.1 }}
                                                        animate={{ scale: 1 }}
                                                        transition={{ type: "spring" as const, stiffness: 300 }}
                                                        className="font-mono font-black text-xl text-white dark:text-zinc-900"
                                                    >
                                                        {formatIDR(total)}
                                                    </motion.span>
                                                </div>
                                            </div>
                                        )
                                    })()}
                                </motion.div>

                                {/* Attachments */}
                                {activeInvoice && (
                                    <motion.div variants={fadeUp} className="border-t-2 border-zinc-200 dark:border-zinc-700 pt-4">
                                        <InvoiceAttachmentSection invoiceId={activeInvoice.id} />
                                    </motion.div>
                                )}

                                {/* Riwayat */}
                                {activeInvoice && (
                                    <motion.div variants={fadeUp} className={NB.section}>
                                        <div className={NB.sectionHead}>
                                            <Clock className="h-4 w-4 text-zinc-500" />
                                            <span className={NB.sectionTitle}>Riwayat Perubahan</span>
                                        </div>
                                        <AuditLogTimeline entityType="Invoice" entityId={activeInvoice.id} />
                                    </motion.div>
                                )}
                            </motion.div>
                        )}
                    </div>
                    <DialogFooter className="p-6 pt-3 border-t border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800/50 flex gap-2">
                        <Button
                            variant="outline"
                            className={NB.cancelBtn}
                            onClick={() => activeInvoice && window.open(`/api/documents/invoice/${activeInvoice.id}?disposition=inline`, '_blank')}
                            disabled={!activeInvoice}
                        >
                            <Download className="h-3.5 w-3.5 mr-1.5" /> Cetak PDF
                        </Button>
                        <div className="flex-1" />
                        <Button variant="outline" className={NB.cancelBtn} onClick={() => setIsEditDialogOpen(false)} disabled={editSaving}>Batal</Button>
                        <Button onClick={handleSaveEdit} disabled={editSaving || editLoading} className={NB.submitBtnOrange}>
                            {editSaving ? <><Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> Menyimpan...</> : "Simpan Perubahan"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* ─── VIEW DIALOG (read-only for non-DRAFT) ─── */}
            <Dialog open={isViewDialogOpen} onOpenChange={setIsViewDialogOpen}>
                <DialogContent className={`${NB.content} overflow-y-auto max-h-[90vh]`}>
                    <DialogHeader className={NB.header}>
                        <DialogTitle className={NB.title}>
                            <Receipt className="h-5 w-5" /> Detail Invoice
                        </DialogTitle>
                        <p className={NB.subtitle}>Detail lengkap invoice</p>
                        {viewData && (
                            <div className="flex items-center gap-2 mt-2">
                                <span className="font-mono text-sm font-black bg-zinc-800 border border-zinc-600 text-white px-3 py-1">{viewData.number}</span>
                                <span className={`text-[10px] font-black uppercase tracking-wide px-2 py-0.5 border rounded-none ${
                                    viewData.status === "PAID" ? "bg-emerald-900/50 border-emerald-400 text-emerald-300"
                                    : viewData.status === "ISSUED" ? "bg-blue-900/50 border-blue-400 text-blue-300"
                                    : viewData.status === "PARTIAL" ? "bg-amber-900/50 border-amber-400 text-amber-300"
                                    : viewData.status === "OVERDUE" ? "bg-red-900/50 border-red-400 text-red-300"
                                    : "bg-zinc-700/50 border-zinc-500 text-zinc-300"
                                }`}>
                                    {viewData.status === "PAID" ? "Lunas" : viewData.status === "ISSUED" ? "Terkirim" : viewData.status === "PARTIAL" ? "Sebagian" : viewData.status === "OVERDUE" ? "Jatuh Tempo" : viewData.status}
                                </span>
                                <span className={`text-[10px] font-black uppercase tracking-wide px-2 py-0.5 border rounded-none ${viewData.type === 'INV_OUT' ? 'bg-blue-900/50 border-blue-400 text-blue-300' : 'bg-purple-900/50 border-purple-400 text-purple-300'}`}>
                                    {viewData.type === 'INV_OUT' ? 'Invoice' : 'Bill'}
                                </span>
                            </div>
                        )}
                    </DialogHeader>
                    <div className="p-6 space-y-5">
                        {viewLoading ? (
                            <div className="flex items-center justify-center py-12 text-zinc-400">
                                <Loader2 className="h-5 w-5 animate-spin mr-2" />
                                <span className="text-xs font-bold uppercase tracking-widest">Memuat detail invoice...</span>
                            </div>
                        ) : viewData ? (
                            <div className="space-y-5">
                                {/* Info */}
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-1">
                                        <span className="text-[10px] font-bold uppercase tracking-widest text-zinc-400">{viewData.type === 'INV_OUT' ? 'Pelanggan' : 'Vendor'}</span>
                                        <div className="text-sm font-bold text-zinc-900 dark:text-zinc-100">{viewData.customerName}</div>
                                    </div>
                                    <div className="space-y-1">
                                        <span className="text-[10px] font-bold uppercase tracking-widest text-zinc-400">Tanggal Terbit</span>
                                        <div className="text-sm font-medium text-zinc-700 dark:text-zinc-300">{viewData.issueDate}</div>
                                    </div>
                                    <div className="space-y-1">
                                        <span className="text-[10px] font-bold uppercase tracking-widest text-zinc-400">Jatuh Tempo</span>
                                        <div className="text-sm font-medium text-zinc-700 dark:text-zinc-300">{viewData.dueDate}</div>
                                    </div>
                                </div>

                                {/* Items table */}
                                <div>
                                    <span className="text-[10px] font-bold uppercase tracking-widest text-zinc-400 block mb-2">Item</span>
                                    <div className="border-2 border-black dark:border-white overflow-hidden">
                                        <div className="grid grid-cols-[1fr_60px_100px_100px] gap-0 bg-zinc-100 dark:bg-zinc-800 border-b-2 border-black dark:border-white">
                                            <span className="px-3 py-1.5 text-[9px] font-black uppercase tracking-widest text-zinc-500">Deskripsi</span>
                                            <span className="px-3 py-1.5 text-[9px] font-black uppercase tracking-widest text-zinc-500 text-center">Qty</span>
                                            <span className="px-3 py-1.5 text-[9px] font-black uppercase tracking-widest text-zinc-500 text-right">Harga</span>
                                            <span className="px-3 py-1.5 text-[9px] font-black uppercase tracking-widest text-zinc-500 text-right">Jumlah</span>
                                        </div>
                                        {viewData.items.map((item, i) => (
                                            <div key={i} className="grid grid-cols-[1fr_60px_100px_100px] gap-0 border-b border-zinc-200 dark:border-zinc-700 last:border-b-0">
                                                <span className="px-3 py-2 text-sm text-zinc-800 dark:text-zinc-200">{item.description}</span>
                                                <span className="px-3 py-2 text-sm font-mono text-center text-zinc-600 dark:text-zinc-400">{item.quantity}</span>
                                                <span className="px-3 py-2 text-sm font-mono text-right text-zinc-600 dark:text-zinc-400">{formatIDR(item.unitPrice)}</span>
                                                <span className="px-3 py-2 text-sm font-mono font-bold text-right text-zinc-800 dark:text-zinc-200">{formatIDR(item.lineTotal)}</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                {/* Totals */}
                                <div className="border-2 border-black dark:border-white bg-zinc-900 dark:bg-zinc-100 px-4 py-3 space-y-1.5">
                                    <div className="flex justify-between items-center text-xs text-zinc-400 dark:text-zinc-500">
                                        <span>Subtotal</span>
                                        <span className="font-mono font-bold">{formatIDR(viewData.subtotal)}</span>
                                    </div>
                                    {viewData.discountAmount > 0 && (
                                        <div className="flex justify-between items-center text-xs text-red-400 dark:text-red-500">
                                            <span>Diskon</span>
                                            <span className="font-mono font-bold">- {formatIDR(viewData.discountAmount)}</span>
                                        </div>
                                    )}
                                    {viewData.taxAmount > 0 && (
                                        <div className="flex justify-between items-center text-xs text-zinc-400 dark:text-zinc-500">
                                            <span>PPN 11%</span>
                                            <span className="font-mono font-bold">{formatIDR(viewData.taxAmount)}</span>
                                        </div>
                                    )}
                                    <div className="flex justify-between items-center border-t border-zinc-700 dark:border-zinc-300 pt-2 mt-1">
                                        <span className="text-[11px] font-black uppercase tracking-wider text-white dark:text-zinc-900">Total</span>
                                        <span className="font-mono font-black text-xl text-white dark:text-zinc-900">{formatIDR(viewData.totalAmount)}</span>
                                    </div>
                                    {viewData.status !== "PAID" && viewData.balanceDue > 0 && viewData.balanceDue !== viewData.totalAmount && (
                                        <div className="flex justify-between items-center text-xs text-amber-400">
                                            <span>Sisa Tagihan</span>
                                            <span className="font-mono font-bold">{formatIDR(viewData.balanceDue)}</span>
                                        </div>
                                    )}
                                </div>

                                {/* Payment history */}
                                {viewData.payments.length > 0 && (
                                    <div>
                                        <span className="text-[10px] font-bold uppercase tracking-widest text-zinc-400 block mb-2">Riwayat Pembayaran</span>
                                        <div className="border-2 border-black dark:border-white overflow-hidden divide-y divide-zinc-200 dark:divide-zinc-700">
                                            {viewData.payments.map((p) => (
                                                <div key={p.id} className="flex items-center justify-between px-3 py-2">
                                                    <div>
                                                        <div className="text-xs font-bold text-zinc-800 dark:text-zinc-200">{p.method}</div>
                                                        <div className="text-[10px] text-zinc-400">{p.date}</div>
                                                    </div>
                                                    <span className="font-mono font-bold text-sm text-emerald-700 dark:text-emerald-400">{formatIDR(p.amount)}</span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {/* Journal Entries */}
                                {viewData.journalEntries.length > 0 && (
                                    <div>
                                        <span className="text-[10px] font-bold uppercase tracking-widest text-zinc-400 block mb-2">Jurnal Akuntansi</span>
                                        <div className="space-y-2">
                                            {viewData.journalEntries.map((je) => (
                                                <div key={je.id} className="border-2 border-black dark:border-white overflow-hidden">
                                                    <div className="px-3 py-1.5 bg-zinc-100 dark:bg-zinc-800 border-b border-zinc-200 dark:border-zinc-700 flex items-center justify-between">
                                                        <span className="text-[10px] font-bold text-zinc-600 dark:text-zinc-400">{je.description}</span>
                                                        <span className="text-[10px] font-mono text-zinc-400">{je.date}</span>
                                                    </div>
                                                    <div className="divide-y divide-zinc-100 dark:divide-zinc-700">
                                                        {je.lines.map((line, li) => (
                                                            <div key={li} className="grid grid-cols-[1fr_90px_90px] gap-0 px-3 py-1.5">
                                                                <span className="text-xs text-zinc-700 dark:text-zinc-300">
                                                                    <span className="font-mono text-zinc-400 mr-1.5">{line.accountCode}</span>
                                                                    {line.accountName}
                                                                </span>
                                                                <span className="text-xs font-mono text-right text-zinc-600 dark:text-zinc-400">
                                                                    {line.debit > 0 ? formatIDR(line.debit) : ''}
                                                                </span>
                                                                <span className="text-xs font-mono text-right text-zinc-600 dark:text-zinc-400">
                                                                    {line.credit > 0 ? formatIDR(line.credit) : ''}
                                                                </span>
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {/* Audit log */}
                                {activeInvoice && (
                                    <div className={NB.section}>
                                        <div className={NB.sectionHead}>
                                            <Clock className="h-4 w-4 text-zinc-500" />
                                            <span className={NB.sectionTitle}>Riwayat Perubahan</span>
                                        </div>
                                        <AuditLogTimeline entityType="Invoice" entityId={activeInvoice.id} />
                                    </div>
                                )}
                            </div>
                        ) : null}
                    </div>
                    <DialogFooter className="p-6 pt-3 border-t border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800/50 flex gap-2">
                        <Button
                            variant="outline"
                            className={NB.cancelBtn}
                            onClick={() => activeInvoice && window.open(`/api/documents/invoice/${activeInvoice.id}?disposition=inline`, '_blank')}
                            disabled={!activeInvoice}
                        >
                            <Download className="h-3.5 w-3.5 mr-1.5" /> Cetak PDF
                        </Button>
                        <div className="flex-1" />
                        {activeInvoice && viewData && (viewData.status === "ISSUED" || viewData.status === "OVERDUE" || viewData.status === "PARTIAL") && (
                            <Button
                                className={NB.submitBtnOrange}
                                onClick={() => {
                                    setIsViewDialogOpen(false)
                                    if (activeInvoice) openPayDialog(activeInvoice)
                                }}
                            >
                                <Banknote className="h-3.5 w-3.5 mr-1.5" /> Catat Pembayaran
                            </Button>
                        )}
                        {activeInvoice && viewData && viewData.status === "DRAFT" && (
                            <Button
                                className={NB.submitBtnOrange}
                                onClick={() => {
                                    setIsViewDialogOpen(false)
                                    if (activeInvoice) openSendDialog(activeInvoice)
                                }}
                            >
                                <Send className="h-3.5 w-3.5 mr-1.5" /> Kirim
                            </Button>
                        )}
                        <Button variant="outline" className={NB.cancelBtn} onClick={() => setIsViewDialogOpen(false)}>Tutup</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* ─── PAY DIALOG ─── */}
            <Dialog open={isPayDialogOpen} onOpenChange={(open) => { if (!paying) setIsPayDialogOpen(open) }}>
                <DialogContent className={NB.contentNarrow}>
                    <DialogHeader className={NB.header}>
                        <DialogTitle className={NB.title}>
                            <Banknote className="h-5 w-5" /> Catat Pembayaran {activeInvoice?.number}
                        </DialogTitle>
                        <p className={NB.subtitle}>Konfirmasi detail penerimaan pembayaran</p>
                    </DialogHeader>
                    <div className="p-6 space-y-4">
                        {activeInvoice && (
                            <motion.div
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                className="flex items-center justify-between border-2 border-emerald-300 dark:border-emerald-700 bg-emerald-50 dark:bg-emerald-950/30 px-4 py-2.5"
                            >
                                <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-400">Sisa Tagihan</span>
                                <span className="font-mono font-black text-lg text-emerald-700 dark:text-emerald-400">{formatIDR(activeInvoice.balanceDue ?? activeInvoice.amount)}</span>
                            </motion.div>
                        )}
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-1.5">
                                <Label className={NB.label}>Tanggal Terima</Label>
                                <Input type="date" className={NB.input} value={payDate} onChange={(e) => setPayDate(e.target.value)} />
                            </div>
                            <div className="space-y-1.5">
                                <Label className={NB.label}>Jumlah Diterima</Label>
                                <span className={NB.labelHint}>Bisa bayar sebagian atau penuh</span>
                                <div className="relative">
                                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-zinc-400">Rp</span>
                                    <Input type="number" className={`${NB.inputMono} pl-9`} placeholder="0" value={payAmount} onChange={(e) => setPayAmount(e.target.value)} />
                                </div>
                            </div>
                        </div>
                        <div className="space-y-1.5">
                            <Label className={NB.label}>Metode Pembayaran</Label>
                            <Select value={payMethod} onValueChange={(v: any) => setPayMethod(v)}>
                                <SelectTrigger className={NB.select}>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="TRANSFER">Transfer Bank</SelectItem>
                                    <SelectItem value="CASH">Tunai</SelectItem>
                                    <SelectItem value="CHECK">Cek</SelectItem>
                                    <SelectItem value="GIRO">Giro</SelectItem>
                                    <SelectItem value="CREDIT_CARD">Kartu Kredit</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-1.5">
                            <Label className={NB.label}>No. Referensi (Opsional)</Label>
                            <span className={NB.labelHint}>No. bukti transfer / kwitansi</span>
                            <Input className={NB.input} placeholder="Ref #123456" value={payReference} onChange={(e) => setPayReference(e.target.value)} />
                        </div>

                        {/* PPh Withholding Section — only for AR (INV_OUT) invoices */}
                        {activeInvoice?.type === "INV_OUT" && (
                            <div className="border-2 border-black p-3 space-y-3">
                                <label className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest cursor-pointer">
                                    <input
                                        type="checkbox"
                                        checked={enablePPh}
                                        onChange={(e) => setEnablePPh(e.target.checked)}
                                        className="rounded border-zinc-300"
                                    />
                                    Dipotong PPh oleh Customer
                                </label>

                                {enablePPh && (
                                    <div className="space-y-3 pl-6">
                                        <div className="grid grid-cols-2 gap-2">
                                            <div className="space-y-1">
                                                <label className="text-[10px] font-bold uppercase text-zinc-500">Jenis PPh</label>
                                                <Select value={pphType} onValueChange={(v: string) => setPPhType(v as PPhTypeValue)}>
                                                    <SelectTrigger className="h-8 rounded-none text-xs border-2 border-black">
                                                        <SelectValue />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        <SelectItem value="PPH_23">PPh 23 (Jasa)</SelectItem>
                                                        <SelectItem value="PPH_4_2">PPh 4(2) (Sewa/Konstruksi)</SelectItem>
                                                    </SelectContent>
                                                </Select>
                                            </div>
                                            <div className="space-y-1">
                                                <label className="text-[10px] font-bold uppercase text-zinc-500">Tarif (%)</label>
                                                <Input
                                                    type="number"
                                                    step="0.01"
                                                    value={pphRate}
                                                    onChange={(e) => setPPhRate(Number(e.target.value))}
                                                    className="h-8 rounded-none text-xs border-2 border-black font-mono"
                                                />
                                            </div>
                                        </div>

                                        <div className="grid grid-cols-2 gap-2 text-xs">
                                            <div>
                                                <span className="text-zinc-500">DPP:</span>{" "}
                                                <span className="font-mono font-bold">{formatIDR(pphBaseAmount)}</span>
                                            </div>
                                            <div>
                                                <span className="text-zinc-500">PPh:</span>{" "}
                                                <span className="font-mono font-bold text-red-600">{formatIDR(pphCalc?.amount || 0)}</span>
                                            </div>
                                        </div>

                                        <div className="space-y-1">
                                            <label className="text-[10px] font-bold uppercase text-zinc-500">No. Bukti Potong</label>
                                            <Input
                                                value={buktiPotongNo}
                                                onChange={(e) => setBuktiPotongNo(e.target.value)}
                                                placeholder="Opsional..."
                                                className="h-8 rounded-none text-xs border-2 border-black placeholder:text-zinc-300"
                                            />
                                        </div>

                                        <div className="bg-blue-50 border-2 border-blue-300 p-2 text-xs">
                                            <span className="font-bold">Diterima dari customer:</span>{" "}
                                            <span className="font-mono font-bold text-lg">{formatIDR(pphCalc?.netAmount || pphBaseAmount)}</span>
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                    <DialogFooter className="p-6 pt-2 border-t border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800/50 flex gap-2">
                        <Button variant="outline" className={NB.cancelBtn} onClick={() => setIsPayDialogOpen(false)} disabled={paying}>Batal</Button>
                        <Button onClick={handleConfirmPayment} disabled={paying} className={NB.submitBtnGreen}>
                            {paying ? <><Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> Memproses...</> : "Konfirmasi Pembayaran"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </motion.div>
    )
}
