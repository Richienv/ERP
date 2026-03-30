"use client"

import { useEffect, useState } from "react"
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
    Wallet,
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
} from "lucide-react"
import { motion, AnimatePresence } from "framer-motion"
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { CheckboxFilter } from "@/components/ui/checkbox-filter"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import { disputeBill, recordMultiBillPayment, type VendorBill } from "@/lib/actions/finance"
import { PaymentHistoryTable, type PaymentHistoryRow } from "@/components/finance/payment-history-table"
import { processXenditPayout } from "@/lib/actions/xendit"
import { formatIDR } from "@/lib/utils"
import { NB } from "@/lib/dialog-styles"
import { toast } from "sonner"
import { useBills, useBanks } from "@/hooks/use-bills"
import { useQueryClient } from "@tanstack/react-query"
import { queryKeys } from "@/lib/query-keys"
import { TablePageSkeleton } from "@/components/ui/page-skeleton"
import { useBankAccounts } from "@/hooks/use-bank-accounts"

/* ─── Animation variants ─── */
const fadeUp = {
    hidden: { opacity: 0, y: 14 },
    show: { opacity: 1, y: 0, transition: { type: "spring" as const, stiffness: 320, damping: 26 } },
}
const fadeX = {
    hidden: { opacity: 0, x: -12 },
    show: { opacity: 1, x: 0, transition: { type: "spring" as const, stiffness: 320, damping: 26 } },
}

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

    const { data: billsData, isLoading } = useBills(queryParams)
    const { data: banksData } = useBanks()

    const bills = billsData?.rows ?? []
    const billMeta = billsData?.meta ?? { page: 1, pageSize: 20, total: 0, totalPages: 1 }
    const banks = banksData?.banks ?? []
    const ewallets = banksData?.ewallets ?? []

    const [searchText, setSearchText] = useState(searchParams.get("q") || "")
    const [selectedStatuses, setSelectedStatuses] = useState<string[]>(
        searchParams.get("status") ? [searchParams.get("status")!] : []
    )
    const [activeBill, setActiveBill] = useState<VendorBill | null>(null)
    const [stamped, setStamped] = useState(false)
    const [processing, setProcessing] = useState(false)
    const [paymentPendingBillId, setPaymentPendingBillId] = useState<string | null>(null)

    const [isDetailOpen, setIsDetailOpen] = useState(false)
    const [isPayOpen, setIsPayOpen] = useState(false)
    const [isDisputeOpen, setIsDisputeOpen] = useState(false)
    const [disputeReason, setDisputeReason] = useState("")

    const [paymentForm, setPaymentForm] = useState({
        bankCode: "",
        accountNumber: "",
        accountHolderName: "",
        description: "",
    })

    // Manual payment state
    const [paymentTab, setPaymentTab] = useState<"manual" | "xendit">("manual")
    const [manualMethod, setManualMethod] = useState<"TRANSFER" | "CHECK" | "GIRO" | "CASH">("TRANSFER")
    const [manualBankAccount, setManualBankAccount] = useState("1010")
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

    const { data: bankAccounts } = useBankAccounts()

    useEffect(() => {
        if (activeBill && activeBill.vendor) {
            setPaymentForm({
                bankCode: activeBill.vendor.bankName?.toUpperCase().replace(/\s+/g, "_").replace(/^BANK_/, "") || "",
                accountNumber: activeBill.vendor.bankAccountNumber || "",
                accountHolderName: activeBill.vendor.bankAccountName || "",
                description: `Payment for ${activeBill.number}`,
            })
        }
    }, [activeBill])

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
            setPaymentTab("manual")
            setManualMethod("TRANSFER")
            setManualBankAccount("1010")
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

    const handlePaySubmit = async () => {
        if (!activeBill) return
        if (paymentPendingBillId) { toast.error("Pembayaran lain sedang diproses"); return }
        if (!paymentForm.bankCode) { toast.error("Pilih bank"); return }
        if (!paymentForm.accountNumber) { toast.error("Masukkan nomor rekening"); return }
        if (!paymentForm.accountHolderName) { toast.error("Masukkan nama pemilik rekening"); return }
        setPaymentPendingBillId(activeBill.id)
        setProcessing(true)
        try {
            const result = await processXenditPayout({ billId: activeBill.id, amount: activeBill.balanceDue, bankCode: paymentForm.bankCode, accountNumber: paymentForm.accountNumber, accountHolderName: paymentForm.accountHolderName, description: paymentForm.description })
            if (result.success) { setStamped(true); toast.success("message" in result ? result.message : "Pembayaran berhasil"); setIsPayOpen(false); setTimeout(() => { setStamped(false); invalidateAfterPayout() }, 2000) }
            else toast.error("error" in result ? result.error : "Gagal bayar")
        } catch (error: any) { toast.error(error.message || "Terjadi kesalahan") } finally { setProcessing(false); setPaymentPendingBillId(null) }
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

    const openBillDetail = (bill: VendorBill) => { setActiveBill(bill); setStamped(false); setIsDetailOpen(true) }

    // Separate active vs completed bills
    const activeBills = bills.filter((b) => b.status !== "PAID")
    const completedBills = bills.filter((b) => b.status === "PAID")
    const completedTotal = completedBills.reduce((sum, b) => sum + b.amount, 0)

    // KPI (only count active bills)
    const totalBills = activeBills.length
    const pendingBills = activeBills.filter((b) => b.status === "ISSUED" || b.status === "DRAFT").length
    const overdueBills = activeBills.filter((b) => b.isOverdue).length
    const totalAmount = activeBills.reduce((sum, b) => sum + b.balanceDue, 0)
    const hasActiveFilters = searchText || selectedStatuses.length > 0

    const getStatusColor = (status: string, isOverdue: boolean) => {
        if (isOverdue) return "bg-red-50 dark:bg-red-950/30 text-red-700 dark:text-red-400 border-red-300 dark:border-red-700"
        switch (status) {
            case "PAID": return "bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-400 border-emerald-300 dark:border-emerald-700"
            case "DISPUTED": return "bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-400 border-amber-300 dark:border-amber-700"
            case "PARTIAL": return "bg-blue-50 dark:bg-blue-950/30 text-blue-700 dark:text-blue-400 border-blue-300 dark:border-blue-700"
            case "DRAFT": return "bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 border-zinc-300 dark:border-zinc-700"
            default: return "bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 border-zinc-300 dark:border-zinc-700"
        }
    }

    if (isLoading) return <TablePageSkeleton accentColor="bg-orange-400" />

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
            <motion.div
                variants={fadeUp}
                initial="hidden"
                animate="show"
                className="border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] bg-white dark:bg-zinc-900 overflow-hidden"
            >
                {/* Row 1: Toolbar — Scan Bill button + count */}
                <div className="px-5 py-2.5 flex items-center justify-between border-b border-zinc-200 dark:border-zinc-800">
                    <div className="flex items-center gap-3">
                        <span className="text-[11px] font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                            Tagihan Vendor
                        </span>
                        <span className="text-[10px] font-mono font-bold text-zinc-400 bg-zinc-100 dark:bg-zinc-800 px-1.5 py-0.5">
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

                {/* Row 2: KPI Strip — big, colorful, attention-grabbing */}
                <div className="grid grid-cols-3 border-b border-zinc-200 dark:border-zinc-800">
                    {/* Total Tagihan */}
                    <div className="px-5 py-4 border-r border-zinc-200 dark:border-zinc-800 bg-blue-50/50 dark:bg-blue-950/10">
                        <div className="flex items-center gap-1.5 mb-1">
                            <span className="w-2 h-2 bg-blue-500 rounded-full" />
                            <span className="text-[10px] font-black uppercase tracking-widest text-blue-600 dark:text-blue-400">Total Tagihan</span>
                        </div>
                        <div className="flex items-baseline gap-2">
                            <span className="text-3xl font-black text-blue-700 dark:text-blue-300 tabular-nums">{totalBills}</span>
                            <span className="text-sm font-mono font-bold text-blue-500 dark:text-blue-400">{formatIDR(totalAmount)}</span>
                        </div>
                    </div>
                    {/* Pending */}
                    <div className="px-5 py-4 border-r border-zinc-200 dark:border-zinc-800">
                        <div className="flex items-center gap-1.5 mb-1">
                            <span className="w-2 h-2 bg-amber-500 rounded-full" />
                            <span className="text-[10px] font-black uppercase tracking-widest text-amber-600 dark:text-amber-400">Pending</span>
                        </div>
                        <span className="text-3xl font-black text-amber-600 dark:text-amber-400 tabular-nums">{pendingBills}</span>
                    </div>
                    {/* Jatuh Tempo / Overdue */}
                    <div className={`px-5 py-4 ${overdueBills > 0 ? "bg-red-50 dark:bg-red-950/20" : ""}`}>
                        <div className="flex items-center gap-1.5 mb-1">
                            <span className={`w-2 h-2 rounded-full ${overdueBills > 0 ? "bg-red-500 animate-pulse" : "bg-zinc-300"}`} />
                            <span className={`text-[10px] font-black uppercase tracking-widest ${overdueBills > 0 ? "text-red-600 dark:text-red-400" : "text-zinc-400"}`}>Jatuh Tempo</span>
                        </div>
                        <span className={`text-3xl font-black tabular-nums ${overdueBills > 0 ? "text-red-600 dark:text-red-400" : "text-zinc-300 dark:text-zinc-600"}`}>{overdueBills}</span>
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
                            <Button variant="ghost" onClick={resetFilters} className="text-zinc-400 text-[10px] font-bold uppercase h-9 px-3 rounded-none hover:text-zinc-700 dark:hover:text-zinc-200 ml-1.5">
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
                        <span key={h} className="text-[10px] font-black uppercase tracking-widest text-zinc-400">{h}</span>
                    ))}
                </div>

                {/* ─── Table Body (active bills only) ─── */}
                <div className="min-h-[200px]">
                    {activeBills.length === 0 ? (
                        <motion.div
                            initial={{ opacity: 0, scale: 0.9 }}
                            animate={{ opacity: 1, scale: 1 }}
                            className="flex flex-col items-center justify-center py-16 text-zinc-400"
                        >
                            <div className="w-14 h-14 border-2 border-zinc-200 dark:border-zinc-700 flex items-center justify-center mb-3">
                                <CheckCircle2 className="h-6 w-6 text-zinc-200 dark:text-zinc-700" />
                            </div>
                            <span className="text-sm font-bold text-zinc-500 dark:text-zinc-400">Semua tagihan sudah terbayar</span>
                            <span className="text-xs text-zinc-400 mt-1">Tidak ada tagihan yang perlu diproses</span>
                        </motion.div>
                    ) : (
                        <div className="divide-y divide-zinc-100 dark:divide-zinc-800">
                            {activeBills.map((bill, idx) => {
                                const isOverdue = bill.isOverdue
                                return (
                                    <motion.div
                                        key={bill.id}
                                        variants={fadeX}
                                        initial="hidden"
                                        animate="show"
                                        transition={{ delay: idx * 0.03 }}
                                        className={`grid grid-cols-1 md:grid-cols-[1fr_1.5fr_110px_100px_140px_110px] gap-2 px-5 py-3 items-center transition-all hover:bg-orange-50/50 dark:hover:bg-orange-950/10 ${
                                            idx % 2 === 0 ? "bg-white dark:bg-zinc-900" : "bg-zinc-50/60 dark:bg-zinc-800/20"
                                        } ${isOverdue ? "border-l-4 border-l-red-500" : ""}`}
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
                                            <span className={`text-xs font-medium ${isOverdue ? "text-red-600 dark:text-red-400 font-bold" : "text-zinc-500"}`}>
                                                {new Date(bill.dueDate).toLocaleDateString("id-ID")}
                                            </span>
                                        </div>
                                        {/* Status */}
                                        <div>
                                            <span className={`inline-flex items-center gap-1.5 text-[9px] font-black uppercase tracking-wide px-2 py-1 border rounded-none ${getStatusColor(bill.status, isOverdue)}`}>
                                                <span className={`w-1.5 h-1.5 ${
                                                    isOverdue ? "bg-red-500" :
                                                    bill.status === "PAID" ? "bg-emerald-500" :
                                                    bill.status === "DISPUTED" ? "bg-amber-500" :
                                                    "bg-zinc-400"
                                                }`} />
                                                {isOverdue ? "Overdue" : bill.status}
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
                                                <span className="text-[9px] text-zinc-400 block font-mono">Sisa {formatIDR(bill.balanceDue)}</span>
                                            )}
                                        </div>
                                        {/* Actions */}
                                        <div className="flex gap-1 justify-end">
                                            <motion.button
                                                whileHover={{ y: -1 }}
                                                whileTap={{ scale: 0.92 }}
                                                onClick={() => openBillDetail(bill)}
                                                title="Detail"
                                                className="h-7 w-7 flex items-center justify-center border border-zinc-200 dark:border-zinc-600 text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-800 hover:border-zinc-400 hover:text-zinc-600 transition-colors rounded-none"
                                            >
                                                <Eye className="h-3 w-3" />
                                            </motion.button>
                                            {["ISSUED", "PARTIAL", "OVERDUE"].includes(bill.status) && bill.balanceDue > 0 && (
                                                <motion.button
                                                    whileHover={{ y: -1 }}
                                                    whileTap={{ scale: 0.92 }}
                                                    onClick={() => { setActiveBill(bill); setStamped(false); setIsPayOpen(true) }}
                                                    disabled={!!paymentPendingBillId}
                                                    title="Bayar"
                                                    className="h-7 px-2 flex items-center gap-1 border border-emerald-300 dark:border-emerald-600 text-emerald-500 hover:bg-emerald-50 dark:hover:bg-emerald-950/30 hover:border-emerald-500 transition-colors rounded-none text-[9px] font-bold uppercase"
                                                >
                                                    <CreditCard className="h-3 w-3" /> Bayar
                                                </motion.button>
                                            )}
                                            {bill.status === "DRAFT" && (
                                                <span className="text-[9px] italic text-zinc-400 dark:text-zinc-500 px-1">Perlu persetujuan</span>
                                            )}
                                        </div>
                                    </motion.div>
                                )
                            })}
                        </div>
                    )}
                </div>

                {/* Pagination footer */}
                {billMeta.totalPages > 1 && (
                    <div className="px-5 py-3 border-t border-zinc-200 dark:border-zinc-700 flex items-center justify-between bg-zinc-50 dark:bg-zinc-800/50">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
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
            </motion.div>

            {/* ═══ BILL DETAIL DIALOG ═══ */}
            <Dialog open={isDetailOpen} onOpenChange={setIsDetailOpen}>
                <DialogContent className={NB.contentNarrow}>
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
                        <div className="px-6 py-5 space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div><label className={NB.label}>No. Invoice</label><p className="font-mono font-bold text-sm">{activeBill.number}</p></div>
                                <div><label className={NB.label}>Jatuh Tempo</label><p className="font-bold text-sm">{new Date(activeBill.dueDate).toLocaleDateString("id-ID")}</p></div>
                                <div><label className={NB.label}>Total Tagihan</label><p className="text-2xl font-black">{formatIDR(activeBill.amount)}</p></div>
                                <div><label className={NB.label}>Sisa Bayar</label><p className="text-2xl font-black text-red-600">{formatIDR(activeBill.balanceDue)}</p></div>
                            </div>
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
                                                    <span className={`text-[9px] font-bold uppercase px-2 py-0.5 border ${
                                                        p.method === "TRANSFER" ? "border-blue-300 text-blue-600 bg-blue-50/50" :
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
                                    <span className="text-[10px] italic text-zinc-400">Tagihan ini masih draft — perlu persetujuan sebelum dibayar</span>
                                    <Button variant="outline" onClick={() => setIsDetailOpen(false)} className={NB.cancelBtn}>
                                        Tutup
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

                        {/* Top-level tabs: MANUAL | XENDIT */}
                        <div className="px-6 pt-4">
                            <Tabs value={paymentTab} onValueChange={(v) => setPaymentTab(v as "manual" | "xendit")} className="w-full">
                                <TabsList className="grid w-full grid-cols-2 border-2 border-black rounded-none">
                                    <TabsTrigger value="manual" className="flex items-center gap-2 rounded-none font-black uppercase text-xs tracking-wider">
                                        <Building2 className="h-4 w-4" /> Manual
                                    </TabsTrigger>
                                    <TabsTrigger value="xendit" className="flex items-center gap-2 rounded-none font-black uppercase text-xs tracking-wider">
                                        <Wallet className="h-4 w-4" /> Xendit
                                    </TabsTrigger>
                                </TabsList>

                                {/* ─── MANUAL TAB ─── */}
                                <TabsContent value="manual" className="space-y-4 mt-4">
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
                                                                setManualBankAccount(m === "CASH" ? "1000" : "1010")
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
                                                            <Label className={NB.label}>Akun Pembayaran <span className={NB.labelRequired}>*</span></Label>
                                                            <Select value={manualBankAccount} onValueChange={setManualBankAccount}>
                                                                <SelectTrigger className={NB.select}><SelectValue placeholder="Pilih akun..." /></SelectTrigger>
                                                                <SelectContent>
                                                                    {bankAccounts?.map((a) => (
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
                                                            <span>{manualBankAccount} - {bankAccounts?.find((a) => a.code === manualBankAccount)?.name || "Cash/Bank"}</span>
                                                            <span className="text-right font-mono">-</span>
                                                            <span className="text-right font-mono">{formatIDR(manualTotalAllocated)}</span>
                                                        </div>
                                                    </div>
                                                </div>
                                            )}
                                        </>
                                    )}
                                </TabsContent>

                                {/* ─── XENDIT TAB ─── */}
                                <TabsContent value="xendit" className="space-y-4 mt-4">
                                    <Tabs defaultValue="bank" className="w-full">
                                        <TabsList className="grid w-full grid-cols-2 border-2 border-black rounded-none">
                                            <TabsTrigger value="bank" className="flex items-center gap-2 rounded-none font-black uppercase text-xs tracking-wider"><Building2 className="h-4 w-4" /> Bank Transfer</TabsTrigger>
                                            <TabsTrigger value="ewallet" className="flex items-center gap-2 rounded-none font-black uppercase text-xs tracking-wider"><Wallet className="h-4 w-4" /> E-Wallet</TabsTrigger>
                                        </TabsList>
                                        <TabsContent value="bank" className="space-y-4 mt-4">
                                            <div className="space-y-1"><label className={NB.label}>Bank <span className={NB.labelRequired}>*</span></label><Select value={paymentForm.bankCode} onValueChange={(v) => setPaymentForm({ ...paymentForm, bankCode: v })}><SelectTrigger className={NB.select}><SelectValue placeholder="Pilih bank..." /></SelectTrigger><SelectContent>{banks.map((bank) => <SelectItem key={bank.key} value={bank.key}>{bank.name}</SelectItem>)}</SelectContent></Select></div>
                                            <div className="space-y-1"><label className={NB.label}>No. Rekening <span className={NB.labelRequired}>*</span></label><Input placeholder="1234567890" value={paymentForm.accountNumber} onChange={(e) => setPaymentForm({ ...paymentForm, accountNumber: e.target.value })} className={NB.inputMono} /></div>
                                            <div className="space-y-1"><label className={NB.label}>Nama Pemilik Rekening <span className={NB.labelRequired}>*</span></label><Input placeholder="Nama sesuai rekening" value={paymentForm.accountHolderName} onChange={(e) => setPaymentForm({ ...paymentForm, accountHolderName: e.target.value })} className={NB.input} /><p className="text-[10px] font-bold text-zinc-400 mt-1">Harus sesuai data bank</p></div>
                                        </TabsContent>
                                        <TabsContent value="ewallet" className="space-y-4 mt-4">
                                            <div className="space-y-1"><label className={NB.label}>E-Wallet <span className={NB.labelRequired}>*</span></label><Select value={paymentForm.bankCode} onValueChange={(v) => setPaymentForm({ ...paymentForm, bankCode: v })}><SelectTrigger className={NB.select}><SelectValue placeholder="Pilih e-wallet..." /></SelectTrigger><SelectContent>{ewallets.map((ew) => <SelectItem key={ew.key} value={ew.key}>{ew.name}</SelectItem>)}</SelectContent></Select></div>
                                            <div className="space-y-1"><label className={NB.label}>No. Telepon <span className={NB.labelRequired}>*</span></label><Input placeholder="08123456789" value={paymentForm.accountNumber} onChange={(e) => setPaymentForm({ ...paymentForm, accountNumber: e.target.value })} className={NB.inputMono} /></div>
                                            <div className="space-y-1"><label className={NB.label}>Nama Akun <span className={NB.labelRequired}>*</span></label><Input placeholder="Nama pemilik akun" value={paymentForm.accountHolderName} onChange={(e) => setPaymentForm({ ...paymentForm, accountHolderName: e.target.value })} className={NB.input} /></div>
                                        </TabsContent>
                                    </Tabs>
                                    {/* Xendit fee summary */}
                                    <div className={NB.section}>
                                        <div className={NB.sectionHead}><CheckCircle2 className="h-3.5 w-3.5" /><span className={NB.sectionTitle}>Ringkasan</span></div>
                                        <div className="p-4 space-y-2 text-sm">
                                            <div className="flex justify-between"><span className="text-zinc-400 font-bold text-xs">Biaya Transfer (estimasi)</span><span className="font-bold font-mono text-xs">Rp 2.775</span></div>
                                            <div className="flex justify-between border-t-2 border-black pt-2"><span className="font-black text-xs uppercase tracking-wider">Total Charge</span><span className="font-black font-mono">{activeBill ? formatIDR(activeBill.balanceDue + 2775) : "-"}</span></div>
                                        </div>
                                    </div>
                                </TabsContent>
                            </Tabs>
                        </div>
                    </div>
                    {/* Footer — button changes based on active tab */}
                    <div className="px-6 py-4 border-t-2 border-black">
                        <div className={NB.footer}>
                            <Button variant="outline" onClick={() => setIsPayOpen(false)} disabled={processing} className={NB.cancelBtn}>Batal</Button>
                            {paymentTab === "manual" ? (
                                <Button
                                    onClick={handleManualPaySubmit}
                                    disabled={processing || manualSelectedCount === 0 || manualTotalAllocated <= 0 || !activeBill?.vendor?.id}
                                    className={NB.submitBtn + " bg-emerald-700 hover:bg-emerald-800 disabled:opacity-40"}
                                >
                                    {processing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                    <Banknote className="h-4 w-4 mr-2" />
                                    Bayar {manualSelectedCount} Tagihan — {formatIDR(manualTotalAllocated)}
                                </Button>
                            ) : (
                                <Button onClick={handlePaySubmit} disabled={processing || !!paymentPendingBillId} className={NB.submitBtn}>
                                    {processing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                    Konfirmasi Pembayaran
                                </Button>
                            )}
                        </div>
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    )
}
