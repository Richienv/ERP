"use client"

import { useEffect, useMemo, useState } from "react"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { formatIDR } from "@/lib/utils"
import {
    ArrowRightLeft,
    BadgeCheck,
    CalendarClock,
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
    Wallet
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
import { Textarea } from "@/components/ui/textarea"
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog"
import { ScrollArea } from "@/components/ui/scroll-area"
import { NB } from "@/lib/dialog-styles"
import { matchPaymentToInvoice, recordARPayment } from "@/lib/actions/finance"
import { toast } from "sonner"
import { useQueryClient } from "@tanstack/react-query"
import { queryKeys } from "@/lib/query-keys"

type PaymentMethod = "CASH" | "TRANSFER" | "CHECK" | "CARD"

interface UnallocatedPayment {
    id: string
    number: string
    from: string
    customerId: string | null
    amount: number
    date: Date
    method: string
    reference: string | null
}

interface OpenInvoice {
    id: string
    number: string
    customer: { id: string; name: string } | null
    balanceDue: number
    dueDate: Date
    isOverdue: boolean
}

interface ARPaymentsViewProps {
    unallocated: UnallocatedPayment[]
    openInvoices: OpenInvoice[]
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
}

const METHOD_LABEL: Record<PaymentMethod, string> = {
    CASH: "Tunai",
    TRANSFER: "Transfer",
    CHECK: "Cek",
    CARD: "Kartu"
}

const EMPTY_INVOICE_VALUE = "__NO_INVOICE__"

const todayAsInput = () => new Date().toISOString().slice(0, 10)

export function ARPaymentsView({ unallocated, openInvoices, stats, registryMeta, registryQuery }: ARPaymentsViewProps) {
    const router = useRouter()
    const queryClient = useQueryClient()
    const pathname = usePathname()
    const searchParams = useSearchParams()
    const [processing, setProcessing] = useState<string | null>(null)
    const [selectedPaymentId, setSelectedPaymentId] = useState<string | null>(null)
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

    const pushSearchParams = (mutator: (params: URLSearchParams) => void) => {
        const next = new URLSearchParams(searchParams.toString())
        mutator(next)
        const qs = next.toString()
        router.replace(qs ? `${pathname}?${qs}` : pathname)
    }

    const customerOptions = useMemo(() => {
        const map = new Map<string, string>()
        for (const invoice of openInvoices) {
            if (invoice.customer?.id) {
                map.set(invoice.customer.id, invoice.customer.name)
            }
        }
        for (const payment of unallocated) {
            if (payment.customerId && !map.has(payment.customerId)) {
                map.set(payment.customerId, payment.from)
            }
        }

        return Array.from(map.entries())
            .map(([id, name]) => ({ id, name }))
            .sort((a, b) => a.name.localeCompare(b.name))
    }, [openInvoices, unallocated])

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
                queryClient.invalidateQueries({ queryKey: queryKeys.invoices.all })
                queryClient.invalidateQueries({ queryKey: queryKeys.vendorPayments.all })
                queryClient.invalidateQueries({ queryKey: queryKeys.financeDashboard.all })
                queryClient.invalidateQueries({ queryKey: queryKeys.journal.all })
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
                method: createForm.method,
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
            queryClient.invalidateQueries({ queryKey: queryKeys.invoices.all })
            queryClient.invalidateQueries({ queryKey: queryKeys.vendorPayments.all })
            queryClient.invalidateQueries({ queryKey: queryKeys.financeDashboard.all })
            queryClient.invalidateQueries({ queryKey: queryKeys.journal.all })
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

            {/* ═══════════════════════════════════════════ */}
            {/* COMMAND HEADER                              */}
            {/* ═══════════════════════════════════════════ */}
            <div className="border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] overflow-hidden bg-white dark:bg-zinc-900">
                <div className="px-6 py-4 flex items-center justify-between border-l-[6px] border-l-orange-400">
                    <div className="flex items-center gap-3">
                        <Wallet className="h-5 w-5 text-orange-500" />
                        <div>
                            <h1 className="text-xl font-black uppercase tracking-tight text-zinc-900 dark:text-white">
                                Penerimaan Piutang (AR)
                            </h1>
                            <p className="text-zinc-400 text-xs font-medium mt-0.5">
                                Alokasikan dana masuk ke invoice pelanggan secara otomatis
                            </p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <Button
                            variant="outline"
                            onClick={() => {
                                queryClient.invalidateQueries({ queryKey: queryKeys.invoices.all })
                                queryClient.invalidateQueries({ queryKey: queryKeys.vendorPayments.all })
                                queryClient.invalidateQueries({ queryKey: queryKeys.financeDashboard.all })
                                queryClient.invalidateQueries({ queryKey: queryKeys.journal.all })
                            }}
                            className="border-2 border-zinc-300 font-bold uppercase text-[10px] tracking-wide h-10 px-4"
                        >
                            <RefreshCcw className="mr-1.5 h-3.5 w-3.5" /> Segarkan
                        </Button>
                        <Button
                            onClick={() => setIsCreateDialogOpen(true)}
                            className="bg-orange-500 text-white hover:bg-orange-600 border-2 border-orange-600 font-black uppercase text-[10px] tracking-wide h-10 px-5 shadow-[3px_3px_0px_0px_rgba(0,0,0,0.2)] active:shadow-none active:translate-y-[1px] transition-all"
                        >
                            <Plus className="h-3.5 w-3.5 mr-1.5" /> Catat Penerimaan
                        </Button>
                    </div>
                </div>
            </div>

            {/* ═══════════════════════════════════════════ */}
            {/* KPI PULSE STRIP                            */}
            {/* ═══════════════════════════════════════════ */}
            <div className="bg-white dark:bg-zinc-900 border-2 border-black shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] overflow-hidden">
                <div className="grid grid-cols-2 md:grid-cols-4">
                    {/* Unallocated Funds */}
                    <div className="relative p-4 md:p-5 md:border-r-2 border-b-2 md:border-b-0 border-zinc-100 dark:border-zinc-800">
                        <div className="absolute top-0 left-0 right-0 h-1 bg-emerald-400" />
                        <div className="flex items-center gap-2 mb-2">
                            <Wallet className="h-4 w-4 text-zinc-400" />
                            <span className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Dana Belum Dialokasi</span>
                        </div>
                        <div className="text-2xl md:text-3xl font-black tracking-tighter text-zinc-900 dark:text-white">
                            {stats.unallocatedAmount === 0
                                ? <span className="text-zinc-300 text-lg">Rp 0</span>
                                : formatIDR(stats.unallocatedAmount)}
                        </div>
                        <div className="flex items-center gap-1 mt-1.5">
                            <span className="text-[10px] font-bold text-emerald-600">{stats.unallocatedCount} transaksi</span>
                        </div>
                    </div>

                    {/* Open Invoices */}
                    <div className="relative p-4 md:p-5 md:border-r-2 border-b-2 md:border-b-0 border-zinc-100 dark:border-zinc-800">
                        <div className="absolute top-0 left-0 right-0 h-1 bg-blue-400" />
                        <div className="flex items-center gap-2 mb-2">
                            <FileText className="h-4 w-4 text-zinc-400" />
                            <span className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Invoice Terbuka</span>
                        </div>
                        <div className="text-2xl md:text-3xl font-black tracking-tighter text-zinc-900 dark:text-white">
                            {stats.openInvoicesCount}
                        </div>
                        <div className="flex items-center gap-1 mt-1.5">
                            <span className="text-[10px] font-bold text-blue-600">Belum lunas / parsial</span>
                        </div>
                    </div>

                    {/* Outstanding Amount */}
                    <div className="relative p-4 md:p-5 md:border-r-2 border-b-2 md:border-b-0 border-zinc-100 dark:border-zinc-800">
                        <div className="absolute top-0 left-0 right-0 h-1 bg-amber-400" />
                        <div className="flex items-center gap-2 mb-2">
                            <CircleDollarSign className="h-4 w-4 text-zinc-400" />
                            <span className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Total Piutang</span>
                        </div>
                        <div className="text-2xl md:text-3xl font-black tracking-tighter text-zinc-900 dark:text-white">
                            {stats.outstandingAmount === 0
                                ? <span className="text-zinc-300 text-lg">Rp 0</span>
                                : formatIDR(stats.outstandingAmount)}
                        </div>
                        <div className="flex items-center gap-1 mt-1.5">
                            <span className="text-[10px] font-bold text-amber-600">Saldo belum tertagih</span>
                        </div>
                    </div>

                    {/* Today's Payments */}
                    <div className="relative p-4 md:p-5">
                        <div className="absolute top-0 left-0 right-0 h-1 bg-violet-400" />
                        <div className="flex items-center gap-2 mb-2">
                            <CalendarClock className="h-4 w-4 text-zinc-400" />
                            <span className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Hari Ini</span>
                        </div>
                        <div className="text-2xl md:text-3xl font-black tracking-tighter text-zinc-900 dark:text-white">
                            {stats.todayPayments === 0
                                ? <span className="text-zinc-300 text-lg">Rp 0</span>
                                : formatIDR(stats.todayPayments)}
                        </div>
                        <div className="flex items-center gap-1 mt-1.5">
                            <span className="text-[10px] font-bold text-violet-600">Penerimaan masuk hari ini</span>
                        </div>
                    </div>
                </div>
            </div>

            {/* ═══════════════════════════════════════════ */}
            {/* SEARCH & FILTER BAR                        */}
            {/* ═══════════════════════════════════════════ */}
            <div className="border-2 border-black shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] bg-white dark:bg-zinc-900 overflow-hidden">
                <div className="p-4">
                    <div className="flex flex-col md:flex-row gap-3">
                        <div className="relative flex-1">
                            <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400" />
                            <Input
                                className="border-2 border-black h-10 pl-9 font-medium rounded-none"
                                placeholder="Cari pembayaran (no., pelanggan, metode)..."
                                value={paymentQuery}
                                onChange={(e) => setPaymentQuery(e.target.value)}
                                onKeyDown={(e) => e.key === "Enter" && applyRegistryFilters()}
                            />
                        </div>
                        <div className="relative flex-1">
                            <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400" />
                            <Input
                                className="border-2 border-black h-10 pl-9 font-medium rounded-none"
                                placeholder="Cari invoice (no., pelanggan)..."
                                value={invoiceQuery}
                                onChange={(e) => setInvoiceQuery(e.target.value)}
                                onKeyDown={(e) => e.key === "Enter" && applyRegistryFilters()}
                            />
                        </div>
                        <Button
                            onClick={applyRegistryFilters}
                            className="bg-orange-500 text-white hover:bg-orange-600 border-2 border-orange-600 font-black uppercase text-[10px] tracking-wide h-10 px-4"
                        >
                            Terapkan
                        </Button>
                        <Button
                            variant="outline"
                            onClick={resetRegistryFilters}
                            className="border-2 border-zinc-300 font-bold uppercase text-[10px] tracking-wide h-10 px-4"
                        >
                            Reset
                        </Button>
                    </div>
                </div>
            </div>

            {/* ═══════════════════════════════════════════ */}
            {/* WORKFLOW STEPS INDICATOR                    */}
            {/* ═══════════════════════════════════════════ */}
            <div className="border-2 border-black shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] bg-white dark:bg-zinc-900 overflow-hidden">
                <div className="px-6 py-3 flex items-center gap-0">
                    {/* Step 1 */}
                    <div className="flex items-center gap-2">
                        <div className={`h-8 w-8 flex items-center justify-center border-2 border-black text-xs font-black transition-all ${
                            currentStep >= 1 ? "bg-emerald-500 text-white" : "bg-zinc-100 text-zinc-400"
                        }`}>
                            {currentStep > 1 ? <Check className="h-4 w-4" /> : "1"}
                        </div>
                        <span className={`text-[10px] font-black uppercase tracking-widest ${
                            currentStep >= 1 ? "text-zinc-900 dark:text-white" : "text-zinc-400"
                        }`}>
                            Pilih Pembayaran
                        </span>
                    </div>
                    {/* Connector */}
                    <div className={`flex-1 h-0.5 mx-3 ${currentStep > 1 ? "bg-emerald-500" : "bg-zinc-200"}`} />
                    {/* Step 2 */}
                    <div className="flex items-center gap-2">
                        <div className={`h-8 w-8 flex items-center justify-center border-2 border-black text-xs font-black transition-all ${
                            currentStep >= 2 ? "bg-blue-500 text-white" : "bg-zinc-100 text-zinc-400"
                        }`}>
                            {currentStep > 2 ? <Check className="h-4 w-4" /> : "2"}
                        </div>
                        <span className={`text-[10px] font-black uppercase tracking-widest ${
                            currentStep >= 2 ? "text-zinc-900 dark:text-white" : "text-zinc-400"
                        }`}>
                            Pilih Invoice
                        </span>
                    </div>
                    {/* Connector */}
                    <div className={`flex-1 h-0.5 mx-3 ${currentStep > 2 ? "bg-orange-500" : "bg-zinc-200"}`} />
                    {/* Step 3 */}
                    <div className="flex items-center gap-2">
                        <div className={`h-8 w-8 flex items-center justify-center border-2 border-black text-xs font-black transition-all ${
                            currentStep >= 3 ? "bg-orange-500 text-white" : "bg-zinc-100 text-zinc-400"
                        }`}>
                            3
                        </div>
                        <span className={`text-[10px] font-black uppercase tracking-widest ${
                            currentStep >= 3 ? "text-zinc-900 dark:text-white" : "text-zinc-400"
                        }`}>
                            Konfirmasi
                        </span>
                    </div>
                </div>
            </div>

            {/* ═══════════════════════════════════════════ */}
            {/* MAIN WORKFLOW: TWO PANELS                   */}
            {/* ═══════════════════════════════════════════ */}
            <div className="grid gap-4 xl:grid-cols-2">

                {/* ── LEFT PANEL: Payments ── */}
                <div className="border-2 border-black shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] bg-white dark:bg-zinc-900 overflow-hidden flex flex-col" style={{ minHeight: 420 }}>
                    {/* Panel Header */}
                    <div className="bg-emerald-50 dark:bg-emerald-950/20 px-5 py-2.5 border-b-2 border-black flex items-center gap-2 border-l-[5px] border-l-emerald-400">
                        <Wallet className="h-4 w-4 text-emerald-600" />
                        <h3 className="text-[11px] font-black uppercase tracking-widest text-zinc-700 dark:text-zinc-200">
                            Pembayaran Masuk
                        </h3>
                        <span className="bg-emerald-500 text-white text-[10px] font-black px-2 py-0.5 min-w-[20px] text-center rounded-sm">
                            {registryMeta.payments.total}
                        </span>
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
                                        <div className="flex items-center gap-2 mt-1">
                                            <span className={`text-[10px] font-black uppercase tracking-wide px-2 py-0.5 border rounded-sm ${
                                                item.method === "TRANSFER" ? "bg-blue-50 border-blue-200 text-blue-600" :
                                                item.method === "CASH" ? "bg-emerald-50 border-emerald-200 text-emerald-600" :
                                                item.method === "CHECK" ? "bg-amber-50 border-amber-200 text-amber-600" :
                                                "bg-violet-50 border-violet-200 text-violet-600"
                                            }`}>
                                                {METHOD_LABEL[item.method as PaymentMethod] ?? item.method}
                                            </span>
                                            {item.reference && (
                                                <span className="text-[10px] font-medium text-zinc-400 truncate">Ref: {item.reference}</span>
                                            )}
                                        </div>
                                    </button>
                                )
                            })
                        )}
                    </div>

                    {/* Pagination */}
                    <div className="px-5 py-3 border-t-2 border-black flex items-center justify-between bg-zinc-50 dark:bg-zinc-800/50">
                        <span className="text-[10px] font-black uppercase tracking-widest text-zinc-400">
                            Hal {registryMeta.payments.page}/{registryMeta.payments.totalPages}
                        </span>
                        <div className="flex items-center gap-2">
                            <Button
                                variant="outline"
                                size="icon"
                                className="h-8 w-8 border-2 border-black"
                                disabled={registryMeta.payments.page <= 1}
                                onClick={() =>
                                    pushSearchParams((params) => {
                                        params.set("pay_page", String(Math.max(1, registryMeta.payments.page - 1)))
                                    })
                                }
                            >
                                <ChevronLeft className="h-3.5 w-3.5" />
                            </Button>
                            <Button
                                variant="outline"
                                size="icon"
                                className="h-8 w-8 border-2 border-black"
                                disabled={registryMeta.payments.page >= registryMeta.payments.totalPages}
                                onClick={() =>
                                    pushSearchParams((params) => {
                                        params.set("pay_page", String(Math.min(registryMeta.payments.totalPages, registryMeta.payments.page + 1)))
                                    })
                                }
                            >
                                <ChevronRight className="h-3.5 w-3.5" />
                            </Button>
                        </div>
                    </div>
                </div>

                {/* ── RIGHT PANEL: Invoices ── */}
                <div className="border-2 border-black shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] bg-white dark:bg-zinc-900 overflow-hidden flex flex-col" style={{ minHeight: 420 }}>
                    {/* Panel Header */}
                    <div className="bg-blue-50 dark:bg-blue-950/20 px-5 py-2.5 border-b-2 border-black flex items-center gap-2 border-l-[5px] border-l-blue-400">
                        <FileText className="h-4 w-4 text-blue-600" />
                        <h3 className="text-[11px] font-black uppercase tracking-widest text-zinc-700 dark:text-zinc-200">
                            Invoice Tujuan
                        </h3>
                        {selectedPayment && (
                            <span className="bg-blue-500 text-white text-[10px] font-black px-2 py-0.5 min-w-[20px] text-center rounded-sm">
                                {filteredInvoices.length}
                            </span>
                        )}
                    </div>

                    {/* Filtered-for notice */}
                    {selectedPayment && (
                        <div className="px-5 py-2 border-b border-zinc-100 bg-blue-50/50 dark:bg-blue-950/10">
                            <span className="text-[10px] font-bold text-blue-600">
                                Difilter untuk: {selectedPayment.from}
                            </span>
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
                                            <span className={`font-mono font-black text-sm whitespace-nowrap ${
                                                invoice.isOverdue ? "text-red-700 dark:text-red-400" : "text-zinc-900 dark:text-zinc-100"
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
                    <div className="px-5 py-3 border-t-2 border-black flex items-center justify-between bg-zinc-50 dark:bg-zinc-800/50">
                        <span className="text-[10px] font-black uppercase tracking-widest text-zinc-400">
                            Hal {registryMeta.invoices.page}/{registryMeta.invoices.totalPages}
                        </span>
                        <div className="flex items-center gap-2">
                            <Button
                                variant="outline"
                                size="icon"
                                className="h-8 w-8 border-2 border-black"
                                disabled={registryMeta.invoices.page <= 1}
                                onClick={() =>
                                    pushSearchParams((params) => {
                                        params.set("inv_page", String(Math.max(1, registryMeta.invoices.page - 1)))
                                    })
                                }
                            >
                                <ChevronLeft className="h-3.5 w-3.5" />
                            </Button>
                            <Button
                                variant="outline"
                                size="icon"
                                className="h-8 w-8 border-2 border-black"
                                disabled={registryMeta.invoices.page >= registryMeta.invoices.totalPages}
                                onClick={() =>
                                    pushSearchParams((params) => {
                                        params.set("inv_page", String(Math.min(registryMeta.invoices.totalPages, registryMeta.invoices.page + 1)))
                                    })
                                }
                            >
                                <ChevronRight className="h-3.5 w-3.5" />
                            </Button>
                        </div>
                    </div>
                </div>
            </div>

            {/* ═══════════════════════════════════════════ */}
            {/* CONFIRMATION PANEL                         */}
            {/* ═══════════════════════════════════════════ */}
            <div className="border-2 border-black shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] bg-white dark:bg-zinc-900 overflow-hidden">
                {/* Panel Header */}
                <div className="bg-orange-50 dark:bg-orange-950/20 px-5 py-2.5 border-b-2 border-black flex items-center gap-2 border-l-[5px] border-l-orange-400">
                    <BadgeCheck className="h-4 w-4 text-orange-600" />
                    <h3 className="text-[11px] font-black uppercase tracking-widest text-zinc-700 dark:text-zinc-200">
                        Konfirmasi Alokasi
                    </h3>
                </div>

                <div className="p-5 space-y-4">
                    {/* Summary Cards */}
                    <div className="grid gap-4 md:grid-cols-2">
                        {/* Selected Payment */}
                        <div className={`border-2 p-4 ${selectedPayment ? "border-emerald-300 bg-emerald-50/50 dark:bg-emerald-950/20" : "border-zinc-200 bg-zinc-50 dark:bg-zinc-800"}`}>
                            <div className="flex items-center gap-2 mb-3">
                                <Wallet className={`h-4 w-4 ${selectedPayment ? "text-emerald-600" : "text-zinc-400"}`} />
                                <span className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Pembayaran Terpilih</span>
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
                        <div className={`border-2 p-4 ${selectedInvoice ? "border-blue-300 bg-blue-50/50 dark:bg-blue-950/20" : "border-zinc-200 bg-zinc-50 dark:bg-zinc-800"}`}>
                            <div className="flex items-center gap-2 mb-3">
                                <FileText className={`h-4 w-4 ${selectedInvoice ? "text-blue-600" : "text-zinc-400"}`} />
                                <span className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Invoice Tujuan</span>
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
                        <div className="border-2 border-black bg-zinc-50 dark:bg-zinc-800 p-4">
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
                                    <span className={`font-mono font-black text-lg ${
                                        selectedPayment.amount - selectedInvoice.balanceDue >= 0 ? "text-emerald-700" : "text-red-700"
                                    }`}>
                                        {formatIDR(selectedPayment.amount - selectedInvoice.balanceDue)}
                                    </span>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Mismatch Warning */}
                    {paymentInvoiceMismatch && (
                        <div className="border-2 border-red-400 bg-red-50 dark:bg-red-950/20 p-3 flex items-center gap-3">
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
                            className="bg-orange-500 text-white hover:bg-orange-600 border-2 border-orange-600 font-black uppercase text-[10px] tracking-wide h-10 px-6 shadow-[3px_3px_0px_0px_rgba(0,0,0,0.2)] active:shadow-none active:translate-y-[1px] transition-all disabled:opacity-40 disabled:shadow-none"
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
                <DialogContent className={NB.content}>
                    <DialogHeader className={NB.header}>
                        <DialogTitle className={NB.title}>
                            <Wallet className="h-5 w-5" /> Catat Penerimaan Baru
                        </DialogTitle>
                        <p className={NB.subtitle}>
                            Isi data penerimaan pelanggan. Simpan sebagai dana belum dialokasikan atau langsung kaitkan ke invoice.
                        </p>
                    </DialogHeader>

                    <ScrollArea className={NB.scroll}>
                        <div className="p-6 space-y-5">
                            {/* Customer & Amount Section */}
                            <div className={NB.section}>
                                <div className="bg-orange-50 dark:bg-orange-950/20 px-4 py-2 border-b-2 border-black flex items-center gap-2 border-l-[4px] border-l-orange-400">
                                    <CircleDollarSign className="h-4 w-4 text-orange-600" />
                                    <span className={NB.sectionTitle}>Data Penerimaan</span>
                                </div>
                                <div className={NB.sectionBody}>
                                    <div className="grid gap-4 md:grid-cols-2">
                                        <div>
                                            <label className={NB.label}>Pelanggan <span className="text-red-500">*</span></label>
                                            <Select
                                                value={createForm.customerId || EMPTY_INVOICE_VALUE}
                                                onValueChange={(value) =>
                                                    setCreateForm((prev) => ({
                                                        ...prev,
                                                        customerId: value === EMPTY_INVOICE_VALUE ? "" : value
                                                    }))
                                                }
                                            >
                                                <SelectTrigger className={NB.select}>
                                                    <SelectValue placeholder="Pilih pelanggan" />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value={EMPTY_INVOICE_VALUE}>Pilih pelanggan</SelectItem>
                                                    {customerOptions.map((customer) => (
                                                        <SelectItem key={customer.id} value={customer.id}>
                                                            {customer.name}
                                                        </SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                        </div>

                                        <div>
                                            <label className={NB.label}>Nominal <span className="text-red-500">*</span></label>
                                            <div className="relative">
                                                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-zinc-400">Rp</span>
                                                <Input
                                                    type="number"
                                                    min={0}
                                                    step="0.01"
                                                    value={createForm.amount}
                                                    onChange={(event) =>
                                                        setCreateForm((prev) => ({ ...prev, amount: event.target.value }))
                                                    }
                                                    placeholder="250000"
                                                    className={`${NB.inputMono} pl-9`}
                                                />
                                            </div>
                                        </div>

                                        <div>
                                            <label className={NB.label}>Tanggal Penerimaan</label>
                                            <Input
                                                type="date"
                                                value={createForm.date}
                                                onChange={(event) =>
                                                    setCreateForm((prev) => ({ ...prev, date: event.target.value }))
                                                }
                                                className={NB.input}
                                            />
                                        </div>

                                        <div>
                                            <label className={NB.label}>Metode Pembayaran</label>
                                            <Select
                                                value={createForm.method}
                                                onValueChange={(value) =>
                                                    setCreateForm((prev) => ({ ...prev, method: value as PaymentMethod }))
                                                }
                                            >
                                                <SelectTrigger className={NB.select}>
                                                    <SelectValue />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="TRANSFER">Transfer</SelectItem>
                                                    <SelectItem value="CASH">Tunai</SelectItem>
                                                    <SelectItem value="CHECK">Cek</SelectItem>
                                                    <SelectItem value="CARD">Kartu</SelectItem>
                                                </SelectContent>
                                            </Select>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Invoice Link Section */}
                            <div className={NB.section}>
                                <div className="bg-blue-50 dark:bg-blue-950/20 px-4 py-2 border-b-2 border-black flex items-center gap-2 border-l-[4px] border-l-blue-400">
                                    <FileText className="h-4 w-4 text-blue-600" />
                                    <span className={NB.sectionTitle}>Hubungkan ke Invoice</span>
                                </div>
                                <div className={NB.sectionBody}>
                                    <div>
                                        <label className={NB.label}>Invoice (Opsional)</label>
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
                                            <SelectTrigger className={NB.select}>
                                                <SelectValue placeholder="Tidak langsung dialokasikan" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value={EMPTY_INVOICE_VALUE}>Tidak langsung dialokasikan</SelectItem>
                                                {openInvoices.map((invoice) => (
                                                    <SelectItem key={invoice.id} value={invoice.id}>
                                                        {invoice.number} - {invoice.customer?.name ?? "Tanpa pelanggan"}
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>

                                    <div className="grid gap-4 md:grid-cols-2">
                                        <div>
                                            <label className={NB.label}>Referensi (Opsional)</label>
                                            <Input
                                                value={createForm.reference}
                                                onChange={(event) =>
                                                    setCreateForm((prev) => ({ ...prev, reference: event.target.value }))
                                                }
                                                placeholder="No. transfer / no. cek"
                                                className={NB.input}
                                            />
                                        </div>

                                        <div>
                                            <label className={NB.label}>Catatan (Opsional)</label>
                                            <Textarea
                                                value={createForm.notes}
                                                onChange={(event) =>
                                                    setCreateForm((prev) => ({ ...prev, notes: event.target.value }))
                                                }
                                                placeholder="Catatan tambahan"
                                                className={NB.textarea}
                                            />
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Footer Actions */}
                            <div className="flex items-center justify-end gap-3 pt-2">
                                <Button
                                    variant="outline"
                                    onClick={() => setIsCreateDialogOpen(false)}
                                    className={NB.cancelBtn}
                                >
                                    Batal
                                </Button>
                                <Button
                                    onClick={handleCreatePayment}
                                    disabled={submittingPayment}
                                    className={NB.submitBtn}
                                >
                                    {submittingPayment ? (
                                        <>
                                            <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> Menyimpan...
                                        </>
                                    ) : (
                                        "Simpan Penerimaan"
                                    )}
                                </Button>
                            </div>
                        </div>
                    </ScrollArea>
                </DialogContent>
            </Dialog>
        </div>
    )
}
