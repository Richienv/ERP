"use client"

import { useEffect, useMemo, useState } from "react"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { formatIDR } from "@/lib/utils"
import {
    ArrowRightLeft,
    ArrowUpRight,
    BadgeCheck,
    Check,
    ChevronLeft,
    ChevronRight,
    CircleDollarSign,
    Clock,
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
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog"
import {
    NBDialog,
    NBDialogHeader,
    NBDialogBody,
    NBDialogFooter,
    NBSection,
    NBInput,
    NBCurrencyInput,
    NBSelect,
} from "@/components/ui/nb-dialog"
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
    number: string
    amount: number
    method: string
    reference: string | null
    date: Date
    createdAt: Date
    customerName: string | null
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

    // NEW: tab state for combined panel
    const [activeTab, setActiveTab] = useState<"payments" | "invoices">("payments")

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
                setActiveTab("payments")
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

    // Unified search — contextual to active tab
    const displayedQuery = activeTab === "payments" ? paymentQuery : invoiceQuery
    const setDisplayedQuery = (v: string) => {
        if (activeTab === "payments") setPaymentQuery(v)
        else setInvoiceQuery(v)
    }

    const applySearch = () => {
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

    const handleSelectPayment = (id: string) => {
        setSelectedPaymentId(id)
        setSelectedInvoiceId(null)
        setActiveTab("invoices")
    }

    const activePagination = activeTab === "payments" ? registryMeta.payments : registryMeta.invoices
    const activePageParam = activeTab === "payments" ? "pay_page" : "inv_page"

    return (
        <div className="mf-page">

            {/* ═══════════════════════════════════════════ */}
            {/* HEADER CARD                                 */}
            {/* ═══════════════════════════════════════════ */}
            <div className={NB.pageCard}>
                <div className={NB.pageAccent} />

                {/* KPI Strip — compact */}
                <div className={`grid grid-cols-3 ${NB.pageRowBorder}`}>
                    <div className={`px-4 py-2.5 border-r border-zinc-200 dark:border-zinc-800 ${stats.unallocatedCount > 0 ? "bg-amber-50/40 dark:bg-amber-950/10" : ""}`}>
                        <div className="flex items-center gap-1.5 mb-0.5">
                            <span className={`w-1.5 h-1.5 rounded-full ${stats.unallocatedCount > 0 ? "bg-amber-500" : "bg-zinc-300"}`} />
                            <span className={`text-[10px] font-bold uppercase tracking-widest ${stats.unallocatedCount > 0 ? "text-amber-600 dark:text-amber-400" : "text-zinc-400"}`}>Belum Dialokasi</span>
                        </div>
                        <span className={`text-2xl font-black tabular-nums ${stats.unallocatedCount > 0 ? "text-amber-600 dark:text-amber-400" : "text-zinc-300 dark:text-zinc-600"}`}>{stats.unallocatedCount}</span>
                    </div>
                    <div className="px-4 py-2.5 border-r border-zinc-200 dark:border-zinc-800 bg-blue-50/40 dark:bg-blue-950/10">
                        <div className="flex items-center gap-1.5 mb-0.5">
                            <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />
                            <span className="text-[10px] font-bold uppercase tracking-widest text-blue-600 dark:text-blue-400">Invoice Terbuka</span>
                        </div>
                        <div className="flex items-baseline gap-2">
                            <span className="text-2xl font-black text-blue-700 dark:text-blue-300 tabular-nums">{stats.openInvoicesCount}</span>
                            <span className="text-xs font-mono font-bold text-blue-500 dark:text-blue-400">{formatIDR(stats.outstandingAmount)}</span>
                        </div>
                    </div>
                    <div className={`px-4 py-2.5 ${stats.todayPayments > 0 ? "bg-emerald-50/40 dark:bg-emerald-950/10" : ""}`}>
                        <div className="flex items-center gap-1.5 mb-0.5">
                            <span className={`w-1.5 h-1.5 rounded-full ${stats.todayPayments > 0 ? "bg-emerald-500" : "bg-zinc-300"}`} />
                            <span className={`text-[10px] font-bold uppercase tracking-widest ${stats.todayPayments > 0 ? "text-emerald-600 dark:text-emerald-400" : "text-zinc-400"}`}>Penerimaan Hari Ini</span>
                        </div>
                        <span className={`text-2xl font-black tabular-nums ${stats.todayPayments > 0 ? "text-emerald-600 dark:text-emerald-400" : "text-zinc-300 dark:text-zinc-600"}`}>{formatIDR(stats.todayPayments)}</span>
                    </div>
                </div>

                {/* Actions + Search — single row */}
                <div className="px-4 py-2 flex items-center gap-2 bg-zinc-50/50 dark:bg-zinc-800/20">
                    <div className="relative flex-1 max-w-xs">
                        <Search className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-zinc-400" />
                        <input
                            className="border border-zinc-200 dark:border-zinc-700 font-medium h-8 w-full text-xs rounded-none pl-8 pr-3 outline-none placeholder:text-zinc-400 bg-white dark:bg-zinc-900 focus:border-zinc-900 dark:focus:border-zinc-400 transition-colors"
                            placeholder={activeTab === "payments" ? "Cari pembayaran..." : "Cari invoice..."}
                            value={displayedQuery}
                            onChange={(e) => setDisplayedQuery(e.target.value)}
                            onKeyDown={(e) => e.key === "Enter" && applySearch()}
                        />
                    </div>
                    <button onClick={applySearch} className="h-8 px-3 bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 text-[10px] font-bold uppercase tracking-wider hover:bg-zinc-700 dark:hover:bg-zinc-300 transition-colors">Cari</button>
                    {(paymentQuery || invoiceQuery) && (
                        <button onClick={() => { setPaymentQuery(""); setInvoiceQuery(""); pushSearchParams((p) => { p.delete("pay_q"); p.delete("inv_q"); p.delete("pay_page"); p.delete("inv_page") }) }} className="text-[10px] font-bold text-zinc-400 hover:text-zinc-600 transition-colors">Reset</button>
                    )}

                    <div className="ml-auto flex items-center gap-0">
                        <Button variant="outline" onClick={() => { exportToExcel([{ header: "No.", accessorKey: "number" }, { header: "Dari", accessorKey: "from" }, { header: "Jumlah", accessorKey: "amount" }, { header: "Metode", accessorKey: "method" }, { header: "Referensi", accessorKey: "reference" }, { header: "Tanggal", accessorKey: "date" }, { header: "Status", accessorKey: "allocated" }], unallocated.map(p => ({ number: p.number, from: p.from, amount: p.amount, method: p.method, reference: p.reference || "-", date: new Date(p.date).toLocaleDateString("id-ID"), allocated: p.allocated ? "Teralokasi" : "Belum" })) as Record<string, unknown>[], { filename: "penerimaan-ar" }) }} className={`${NB.toolbarBtn} ${NB.toolbarBtnJoin}`}>
                            <Download className="h-3.5 w-3.5 mr-1" /> Export
                        </Button>
                        <Button variant="outline" onClick={() => { queryClient.invalidateQueries({ queryKey: queryKeys.arPayments.all }); queryClient.invalidateQueries({ queryKey: queryKeys.invoices.all }); queryClient.invalidateQueries({ queryKey: queryKeys.vendorPayments.all }); queryClient.invalidateQueries({ queryKey: queryKeys.financeDashboard.all }); queryClient.invalidateQueries({ queryKey: queryKeys.journal.all }) }} className={NB.toolbarBtn}>
                            <RefreshCcw className="h-3.5 w-3.5 mr-1" /> Refresh
                        </Button>
                        <Button onClick={() => setIsCreateDialogOpen(true)} className={NB.toolbarBtnPrimary}>
                            <Plus className="h-3.5 w-3.5 mr-1" /> Catat Penerimaan
                        </Button>
                    </div>
                </div>
            </div>

            {/* ═══════════════════════════════════════════ */}
            {/* RIWAYAT TERAKHIR — rich table with actions  */}
            {/* ═══════════════════════════════════════════ */}
            {recentPayments.length > 0 && (
                <div className="border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] bg-white dark:bg-zinc-900 overflow-hidden">
                    {/* Header bar */}
                    <div className="px-4 py-2 flex items-center justify-between bg-zinc-50 dark:bg-zinc-800/50 border-b border-zinc-200 dark:border-zinc-700">
                        <div className="flex items-center gap-2">
                            <Clock className="h-3.5 w-3.5 text-zinc-400" />
                            <span className="text-[10px] font-black uppercase tracking-widest text-zinc-500 dark:text-zinc-400">Riwayat Terakhir</span>
                        </div>
                        <span className="text-[10px] font-bold text-zinc-400 bg-zinc-200 dark:bg-zinc-700 px-2 py-0.5">{recentPayments.length}</span>
                    </div>

                    {/* Table header */}
                    <div className="grid grid-cols-12 gap-2 px-4 py-1.5 border-b border-zinc-200 dark:border-zinc-700 bg-zinc-50/60 dark:bg-zinc-800/30">
                        <div className="col-span-2 text-[9px] font-black uppercase tracking-widest text-zinc-400">Invoice</div>
                        <div className="col-span-3 text-[9px] font-black uppercase tracking-widest text-zinc-400">Pelanggan</div>
                        <div className="col-span-1 text-[9px] font-black uppercase tracking-widest text-zinc-400 text-center">Metode</div>
                        <div className="col-span-2 text-[9px] font-black uppercase tracking-widest text-zinc-400">Referensi</div>
                        <div className="col-span-2 text-[9px] font-black uppercase tracking-widest text-zinc-400 text-right">Jumlah</div>
                        <div className="col-span-2 text-[9px] font-black uppercase tracking-widest text-zinc-400 text-right">Tanggal</div>
                    </div>

                    {/* Table rows */}
                    <div className="max-h-[200px] overflow-auto">
                        {recentPayments.map((payment, idx) => (
                            <button
                                key={payment.id}
                                type="button"
                                onClick={() => {
                                    if (payment.invoice?.id) {
                                        router.push(`/finance/invoices?highlight=${payment.invoice.id}`)
                                    }
                                }}
                                className={`group w-full grid grid-cols-12 gap-2 px-4 py-2.5 border-b border-zinc-100 dark:border-zinc-800 items-center text-left transition-all duration-150 ${
                                    idx % 2 === 1 ? "bg-zinc-50/40 dark:bg-zinc-800/20" : ""
                                } hover:bg-orange-50/40 dark:hover:bg-orange-950/15 hover:border-l-4 hover:border-l-orange-400 hover:pl-3 ${
                                    payment.invoice ? "cursor-pointer" : "cursor-default"
                                }`}
                            >
                                {/* Invoice # */}
                                <div className="col-span-2 flex items-center gap-1.5 min-w-0">
                                    <span className="font-mono text-xs font-bold text-zinc-800 dark:text-zinc-100 truncate">
                                        {payment.invoice?.number ?? payment.number}
                                    </span>
                                    {payment.invoice && (
                                        <ArrowUpRight className="h-3 w-3 text-orange-400 opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
                                    )}
                                </div>

                                {/* Customer */}
                                <div className="col-span-3 min-w-0">
                                    <span className="text-xs font-medium text-zinc-600 dark:text-zinc-300 truncate block">
                                        {payment.customerName ?? "—"}
                                    </span>
                                </div>

                                {/* Method badge */}
                                <div className="col-span-1 flex justify-center">
                                    <span className={`text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 border text-center whitespace-nowrap ${
                                        payment.method === "TRANSFER"
                                            ? "border-blue-300 dark:border-blue-700 text-blue-600 dark:text-blue-400 bg-blue-50/50 dark:bg-blue-950/20"
                                            : payment.method === "CASH"
                                            ? "border-emerald-300 dark:border-emerald-700 text-emerald-600 dark:text-emerald-400 bg-emerald-50/50 dark:bg-emerald-950/20"
                                            : payment.method === "CHECK" || payment.method === "GIRO"
                                            ? "border-amber-300 dark:border-amber-700 text-amber-600 dark:text-amber-400 bg-amber-50/50 dark:bg-amber-950/20"
                                            : "border-zinc-300 dark:border-zinc-600 text-zinc-500 dark:text-zinc-400 bg-zinc-50/50 dark:bg-zinc-800/30"
                                    }`}>
                                        {METHOD_LABEL[payment.method as PaymentMethod]?.split(" ")[0] ?? payment.method}
                                    </span>
                                </div>

                                {/* Reference */}
                                <div className="col-span-2 min-w-0">
                                    <span className="font-mono text-[10px] text-zinc-400 dark:text-zinc-500 truncate block">
                                        {payment.reference || "—"}
                                    </span>
                                </div>

                                {/* Amount */}
                                <div className="col-span-2 text-right">
                                    <span className="font-mono font-bold text-xs text-emerald-700 dark:text-emerald-400">
                                        {formatIDR(payment.amount)}
                                    </span>
                                </div>

                                {/* Date + Status */}
                                <div className="col-span-2 flex items-center justify-end gap-2">
                                    <span className="text-[10px] font-bold text-zinc-400 whitespace-nowrap">
                                        {new Date(payment.date).toLocaleDateString("id-ID")}
                                    </span>
                                    {payment.invoice?.status && (
                                        <span className={`text-[8px] font-black uppercase px-1.5 py-0.5 ${
                                            payment.invoice.status === "PAID"
                                                ? "bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400"
                                                : payment.invoice.status === "PARTIAL"
                                                ? "bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400"
                                                : "bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400"
                                        }`}>
                                            {payment.invoice.status === "PAID" ? "Lunas" : payment.invoice.status === "PARTIAL" ? "Sebagian" : payment.invoice.status}
                                        </span>
                                    )}
                                </div>
                            </button>
                        ))}
                    </div>

                    {/* Summary footer */}
                    <div className="grid grid-cols-12 gap-2 px-4 py-2 bg-zinc-50 dark:bg-zinc-800/50 border-t border-zinc-200 dark:border-zinc-700">
                        <div className="col-span-8 text-[10px] font-black uppercase tracking-widest text-zinc-400 flex items-center">
                            Total {recentPayments.length} pembayaran
                        </div>
                        <div className="col-span-2 text-right">
                            <span className="font-mono font-black text-xs text-zinc-800 dark:text-zinc-100">
                                {formatIDR(recentPayments.reduce((sum, p) => sum + p.amount, 0))}
                            </span>
                        </div>
                        <div className="col-span-2" />
                    </div>
                </div>
            )}

            {/* ═══════════════════════════════════════════ */}
            {/* COMBINED PANEL — tabs + items + pagination  */}
            {/* ═══════════════════════════════════════════ */}
            <div className="border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] bg-white dark:bg-zinc-900 overflow-hidden flex flex-col" style={{ minHeight: 360 }}>
                {/* Tab header */}
                <div className="flex border-b-2 border-black">
                    <button
                        onClick={() => setActiveTab("payments")}
                        className={`flex-1 px-4 py-2 text-[11px] font-black uppercase tracking-wider transition-colors relative ${activeTab === "payments"
                            ? "bg-black text-white"
                            : "bg-zinc-50 dark:bg-zinc-800 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-700"
                            }`}
                    >
                        <div className="flex items-center justify-center gap-2">
                            {selectedPayment && activeTab !== "payments" && <Check className="h-3 w-3 text-emerald-400" />}
                            <Wallet className="h-3.5 w-3.5" />
                            Pembayaran Masuk
                            <span className={`text-[10px] font-mono ${activeTab === "payments" ? "text-zinc-500" : "text-zinc-300 dark:text-zinc-600"}`}>{registryMeta.payments.total}</span>
                        </div>
                    </button>
                    <button
                        onClick={() => setActiveTab("invoices")}
                        className={`flex-1 px-4 py-2 text-[11px] font-black uppercase tracking-wider transition-colors relative ${activeTab === "invoices"
                            ? "bg-black text-white"
                            : "bg-zinc-50 dark:bg-zinc-800 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-700"
                            }`}
                    >
                        <div className="flex items-center justify-center gap-2">
                            {selectedInvoice && activeTab !== "invoices" && <Check className="h-3 w-3 text-blue-400" />}
                            <FileText className="h-3.5 w-3.5" />
                            Invoice Tujuan
                            <span className={`text-[10px] font-mono ${activeTab === "invoices" ? "text-zinc-500" : "text-zinc-300 dark:text-zinc-600"}`}>{filteredInvoices.length}</span>
                        </div>
                    </button>
                </div>

                {/* Context bar — shows selected payment when on invoices tab */}
                {activeTab === "invoices" && selectedPayment && (
                    <div className="px-4 py-1.5 bg-emerald-50/60 dark:bg-emerald-950/20 border-b border-emerald-200 dark:border-emerald-900 flex items-center gap-2">
                        <Check className="h-3 w-3 text-emerald-500 shrink-0" />
                        <span className="text-[10px] font-bold text-emerald-700 dark:text-emerald-400 truncate">
                            {selectedPayment.number} &middot; {selectedPayment.from} &middot; {formatIDR(selectedPayment.amount)}
                        </span>
                        <button
                            onClick={() => { setSelectedPaymentId(null); setSelectedInvoiceId(null); setActiveTab("payments") }}
                            className="ml-auto text-[10px] font-bold text-emerald-600 dark:text-emerald-400 hover:text-emerald-800 dark:hover:text-emerald-200 transition-colors shrink-0"
                        >
                            Ubah
                        </button>
                    </div>
                )}

                {/* Items list */}
                <div className="flex-1 overflow-auto divide-y divide-zinc-100 dark:divide-zinc-800">
                    {activeTab === "payments" ? (
                        filteredPayments.length === 0 ? (
                            <div className="flex items-center justify-center py-16 text-zinc-400 text-xs font-bold uppercase tracking-widest">
                                Tidak ada pembayaran ditemukan
                            </div>
                        ) : (
                            filteredPayments.map((item) => {
                                const isSelected = selectedPaymentId === item.id
                                return (
                                    <button
                                        key={item.id}
                                        data-payment-id={item.id}
                                        type="button"
                                        className={`w-full px-4 py-2.5 text-left transition-colors ${isSelected
                                            ? "bg-emerald-50 dark:bg-emerald-950/30 border-l-4 border-l-emerald-500"
                                            : "hover:bg-zinc-50 dark:hover:bg-zinc-800/50 border-l-4 border-l-transparent"
                                            }`}
                                        onClick={() => handleSelectPayment(item.id)}
                                    >
                                        <div className="flex items-center justify-between gap-2">
                                            <div className="flex items-center gap-2 min-w-0">
                                                <span className="font-mono text-sm font-bold text-zinc-900 dark:text-zinc-100">{item.number}</span>
                                                <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400 truncate">{item.from}</span>
                                            </div>
                                            <div className="flex items-center gap-2.5 shrink-0">
                                                <span className="font-mono font-black text-sm text-emerald-700 dark:text-emerald-400">{formatIDR(item.amount)}</span>
                                                <span className="text-[10px] font-bold text-zinc-400">{new Date(item.date).toLocaleDateString("id-ID")}</span>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-2 mt-0.5 text-[10px]">
                                            <span className="font-bold text-zinc-400">{METHOD_LABEL[item.method as PaymentMethod] ?? item.method}</span>
                                            {item.reference && (
                                                <>
                                                    <span className="text-zinc-200 dark:text-zinc-700">&middot;</span>
                                                    <span className="text-zinc-300 dark:text-zinc-600 truncate">Ref: {item.reference}</span>
                                                </>
                                            )}
                                        </div>
                                    </button>
                                )
                            })
                        )
                    ) : (
                        filteredInvoices.length === 0 ? (
                            <div className="flex items-center justify-center py-16 text-zinc-400 text-xs font-bold uppercase tracking-widest">
                                {selectedPayment ? "Tidak ada invoice yang cocok" : "Tidak ada invoice terbuka"}
                            </div>
                        ) : (
                            filteredInvoices.map((invoice) => {
                                const isSelected = selectedInvoiceId === invoice.id
                                return (
                                    <button
                                        key={invoice.id}
                                        type="button"
                                        onClick={() => setSelectedInvoiceId(invoice.id)}
                                        className={`w-full px-4 py-2.5 text-left transition-colors ${isSelected
                                            ? "bg-blue-50 dark:bg-blue-950/30 border-l-4 border-l-blue-500"
                                            : "hover:bg-zinc-50 dark:hover:bg-zinc-800/50 border-l-4 border-l-transparent"
                                            }`}
                                    >
                                        <div className="flex items-center justify-between gap-2">
                                            <div className="flex items-center gap-2 min-w-0">
                                                <span className="font-mono text-sm font-bold text-zinc-900 dark:text-zinc-100">{invoice.number}</span>
                                                <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400 truncate">{invoice.customer?.name ?? "—"}</span>
                                            </div>
                                            <div className="flex items-center gap-2 shrink-0">
                                                <span className={`font-mono font-black text-sm ${invoice.isOverdue ? "text-red-700 dark:text-red-400" : "text-zinc-900 dark:text-zinc-100"}`}>{formatIDR(invoice.balanceDue)}</span>
                                                {invoice.isOverdue && <Badge variant="destructive" className="text-[9px] font-black uppercase px-1.5 py-0 h-4 rounded-none">Overdue</Badge>}
                                            </div>
                                        </div>
                                        <div className="mt-0.5 text-[10px] font-medium text-zinc-400">
                                            Jatuh tempo {new Date(invoice.dueDate).toLocaleDateString("id-ID")}
                                        </div>
                                    </button>
                                )
                            })
                        )
                    )}
                </div>

                {/* Pagination */}
                <div className="px-4 py-1.5 border-t border-zinc-100 dark:border-zinc-800 flex items-center justify-between">
                    <span className="text-[10px] font-bold text-zinc-400">{activePagination.page}/{activePagination.totalPages}</span>
                    <div className="flex items-center gap-1">
                        <button
                            className="h-6 w-6 flex items-center justify-center border border-zinc-200 dark:border-zinc-700 text-zinc-400 hover:text-zinc-600 hover:bg-zinc-50 dark:hover:bg-zinc-800 disabled:opacity-30 transition-colors"
                            disabled={activePagination.page <= 1}
                            onClick={() => pushSearchParams((p) => { p.set(activePageParam, String(Math.max(1, activePagination.page - 1))) })}
                        >
                            <ChevronLeft className="h-3 w-3" />
                        </button>
                        <button
                            className="h-6 w-6 flex items-center justify-center border border-zinc-200 dark:border-zinc-700 text-zinc-400 hover:text-zinc-600 hover:bg-zinc-50 dark:hover:bg-zinc-800 disabled:opacity-30 transition-colors"
                            disabled={activePagination.page >= activePagination.totalPages}
                            onClick={() => pushSearchParams((p) => { p.set(activePageParam, String(Math.min(activePagination.totalPages, activePagination.page + 1))) })}
                        >
                            <ChevronRight className="h-3 w-3" />
                        </button>
                    </div>
                </div>
            </div>

            {/* ═══════════════════════════════════════════ */}
            {/* ALLOCATION BAR — compact inline             */}
            {/* ═══════════════════════════════════════════ */}
            <div className="border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] bg-white dark:bg-zinc-900 overflow-hidden">
                {!selectedPayment && !selectedInvoice ? (
                    /* Empty — subtle hint */
                    <div className="px-4 py-2.5 flex items-center justify-center gap-2 text-zinc-300 dark:text-zinc-600">
                        <ArrowRightLeft className="h-3.5 w-3.5" />
                        <span className="text-[10px] font-bold uppercase tracking-wider">Pilih pembayaran lalu invoice untuk dialokasikan</span>
                    </div>
                ) : selectedPayment && !selectedInvoice ? (
                    /* Payment selected — waiting for invoice */
                    <div className="px-4 py-2.5 flex items-center gap-3">
                        <div className="h-5 w-5 bg-emerald-500 flex items-center justify-center shrink-0">
                            <Check className="h-3 w-3 text-white" />
                        </div>
                        <span className="font-mono text-xs font-bold text-zinc-700 dark:text-zinc-200">{selectedPayment.number}</span>
                        <span className="text-xs text-zinc-500 dark:text-zinc-400 truncate">{selectedPayment.from}</span>
                        <span className="font-mono font-bold text-xs text-emerald-700 dark:text-emerald-400">{formatIDR(selectedPayment.amount)}</span>
                        <span className="ml-auto text-[10px] font-bold text-zinc-400 uppercase tracking-wider">&rarr; Pilih invoice</span>
                    </div>
                ) : selectedPayment && selectedInvoice ? (
                    /* Both selected — show comparison + action */
                    <div className="px-4 py-2.5 space-y-2">
                        {paymentInvoiceMismatch && (
                            <div className="flex items-center gap-2 text-red-600 dark:text-red-400">
                                <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                                <span className="text-[10px] font-bold">Pelanggan pembayaran tidak sama dengan pelanggan invoice</span>
                            </div>
                        )}
                        <div className="flex items-center justify-between gap-3">
                            <div className="flex items-center gap-3 flex-1 min-w-0 overflow-x-auto">
                                {/* Payment */}
                                <div className="flex items-center gap-1.5 shrink-0">
                                    <span className="text-[9px] font-black uppercase tracking-widest text-zinc-400">PAY</span>
                                    <span className="font-mono text-xs font-bold text-zinc-700 dark:text-zinc-200">{selectedPayment.number}</span>
                                    <span className="font-mono font-bold text-xs text-emerald-700 dark:text-emerald-400">{formatIDR(selectedPayment.amount)}</span>
                                </div>
                                <span className="text-zinc-300 dark:text-zinc-600 shrink-0">&rarr;</span>
                                {/* Invoice */}
                                <div className="flex items-center gap-1.5 shrink-0">
                                    <span className="text-[9px] font-black uppercase tracking-widest text-zinc-400">INV</span>
                                    <span className="font-mono text-xs font-bold text-zinc-700 dark:text-zinc-200">{selectedInvoice.number}</span>
                                    <span className={`font-mono font-bold text-xs ${selectedInvoice.isOverdue ? "text-red-700 dark:text-red-400" : "text-zinc-700 dark:text-zinc-200"}`}>{formatIDR(selectedInvoice.balanceDue)}</span>
                                </div>
                                {/* Diff */}
                                <div className="flex items-center gap-1.5 pl-2.5 border-l border-zinc-200 dark:border-zinc-700 shrink-0">
                                    <span className="text-[9px] font-black uppercase tracking-widest text-zinc-400">Selisih</span>
                                    <span className={`font-mono font-bold text-xs ${(selectedPayment.amount - selectedInvoice.balanceDue) >= 0 ? "text-emerald-700 dark:text-emerald-400" : "text-red-700 dark:text-red-400"}`}>
                                        {formatIDR(selectedPayment.amount - selectedInvoice.balanceDue)}
                                    </span>
                                </div>
                            </div>
                            <Button
                                disabled={!canMatch}
                                onClick={() => handleMatch(selectedPayment.id, selectedInvoice.id)}
                                className="bg-black dark:bg-white text-white dark:text-black hover:bg-zinc-800 dark:hover:bg-zinc-200 text-[10px] font-bold uppercase tracking-wider h-8 px-5 rounded-none transition-colors disabled:opacity-30 shrink-0"
                            >
                                {processing ? (
                                    <><Loader2 className="mr-1.5 h-3 w-3 animate-spin" /> Memproses...</>
                                ) : (
                                    <><BadgeCheck className="mr-1.5 h-3 w-3" /> Alokasikan</>
                                )}
                            </Button>
                        </div>
                    </div>
                ) : null}
            </div>

            {/* ═══════════════════════════════════════════ */}
            {/* CREATE PAYMENT DIALOG                       */}
            {/* ═══════════════════════════════════════════ */}
            <NBDialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
                <NBDialogHeader
                    icon={Wallet}
                    title="Catat Penerimaan Baru"
                    subtitle="Catat penerimaan pelanggan — bisa langsung dialokasikan atau disimpan dulu"
                />
                <NBDialogBody>
                    <NBSection icon={CircleDollarSign} title="Data Penerimaan">
                        <NBSelect
                            label="Pelanggan"
                            required
                            value={createForm.customerId}
                            onValueChange={(value) =>
                                setCreateForm((prev) => ({
                                    ...prev,
                                    customerId: value,
                                    invoiceId: ""
                                }))
                            }
                            placeholder="Pilih pelanggan"
                        >
                            {allCustomers.map((customer) => (
                                <SelectItem key={customer.id} value={customer.id}>
                                    {customer.code ? `[${customer.code}] ` : ""}{customer.name}
                                </SelectItem>
                            ))}
                        </NBSelect>
                        <div className="grid grid-cols-3 gap-3">
                            <NBCurrencyInput
                                label="Nominal"
                                required
                                value={createForm.amount}
                                onChange={(value) =>
                                    setCreateForm((prev) => ({ ...prev, amount: value }))
                                }
                            />
                            <NBInput
                                label="Tanggal"
                                type="date"
                                value={createForm.date}
                                onChange={(value) =>
                                    setCreateForm((prev) => ({ ...prev, date: value }))
                                }
                            />
                            <NBSelect
                                label="Metode"
                                value={createForm.method}
                                onValueChange={(value) =>
                                    setCreateForm((prev) => ({ ...prev, method: value as PaymentMethod }))
                                }
                                options={[
                                    { value: "TRANSFER", label: "Transfer Bank" },
                                    { value: "CASH", label: "Tunai" },
                                    { value: "CHECK", label: "Cek" },
                                    { value: "GIRO", label: "Giro" },
                                    { value: "CARD", label: "Kartu" },
                                ]}
                            />
                        </div>
                    </NBSection>

                    <NBSection icon={FileText} title="Hubungkan ke Invoice" optional>
                        <NBSelect
                            label="Invoice Penjualan"
                            value={createForm.invoiceId}
                            onValueChange={(value) => {
                                if (!value) {
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
                            placeholder="Kosongkan untuk simpan tanpa alokasi"
                            emptyLabel="Tanpa alokasi"
                        >
                            {openInvoices
                                .filter((inv) => !createForm.customerId || inv.customer?.id === createForm.customerId)
                                .map((invoice) => (
                                    <SelectItem key={invoice.id} value={invoice.id}>
                                        {invoice.number} {"\u2014"} {invoice.customer?.name ?? "?"} {"\u2014"} Sisa: {formatIDR(invoice.balanceDue)} {invoice.isOverdue ? " OVERDUE" : ""}
                                    </SelectItem>
                                ))}
                        </NBSelect>
                        <div className="grid grid-cols-2 gap-3">
                            <NBInput
                                label="Referensi"
                                value={createForm.reference}
                                onChange={(value) =>
                                    setCreateForm((prev) => ({ ...prev, reference: value }))
                                }
                                placeholder="No. transfer / no. cek"
                            />
                            <NBInput
                                label="Catatan"
                                value={createForm.notes}
                                onChange={(value) =>
                                    setCreateForm((prev) => ({ ...prev, notes: value }))
                                }
                                placeholder="Catatan tambahan"
                            />
                        </div>
                    </NBSection>
                </NBDialogBody>
                <NBDialogFooter
                    onCancel={() => setIsCreateDialogOpen(false)}
                    onSubmit={handleCreatePayment}
                    submitting={submittingPayment}
                    submitLabel="Simpan Penerimaan"
                />
            </NBDialog>
        </div>
    )
}
