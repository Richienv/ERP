"use client"

import { useEffect, useMemo, useState } from "react"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import {
    Plus,
    XCircle,
    Receipt,
    Building2,
    CreditCard,
    Loader2,
    CheckCircle2,
    AlertCircle,
    Search,
    FileText,
    Eye,
    X,
    ChevronLeft,
    ChevronRight,
    Filter,
    RotateCcw,
    Banknote,
    Check,
    Minus,
    GitCompare,
    ShieldCheck,
    ShieldAlert,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import {
    Dialog,
    DialogContent,
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
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { CheckboxFilter } from "@/components/ui/checkbox-filter"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import { disputeBill, recordMultiBillPayment, type VendorBill } from "@/lib/actions/finance"
import { moveInvoiceToSent } from "@/lib/actions/finance-invoices"
import { getThreeWayMatch } from "@/lib/actions/finance-match"
import { useBillMatch } from "@/hooks/use-bill-match"
import { PaymentHistoryTable, type PaymentHistoryRow } from "@/components/finance/payment-history-table"
import { SYS_ACCOUNTS } from "@/lib/gl-accounts"
import { formatIDR } from "@/lib/utils"
import { NB } from "@/lib/dialog-styles"
import { toast } from "sonner"
import { useBills } from "@/hooks/use-bills"
import { useQueryClient } from "@tanstack/react-query"
import { queryKeys } from "@/lib/query-keys"
import { invalidateOpsLoop } from "@/lib/invalidate-ops-loop"
import { TablePageSkeleton } from "@/components/ui/page-skeleton"
import { InlinePendingBar } from "@/components/ui/inline-pending"
import { useChartOfAccounts } from "@/hooks/use-chart-accounts"

export default function APBillsStackPage() {
    const router = useRouter()
    const pathname = usePathname()
    const searchParams = useSearchParams()
    const queryClient = useQueryClient()

    const queryParams = {
        q: searchParams.get("q"),
        status: searchParams.get("status"),
        page: Number(searchParams.get("page") || "1"),
        pageSize: Number(searchParams.get("size") || "20"),
    }

    const { data: billsData, isLoading, isFetching } = useBills(queryParams)

    const bills = billsData?.rows ?? []
    const billMeta = billsData?.meta ?? { page: 1, pageSize: 20, total: 0, totalPages: 1 }

    const [searchText, setSearchText] = useState(searchParams.get("q") || "")
    const [selectedStatuses, setSelectedStatuses] = useState<string[]>(
        searchParams.get("status") ? [searchParams.get("status")!] : []
    )
    const [activeBill, setActiveBill] = useState<VendorBill | null>(null)
    const [stamped, setStamped] = useState(false)
    const [processing, setProcessing] = useState(false)
    const [approvingId, setApprovingId] = useState<string | null>(null)
    const [paymentPendingBillId, setPaymentPendingBillId] = useState<string | null>(null)

    const [isDetailOpen, setIsDetailOpen] = useState(false)
    const [isPayOpen, setIsPayOpen] = useState(false)
    const [isDisputeOpen, setIsDisputeOpen] = useState(false)
    const [disputeReason, setDisputeReason] = useState("")
    const [approveAlasan, setApproveAlasan] = useState("")

    const { data: billMatch, isLoading: matchLoading, isError: matchError } = useBillMatch(
        activeBill?.id,
        isDetailOpen && activeBill?.status === "DRAFT"
    )

    const [manualMethod, setManualMethod] = useState<"TRANSFER" | "CHECK" | "GIRO" | "CASH">("TRANSFER")
    const [manualBankAccount, setManualBankAccount] = useState("")
    const [manualReference, setManualReference] = useState("")
    const [manualNotes, setManualNotes] = useState("")
    const [manualAllocations, setManualAllocations] = useState<Array<{
        billId: string
        billNumber: string
        totalAmount: number
        balanceDue: number
        selected: boolean
        allocatedAmount: number
        dueDate: Date
        isOverdue: boolean
    }>>([])

    const { data: coaTree } = useChartOfAccounts()
    const { bankAccounts, cashAccounts } = useMemo(() => {
        if (!coaTree) return { bankAccounts: [] as { code: string; name: string }[], cashAccounts: [] as { code: string; name: string }[] }
        const flat: any[] = []
        const walk = (nodes: any[]) => {
            for (const n of nodes) {
                if (n.children?.length) {
                    walk(n.children)
                } else {
                    flat.push(n)
                }
            }
        }
        walk(Array.isArray(coaTree) ? coaTree : [])
        const leafs = flat
            .filter((a) => a.type === "ASSET" && (a.subType === "ASSET_CASH" || (a.code >= "1000" && a.code < "1200")))
            .map((a) => ({ code: a.code as string, name: a.name as string }))
            .sort((a, b) => a.code.localeCompare(b.code))

        const bank: { code: string; name: string }[] = []
        const cash: { code: string; name: string }[] = []
        for (const acc of leafs) {
            const lower = acc.name.toLowerCase()
            if (lower.includes("bank")) {
                bank.push(acc)
            } else if (lower.includes("kas") || lower.includes("cash") || lower.includes("petty")) {
                cash.push(acc)
            }
        }
        return { bankAccounts: bank, cashAccounts: cash }
    }, [coaTree])

    // Initialize manual allocations when pay dialog opens
    useEffect(() => {
        if (isPayOpen && activeBill && activeBill.vendor) {
            const vendorId = activeBill.vendor.id
            const vendorBills = bills
                .filter((b) => b.vendor?.id === vendorId && b.balanceDue > 0 && b.status !== "PAID")
                .map((b) => ({
                    billId: b.id,
                    billNumber: b.number,
                    totalAmount: b.amount,
                    balanceDue: b.balanceDue,
                    dueDate: new Date(b.dueDate),
                    isOverdue: b.isOverdue,
                    selected: b.id === activeBill.id,
                    allocatedAmount: b.id === activeBill.id ? b.balanceDue : 0,
                }))
            setManualAllocations(vendorBills)
            setManualMethod("TRANSFER")
            setManualBankAccount(SYS_ACCOUNTS.BANK_BCA)
            setManualReference("")
            setManualNotes("")
        }
    }, [isPayOpen, activeBill, bills])

    const pushSearchParams = (mutator: (params: URLSearchParams) => void) => {
        const next = new URLSearchParams(searchParams.toString())
        mutator(next)
        const qs = next.toString()
        router.replace(qs ? `${pathname}?${qs}` : pathname)
    }

    const applyFilters = () => {
        pushSearchParams((params) => {
            const q = searchText.trim()
            if (q) params.set("q", q)
            else params.delete("q")
            if (selectedStatuses.length === 1) params.set("status", selectedStatuses[0])
            else params.delete("status")
            params.set("page", "1")
        })
    }

    const resetFilters = () => {
        setSearchText("")
        setSelectedStatuses([])
        pushSearchParams((params) => {
            params.delete("q")
            params.delete("status")
            params.set("page", "1")
        })
    }

    const setPage = (page: number) => pushSearchParams((params) => params.set("page", String(Math.max(1, page))))

    const invalidateAfterDispute = () => {
        queryClient.invalidateQueries({ queryKey: queryKeys.bills.all })
        queryClient.invalidateQueries({ queryKey: queryKeys.financeDashboard.all })
        queryClient.invalidateQueries({ queryKey: queryKeys.invoices.all })
    }

    const invalidateAfterPayout = () => {
        queryClient.invalidateQueries({ queryKey: queryKeys.bills.all })
        queryClient.invalidateQueries({ queryKey: queryKeys.invoices.all })
        queryClient.invalidateQueries({ queryKey: queryKeys.financeDashboard.all })
        queryClient.invalidateQueries({ queryKey: queryKeys.vendorPayments.all })
        queryClient.invalidateQueries({ queryKey: queryKeys.financeReports.all })
        queryClient.invalidateQueries({ queryKey: queryKeys.journal.all })
        queryClient.invalidateQueries({ queryKey: queryKeys.accountTransactions.all })
        queryClient.invalidateQueries({ queryKey: queryKeys.chartAccounts.all })
        invalidateOpsLoop(queryClient)
    }

    const invalidateAfterApprove = () => {
        queryClient.invalidateQueries({ queryKey: queryKeys.bills.all })
        invalidateOpsLoop(queryClient)
    }

    const handleApproveBill = async (bill: VendorBill) => {
        if (!bill?.id || approvingId) return
        setApprovingId(bill.id)
        try {
            const match = await queryClient.fetchQuery({
                queryKey: queryKeys.bills.match(bill.id),
                queryFn: () => getThreeWayMatch(bill.id),
            })
            let message: string | undefined
            if (match.status === "OVER_BILLED") {
                const reason = approveAlasan.trim()
                if (reason.length < 10) {
                    setActiveBill(bill)
                    setIsDetailOpen(true)
                    toast.error("Selisih penerimaan. Isi alasan persetujuan (min. 10 karakter).")
                    return
                }
                message = reason
            }
            const result = await moveInvoiceToSent(bill.id, message)
            if (result.success) {
                toast.success(`${bill.number} berhasil disetujui`)
                setIsDetailOpen(false)
                setApproveAlasan("")
                invalidateAfterApprove()
            } else {
                toast.error(("error" in result ? result.error : null) || "Gagal menyetujui tagihan")
            }
        } catch (err: any) {
            toast.error(err?.message || "Gagal menyetujui tagihan")
        } finally {
            setApprovingId(null)
        }
    }

    const handleDisputeSubmit = async () => {
        if (!activeBill || !disputeReason.trim()) { toast.error("Masukkan alasan dispute"); return }
        setProcessing(true)
        try {
            const result = await disputeBill(activeBill.id, disputeReason)
            if (result.success) { toast.success("Bill disputed"); setIsDisputeOpen(false); setDisputeReason(""); invalidateAfterDispute() }
            else toast.error("Gagal dispute bill")
        } catch { toast.error("Terjadi kesalahan") } finally { setProcessing(false) }
    }

    // Manual payment allocation helpers
    const manualTotalAllocated = manualAllocations
        .filter((a) => a.selected)
        .reduce((sum, a) => sum + a.allocatedAmount, 0)

    const manualSelectedCount = manualAllocations.filter((a) => a.selected).length

    const toggleManualBill = (billId: string) => {
        setManualAllocations((prev) =>
            prev.map((a) =>
                a.billId === billId
                    ? { ...a, selected: !a.selected, allocatedAmount: !a.selected ? a.balanceDue : 0 }
                    : a
            )
        )
    }

    const updateManualAllocation = (billId: string, amount: number) => {
        setManualAllocations((prev) =>
            prev.map((a) =>
                a.billId === billId
                    ? { ...a, allocatedAmount: Math.min(Math.max(0, amount), a.balanceDue) }
                    : a
            )
        )
    }

    const selectAllManual = () => {
        setManualAllocations((prev) =>
            prev.map((a) => ({ ...a, selected: true, allocatedAmount: a.balanceDue }))
        )
    }

    const deselectAllManual = () => {
        setManualAllocations((prev) =>
            prev.map((a) => ({ ...a, selected: false, allocatedAmount: 0 }))
        )
    }

    const handleManualPaySubmit = async () => {
        if (!activeBill?.vendor?.id) {
            toast.error("Vendor tidak ditemukan")
            return
        }
        const selected = manualAllocations.filter((a) => a.selected && a.allocatedAmount > 0)
        if (selected.length === 0) {
            toast.error("Pilih minimal satu tagihan untuk dibayar")
            return
        }
        if ((manualMethod === "CHECK" || manualMethod === "GIRO") && !manualReference.trim()) {
            toast.error(manualMethod === "GIRO" ? "Nomor giro wajib diisi" : "Nomor cek wajib diisi")
            return
        }

        setProcessing(true)
        try {
            const result = await recordMultiBillPayment({
                supplierId: activeBill.vendor.id,
                allocations: selected.map((a) => ({
                    billId: a.billId,
                    amount: a.allocatedAmount,
                })),
                method: manualMethod,
                reference: manualReference.trim() || undefined,
                notes: manualNotes.trim() || undefined,
                bankAccountCode: manualBankAccount,
            })

            if (result.success) {
                const payNum = "paymentNumber" in result ? result.paymentNumber : ""
                toast.success(`Pembayaran ${payNum} berhasil — ${selected.length} tagihan, total ${formatIDR(manualTotalAllocated)}`)
                setIsPayOpen(false)
                invalidateAfterPayout()
            } else {
                const errMsg = "error" in result ? result.error : "Gagal mencatat pembayaran"
                toast.error(errMsg || "Gagal mencatat pembayaran")
            }
        } catch {
            toast.error("Terjadi kesalahan saat memproses pembayaran")
        } finally {
            setProcessing(false)
        }
    }

    const openBillDetail = (bill: VendorBill) => {
        setActiveBill(bill)
        setStamped(false)
        setApproveAlasan("")
        setIsDetailOpen(true)
    }

    const overBilledBlocked = billMatch?.status === "OVER_BILLED" && approveAlasan.trim().length < 10
    const approveDisabled = !!approvingId || (activeBill?.status === "DRAFT" && (matchLoading || matchError || overBilledBlocked))

    // Separate active vs completed bills
    const activeBills = bills.filter((b) => b.status !== "PAID")
    const completedBills = bills.filter((b) => b.status === "PAID")
    const completedTotal = completedBills.reduce((sum, b) => sum + b.amount, 0)

    // KPI (only count active bills)
    const totalBills = activeBills.length
    const pendingBills = activeBills.filter((b) => b.status === "ISSUED" || b.status === "DRAFT").length
    const dueTodayBills = activeBills.filter((b) => (b as any).isDueToday).length
    const overdueBills = activeBills.filter((b) => b.isOverdue).length
    const totalAmount = activeBills.reduce((sum, b) => sum + b.balanceDue, 0)
    const hasActiveFilters = searchText || selectedStatuses.length > 0

    const getStatusColor = (status: string, isOverdue: boolean, isDueToday?: boolean) => {
        if (isOverdue) return "bg-red-50 dark:bg-red-950/30 text-red-700 dark:text-red-400 border-red-300 dark:border-red-700"
        if (isDueToday) return "bg-orange-50 dark:bg-orange-950/30 text-orange-700 dark:text-orange-400 border-orange-300 dark:border-orange-700"
        switch (status) {
            case "PAID": return "bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-400 border-emerald-300 dark:border-emerald-700"
            case "DISPUTED": return "bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-400 border-amber-300 dark:border-amber-700"
            case "PARTIAL": return "bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 border-zinc-300 dark:border-zinc-700"
            case "DRAFT": return "bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 border-zinc-300 dark:border-zinc-700"
            default: return "bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 border-zinc-300 dark:border-zinc-700"
        }
    }

    if (isLoading && !billsData) return <TablePageSkeleton accentColor="bg-orange-400" />

    return (
        <div className="mf-page">
            {/* ─── RIWAYAT PEMBAYARAN — above active bills ─── */}
            <PaymentHistoryTable
                title="Riwayat Pembayaran"
                rows={completedBills.map((bill): PaymentHistoryRow => ({
                    id: bill.id,
                    documentNumber: bill.number,
                    counterpartyName: bill.vendor?.name ?? "—",
                    method: bill.payments?.[0]?.method ?? "—",
                    reference: bill.payments?.[0]?.reference ?? null,
                    amount: bill.amount,
                    date: bill.payments?.[0]?.date ?? bill.date,
                    status: "PAID",
                }))}
                documentLabel="No. Bill"
                counterpartyLabel="Vendor"
                onRowClick={(row) => {
                    const match = completedBills.find(b => b.id === row.id)
                    if (match) openBillDetail(match)
                }}
                maxHeight={250}
            />

            {/* ─── Single unified card: KPI + Filter + Table ─── */}
            <div className="relative border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] bg-white dark:bg-zinc-900 overflow-hidden">
                <InlinePendingBar active={!!billsData && isFetching} />
                {/* Row 1: Toolbar — Scan Bill button + count */}
                <div className="px-5 py-2.5 flex items-center justify-between border-b border-zinc-200 dark:border-zinc-800">
                    <div className="flex items-center gap-3">
                        <span className="text-[11px] font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                            Tagihan Vendor
                        </span>
                        <span className="text-xs font-mono font-bold text-zinc-400 bg-zinc-100 dark:bg-zinc-800 px-1.5 py-0.5">
                            {billMeta.total}
                        </span>
                    </div>
                    <Button
                        onClick={() => toast.info("Fitur scan bill belum tersedia")}
                        className={NB.toolbarBtnPrimary}
                    >
                        <Plus className="h-3.5 w-3.5 mr-1.5" /> Scan Bill
                    </Button>
                </div>

                {/* Row 2: KPI Strip — zinc default, orange due-today, red overdue */}
                <div className={`${NB.kpiStrip} border-b border-zinc-200 dark:border-zinc-800`}>
                    <div className={NB.kpiCell}>
                        <div className="flex items-center gap-1.5">
                            <span className="w-2 h-2 bg-zinc-400 rounded-full" />
                            <span className={NB.kpiLabel}>Total Tagihan</span>
                        </div>
                        <div className="text-right">
                            <span className={NB.kpiCount}>{totalBills}</span>
                            <span className={`${NB.kpiAmount} block`}>{formatIDR(totalAmount)}</span>
                        </div>
                    </div>
                    <div className={NB.kpiCell}>
                        <div className="flex items-center gap-1.5">
                            <span className="w-2 h-2 bg-zinc-400 rounded-full" />
                            <span className={NB.kpiLabel}>Pending</span>
                        </div>
                        <span className={NB.kpiCount}>{pendingBills}</span>
                    </div>
                    <div className={NB.kpiCell}>
                        <div className="flex items-center gap-1.5">
                            <span className={`w-2 h-2 rounded-full ${dueTodayBills > 0 ? "bg-orange-500" : "bg-zinc-300"}`} />
                            <span className={NB.kpiLabel}>Hari Ini</span>
                        </div>
                        <span className={`${NB.kpiCount} ${dueTodayBills > 0 ? "text-orange-600 dark:text-orange-400" : ""}`}>{dueTodayBills}</span>
                    </div>
                    <div className={NB.kpiCell}>
                        <div className="flex items-center gap-1.5">
                            <span className={`w-2 h-2 rounded-full ${overdueBills > 0 ? "bg-red-500" : "bg-zinc-300"}`} />
                            <span className={NB.kpiLabel}>Jatuh Tempo</span>
                        </div>
                        <span className={`${NB.kpiCount} ${overdueBills > 0 ? "text-red-600 dark:text-red-400" : ""}`}>{overdueBills}</span>
                    </div>
                </div>

                {/* Row 3: Filter Toolbar */}
                <div className={NB.filterBar}>
                    <div className="flex items-center gap-0">
                        {/* Search */}
                        <div className="relative">
                            <Search className={`pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 z-10 transition-colors ${searchText ? NB.inputIconActive : NB.inputIconEmpty}`} />
                            <input
                                className={`border border-r-0 font-medium h-9 w-[280px] text-xs rounded-none pl-9 pr-8 outline-none placeholder:text-zinc-400 transition-all ${searchText ? NB.inputActive : NB.inputEmpty}`}
                                placeholder="Cari nomor bill, vendor..."
                                value={searchText}
                                onChange={(e) => setSearchText(e.target.value)}
                                onKeyDown={(e) => e.key === "Enter" && applyFilters()}
                            />
                            {searchText && (
                                <button onClick={() => setSearchText("")} className="absolute right-2 top-1/2 -translate-y-1/2 h-4 w-4 flex items-center justify-center text-zinc-400 hover:text-zinc-600 transition-colors z-10">
                                    <X className="h-3 w-3" />
                                </button>
                            )}
                        </div>
                        {/* Status filter */}
                        <CheckboxFilter
                            label="Status"
                            hideLabel
                            triggerClassName={NB.filterDropdown}
                            triggerActiveClassName="flex items-center gap-2 border border-orange-400 dark:border-orange-500 border-r-0 h-9 px-3 bg-orange-50/50 dark:bg-orange-950/20 text-xs font-medium min-w-[120px] justify-between transition-all rounded-none"
                            options={[
                                { value: "DRAFT", label: "Draft" },
                                { value: "ISSUED", label: "Issued" },
                                { value: "PARTIAL", label: "Partial" },
                                { value: "OVERDUE", label: "Overdue" },
                                { value: "DISPUTED", label: "Disputed" },
                                { value: "PAID", label: "Paid" },
                            ]}
                            selected={selectedStatuses}
                            onChange={setSelectedStatuses}
                        />
                        <Button onClick={applyFilters} variant="outline" className={NB.toolbarBtn}>
                            <Filter className="h-3.5 w-3.5 mr-1.5" /> Terapkan
                        </Button>
                        {hasActiveFilters && (
                            <Button variant="ghost" onClick={resetFilters} className="text-zinc-400 text-xs font-bold uppercase h-9 px-3 rounded-none hover:text-zinc-700 dark:hover:text-zinc-200 ml-1.5">
                                <RotateCcw className="h-3 w-3 mr-1" /> Reset
                            </Button>
                        )}
                    </div>
                    <span className="hidden md:inline text-[11px] font-medium text-zinc-400">
                        <span className="font-mono font-bold text-zinc-600 dark:text-zinc-300">{billMeta.total}</span> tagihan
                    </span>
                </div>

                {/* ─── Table Header — black bar ─── */}
                <div className="hidden md:grid grid-cols-[1fr_1.5fr_110px_100px_140px_110px] gap-2 px-5 py-2.5 bg-black dark:bg-zinc-950 border-b-2 border-black">
                    {["No. Bill", "Vendor", "Jatuh Tempo", "Status", "Jumlah", "Aksi"].map((h) => (
                        <span key={h} className="text-xs font-black uppercase tracking-widest text-zinc-400">{h}</span>
                    ))}
                </div>

                {/* ─── Table Body (active bills only) ─── */}
                <div className="min-h-[200px]">
                    {activeBills.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-16 text-zinc-400">
                            <div className="w-14 h-14 border-2 border-zinc-200 dark:border-zinc-700 flex items-center justify-center mb-3">
                                <CheckCircle2 className="h-6 w-6 text-zinc-200 dark:text-zinc-700" />
                            </div>
                            <span className="text-sm font-bold text-zinc-500 dark:text-zinc-400">Semua tagihan sudah terbayar</span>
                            <span className="text-xs text-zinc-400 mt-1">Tidak ada tagihan yang perlu diproses</span>
                        </div>
                    ) : (
                        <div className="divide-y divide-zinc-100 dark:divide-zinc-800">
                            {activeBills.map((bill, idx) => {
                                const isOverdue = bill.isOverdue
                                const billDueToday = (bill as any).isDueToday
                                return (
                                    <div
                                        key={bill.id}
                                        className={`grid grid-cols-1 md:grid-cols-[1fr_1.5fr_110px_100px_140px_110px] gap-2 px-5 py-3 items-center hover:bg-orange-50/50 dark:hover:bg-orange-950/10 ${
                                            idx % 2 === 0 ? "bg-white dark:bg-zinc-900" : "bg-zinc-50/60 dark:bg-zinc-800/20"
                                        } ${isOverdue ? "border-l-4 border-l-red-500" : billDueToday ? "border-l-4 border-l-orange-400" : ""}`}
                                    >
                                        {/* Bill number */}
                                        <div>
                                            <span className="font-mono text-sm font-black text-zinc-900 dark:text-zinc-100">{bill.number}</span>
                                        </div>
                                        {/* Vendor */}
                                        <div className="truncate">
                                            <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">{bill.vendor?.name || "Unknown Vendor"}</span>
                                        </div>
                                        {/* Due date */}
                                        <div>
                                            <span className={`text-xs font-medium ${isOverdue ? "text-red-600 dark:text-red-400 font-bold" : billDueToday ? "text-orange-600 dark:text-orange-400 font-bold" : "text-zinc-500"}`}>
                                                {new Date(bill.dueDate).toLocaleDateString("id-ID")}
                                            </span>
                                        </div>
                                        {/* Status */}
                                        <div>
                                            <span className={`inline-flex items-center gap-1.5 text-xs font-black uppercase tracking-wide px-2 py-1 border rounded-none ${getStatusColor(bill.status, isOverdue, billDueToday)}`}>
                                                <span className={`w-1.5 h-1.5 ${
                                                    isOverdue ? "bg-red-500" :
                                                    billDueToday ? "bg-orange-500" :
                                                    bill.status === "PAID" ? "bg-emerald-500" :
                                                    bill.status === "DISPUTED" ? "bg-amber-500" :
                                                    "bg-zinc-400"
                                                }`} />
                                                {isOverdue ? "Overdue" : billDueToday ? "Hari Ini" : bill.status}
                                            </span>
                                        </div>
                                        {/* Amount */}
                                        <div>
                                            <span className={`font-mono font-black text-sm ${
                                                isOverdue ? "text-red-600 dark:text-red-400" :
                                                bill.status === "PAID" ? "text-emerald-600 dark:text-emerald-400" :
                                                "text-zinc-900 dark:text-zinc-100"
                                            }`}>
                                                {formatIDR(bill.amount)}
                                            </span>
                                            {bill.balanceDue !== bill.amount && bill.balanceDue > 0 && (
                                                <span className="text-xs text-zinc-400 block font-mono">Sisa {formatIDR(bill.balanceDue)}</span>
                                            )}
                                        </div>
                                        {/* Actions */}
                                        <div className="flex gap-1 justify-end">
                                            <button
                                                type="button"
                                                onClick={() => openBillDetail(bill)}
                                                title="Detail"
                                                className="h-7 w-7 flex items-center justify-center border border-zinc-200 dark:border-zinc-600 text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-800 hover:border-zinc-400 hover:text-zinc-600 transition-colors rounded-none"
                                            >
                                                <Eye className="h-3 w-3" />
                                            </button>
                                            {["ISSUED", "PARTIAL", "OVERDUE"].includes(bill.status) && bill.balanceDue > 0 && (
                                                <button
                                                    type="button"
                                                    onClick={() => { setActiveBill(bill); setStamped(false); setIsPayOpen(true) }}
                                                    disabled={!!paymentPendingBillId}
                                                    title="Bayar"
                                                    className="h-7 px-2 flex items-center gap-1 border border-emerald-300 dark:border-emerald-600 text-emerald-500 hover:bg-emerald-50 dark:hover:bg-emerald-950/30 hover:border-emerald-500 transition-colors rounded-none text-xs font-bold uppercase"
                                                >
                                                    <CreditCard className="h-3 w-3" /> Bayar
                                                </button>
                                            )}
                                            {bill.status === "DRAFT" && (
                                                <button
                                                    type="button"
                                                    onClick={() => handleApproveBill(bill)}
                                                    disabled={!!approvingId}
                                                    title="Setujui"
                                                    className={`${NB.toolbarBtnPrimary} ml-0 h-7 px-2 inline-flex items-center`}
                                                >
                                                    {approvingId === bill.id ? (
                                                        <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                                                    ) : (
                                                        <Check className="h-3 w-3 mr-1" />
                                                    )}
                                                    Setujui
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                )
                            })}
                        </div>
                    )}
                </div>

                {/* Pagination footer */}
                {billMeta.totalPages > 1 && (
                    <div className="px-5 py-3 border-t border-zinc-200 dark:border-zinc-700 flex items-center justify-between bg-zinc-50 dark:bg-zinc-800/50">
                        <span className="text-xs font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                            {billMeta.total} tagihan
                        </span>
                        <div className="flex items-center gap-2">
                            <Button variant="outline" size="icon" className="h-7 w-7 border border-zinc-300 dark:border-zinc-600 rounded-none" disabled={billMeta.page <= 1} onClick={() => setPage(billMeta.page - 1)}>
                                <ChevronLeft className="h-3.5 w-3.5" />
                            </Button>
                            <span className="text-xs font-black min-w-[50px] text-center">{billMeta.page}/{billMeta.totalPages}</span>
                            <Button variant="outline" size="icon" className="h-7 w-7 border border-zinc-300 dark:border-zinc-600 rounded-none" disabled={billMeta.page >= billMeta.totalPages} onClick={() => setPage(billMeta.page + 1)}>
                                <ChevronRight className="h-3.5 w-3.5" />
                            </Button>
                        </div>
                    </div>
                )}
            </div>

            {/* ═══ BILL DETAIL DIALOG ═══ */}
            <Dialog open={isDetailOpen} onOpenChange={(open) => {
                setIsDetailOpen(open)
                if (!open) setApproveAlasan("")
            }}>
                <DialogContent className={NB.content}>
                    {activeBill && (<>
                        <DialogHeader className={NB.header}>
                            <div className="flex items-center justify-between">
                                <div>
                                    <DialogTitle className={NB.title}><FileText className="h-5 w-5" /> Detail Tagihan</DialogTitle>
                                    <p className={NB.subtitle}>{activeBill.vendor?.name || "Unknown Vendor"}</p>
                                </div>
                                <span className={`px-3 py-1 text-[10px] font-black uppercase tracking-widest border ${getStatusColor(activeBill.status, activeBill.isOverdue)}`}>
                                    {activeBill.isOverdue ? "Overdue" : activeBill.status}
                                </span>
                            </div>
                        </DialogHeader>
                        {stamped && (
                            <div className="absolute inset-0 flex items-center justify-center z-50 pointer-events-none">
                                <div className="border-8 border-emerald-600 text-emerald-600 font-black text-5xl uppercase px-6 py-3 -rotate-12 opacity-70 tracking-widest">PAID</div>
                            </div>
                        )}
                        <div className={`px-6 py-5 space-y-4 overflow-y-auto ${NB.scroll}`}>
                            <div className="grid grid-cols-2 gap-4">
                                <div><label className={NB.label}>No. Invoice</label><p className="font-mono font-bold text-sm">{activeBill.number}</p></div>
                                <div><label className={NB.label}>Jatuh Tempo</label><p className="font-bold text-sm">{new Date(activeBill.dueDate).toLocaleDateString("id-ID")}</p></div>
                                <div><label className={NB.label}>Total Tagihan</label><p className="text-2xl font-black">{formatIDR(activeBill.amount)}</p></div>
                                <div><label className={NB.label}>Sisa Bayar</label><p className="text-2xl font-black text-red-600">{formatIDR(activeBill.balanceDue)}</p></div>
                            </div>
                            {activeBill.status === "DRAFT" && (
                                <div className={NB.section}>
                                    <div className={NB.sectionHead}>
                                        <GitCompare className="h-3.5 w-3.5" />
                                        <span className={NB.sectionTitle}>Verifikasi 3 Arah</span>
                                        {billMatch?.poNumber && (
                                            <span className={NB.sectionHint}>{billMatch.poNumber}</span>
                                        )}
                                    </div>
                                    {matchLoading ? (
                                        <div className="px-4 py-6 text-center text-[11px] font-bold uppercase tracking-wider text-zinc-400">
                                            Memuat verifikasi PO ↔ GRN ↔ Bill…
                                        </div>
                                    ) : matchError ? (
                                        <div className="px-4 py-4 text-[11px] font-bold text-red-600">
                                            Gagal memuat verifikasi 3 arah. Tutup dan buka ulang detail.
                                        </div>
                                    ) : billMatch?.status === "NO_PO" ? (
                                        <div className="px-4 py-3 text-[11px] font-bold text-zinc-500">
                                            Tagihan manual — tidak terhubung ke PO
                                        </div>
                                    ) : billMatch ? (
                                        <>
                                            <div className={`px-4 py-2.5 flex items-center gap-2 text-[11px] font-black uppercase tracking-wider ${
                                                billMatch.status === "MATCHED"
                                                    ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-400"
                                                    : billMatch.status === "OVER_BILLED"
                                                        ? "bg-red-50 text-red-700 dark:bg-red-950/30 dark:text-red-400"
                                                        : "bg-amber-50 text-amber-800 dark:bg-amber-950/30 dark:text-amber-400"
                                            }`}>
                                                {billMatch.status === "MATCHED" ? (
                                                    <ShieldCheck className="h-3.5 w-3.5 shrink-0" />
                                                ) : (
                                                    <ShieldAlert className="h-3.5 w-3.5 shrink-0" />
                                                )}
                                                {billMatch.status === "MATCHED"
                                                    ? "Cocok — aman disetujui"
                                                    : billMatch.status === "OVER_BILLED"
                                                        ? `Selisih ${billMatch.totalVarianceQty} unit — ${formatIDR(billMatch.totalVarianceAmount)} ditagih tanpa barang`
                                                        : "Penerimaan belum lengkap — tagihan sesuai barang diterima"}
                                            </div>
                                            <div className="overflow-x-auto">
                                                <table className="w-full">
                                                    <thead>
                                                        <tr className="bg-zinc-100 dark:bg-zinc-800 border-b border-zinc-200 dark:border-zinc-700">
                                                            <th className={`${NB.tableHeadCell} text-left`}>Barang</th>
                                                            <th className={`${NB.tableHeadCell} text-right`}>Dipesan</th>
                                                            <th className={`${NB.tableHeadCell} text-right`}>Diterima</th>
                                                            <th className={`${NB.tableHeadCell} text-right`}>Ditagih</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody>
                                                        {billMatch.lines.map((line, idx) => {
                                                            const hasVariance = line.varianceQty !== 0
                                                            return (
                                                                <tr
                                                                    key={`${line.productId ?? line.productName}-${idx}`}
                                                                    className={`${NB.tableRow} ${hasVariance ? "bg-red-50 text-red-700 dark:bg-red-950/20 dark:text-red-400" : ""}`}
                                                                >
                                                                    <td className={NB.tableCell}>
                                                                        <span className="font-bold">{line.productName}</span>
                                                                        {line.productCode && (
                                                                            <span className="block font-mono text-[10px] text-zinc-400">{line.productCode}</span>
                                                                        )}
                                                                    </td>
                                                                    <td className={`${NB.tableCell} text-right font-mono`}>{line.ordered}</td>
                                                                    <td className={`${NB.tableCell} text-right font-mono`}>{line.received}</td>
                                                                    <td className={`${NB.tableCell} text-right font-mono font-black`}>{line.billed}</td>
                                                                </tr>
                                                            )
                                                        })}
                                                    </tbody>
                                                </table>
                                            </div>
                                            {billMatch.status === "OVER_BILLED" && (
                                                <div className="p-4 border-t border-zinc-200 dark:border-zinc-700 space-y-1.5">
                                                    <label className={NB.label}>
                                                        Alasan menyetujui selisih <span className={NB.labelRequired}>*</span>
                                                    </label>
                                                    <Textarea
                                                        placeholder="Contoh: sisa barang masih di jalan, tagihan sesuai kontrak..."
                                                        value={approveAlasan}
                                                        onChange={(e) => setApproveAlasan(e.target.value)}
                                                        rows={3}
                                                        className={`${NB.textarea} ${approveAlasan.trim() ? NB.inputActive : NB.inputEmpty}`}
                                                    />
                                                    <p className={NB.labelHint}>
                                                        Wajib diisi (min. 10 karakter) sebelum Setujui — {approveAlasan.trim().length}/10
                                                    </p>
                                                </div>
                                            )}
                                        </>
                                    ) : null}
                                </div>
                            )}
                            {activeBill.vendor?.bankAccountNumber && (
                                <div className={NB.section}>
                                    <div className={NB.sectionHead}><Building2 className="h-3.5 w-3.5" /><span className={NB.sectionTitle}>Info Bank Vendor</span></div>
                                    <div className="p-4">
                                        <div className="grid grid-cols-3 gap-3 text-xs">
                                            <div><label className={NB.label}>Bank</label><p className="font-bold">{activeBill.vendor.bankName || "-"}</p></div>
                                            <div><label className={NB.label}>No. Rekening</label><p className="font-bold font-mono">{activeBill.vendor.bankAccountNumber}</p></div>
                                            <div><label className={NB.label}>Nama Rekening</label><p className="font-bold">{activeBill.vendor.bankAccountName || "-"}</p></div>
                                        </div>
                                    </div>
                                </div>
                            )}
                            {activeBill.payments && activeBill.payments.length > 0 && (
                                <div className={NB.section}>
                                    <div className={NB.sectionHead}><CreditCard className="h-3.5 w-3.5" /><span className={NB.sectionTitle}>Riwayat Pembayaran</span></div>
                                    <div className="divide-y divide-zinc-100 dark:divide-zinc-800">
                                        {activeBill.payments.map((p) => (
                                            <div key={p.id} className="px-4 py-2.5 flex items-center justify-between text-xs">
                                                <div className="flex items-center gap-3">
                                                    <span className={`text-xs font-bold uppercase px-2 py-0.5 border ${
                                                        p.method === "TRANSFER" ? "border-zinc-300 text-zinc-600 bg-zinc-50" :
                                                        p.method === "CASH" ? "border-emerald-300 text-emerald-600 bg-emerald-50/50" :
                                                        "border-amber-300 text-amber-600 bg-amber-50/50"
                                                    }`}>{p.method}</span>
                                                    <span className="font-mono text-zinc-400 text-[10px]">{p.reference || "—"}</span>
                                                </div>
                                                <div className="flex items-center gap-3">
                                                    <span className="font-mono font-bold text-emerald-700 dark:text-emerald-400">{formatIDR(p.amount)}</span>
                                                    <span className="text-zinc-400">{new Date(p.date).toLocaleDateString("id-ID")}</span>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                        <div className="px-6 py-4 border-t-2 border-black bg-zinc-50 dark:bg-zinc-800 flex items-center justify-between gap-3">
                            {activeBill.status === "PAID" ? (
                                <>
                                    <div className="flex items-center gap-2">
                                        <span className="text-[8px] font-black uppercase px-2 py-1 bg-emerald-100 text-emerald-700 border border-emerald-300">Lunas</span>
                                        {activeBill.payments?.[0] && (
                                            <span className="text-[10px] text-zinc-400">
                                                {new Date(activeBill.payments[0].date).toLocaleDateString("id-ID")}
                                            </span>
                                        )}
                                    </div>
                                    <Button variant="outline" onClick={() => setIsDetailOpen(false)} className={NB.cancelBtn}>
                                        Tutup
                                    </Button>
                                </>
                            ) : activeBill.status === "DRAFT" ? (
                                <>
                                    <Button variant="outline" onClick={() => setIsDetailOpen(false)} className={NB.cancelBtn}>
                                        Tutup
                                    </Button>
                                    <Button
                                        onClick={() => handleApproveBill(activeBill)}
                                        disabled={approveDisabled}
                                        className={NB.submitBtnOrange}
                                    >
                                        {approvingId === activeBill.id && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                        <Check className="mr-2 h-3.5 w-3.5" />
                                        Setujui
                                    </Button>
                                </>
                            ) : (
                                <>
                                    <Button variant="outline" onClick={() => { setIsDetailOpen(false); setIsDisputeOpen(true) }} className={NB.cancelBtn}>
                                        <XCircle className="mr-2 h-3.5 w-3.5" /> Dispute
                                    </Button>
                                    <Button onClick={() => { setIsDetailOpen(false); setIsPayOpen(true) }} disabled={activeBill.balanceDue <= 0} className={NB.submitBtnGreen}>
                                        <CreditCard className="mr-2 h-3.5 w-3.5" /> Bayar Sekarang
                                    </Button>
                                </>
                            )}
                        </div>
                    </>)}
                </DialogContent>
            </Dialog>

            {/* ═══ DISPUTE DIALOG ═══ */}
            <Dialog open={isDisputeOpen} onOpenChange={setIsDisputeOpen}>
                <DialogContent className={NB.contentNarrow}>
                    <DialogHeader className={NB.header}>
                        <DialogTitle className={NB.title}><AlertCircle className="h-5 w-5" /> Dispute Tagihan</DialogTitle>
                        <p className="text-red-400 text-[11px] font-bold mt-0.5">Masukkan alasan dispute. Vendor akan mendapat notifikasi.</p>
                    </DialogHeader>
                    <div className="px-6 py-5 space-y-4">
                        <div className="space-y-1">
                            <label className={NB.label}>Alasan <span className={NB.labelRequired}>*</span></label>
                            <Textarea placeholder="Jumlah salah, barang rusak..." value={disputeReason} onChange={(e) => setDisputeReason(e.target.value)} rows={4} className={NB.textarea} />
                        </div>
                    </div>
                    <div className="px-6 py-4 border-t-2 border-black">
                        <div className={NB.footer}>
                            <Button variant="outline" onClick={() => setIsDisputeOpen(false)} disabled={processing} className={NB.cancelBtn}>Batal</Button>
                            <Button onClick={handleDisputeSubmit} disabled={processing} className="bg-red-600 text-white border-2 border-red-700 shadow-[4px_4px_0px_0px_rgba(0,0,0,0.2)] hover:bg-red-700 hover:translate-y-[2px] hover:shadow-[2px_2px_0px_0px_rgba(0,0,0,0.2)] active:translate-y-[4px] active:shadow-none transition-all font-black uppercase text-xs tracking-wider px-8 h-11 rounded-none">
                                {processing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Submit Dispute
                            </Button>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>

            {/* ═══ PAY DIALOG ═══ */}
            <Dialog open={isPayOpen} onOpenChange={setIsPayOpen}>
                <DialogContent className={NB.contentWide}>
                    <DialogHeader className={NB.header}>
                        <DialogTitle className={NB.title}><CreditCard className="h-5 w-5" /> Pembayaran Tagihan</DialogTitle>
                        <p className={NB.subtitle}>Pilih metode dan konfirmasi pembayaran vendor.</p>
                    </DialogHeader>
                    <div className={`overflow-y-auto ${NB.scroll}`}>
                        {/* Amount display */}
                        <div className={NB.section}>
                            <div className={NB.sectionHead}><Receipt className="h-3.5 w-3.5" /><span className={NB.sectionTitle}>Jumlah Bayar</span></div>
                            <div className="p-4 bg-emerald-50 dark:bg-emerald-950/20 text-center">
                                <p className="text-3xl font-black text-emerald-700 dark:text-emerald-400">{activeBill ? formatIDR(activeBill.balanceDue) : "-"}</p>
                                <p className="text-[10px] font-bold text-emerald-600/70 mt-1">{activeBill?.number} — {activeBill?.vendor?.name || "Unknown"}</p>
                            </div>
                        </div>

                        <div className="px-6 pt-4 space-y-4">
                                    {!activeBill?.vendor?.id ? (
                                        <div className="p-8 text-center border-2 border-dashed border-zinc-300">
                                            <AlertCircle className="h-8 w-8 mx-auto text-zinc-300 mb-2" />
                                            <p className="text-[10px] font-black uppercase tracking-widest text-zinc-400">
                                                Vendor tidak ditemukan untuk tagihan ini
                                            </p>
                                        </div>
                                    ) : (
                                        <>
                                            {/* Method & Account */}
                                            <div className={NB.section}>
                                                <div className={NB.sectionHead}>
                                                    <Banknote className="h-3.5 w-3.5" />
                                                    <span className={NB.sectionTitle}>Metode & Akun</span>
                                                </div>
                                                <div className="p-4 space-y-3">
                                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                                        <div className="space-y-1.5">
                                                            <Label className={NB.label}>Metode Pembayaran <span className={NB.labelRequired}>*</span></Label>
                                                            <Select value={manualMethod} onValueChange={(v) => {
                                                                const m = v as "TRANSFER" | "CHECK" | "GIRO" | "CASH"
                                                                setManualMethod(m)
                                                                setManualBankAccount("")
                                                            }}>
                                                                <SelectTrigger className={NB.select}><SelectValue /></SelectTrigger>
                                                                <SelectContent>
                                                                    <SelectItem value="TRANSFER">Transfer Manual</SelectItem>
                                                                    <SelectItem value="CASH">Tunai</SelectItem>
                                                                    <SelectItem value="CHECK">Cek</SelectItem>
                                                                    <SelectItem value="GIRO">Giro</SelectItem>
                                                                </SelectContent>
                                                            </Select>
                                                        </div>
                                                        <div className="space-y-1.5">
                                                            <Label className={NB.label}>{manualMethod === "CASH" ? "Akun Kas" : "Akun Bank"} <span className={NB.labelRequired}>*</span></Label>
                                                            <Select value={manualBankAccount} onValueChange={setManualBankAccount}>
                                                                <SelectTrigger className={NB.select}><SelectValue placeholder={manualMethod === "CASH" ? "Pilih akun kas..." : "Pilih akun bank..."} /></SelectTrigger>
                                                                <SelectContent>
                                                                    {(manualMethod === "CASH" ? cashAccounts : bankAccounts).map((a) => (
                                                                        <SelectItem key={a.code} value={a.code}>
                                                                            {a.code} — {a.name}
                                                                        </SelectItem>
                                                                    ))}
                                                                </SelectContent>
                                                            </Select>
                                                        </div>
                                                    </div>
                                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                                        <div className="space-y-1.5">
                                                            <Label className={NB.label}>
                                                                Referensi{(manualMethod === "CHECK" || manualMethod === "GIRO") && <span className={NB.labelRequired}> *</span>}
                                                            </Label>
                                                            <Input
                                                                value={manualReference}
                                                                onChange={(e) => setManualReference(e.target.value)}
                                                                placeholder={manualMethod === "CHECK" ? "No. Cek" : manualMethod === "GIRO" ? "No. Giro" : "Ref transfer..."}
                                                                className={NB.input}
                                                            />
                                                        </div>
                                                        <div className="space-y-1.5">
                                                            <Label className={NB.label}>Catatan</Label>
                                                            <Input
                                                                value={manualNotes}
                                                                onChange={(e) => setManualNotes(e.target.value)}
                                                                placeholder="Opsional..."
                                                                className={NB.input}
                                                            />
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Bill allocation table */}
                                            <div className={NB.section}>
                                                <div className={NB.sectionHead + " justify-between"}>
                                                    <div className="flex items-center gap-2">
                                                        <FileText className="h-3.5 w-3.5" />
                                                        <span className={NB.sectionTitle}>Tagihan Vendor ({manualAllocations.length})</span>
                                                    </div>
                                                    <div className="flex items-center gap-2">
                                                        <Button type="button" variant="ghost" onClick={selectAllManual} className="text-[9px] font-black uppercase tracking-widest h-7 px-2">
                                                            <Check className="h-3 w-3 mr-1" /> Semua
                                                        </Button>
                                                        <Button type="button" variant="ghost" onClick={deselectAllManual} className="text-[9px] font-black uppercase tracking-widest h-7 px-2">
                                                            <Minus className="h-3 w-3 mr-1" /> Batal
                                                        </Button>
                                                    </div>
                                                </div>

                                                {manualAllocations.length === 0 ? (
                                                    <div className="p-8 text-center">
                                                        <FileText className="h-8 w-8 mx-auto text-zinc-300 mb-2" />
                                                        <p className="text-[10px] font-black uppercase tracking-widest text-zinc-400">
                                                            Tidak ada tagihan terbuka untuk vendor ini
                                                        </p>
                                                    </div>
                                                ) : (
                                                    <>
                                                        {/* Table header */}
                                                        <div className="grid grid-cols-12 gap-2 px-3 py-2 bg-black text-zinc-400">
                                                            <div className="col-span-1 text-[9px] font-black uppercase tracking-widest"></div>
                                                            <div className="col-span-3 text-[9px] font-black uppercase tracking-widest">No. Tagihan</div>
                                                            <div className="col-span-2 text-[9px] font-black uppercase tracking-widest">Jatuh Tempo</div>
                                                            <div className="col-span-2 text-[9px] font-black uppercase tracking-widest text-right">Total</div>
                                                            <div className="col-span-2 text-[9px] font-black uppercase tracking-widest text-right">Sisa</div>
                                                            <div className="col-span-2 text-[9px] font-black uppercase tracking-widest text-right">Bayar</div>
                                                        </div>

                                                        {/* Rows */}
                                                        {manualAllocations.map((row) => (
                                                            <div
                                                                key={row.billId}
                                                                className={`grid grid-cols-12 gap-2 items-center px-3 py-2 border-b border-zinc-100 dark:border-zinc-800 ${
                                                                    row.selected ? "bg-emerald-50 dark:bg-emerald-950/30" : ""
                                                                } ${row.isOverdue ? "border-l-4 border-l-red-400" : ""}`}
                                                            >
                                                                <div className="col-span-1 flex items-center justify-center">
                                                                    <Checkbox checked={row.selected} onCheckedChange={() => toggleManualBill(row.billId)} />
                                                                </div>
                                                                <div className="col-span-3">
                                                                    <span className="font-mono text-xs font-bold">{row.billNumber}</span>
                                                                    {row.isOverdue && (
                                                                        <span className="ml-2 text-[9px] font-black uppercase text-red-600 bg-red-100 px-1.5 py-0.5">Overdue</span>
                                                                    )}
                                                                    {!row.isOverdue && (row as any).isDueToday && (
                                                                        <span className="ml-2 text-[9px] font-black uppercase text-orange-600 bg-orange-100 px-1.5 py-0.5">Hari Ini</span>
                                                                    )}
                                                                </div>
                                                                <div className="col-span-2 text-xs text-zinc-500">
                                                                    {row.dueDate.toLocaleDateString("id-ID")}
                                                                </div>
                                                                <div className="col-span-2 text-right font-mono text-xs text-zinc-500">
                                                                    {formatIDR(row.totalAmount)}
                                                                </div>
                                                                <div className="col-span-2 text-right font-mono text-xs font-bold text-red-600">
                                                                    {formatIDR(row.balanceDue)}
                                                                </div>
                                                                <div className="col-span-2">
                                                                    {row.selected ? (
                                                                        <Input
                                                                            type="number"
                                                                            value={row.allocatedAmount || ""}
                                                                            onChange={(e) => updateManualAllocation(row.billId, Number(e.target.value))}
                                                                            max={row.balanceDue}
                                                                            min={0}
                                                                            className="border-2 border-black font-mono font-bold h-8 text-right rounded-none text-xs w-full"
                                                                        />
                                                                    ) : (
                                                                        <div className="text-right text-xs text-zinc-300 font-mono">-</div>
                                                                    )}
                                                                </div>
                                                            </div>
                                                        ))}
                                                    </>
                                                )}
                                            </div>

                                            {/* Payment summary */}
                                            {manualSelectedCount > 0 && (
                                                <div className="border-2 border-black bg-emerald-50 dark:bg-emerald-950 p-4">
                                                    <div className="flex items-center justify-between">
                                                        <div>
                                                            <span className="text-[10px] font-black uppercase tracking-widest text-emerald-700">Ringkasan Pembayaran</span>
                                                            <p className="text-xs text-emerald-600 mt-0.5">{manualSelectedCount} tagihan dipilih</p>
                                                        </div>
                                                        <div className="text-right">
                                                            <span className="text-[10px] font-black uppercase tracking-widest text-emerald-700 block">Total Bayar</span>
                                                            <span className="font-mono font-black text-2xl text-emerald-800">{formatIDR(manualTotalAllocated)}</span>
                                                        </div>
                                                    </div>
                                                    {/* GL Entry Preview */}
                                                    <div className="mt-3 pt-3 border-t border-emerald-200 dark:border-emerald-800">
                                                        <span className="text-[9px] font-black uppercase tracking-widest text-emerald-600 block mb-1">Jurnal Otomatis</span>
                                                        <div className="grid grid-cols-3 gap-1 text-[10px] font-bold">
                                                            <span className="text-emerald-700">Akun</span>
                                                            <span className="text-emerald-700 text-right">Debit</span>
                                                            <span className="text-emerald-700 text-right">Kredit</span>
                                                            <span>2000 - Hutang Usaha</span>
                                                            <span className="text-right font-mono">{formatIDR(manualTotalAllocated)}</span>
                                                            <span className="text-right font-mono">-</span>
                                                            <span>{manualBankAccount} - {[...bankAccounts, ...cashAccounts].find((a) => a.code === manualBankAccount)?.name || "Cash/Bank"}</span>
                                                            <span className="text-right font-mono">-</span>
                                                            <span className="text-right font-mono">{formatIDR(manualTotalAllocated)}</span>
                                                        </div>
                                                    </div>
                                                </div>
                                            )}
                                        </>
                                    )}
                        </div>
                    </div>
                    {/* Footer */}
                    <div className="px-6 py-4 border-t-2 border-black">
                        <div className={NB.footer}>
                            <Button variant="outline" onClick={() => setIsPayOpen(false)} disabled={processing} className={NB.cancelBtn}>Batal</Button>
                            <Button
                                onClick={handleManualPaySubmit}
                                disabled={processing || manualSelectedCount === 0 || manualTotalAllocated <= 0 || !activeBill?.vendor?.id}
                                className={NB.submitBtn + " bg-emerald-700 hover:bg-emerald-800 disabled:opacity-40"}
                            >
                                {processing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                <Banknote className="h-4 w-4 mr-2" />
                                Bayar {manualSelectedCount} Tagihan — {formatIDR(manualTotalAllocated)}
                            </Button>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    )
}
