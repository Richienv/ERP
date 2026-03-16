"use client"

import { useEffect, useMemo, useState } from "react"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { formatIDR } from "@/lib/utils"
import {
    ArrowRightLeft,
    BadgeCheck,
    Check,
    ChevronLeft,
    ChevronRight,
    CircleDollarSign,
    FileText,
    Loader2,
    Plus,
    RefreshCcw,
    Search,
    AlertTriangle,
    Wallet,
    Download,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue
} from "@/components/ui/select"
// Textarea removed — using Input for compact layout
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog"
import { NB } from "@/lib/dialog-styles"
import { matchPaymentToInvoice, recordARPayment } from "@/lib/actions/finance-ar"
import { toast } from "sonner"
import { useQueryClient } from "@tanstack/react-query"
import { queryKeys } from "@/lib/query-keys"
import { exportToExcel } from "@/lib/table-export"

type PaymentMethod = "CASH" | "TRANSFER" | "CHECK" | "GIRO" | "CARD"

interface UnallocatedPayment {
    id: string
    number: string
    from: string
    customerId: string | null
    amount: number
    date: Date
    method: string
    reference: string | null
    allocated?: boolean
    invoiceNumber?: string | null
}

interface OpenInvoice {
    id: string
    number: string
    customer: { id: string; name: string } | null
    balanceDue: number
    dueDate: Date
    isOverdue: boolean
}

interface RecentPayment {
    id: string
    amount: number
    method: string
    reference: string | null
    createdAt: Date
    invoice: { id: string; number: string; status: string } | null
}

interface ARPaymentsViewProps {
    unallocated: UnallocatedPayment[]
    openInvoices: OpenInvoice[]
    recentPayments: RecentPayment[]
    allCustomers: { id: string; name: string; code: string | null }[]
    stats: {
        unallocatedCount: number
        unallocatedAmount: number
        openInvoicesCount: number
        outstandingAmount: number
        todayPayments: number
    }
    registryMeta: {
        payments: { page: number; pageSize: number; total: number; totalPages: number }
        invoices: { page: number; pageSize: number; total: number; totalPages: number }
    }
    registryQuery: {
        paymentsQ: string | null
        invoicesQ: string | null
        customerId: string | null
    }
    highlightPaymentId?: string
}

const METHOD_LABEL: Record<PaymentMethod, string> = {
    CASH: "Tunai",
    TRANSFER: "Transfer Bank",
    CHECK: "Cek",
    GIRO: "Giro",
    CARD: "Kartu Kredit"
}

const EMPTY_INVOICE_VALUE = "__NO_INVOICE__"

const todayAsInput = () => new Date().toISOString().slice(0, 10)

export function ARPaymentsView({ unallocated, openInvoices, recentPayments, allCustomers, stats, registryMeta, registryQuery, highlightPaymentId }: ARPaymentsViewProps) {
    const router = useRouter()
    const queryClient = useQueryClient()
    const pathname = usePathname()
    const searchParams = useSearchParams()
    const [processing, setProcessing] = useState<string | null>(null)
    const [selectedPaymentId, setSelectedPaymentId] = useState<string | null>(highlightPaymentId ?? null)
    const [selectedInvoiceId, setSelectedInvoiceId] = useState<string | null>(null)
    const [paymentQuery, setPaymentQuery] = useState(registryQuery.paymentsQ || "")
    const [invoiceQuery, setInvoiceQuery] = useState(registryQuery.invoicesQ || "")
    const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false)
    const [submittingPayment, setSubmittingPayment] = useState(false)
    const [createForm, setCreateForm] = useState({
        customerId: "",
        amount: "",
        date: todayAsInput(),
        method: "TRANSFER" as PaymentMethod,
        reference: "",
        notes: "",
        invoiceId: ""
    })

    // Auto-scroll to highlighted payment from ?highlight= param
    useEffect(() => {
        if (!highlightPaymentId) return
        const timer = setTimeout(() => {
            const el = document.querySelector(`[data-payment-id="${highlightPaymentId}"]`)
            if (el) el.scrollIntoView({ behavior: "smooth", block: "center" })
        }, 300)
        return () => clearTimeout(timer)
    }, [highlightPaymentId])

    const pushSearchParams = (mutator: (params: URLSearchParams) => void) => {
        const next = new URLSearchParams(searchParams.toString())
        mutator(next)
        const qs = next.toString()
        router.replace(qs ? `${pathname}?${qs}` : pathname)
    }



    const selectedPayment = useMemo(
        () => unallocated.find((item) => item.id === selectedPaymentId) ?? null,
        [unallocated, selectedPaymentId]
    )

    const selectedInvoice = useMemo(
        () => openInvoices.find((item) => item.id === selectedInvoiceId) ?? null,
        [openInvoices, selectedInvoiceId]
    )

    const paymentInvoiceMismatch = Boolean(
        selectedPayment &&
        selectedInvoice &&
        selectedPayment.customerId &&
        selectedInvoice.customer?.id &&
        selectedPayment.customerId !== selectedInvoice.customer.id
    )

    const filteredPayments = unallocated
    const filteredInvoices = useMemo(() => {
        if (!selectedPayment?.customerId) return openInvoices
        return openInvoices.filter((invoice) => invoice.customer?.id === selectedPayment.customerId)
    }, [openInvoices, selectedPayment])

    useEffect(() => {
        setPaymentQuery(registryQuery.paymentsQ || "")
        setInvoiceQuery(registryQuery.invoicesQ || "")
    }, [registryQuery.paymentsQ, registryQuery.invoicesQ])

    const handleMatch = async (paymentId: string, invoiceId: string) => {
        setProcessing(paymentId)
        try {
            const result = await matchPaymentToInvoice(paymentId, invoiceId)
            if (result.success) {
                toast.success("message" in result ? result.message : "Pembayaran berhasil dialokasikan")
                setSelectedPaymentId(null)
                setSelectedInvoiceId(null)
                queryClient.invalidateQueries({ queryKey: queryKeys.arPayments.all })
                queryClient.invalidateQueries({ queryKey: queryKeys.invoices.all })
                queryClient.invalidateQueries({ queryKey: queryKeys.vendorPayments.all })
                queryClient.invalidateQueries({ queryKey: queryKeys.financeDashboard.all })
                queryClient.invalidateQueries({ queryKey: queryKeys.journal.all })
                queryClient.invalidateQueries({ queryKey: queryKeys.chartAccounts.all })
                queryClient.invalidateQueries({ queryKey: queryKeys.financeReports.all })
            } else {
                toast.error("error" in result ? String(result.error) : "Gagal mengalokasikan pembayaran")
            }
        } catch {
            toast.error("Terjadi kesalahan saat menyimpan alokasi")
        } finally {
            setProcessing(null)
        }
    }

    const handleCreatePayment = async () => {
        const amount = Number(createForm.amount)
        if (!createForm.customerId) {
            toast.error("Pilih pelanggan terlebih dahulu")
            return
        }
        // invoiceId is optional — payment can be saved as unallocated
        if (!Number.isFinite(amount) || amount <= 0) {
            toast.error("Nominal penerimaan harus lebih besar dari 0")
            return
        }

        setSubmittingPayment(true)
        try {
            const result = await recordARPayment({
                customerId: createForm.customerId,
                amount,
                date: createForm.date ? new Date(`${createForm.date}T00:00:00`) : new Date(),
                method: createForm.method as "CASH" | "TRANSFER" | "CHECK" | "CARD",
                reference: createForm.reference.trim() || undefined,
                notes: createForm.notes.trim() || undefined,
                invoiceId: createForm.invoiceId || undefined
            })

            if (!result.success) {
                toast.error("error" in result ? String(result.error) : "Gagal mencatat penerimaan")
                return
            }

            toast.success("Penerimaan pelanggan berhasil dicatat")
            setIsCreateDialogOpen(false)
            setCreateForm({
                customerId: "",
                amount: "",
                date: todayAsInput(),
                method: "TRANSFER",
                reference: "",
                notes: "",
                invoiceId: ""
            })
            queryClient.invalidateQueries({ queryKey: queryKeys.arPayments.all })
            queryClient.invalidateQueries({ queryKey: queryKeys.invoices.all })
            queryClient.invalidateQueries({ queryKey: queryKeys.vendorPayments.all })
            queryClient.invalidateQueries({ queryKey: queryKeys.financeDashboard.all })
            queryClient.invalidateQueries({ queryKey: queryKeys.journal.all })
            queryClient.invalidateQueries({ queryKey: queryKeys.chartAccounts.all })
            queryClient.invalidateQueries({ queryKey: queryKeys.financeReports.all })
        } catch {
            toast.error("Terjadi kesalahan saat mencatat penerimaan")
        } finally {
            setSubmittingPayment(false)
        }
    }

    const canMatch = Boolean(selectedPayment && selectedInvoice && !paymentInvoiceMismatch && !processing)

    const applyRegistryFilters = () => {
        pushSearchParams((params) => {
            const payQ = paymentQuery.trim()
            const invQ = invoiceQuery.trim()
            if (payQ) params.set("pay_q", payQ)
            else params.delete("pay_q")
            if (invQ) params.set("inv_q", invQ)
            else params.delete("inv_q")
            params.set("pay_page", "1")
            params.set("inv_page", "1")
        })
    }

    const resetRegistryFilters = () => {
        setPaymentQuery("")
        setInvoiceQuery("")
        pushSearchParams((params) => {
            params.delete("pay_q")
            params.delete("inv_q")
            params.delete("pay_page")
            params.delete("inv_page")
        })
    }

    // Determine workflow step
    const currentStep = selectedPayment && selectedInvoice ? 3 : selectedPayment ? 2 : 1

    return (
        <div className="mf-page">

            {/* ─── TOOLBAR ─── */}
            <div className={NB.pageCard}>
                <div className={NB.pageAccent} />

                {/* Row 1: KPI Strip — big, colorful */}
                <div className={`grid grid-cols-3 ${NB.pageRowBorder}`}>
                    {/* Belum Dialokasi */}
                    <div className={`px-5 py-4 border-r border-zinc-200 dark:border-zinc-800 ${stats.unallocatedCount > 0 ? "bg-amber-50/50 dark:bg-amber-950/10" : ""}`}>
                        <div className="flex items-center gap-1.5 mb-1">
                            <span className={`w-2 h-2 rounded-full ${stats.unallocatedCount > 0 ? "bg-amber-500" : "bg-zinc-300"}`} />
                            <span className={`text-[10px] font-black uppercase tracking-widest ${stats.unallocatedCount > 0 ? "text-amber-600 dark:text-amber-400" : "text-zinc-400"}`}>Belum Dialokasi</span>
                        </div>
                        <span className={`text-3xl font-black tabular-nums ${stats.unallocatedCount > 0 ? "text-amber-600 dark:text-amber-400" : "text-zinc-300 dark:text-zinc-600"}`}>{stats.unallocatedCount}</span>
                    </div>
                    {/* Invoice Terbuka */}
                    <div className="px-5 py-4 border-r border-zinc-200 dark:border-zinc-800 bg-blue-50/50 dark:bg-blue-950/10">
                        <div className="flex items-center gap-1.5 mb-1">
                            <span className="w-2 h-2 bg-blue-500 rounded-full" />
                            <span className="text-[10px] font-black uppercase tracking-widest text-blue-600 dark:text-blue-400">Invoice Terbuka</span>
                        </div>
                        <div className="flex items-baseline gap-2">
                            <span className="text-3xl font-black text-blue-700 dark:text-blue-300 tabular-nums">{stats.openInvoicesCount}</span>
                            <span className="text-sm font-mono font-bold text-blue-500 dark:text-blue-400">{formatIDR(stats.outstandingAmount)}</span>
                        </div>
                    </div>
                    {/* Hari Ini */}
                    <div className={`px-5 py-4 ${stats.todayPayments > 0 ? "bg-emerald-50/50 dark:bg-emerald-950/10" : ""}`}>
                        <div className="flex items-center gap-1.5 mb-1">
                            <span className={`w-2 h-2 rounded-full ${stats.todayPayments > 0 ? "bg-emerald-500" : "bg-zinc-300"}`} />
                            <span className={`text-[10px] font-black uppercase tracking-widest ${stats.todayPayments > 0 ? "text-emerald-600 dark:text-emerald-400" : "text-zinc-400"}`}>Penerimaan Hari Ini</span>
                        </div>
                        <span className={`text-3xl font-black tabular-nums ${stats.todayPayments > 0 ? "text-emerald-600 dark:text-emerald-400" : "text-zinc-300 dark:text-zinc-600"}`}>{formatIDR(stats.todayPayments)}</span>
                    </div>
                </div>

                {/* Row 2: Actions */}
                <div className={`px-5 py-2.5 flex items-center justify-end ${NB.pageRowBorder}`}>
                    <div className="flex items-center gap-0">
                        <Button variant="outline" onClick={() => { exportToExcel([{ header: "No.", accessorKey: "number" },{ header: "Dari", accessorKey: "from" },{ header: "Jumlah", accessorKey: "amount" },{ header: "Metode", accessorKey: "method" },{ header: "Referensi", accessorKey: "reference" },{ header: "Tanggal", accessorKey: "date" },{ header: "Status", accessorKey: "allocated" }], unallocated.map(p => ({ number: p.number, from: p.from, amount: p.amount, method: p.method, reference: p.reference || "-", date: new Date(p.date).toLocaleDateString("id-ID"), allocated: p.allocated ? "Teralokasi" : "Belum" })) as Record<string, unknown>[], { filename: "penerimaan-ar" }) }} className={`${NB.toolbarBtn} ${NB.toolbarBtnJoin}`}>
                            <Download className="h-3.5 w-3.5 mr-1" /> Export
                        </Button>
                        <Button variant="outline" onClick={() => { queryClient.invalidateQueries({ queryKey: queryKeys.invoices.all }); queryClient.invalidateQueries({ queryKey: queryKeys.vendorPayments.all }); queryClient.invalidateQueries({ queryKey: queryKeys.financeDashboard.all }); queryClient.invalidateQueries({ queryKey: queryKeys.journal.all }) }} className={NB.toolbarBtn}>
                            <RefreshCcw className="h-3.5 w-3.5 mr-1" /> Refresh
                        </Button>
                        <Button onClick={() => setIsCreateDialogOpen(true)} className={NB.toolbarBtnPrimary}>
                            <Plus className="h-3.5 w-3.5 mr-1" /> Catat Penerimaan
                        </Button>
                    </div>
                </div>
                {/* Row 2: Search + Steps */}
                <div className="px-5 py-2.5 flex items-center gap-3 bg-zinc-50/50 dark:bg-zinc-800/20">
                    <div className="relative flex-1">
                        <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-zinc-400" />
                        <input className="border border-zinc-200 dark:border-zinc-700 font-medium h-8 w-full text-xs rounded-none pl-9 pr-3 outline-none placeholder:text-zinc-400 bg-white dark:bg-zinc-900 focus:border-zinc-900 dark:focus:border-zinc-400 transition-colors" placeholder="Cari pembayaran..." value={paymentQuery} onChange={(e) => setPaymentQuery(e.target.value)} onKeyDown={(e) => e.key === "Enter" && applyRegistryFilters()} />
                    </div>
                    <div className="relative flex-1">
                        <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-zinc-400" />
                        <input className="border border-zinc-200 dark:border-zinc-700 font-medium h-8 w-full text-xs rounded-none pl-9 pr-3 outline-none placeholder:text-zinc-400 bg-white dark:bg-zinc-900 focus:border-zinc-900 dark:focus:border-zinc-400 transition-colors" placeholder="Cari invoice..." value={invoiceQuery} onChange={(e) => setInvoiceQuery(e.target.value)} onKeyDown={(e) => e.key === "Enter" && applyRegistryFilters()} />
                    </div>
                    <button onClick={applyRegistryFilters} className="h-8 px-3 bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 text-[10px] font-bold uppercase tracking-wider hover:bg-zinc-700 dark:hover:bg-zinc-300 transition-colors">Cari</button>
                    {(paymentQuery || invoiceQuery) && <button onClick={resetRegistryFilters} className="text-[10px] font-bold text-zinc-400 hover:text-zinc-600 transition-colors">Reset</button>}
                    {/* Minimal step indicator */}
                    <div className="hidden md:flex items-center gap-1.5 ml-auto pl-4 border-l border-zinc-200 dark:border-zinc-700">
                        {[{ s: 1, l: "Pembayaran" }, { s: 2, l: "Invoice" }, { s: 3, l: "Alokasi" }].map(({ s, l }) => (
                            <div key={s} className="flex items-center gap-1">
                                {s > 1 && <div className={`w-4 h-px ${currentStep >= s ? "bg-zinc-900 dark:bg-zinc-300" : "bg-zinc-200 dark:bg-zinc-700"}`} />}
                                <div className={`h-5 w-5 flex items-center justify-center text-[9px] font-bold transition-colors ${currentStep >= s ? "bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900" : "bg-zinc-100 dark:bg-zinc-800 text-zinc-400"}`}>
                                    {currentStep > s ? <Check className="h-3 w-3" /> : s}
                                </div>
                                <span className={`text-[10px] font-bold ${currentStep >= s ? "text-zinc-700 dark:text-zinc-300" : "text-zinc-400"}`}>{l}</span>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* ─── TWO PANELS ─── */}
            <div className="grid gap-4 xl:grid-cols-2">
                {/* ── LEFT: Payments ── */}
                <div className="border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] bg-white dark:bg-zinc-900 overflow-hidden flex flex-col" style={{ minHeight: 420 }}>
                    <div className="px-5 py-2.5 border-b border-zinc-100 dark:border-zinc-800 flex items-center justify-between">
                        <h3 className="text-[11px] font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">Pembayaran Masuk</h3>
                        <span className="text-[10px] font-bold text-zinc-400">{registryMeta.payments.total}</span>
                    </div>

                    {/* Payment Items */}
                    <div className="flex-1 overflow-auto divide-y divide-zinc-100 dark:divide-zinc-800">
                        {filteredPayments.length === 0 ? (
                            <div className="flex-1 flex items-center justify-center py-16 text-zinc-400 text-xs font-bold uppercase tracking-widest">
                                Tidak ada pembayaran ditemukan
                            </div>
                        ) : (
                            filteredPayments.map((item) => {
                                const isSelected = selectedPaymentId === item.id
                                return (
                                    <button
                                        type="button"
                                        key={item.id}
                                        data-payment-id={item.id}
                                        className={`w-full px-5 py-3 text-left transition-colors ${isSelected
                                            ? "bg-emerald-50 dark:bg-emerald-950/30 border-l-4 border-l-emerald-500"
                                            : "hover:bg-zinc-50 dark:hover:bg-zinc-800/50 border-l-4 border-l-transparent"
                                            }`}
                                        onClick={() => {
                                            setSelectedPaymentId(item.id)
                                            setSelectedInvoiceId(null)
                                        }}
                                    >
                                        <div className="flex items-center justify-between gap-2 mb-1">
                                            <span className="font-mono text-sm font-bold text-zinc-900 dark:text-zinc-100">{item.number}</span>
                                            <span className="text-[10px] font-bold text-zinc-400">
                                                {new Date(item.date).toLocaleDateString("id-ID")}
                                            </span>
                                        </div>
                                        <div className="flex items-center justify-between gap-2">
                                            <span className="text-sm font-medium text-zinc-600 dark:text-zinc-300 truncate">{item.from}</span>
                                            <span className="font-mono font-black text-sm text-emerald-700 dark:text-emerald-400 whitespace-nowrap">{formatIDR(item.amount)}</span>
                                        </div>
                                        <div className="flex items-center gap-2 mt-1 text-[10px]">
                                            <span className="font-bold text-zinc-400">{METHOD_LABEL[item.method as PaymentMethod] ?? item.method}</span>
                                            <span className="text-zinc-200 dark:text-zinc-700">&middot;</span>
                                            <span className={`font-bold ${item.allocated ? "text-zinc-600 dark:text-zinc-300" : "text-zinc-400"}`}>
                                                {item.allocated ? (item.invoiceNumber ? `→ ${item.invoiceNumber}` : "Teralokasi") : "Belum dialokasi"}
                                            </span>
                                            {item.reference && <span className="font-medium text-zinc-300 dark:text-zinc-600 truncate">Ref: {item.reference}</span>}
                                        </div>
                                    </button>
                                )
                            })
                        )}
                    </div>

                    {/* Pagination */}
                    <div className="px-5 py-2 border-t border-zinc-100 dark:border-zinc-800 flex items-center justify-between">
                        <span className="text-[10px] font-bold text-zinc-400">{registryMeta.payments.page}/{registryMeta.payments.totalPages}</span>
                        <div className="flex items-center gap-1">
                            <button className="h-7 w-7 flex items-center justify-center border border-zinc-200 dark:border-zinc-700 text-zinc-400 hover:text-zinc-600 hover:bg-zinc-50 dark:hover:bg-zinc-800 disabled:opacity-30 transition-colors" disabled={registryMeta.payments.page <= 1} onClick={() => pushSearchParams((p) => { p.set("pay_page", String(Math.max(1, registryMeta.payments.page - 1))) })}><ChevronLeft className="h-3.5 w-3.5" /></button>
                            <button className="h-7 w-7 flex items-center justify-center border border-zinc-200 dark:border-zinc-700 text-zinc-400 hover:text-zinc-600 hover:bg-zinc-50 dark:hover:bg-zinc-800 disabled:opacity-30 transition-colors" disabled={registryMeta.payments.page >= registryMeta.payments.totalPages} onClick={() => pushSearchParams((p) => { p.set("pay_page", String(Math.min(registryMeta.payments.totalPages, registryMeta.payments.page + 1))) })}><ChevronRight className="h-3.5 w-3.5" /></button>
                        </div>
                    </div>
                </div>

                {/* ── RIGHT: Invoices ── */}
                <div className="border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] bg-white dark:bg-zinc-900 overflow-hidden flex flex-col" style={{ minHeight: 420 }}>
                    <div className="px-5 py-2.5 border-b border-zinc-100 dark:border-zinc-800 flex items-center justify-between">
                        <h3 className="text-[11px] font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">Invoice Tujuan</h3>
                        {selectedPayment && <span className="text-[10px] font-bold text-zinc-400">{filteredInvoices.length}</span>}
                    </div>
                    {selectedPayment && (
                        <div className="px-5 py-1.5 border-b border-zinc-100 dark:border-zinc-800">
                            <span className="text-[10px] font-bold text-zinc-500">Difilter: {selectedPayment.from}</span>
                        </div>
                    )}

                    {/* Invoice Items */}
                    <div className="flex-1 overflow-auto divide-y divide-zinc-100 dark:divide-zinc-800">
                        {!selectedPayment ? (
                            <div className="flex-1 flex flex-col items-center justify-center py-16 gap-2 text-zinc-400">
                                <ArrowRightLeft className="h-6 w-6 text-zinc-300" />
                                <span className="text-xs font-bold uppercase tracking-widest">Pilih pembayaran terlebih dahulu</span>
                            </div>
                        ) : filteredInvoices.length === 0 ? (
                            <div className="flex-1 flex items-center justify-center py-16 text-zinc-400 text-xs font-bold uppercase tracking-widest">
                                Tidak ada invoice yang cocok
                            </div>
                        ) : (
                            filteredInvoices.map((invoice) => {
                                const isSelected = selectedInvoiceId === invoice.id
                                return (
                                    <button
                                        key={invoice.id}
                                        type="button"
                                        onClick={() => setSelectedInvoiceId(invoice.id)}
                                        className={`w-full px-5 py-3 text-left transition-colors ${isSelected
                                            ? "bg-blue-50 dark:bg-blue-950/30 border-l-4 border-l-blue-500"
                                            : "hover:bg-zinc-50 dark:hover:bg-zinc-800/50 border-l-4 border-l-transparent"
                                            }`}
                                    >
                                        <div className="flex items-center justify-between gap-2 mb-1">
                                            <span className="font-mono text-sm font-bold text-zinc-900 dark:text-zinc-100">{invoice.number}</span>
                                            <Badge
                                                variant={invoice.isOverdue ? "destructive" : "outline"}
                                                className={invoice.isOverdue
                                                    ? "text-[10px] font-black uppercase"
                                                    : "text-[10px] font-black uppercase border-zinc-300 text-zinc-500"}
                                            >
                                                {invoice.isOverdue ? "Jatuh Tempo" : "On Time"}
                                            </Badge>
                                        </div>
                                        <div className="flex items-center justify-between gap-2">
                                            <span className="text-sm font-medium text-zinc-600 dark:text-zinc-300 truncate">
                                                {invoice.customer?.name ?? "Tanpa pelanggan"}
                                            </span>
                                            <span className={`font-mono font-black text-sm whitespace-nowrap ${invoice.isOverdue ? "text-red-700 dark:text-red-400" : "text-zinc-900 dark:text-zinc-100"
                                                }`}>
                                                {formatIDR(invoice.balanceDue)}
                                            </span>
                                        </div>
                                        <div className="mt-1 text-[10px] font-medium text-zinc-400">
                                            Jatuh tempo {new Date(invoice.dueDate).toLocaleDateString("id-ID")}
                                        </div>
                                    </button>
                                )
                            })
                        )}
                    </div>

                    {/* Pagination */}
                    <div className="px-5 py-2 border-t border-zinc-100 dark:border-zinc-800 flex items-center justify-between">
                        <span className="text-[10px] font-bold text-zinc-400">{registryMeta.invoices.page}/{registryMeta.invoices.totalPages}</span>
                        <div className="flex items-center gap-1">
                            <button className="h-7 w-7 flex items-center justify-center border border-zinc-200 dark:border-zinc-700 text-zinc-400 hover:text-zinc-600 hover:bg-zinc-50 dark:hover:bg-zinc-800 disabled:opacity-30 transition-colors" disabled={registryMeta.invoices.page <= 1} onClick={() => pushSearchParams((p) => { p.set("inv_page", String(Math.max(1, registryMeta.invoices.page - 1))) })}><ChevronLeft className="h-3.5 w-3.5" /></button>
                            <button className="h-7 w-7 flex items-center justify-center border border-zinc-200 dark:border-zinc-700 text-zinc-400 hover:text-zinc-600 hover:bg-zinc-50 dark:hover:bg-zinc-800 disabled:opacity-30 transition-colors" disabled={registryMeta.invoices.page >= registryMeta.invoices.totalPages} onClick={() => pushSearchParams((p) => { p.set("inv_page", String(Math.min(registryMeta.invoices.totalPages, registryMeta.invoices.page + 1))) })}><ChevronRight className="h-3.5 w-3.5" /></button>
                        </div>
                    </div>
                </div>
            </div>

            {/* ═══════════════════════════════════════════ */}
            {/* RECENT ALLOCATED PAYMENTS                   */}
            {/* ═══════════════════════════════════════════ */}
            {recentPayments.length > 0 && (
                <div className="border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] bg-white dark:bg-zinc-900 overflow-hidden">
                    <div className="px-5 py-2.5 border-b border-zinc-100 dark:border-zinc-800 flex items-center justify-between">
                        <h3 className="text-[11px] font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">Riwayat Terakhir</h3>
                        <span className="text-[10px] font-bold text-zinc-400">{recentPayments.length}</span>
                    </div>
                    <div className="divide-y divide-zinc-100 dark:divide-zinc-800 max-h-[320px] overflow-auto">
                        {recentPayments.map((payment) => (
                            <div key={payment.id} className="px-5 py-2.5 flex items-center gap-4">
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2">
                                        {payment.invoice && <span className="font-mono text-sm font-bold text-zinc-900 dark:text-zinc-100 truncate">{payment.invoice.number}</span>}
                                        <span className="text-[10px] font-bold text-zinc-400">{METHOD_LABEL[payment.method as PaymentMethod] ?? payment.method}</span>
                                        {payment.reference && <span className="text-[10px] text-zinc-300 dark:text-zinc-600 truncate">Ref: {payment.reference}</span>}
                                    </div>
                                </div>
                                <div className="text-right shrink-0 flex items-center gap-3">
                                    <span className="font-mono font-bold text-sm text-zinc-900 dark:text-zinc-100">{formatIDR(payment.amount)}</span>
                                    <span className="text-[10px] font-bold text-zinc-400">{new Date(payment.createdAt).toLocaleDateString("id-ID")}</span>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* ═══════════════════════════════════════════ */}
            {/* CONFIRMATION PANEL                         */}
            {/* ═══════════════════════════════════════════ */}
            <div className="border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] bg-white dark:bg-zinc-900 overflow-hidden">
                <div className="px-5 py-2.5 border-b border-zinc-100 dark:border-zinc-800 flex items-center gap-2">
                    <h3 className="text-[11px] font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">Konfirmasi Alokasi</h3>
                </div>

                <div className="p-5 space-y-4">
                    {/* Summary Cards */}
                    <div className="grid gap-4 md:grid-cols-2">
                        {/* Selected Payment */}
                        <div className={`border p-4 ${selectedPayment ? "border-zinc-300 dark:border-zinc-600 bg-zinc-50/50 dark:bg-zinc-800/50" : "border-zinc-200 dark:border-zinc-700 bg-zinc-50/30 dark:bg-zinc-800/30"}`}>
                            <div className="flex items-center gap-2 mb-3">
                                <Wallet className="h-4 w-4 text-zinc-400" />
                                <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-500">Pembayaran Terpilih</span>
                            </div>
                            {selectedPayment ? (
                                <div className="space-y-1.5">
                                    <p className="font-mono text-sm font-bold text-zinc-900 dark:text-zinc-100">{selectedPayment.number}</p>
                                    <p className="text-sm font-medium text-zinc-600 dark:text-zinc-300">{selectedPayment.from}</p>
                                    <p className="font-mono font-black text-lg text-emerald-700 dark:text-emerald-400">{formatIDR(selectedPayment.amount)}</p>
                                    <span className="text-[10px] font-bold text-zinc-400">
                                        Metode: {METHOD_LABEL[selectedPayment.method as PaymentMethod] ?? selectedPayment.method}
                                    </span>
                                </div>
                            ) : (
                                <p className="text-sm text-zinc-400 font-medium">Belum ada pembayaran dipilih.</p>
                            )}
                        </div>

                        {/* Selected Invoice */}
                        <div className={`border p-4 ${selectedInvoice ? "border-zinc-300 dark:border-zinc-600 bg-zinc-50/50 dark:bg-zinc-800/50" : "border-zinc-200 dark:border-zinc-700 bg-zinc-50/30 dark:bg-zinc-800/30"}`}>
                            <div className="flex items-center gap-2 mb-3">
                                <FileText className="h-4 w-4 text-zinc-400" />
                                <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-500">Invoice Tujuan</span>
                            </div>
                            {selectedInvoice ? (
                                <div className="space-y-1.5">
                                    <p className="font-mono text-sm font-bold text-zinc-900 dark:text-zinc-100">{selectedInvoice.number}</p>
                                    <p className="text-sm font-medium text-zinc-600 dark:text-zinc-300">{selectedInvoice.customer?.name ?? "Tanpa pelanggan"}</p>
                                    <p className={`font-mono font-black text-lg ${selectedInvoice.isOverdue ? "text-red-700 dark:text-red-400" : "text-zinc-900 dark:text-zinc-100"}`}>
                                        {formatIDR(selectedInvoice.balanceDue)}
                                    </p>
                                    <span className="text-[10px] font-bold text-zinc-400">
                                        Jatuh tempo: {new Date(selectedInvoice.dueDate).toLocaleDateString("id-ID")}
                                    </span>
                                </div>
                            ) : (
                                <p className="text-sm text-zinc-400 font-medium">Belum ada invoice dipilih.</p>
                            )}
                        </div>
                    </div>

                    {/* Amount Comparison */}
                    {selectedPayment && selectedInvoice && (
                        <div className="border border-zinc-200 dark:border-zinc-700 bg-zinc-50/50 dark:bg-zinc-800/30 p-4">
                            <div className="flex items-center justify-between">
                                <div className="text-center flex-1">
                                    <span className="text-[10px] font-black uppercase tracking-widest text-zinc-400 block mb-1">Pembayaran</span>
                                    <span className="font-mono font-black text-lg text-emerald-700">{formatIDR(selectedPayment.amount)}</span>
                                </div>
                                <div className="px-4">
                                    <ArrowRightLeft className="h-5 w-5 text-zinc-400" />
                                </div>
                                <div className="text-center flex-1">
                                    <span className="text-[10px] font-black uppercase tracking-widest text-zinc-400 block mb-1">Sisa Invoice</span>
                                    <span className="font-mono font-black text-lg text-zinc-900 dark:text-zinc-100">{formatIDR(selectedInvoice.balanceDue)}</span>
                                </div>
                                <div className="px-4">
                                    <span className="text-zinc-400">=</span>
                                </div>
                                <div className="text-center flex-1">
                                    <span className="text-[10px] font-black uppercase tracking-widest text-zinc-400 block mb-1">Selisih</span>
                                    <span className={`font-mono font-black text-lg ${selectedPayment.amount - selectedInvoice.balanceDue >= 0 ? "text-emerald-700" : "text-red-700"
                                        }`}>
                                        {formatIDR(selectedPayment.amount - selectedInvoice.balanceDue)}
                                    </span>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Mismatch Warning */}
                    {paymentInvoiceMismatch && (
                        <div className="border border-red-200 bg-red-50/50 dark:bg-red-950/10 p-3 flex items-center gap-3">
                            <AlertTriangle className="h-5 w-5 text-red-600 flex-shrink-0" />
                            <span className="text-sm font-bold text-red-700 dark:text-red-400">
                                Pelanggan pembayaran tidak sama dengan pelanggan invoice. Pilih invoice yang sesuai.
                            </span>
                        </div>
                    )}

                    {/* Action Row */}
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 text-sm text-zinc-400">
                            <ArrowRightLeft className="h-4 w-4" />
                            <span className="text-[10px] font-bold uppercase tracking-wide">Alokasi akan mengurangi saldo invoice & membuat jurnal otomatis</span>
                        </div>
                        <Button
                            disabled={!canMatch}
                            onClick={() => selectedPayment && selectedInvoice && handleMatch(selectedPayment.id, selectedInvoice.id)}
                            className="bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 hover:bg-zinc-800 dark:hover:bg-zinc-200 text-[10px] font-bold uppercase tracking-wider h-9 px-6 rounded-none transition-colors disabled:opacity-30"
                        >
                            {processing ? (
                                <>
                                    <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> Memproses...
                                </>
                            ) : (
                                <>
                                    <BadgeCheck className="mr-1.5 h-3.5 w-3.5" /> Alokasikan Pembayaran
                                </>
                            )}
                        </Button>
                    </div>
                </div>
            </div>

            {/* ═══════════════════════════════════════════ */}
            {/* CREATE PAYMENT DIALOG                      */}
            {/* ═══════════════════════════════════════════ */}
            <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
                <DialogContent className="max-w-3xl sm:max-w-3xl p-0 border-2 border-black shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] rounded-none overflow-hidden gap-0">
                    {/* Black header */}
                    <DialogHeader className="bg-black text-white px-5 py-3">
                        <DialogTitle className="text-sm font-black uppercase tracking-wider text-white flex items-center gap-2">
                            <Wallet className="h-4 w-4" /> Catat Penerimaan Baru
                        </DialogTitle>
                        <p className={NB.subtitle}>
                            Catat penerimaan pelanggan — bisa langsung dialokasikan atau disimpan dulu
                        </p>
                    </DialogHeader>

                    <div className={NB.scroll}>
                        <div className="p-4 space-y-3">
                            {/* Data Penerimaan Section */}
                            <div className="border border-zinc-200 dark:border-zinc-700">
                                <div className="bg-zinc-50 dark:bg-zinc-800/50 px-3 py-1.5 border-b border-zinc-200 dark:border-zinc-700 flex items-center gap-2">
                                    <CircleDollarSign className="h-3.5 w-3.5 text-zinc-400" />
                                    <span className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Data Penerimaan</span>
                                </div>
                                <div className="p-3 space-y-3">
                                    <div>
                                        <label className={NB.label}>Pelanggan <span className="text-red-500">*</span></label>
                                        <Select
                                            value={createForm.customerId || EMPTY_INVOICE_VALUE}
                                            onValueChange={(value) =>
                                                setCreateForm((prev) => ({
                                                    ...prev,
                                                    customerId: value === EMPTY_INVOICE_VALUE ? "" : value,
                                                    invoiceId: ""
                                                }))
                                            }
                                        >
                                            <SelectTrigger className={`h-8 text-sm rounded-none border ${
                                                createForm.customerId
                                                    ? "border-orange-400 dark:border-orange-500 bg-orange-50/50 dark:bg-orange-950/20 font-bold"
                                                    : "border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900"
                                            }`}>
                                                <SelectValue placeholder="Pilih pelanggan" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value={EMPTY_INVOICE_VALUE}>Pilih pelanggan</SelectItem>
                                                {allCustomers.map((customer) => (
                                                    <SelectItem key={customer.id} value={customer.id}>
                                                        {customer.code ? `[${customer.code}] ` : ""}{customer.name}
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    <div className="grid grid-cols-3 gap-3">
                                        <div>
                                            <label className={NB.label}>Nominal <span className="text-red-500">*</span></label>
                                            <div className={`flex items-center border h-8 rounded-none transition-colors ${
                                                Number(createForm.amount) > 0
                                                    ? "border-emerald-400 dark:border-emerald-600 bg-emerald-50 dark:bg-emerald-950/20"
                                                    : "border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900"
                                            }`}>
                                                <span className={`pl-2 text-[10px] font-bold select-none ${
                                                    Number(createForm.amount) > 0 ? "text-emerald-500" : "text-zinc-300 dark:text-zinc-600"
                                                }`}>Rp</span>
                                                <input
                                                    type="text"
                                                    inputMode="numeric"
                                                    placeholder="0"
                                                    className={`w-full h-full bg-transparent text-right text-sm font-mono font-bold pr-2 pl-1 outline-none placeholder:text-zinc-300 placeholder:font-normal ${
                                                        Number(createForm.amount) > 0 ? "text-emerald-700 dark:text-emerald-400" : ""
                                                    }`}
                                                    value={Number(createForm.amount) ? Number(createForm.amount).toLocaleString("id-ID") : createForm.amount}
                                                    onChange={(e) => {
                                                        const raw = e.target.value.replace(/\D/g, "")
                                                        setCreateForm((prev) => ({ ...prev, amount: raw }))
                                                    }}
                                                />
                                            </div>
                                        </div>

                                        <div>
                                            <label className={NB.label}>Tanggal</label>
                                            <Input
                                                type="date"
                                                value={createForm.date}
                                                onChange={(event) =>
                                                    setCreateForm((prev) => ({ ...prev, date: event.target.value }))
                                                }
                                                className={`border font-medium h-8 text-sm rounded-none transition-colors ${
                                                    createForm.date
                                                        ? "border-orange-400 dark:border-orange-500 bg-orange-50/50 dark:bg-orange-950/20"
                                                        : "border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900"
                                                }`}
                                            />
                                        </div>

                                        <div>
                                            <label className={NB.label}>Metode</label>
                                            <Select
                                                value={createForm.method}
                                                onValueChange={(value) =>
                                                    setCreateForm((prev) => ({ ...prev, method: value as PaymentMethod }))
                                                }
                                            >
                                                <SelectTrigger className={`h-8 text-sm rounded-none border ${
                                                    createForm.method
                                                        ? "border-orange-400 dark:border-orange-500 bg-orange-50/50 dark:bg-orange-950/20 font-bold"
                                                        : "border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900"
                                                }`}>
                                                    <SelectValue />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="TRANSFER">Transfer Bank</SelectItem>
                                                    <SelectItem value="CASH">Tunai</SelectItem>
                                                    <SelectItem value="CHECK">Cek</SelectItem>
                                                    <SelectItem value="GIRO">Giro</SelectItem>
                                                    <SelectItem value="CARD">Kartu</SelectItem>
                                                </SelectContent>
                                            </Select>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Invoice Link Section */}
                            <div className="border border-zinc-200 dark:border-zinc-700">
                                <div className="bg-zinc-50 dark:bg-zinc-800/50 px-3 py-1.5 border-b border-zinc-200 dark:border-zinc-700 flex items-center gap-2">
                                    <FileText className="h-3.5 w-3.5 text-zinc-400" />
                                    <span className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Hubungkan ke Invoice</span>
                                    <span className="text-[10px] font-medium text-zinc-400 ml-auto">opsional</span>
                                </div>
                                <div className="p-3 space-y-3">
                                    <div>
                                        <label className={NB.label}>Invoice Penjualan</label>
                                        <Select
                                            value={createForm.invoiceId || EMPTY_INVOICE_VALUE}
                                            onValueChange={(value) => {
                                                if (value === EMPTY_INVOICE_VALUE) {
                                                    setCreateForm((prev) => ({ ...prev, invoiceId: "" }))
                                                    return
                                                }
                                                const invoice = openInvoices.find((item) => item.id === value)
                                                setCreateForm((prev) => ({
                                                    ...prev,
                                                    invoiceId: value,
                                                    customerId: invoice?.customer?.id ?? prev.customerId
                                                }))
                                            }}
                                        >
                                            <SelectTrigger className={`h-8 text-sm rounded-none border ${
                                                createForm.invoiceId
                                                    ? "border-orange-400 dark:border-orange-500 bg-orange-50/50 dark:bg-orange-950/20 font-bold"
                                                    : "border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900"
                                            }`}>
                                                <SelectValue placeholder="Kosongkan untuk simpan tanpa alokasi" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value={EMPTY_INVOICE_VALUE}>Tanpa alokasi</SelectItem>
                                                {openInvoices
                                                    .filter((inv) => !createForm.customerId || inv.customer?.id === createForm.customerId)
                                                    .map((invoice) => (
                                                        <SelectItem key={invoice.id} value={invoice.id}>
                                                            {invoice.number} {"\u2014"} {invoice.customer?.name ?? "?"} {"\u2014"} Sisa: {formatIDR(invoice.balanceDue)} {invoice.isOverdue ? " OVERDUE" : ""}
                                                        </SelectItem>
                                                    ))}
                                            </SelectContent>
                                        </Select>
                                    </div>

                                    <div className="grid grid-cols-2 gap-3">
                                        <div>
                                            <label className={NB.label}>Referensi</label>
                                            <Input
                                                value={createForm.reference}
                                                onChange={(event) =>
                                                    setCreateForm((prev) => ({ ...prev, reference: event.target.value }))
                                                }
                                                placeholder="No. transfer / no. cek"
                                                className={`border font-medium h-8 text-sm rounded-none placeholder:text-zinc-400 placeholder:italic placeholder:font-normal transition-colors ${
                                                    createForm.reference
                                                        ? "border-orange-400 dark:border-orange-500 bg-orange-50/50 dark:bg-orange-950/20"
                                                        : "border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900"
                                                }`}
                                            />
                                        </div>

                                        <div>
                                            <label className={NB.label}>Catatan</label>
                                            <Input
                                                value={createForm.notes}
                                                onChange={(event) =>
                                                    setCreateForm((prev) => ({ ...prev, notes: event.target.value }))
                                                }
                                                placeholder="Catatan tambahan"
                                                className={`border font-medium h-8 text-sm rounded-none placeholder:text-zinc-400 placeholder:italic placeholder:font-normal transition-colors ${
                                                    createForm.notes
                                                        ? "border-orange-400 dark:border-orange-500 bg-orange-50/50 dark:bg-orange-950/20"
                                                        : "border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900"
                                                }`}
                                            />
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Sticky footer */}
                    <div className="border-t border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800/50 px-4 py-2.5 flex items-center justify-end gap-2">
                        <Button
                            variant="outline"
                            onClick={() => setIsCreateDialogOpen(false)}
                            className="border border-zinc-300 dark:border-zinc-600 text-zinc-500 font-bold uppercase text-[10px] tracking-wider px-4 h-8 rounded-none"
                        >
                            Batal
                        </Button>
                        <Button
                            onClick={handleCreatePayment}
                            disabled={submittingPayment}
                            className="bg-black text-white border border-black hover:bg-zinc-800 font-black uppercase text-[10px] tracking-wider px-5 h-8 rounded-none gap-1.5 disabled:opacity-40 transition-colors"
                        >
                            {submittingPayment ? (
                                <>
                                    <Loader2 className="h-3 w-3 animate-spin" /> Menyimpan...
                                </>
                            ) : (
                                "Simpan Penerimaan"
                            )}
                        </Button>
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    )
}
