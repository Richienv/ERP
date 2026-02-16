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
    Clock,
    Ban,
    FileText,
    Eye,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
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
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { getVendorBillsRegistry, disputeBill, type VendorBill } from "@/lib/actions/finance"
import { processXenditPayout, getAvailableBanks } from "@/lib/actions/xendit"
import { formatIDR } from "@/lib/utils"
import { toast } from "sonner"

interface BankOption {
    key: string
    code: string
    name: string
    isEwallet: boolean
}

export default function APBillsStackPage() {
    const [bills, setBills] = useState<VendorBill[]>([])
    const [billMeta, setBillMeta] = useState({ page: 1, pageSize: 20, total: 0, totalPages: 1 })
    const [queryState, setQueryState] = useState({ q: "", status: "__all__" })
    const [activeBill, setActiveBill] = useState<VendorBill | null>(null)
    const [stamped, setStamped] = useState(false)
    const [loading, setLoading] = useState(true)
    const [processing, setProcessing] = useState(false)

    const [banks, setBanks] = useState<BankOption[]>([])
    const [ewallets, setEwallets] = useState<BankOption[]>([])

    const [isDetailOpen, setIsDetailOpen] = useState(false)
    const [isPayOpen, setIsPayOpen] = useState(false)
    const [isDisputeOpen, setIsDisputeOpen] = useState(false)
    const [disputeReason, setDisputeReason] = useState("")

    const [paymentForm, setPaymentForm] = useState({
        bankCode: "",
        accountNumber: "",
        accountHolderName: "",
        description: ""
    })
    const router = useRouter()
    const pathname = usePathname()
    const searchParams = useSearchParams()

    useEffect(() => { loadBills() }, [searchParams.toString()])
    useEffect(() => { loadBanks() }, [])

    useEffect(() => {
        if (activeBill && activeBill.vendor) {
            setPaymentForm({
                bankCode: activeBill.vendor.bankName || "",
                accountNumber: activeBill.vendor.bankAccountNumber || "",
                accountHolderName: activeBill.vendor.bankAccountName || activeBill.vendor.name || "",
                description: `Payment for ${activeBill.number}`
            })
        }
    }, [activeBill])

    async function loadBills() {
        setLoading(true)
        try {
            const query = {
                q: searchParams.get("q"),
                status: searchParams.get("status"),
                page: Number(searchParams.get("page") || "1"),
                pageSize: Number(searchParams.get("size") || "20"),
            }
            const data = await getVendorBillsRegistry(query)
            setBills(data.rows)
            setBillMeta(data.meta)
            setQueryState({
                q: data.query.q || "",
                status: data.query.status || "__all__",
            })
        } catch (error) {
            console.error("Failed to load bills:", error)
            toast.error("Failed to load bills")
        } finally {
            setLoading(false)
        }
    }

    const pushSearchParams = (mutator: (params: URLSearchParams) => void) => {
        const next = new URLSearchParams(searchParams.toString())
        mutator(next)
        const qs = next.toString()
        router.replace(qs ? `${pathname}?${qs}` : pathname)
    }

    const applyFilters = () => {
        pushSearchParams((params) => {
            const normalizedQ = queryState.q.trim()
            if (normalizedQ) params.set("q", normalizedQ)
            else params.delete("q")
            if (queryState.status === "__all__") params.delete("status")
            else params.set("status", queryState.status)
            params.set("page", "1")
        })
    }

    const setPage = (page: number) => {
        pushSearchParams((params) => {
            params.set("page", String(Math.max(1, page)))
        })
    }

    async function loadBanks() {
        try {
            const data = await getAvailableBanks()
            setBanks(data.banks)
            setEwallets(data.ewallets)
        } catch (error) {
            console.error("Failed to load banks:", error)
        }
    }

    const handleDisputeSubmit = async () => {
        if (!activeBill || !disputeReason.trim()) {
            toast.error("Please enter a dispute reason")
            return
        }
        setProcessing(true)
        try {
            const result = await disputeBill(activeBill.id, disputeReason)
            if (result.success) {
                toast.success("Bill disputed successfully")
                setIsDisputeOpen(false)
                setDisputeReason("")
                loadBills()
            } else {
                toast.error("Failed to dispute bill")
            }
        } catch {
            toast.error("An error occurred")
        } finally {
            setProcessing(false)
        }
    }

    const handlePaySubmit = async () => {
        if (!activeBill) return
        if (!paymentForm.bankCode) { toast.error("Please select a bank"); return }
        if (!paymentForm.accountNumber) { toast.error("Please enter account number"); return }
        if (!paymentForm.accountHolderName) { toast.error("Please enter account holder name"); return }

        setProcessing(true)
        try {
            const result = await processXenditPayout({
                billId: activeBill.id,
                amount: activeBill.balanceDue,
                bankCode: paymentForm.bankCode,
                accountNumber: paymentForm.accountNumber,
                accountHolderName: paymentForm.accountHolderName,
                description: paymentForm.description
            })
            if (result.success) {
                setStamped(true)
                toast.success('message' in result ? result.message : "Payment initiated successfully")
                setIsPayOpen(false)
                setTimeout(() => { setStamped(false); loadBills() }, 2000)
            } else {
                toast.error('error' in result ? result.error : "Failed to process payment")
            }
        } catch (error: any) {
            toast.error(error.message || "An error occurred")
        } finally {
            setProcessing(false)
        }
    }

    const openBillDetail = (bill: VendorBill) => {
        setActiveBill(bill)
        setStamped(false)
        setIsDetailOpen(true)
    }

    // KPI calculations
    const totalBills = billMeta.total
    const pendingBills = bills.filter(b => b.status === "ISSUED" || b.status === "DRAFT").length
    const overdueBills = bills.filter(b => b.isOverdue).length
    const disputedBills = bills.filter(b => b.status === "DISPUTED").length
    const totalAmount = bills.reduce((sum, b) => sum + b.balanceDue, 0)

    const statusFilters = ["__all__", "DRAFT", "ISSUED", "PARTIAL", "OVERDUE", "DISPUTED", "PAID"] as const
    const statusLabels: Record<string, string> = {
        "__all__": "Semua",
        DRAFT: "Draft",
        ISSUED: "Issued",
        PARTIAL: "Partial",
        OVERDUE: "Overdue",
        DISPUTED: "Disputed",
        PAID: "Paid",
    }

    const getStatusColor = (status: string, isOverdue: boolean) => {
        if (isOverdue) return "bg-red-100 text-red-700 border-red-300"
        switch (status) {
            case "PAID": return "bg-emerald-100 text-emerald-700 border-emerald-300"
            case "DISPUTED": return "bg-amber-100 text-amber-700 border-amber-300"
            case "PARTIAL": return "bg-blue-100 text-blue-700 border-blue-300"
            case "DRAFT": return "bg-zinc-100 text-zinc-600 border-zinc-300"
            default: return "bg-zinc-100 text-zinc-700 border-zinc-300"
        }
    }

    if (loading && bills.length === 0) {
        return (
            <div className="p-4 md:p-8 pt-6 max-w-[1600px] mx-auto bg-zinc-50 dark:bg-black min-h-screen flex items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-zinc-400" />
            </div>
        )
    }

    return (
        <div className="p-4 md:p-8 pt-6 max-w-[1600px] mx-auto space-y-4 bg-zinc-50 dark:bg-black min-h-screen">

            {/* ═══ COMMAND HEADER ═══ */}
            <div className="border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] overflow-hidden bg-white dark:bg-zinc-900">
                <div className="px-6 py-4 flex items-center justify-between border-l-[6px] border-l-red-400">
                    <div className="flex items-center gap-3">
                        <Receipt className="h-5 w-5 text-red-500" />
                        <div>
                            <h1 className="text-xl font-black uppercase tracking-tight text-zinc-900 dark:text-white">
                                Tagihan Vendor
                            </h1>
                            <p className="text-zinc-400 text-xs font-medium mt-0.5">
                                Review, approve, dan bayar tagihan vendor via Xendit
                            </p>
                        </div>
                    </div>
                    <Button className="bg-black text-white hover:bg-zinc-800 border-2 border-black shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] active:translate-y-[1px] active:shadow-none transition-all text-[10px] font-black uppercase tracking-widest h-9 px-4">
                        <Plus className="mr-2 h-3.5 w-3.5" /> Scan Bill
                    </Button>
                </div>
            </div>

            {/* ═══ KPI PULSE STRIP ═══ */}
            <div className="bg-white dark:bg-zinc-900 border-2 border-black shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] overflow-hidden">
                <div className="grid grid-cols-2 md:grid-cols-4">
                    <div className="relative p-4 md:p-5 border-r-2 border-zinc-100 dark:border-zinc-800 border-b-2 md:border-b-0">
                        <div className="absolute top-0 left-0 right-0 h-1 bg-red-400" />
                        <div className="flex items-center gap-2 mb-2">
                            <FileText className="h-4 w-4 text-zinc-400" />
                            <span className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Total Tagihan</span>
                        </div>
                        <div className="text-2xl md:text-3xl font-black tracking-tighter text-zinc-900 dark:text-white">{totalBills}</div>
                        <div className="text-[10px] font-bold text-red-600 mt-1">{formatIDR(totalAmount)} sisa</div>
                    </div>
                    <div className="relative p-4 md:p-5 border-r-2 border-zinc-100 dark:border-zinc-800 border-b-2 md:border-b-0">
                        <div className="absolute top-0 left-0 right-0 h-1 bg-amber-400" />
                        <div className="flex items-center gap-2 mb-2">
                            <Clock className="h-4 w-4 text-zinc-400" />
                            <span className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Pending</span>
                        </div>
                        <div className="text-2xl md:text-3xl font-black tracking-tighter text-amber-600">{pendingBills}</div>
                        <div className="text-[10px] font-bold text-amber-600 mt-1">Menunggu proses</div>
                    </div>
                    <div className="relative p-4 md:p-5 border-r-2 border-zinc-100 dark:border-zinc-800">
                        <div className="absolute top-0 left-0 right-0 h-1 bg-rose-500" />
                        <div className="flex items-center gap-2 mb-2">
                            <AlertCircle className="h-4 w-4 text-zinc-400" />
                            <span className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Overdue</span>
                        </div>
                        <div className="text-2xl md:text-3xl font-black tracking-tighter text-rose-600">{overdueBills}</div>
                        <div className="text-[10px] font-bold text-rose-600 mt-1">Jatuh tempo</div>
                    </div>
                    <div className="relative p-4 md:p-5">
                        <div className="absolute top-0 left-0 right-0 h-1 bg-orange-400" />
                        <div className="flex items-center gap-2 mb-2">
                            <Ban className="h-4 w-4 text-zinc-400" />
                            <span className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Disputed</span>
                        </div>
                        <div className="text-2xl md:text-3xl font-black tracking-tighter text-orange-600">{disputedBills}</div>
                        <div className="text-[10px] font-bold text-orange-600 mt-1">Dalam sengketa</div>
                    </div>
                </div>
            </div>

            {/* ═══ SEARCH & FILTER BAR ═══ */}
            <div className="bg-white dark:bg-zinc-900 border-2 border-black shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] overflow-hidden">
                <div className="px-4 py-3 flex items-center gap-3 flex-wrap">
                    <div className="relative flex-1 min-w-[200px] max-w-md">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400" />
                        <Input
                            value={queryState.q}
                            onChange={(e) => setQueryState(prev => ({ ...prev, q: e.target.value }))}
                            onKeyDown={(e) => e.key === "Enter" && applyFilters()}
                            placeholder="Cari nomor bill / vendor..."
                            className="pl-9 border-2 border-black font-bold h-10 placeholder:text-zinc-400 rounded-none"
                        />
                    </div>
                    <div className="flex border-2 border-black">
                        {statusFilters.map((s) => (
                            <button
                                key={s}
                                onClick={() => {
                                    setQueryState(prev => ({ ...prev, status: s }))
                                    pushSearchParams((params) => {
                                        if (s === "__all__") params.delete("status")
                                        else params.set("status", s)
                                        params.set("page", "1")
                                    })
                                }}
                                className={`px-3 py-2 text-[10px] font-black uppercase tracking-widest transition-all border-r border-black last:border-r-0 ${
                                    queryState.status === s
                                        ? "bg-black text-white"
                                        : "bg-white text-zinc-400 hover:bg-zinc-50"
                                }`}
                            >
                                {statusLabels[s]}
                            </button>
                        ))}
                    </div>
                    <div className="text-[10px] font-black uppercase tracking-widest text-zinc-400 hidden md:block">
                        {billMeta.total} tagihan
                    </div>
                </div>
            </div>

            {/* ═══ BILLS TABLE ═══ */}
            <div className="bg-white dark:bg-zinc-900 border-2 border-black shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] overflow-hidden">
                {/* Table Header */}
                <div className="grid grid-cols-12 gap-2 px-4 py-3 border-b-2 border-black bg-zinc-50 dark:bg-zinc-800 text-[10px] font-black uppercase tracking-widest text-zinc-500">
                    <div className="col-span-2">No. Bill</div>
                    <div className="col-span-3">Vendor</div>
                    <div className="col-span-2">Jatuh Tempo</div>
                    <div className="col-span-1 text-center">Status</div>
                    <div className="col-span-2 text-right">Jumlah</div>
                    <div className="col-span-2 text-right">Aksi</div>
                </div>

                {bills.length === 0 ? (
                    <div className="p-12 text-center">
                        <CheckCircle2 className="h-8 w-8 mx-auto text-emerald-400 mb-2" />
                        <p className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Semua tagihan sudah terbayar</p>
                    </div>
                ) : (
                    bills.map((bill) => (
                        <div
                            key={bill.id}
                            className="grid grid-cols-12 gap-2 px-4 py-3 border-b border-zinc-100 dark:border-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors items-center group"
                        >
                            <div className="col-span-2">
                                <span className="font-mono font-bold text-xs">{bill.number}</span>
                            </div>
                            <div className="col-span-3">
                                <p className="font-bold text-sm truncate">{bill.vendor?.name || "Unknown Vendor"}</p>
                            </div>
                            <div className="col-span-2">
                                <span className={`text-xs font-bold ${bill.isOverdue ? "text-red-600" : "text-zinc-500"}`}>
                                    {new Date(bill.dueDate).toLocaleDateString("id-ID")}
                                </span>
                            </div>
                            <div className="col-span-1 text-center">
                                <span className={`inline-block px-2 py-0.5 text-[9px] font-black uppercase tracking-widest border ${getStatusColor(bill.status, bill.isOverdue)}`}>
                                    {bill.isOverdue ? "Overdue" : bill.status}
                                </span>
                            </div>
                            <div className="col-span-2 text-right">
                                <p className="font-black text-sm">{formatIDR(bill.amount)}</p>
                                {bill.balanceDue !== bill.amount && (
                                    <p className="text-[10px] font-bold text-red-500">Sisa: {formatIDR(bill.balanceDue)}</p>
                                )}
                            </div>
                            <div className="col-span-2 text-right flex items-center justify-end gap-1">
                                <button
                                    onClick={() => openBillDetail(bill)}
                                    className="p-1.5 border border-black text-[9px] font-black uppercase hover:bg-black hover:text-white transition-colors"
                                >
                                    <Eye className="h-3.5 w-3.5" />
                                </button>
                                {bill.status !== "PAID" && bill.balanceDue > 0 && (
                                    <button
                                        onClick={() => { setActiveBill(bill); setStamped(false); setIsPayOpen(true) }}
                                        className="px-2 py-1.5 bg-emerald-600 text-white text-[9px] font-black uppercase tracking-widest hover:bg-emerald-700 transition-colors flex items-center gap-1"
                                    >
                                        <CreditCard className="h-3 w-3" /> Bayar
                                    </button>
                                )}
                            </div>
                        </div>
                    ))
                )}

                {/* Pagination */}
                {billMeta.totalPages > 1 && (
                    <div className="px-4 py-3 flex items-center justify-between border-t border-zinc-100 dark:border-zinc-800">
                        <span className="text-[10px] font-black uppercase tracking-widest text-zinc-400">
                            Halaman {billMeta.page} / {billMeta.totalPages}
                        </span>
                        <div className="flex gap-1">
                            <button
                                onClick={() => setPage(billMeta.page - 1)}
                                disabled={billMeta.page <= 1}
                                className="px-3 py-1.5 border-2 border-black text-[10px] font-black uppercase disabled:opacity-30 hover:bg-black hover:text-white transition-colors"
                            >
                                Prev
                            </button>
                            <button
                                onClick={() => setPage(billMeta.page + 1)}
                                disabled={billMeta.page >= billMeta.totalPages}
                                className="px-3 py-1.5 border-2 border-black text-[10px] font-black uppercase disabled:opacity-30 hover:bg-black hover:text-white transition-colors"
                            >
                                Next
                            </button>
                        </div>
                    </div>
                )}
            </div>

            {/* ═══ BILL DETAIL DIALOG ═══ */}
            <Dialog open={isDetailOpen} onOpenChange={setIsDetailOpen}>
                <DialogContent className="sm:max-w-[600px] p-0 border-2 border-black rounded-none">
                    {activeBill && (
                        <>
                            <div className="px-6 py-4 border-b-2 border-black bg-zinc-50 dark:bg-zinc-800">
                                <div className="flex items-center justify-between">
                                    <div>
                                        <p className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Detail Tagihan</p>
                                        <h3 className="text-lg font-black uppercase mt-1">{activeBill.vendor?.name}</h3>
                                    </div>
                                    <span className={`px-3 py-1 text-[10px] font-black uppercase tracking-widest border ${getStatusColor(activeBill.status, activeBill.isOverdue)}`}>
                                        {activeBill.isOverdue ? "Overdue" : activeBill.status}
                                    </span>
                                </div>
                            </div>

                            {/* Stamped overlay */}
                            {stamped && (
                                <div className="absolute inset-0 flex items-center justify-center z-50 pointer-events-none">
                                    <div className="border-8 border-emerald-600 text-emerald-600 font-black text-5xl uppercase px-6 py-3 -rotate-12 opacity-70 tracking-widest">
                                        PAID
                                    </div>
                                </div>
                            )}

                            <div className="px-6 py-5 space-y-4">
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <p className="text-[10px] font-black uppercase tracking-widest text-zinc-400 mb-1">No. Invoice</p>
                                        <p className="font-mono font-bold text-sm">{activeBill.number}</p>
                                    </div>
                                    <div>
                                        <p className="text-[10px] font-black uppercase tracking-widest text-zinc-400 mb-1">Jatuh Tempo</p>
                                        <p className="font-bold text-sm">{new Date(activeBill.dueDate).toLocaleDateString("id-ID")}</p>
                                    </div>
                                    <div>
                                        <p className="text-[10px] font-black uppercase tracking-widest text-zinc-400 mb-1">Total Tagihan</p>
                                        <p className="text-2xl font-black">{formatIDR(activeBill.amount)}</p>
                                    </div>
                                    <div>
                                        <p className="text-[10px] font-black uppercase tracking-widest text-zinc-400 mb-1">Sisa Bayar</p>
                                        <p className="text-2xl font-black text-red-600">{formatIDR(activeBill.balanceDue)}</p>
                                    </div>
                                </div>

                                {activeBill.vendor?.bankAccountNumber && (
                                    <div className="p-4 border-2 border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800">
                                        <p className="text-[10px] font-black uppercase tracking-widest text-zinc-500 mb-2 flex items-center gap-2">
                                            <Building2 className="h-3 w-3" /> Info Bank Vendor
                                        </p>
                                        <div className="grid grid-cols-3 gap-3 text-xs">
                                            <div>
                                                <p className="text-zinc-400 font-medium">Bank</p>
                                                <p className="font-bold">{activeBill.vendor.bankName || "-"}</p>
                                            </div>
                                            <div>
                                                <p className="text-zinc-400 font-medium">No. Rekening</p>
                                                <p className="font-bold font-mono">{activeBill.vendor.bankAccountNumber}</p>
                                            </div>
                                            <div>
                                                <p className="text-zinc-400 font-medium">Nama Rekening</p>
                                                <p className="font-bold">{activeBill.vendor.bankAccountName || "-"}</p>
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>

                            <div className="px-6 py-4 border-t-2 border-black bg-zinc-50 dark:bg-zinc-800 flex items-center justify-between gap-3">
                                <Button
                                    variant="outline"
                                    onClick={() => { setIsDetailOpen(false); setIsDisputeOpen(true) }}
                                    disabled={activeBill.status === "PAID"}
                                    className="border-2 border-black text-[10px] font-black uppercase tracking-widest h-9"
                                >
                                    <XCircle className="mr-2 h-3.5 w-3.5" /> Dispute
                                </Button>
                                <Button
                                    onClick={() => { setIsDetailOpen(false); setIsPayOpen(true) }}
                                    disabled={activeBill.status === "PAID" || activeBill.balanceDue <= 0}
                                    className="bg-emerald-600 text-white hover:bg-emerald-700 border-2 border-black shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] active:translate-y-[1px] active:shadow-none transition-all text-[10px] font-black uppercase tracking-widest h-9 px-6"
                                >
                                    <CreditCard className="mr-2 h-3.5 w-3.5" /> Bayar Sekarang
                                </Button>
                            </div>
                        </>
                    )}
                </DialogContent>
            </Dialog>

            {/* ═══ DISPUTE DIALOG ═══ */}
            <Dialog open={isDisputeOpen} onOpenChange={setIsDisputeOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <AlertCircle className="h-5 w-5 text-amber-500" />
                            Dispute Tagihan
                        </DialogTitle>
                        <DialogDescription>
                            Masukkan alasan dispute. Vendor akan mendapat notifikasi.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                        <div className="space-y-2">
                            <Label htmlFor="reason">Alasan</Label>
                            <Textarea
                                id="reason"
                                placeholder="Contoh: Jumlah salah, barang rusak..."
                                value={disputeReason}
                                onChange={(e) => setDisputeReason(e.target.value)}
                                rows={4}
                            />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsDisputeOpen(false)} disabled={processing}>
                            Batal
                        </Button>
                        <Button variant="destructive" onClick={handleDisputeSubmit} disabled={processing}>
                            {processing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            Submit Dispute
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* ═══ PAY DIALOG ═══ */}
            <Dialog open={isPayOpen} onOpenChange={setIsPayOpen}>
                <DialogContent className="sm:max-w-[500px]">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <CreditCard className="h-5 w-5 text-emerald-600" />
                            Bayar via Xendit
                        </DialogTitle>
                        <DialogDescription>
                            Konfirmasi detail pembayaran. Dana akan ditransfer via Xendit.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-4 py-4">
                        <div className="bg-emerald-50 border-2 border-emerald-200 p-4 text-center">
                            <p className="text-[10px] font-black uppercase tracking-widest text-emerald-700">Jumlah Bayar</p>
                            <p className="text-3xl font-black text-emerald-700">
                                {activeBill ? formatIDR(activeBill.balanceDue) : "-"}
                            </p>
                        </div>

                        <Tabs defaultValue="bank" className="w-full">
                            <TabsList className="grid w-full grid-cols-2">
                                <TabsTrigger value="bank" className="flex items-center gap-2">
                                    <Building2 className="h-4 w-4" /> Bank Transfer
                                </TabsTrigger>
                                <TabsTrigger value="ewallet" className="flex items-center gap-2">
                                    <Wallet className="h-4 w-4" /> E-Wallet
                                </TabsTrigger>
                            </TabsList>

                            <TabsContent value="bank" className="space-y-4 mt-4">
                                <div className="space-y-2">
                                    <Label>Bank</Label>
                                    <Select value={paymentForm.bankCode} onValueChange={(v) => setPaymentForm({ ...paymentForm, bankCode: v })}>
                                        <SelectTrigger><SelectValue placeholder="Pilih bank..." /></SelectTrigger>
                                        <SelectContent>
                                            {banks.map((bank) => (
                                                <SelectItem key={bank.key} value={bank.key}>{bank.name}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="space-y-2">
                                    <Label>No. Rekening</Label>
                                    <Input
                                        placeholder="1234567890"
                                        value={paymentForm.accountNumber}
                                        onChange={(e) => setPaymentForm({ ...paymentForm, accountNumber: e.target.value })}
                                        className="font-mono"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label>Nama Pemilik Rekening</Label>
                                    <Input
                                        placeholder="Nama sesuai rekening"
                                        value={paymentForm.accountHolderName}
                                        onChange={(e) => setPaymentForm({ ...paymentForm, accountHolderName: e.target.value })}
                                    />
                                    <p className="text-xs text-zinc-400">Harus sesuai data bank</p>
                                </div>
                            </TabsContent>

                            <TabsContent value="ewallet" className="space-y-4 mt-4">
                                <div className="space-y-2">
                                    <Label>E-Wallet</Label>
                                    <Select value={paymentForm.bankCode} onValueChange={(v) => setPaymentForm({ ...paymentForm, bankCode: v })}>
                                        <SelectTrigger><SelectValue placeholder="Pilih e-wallet..." /></SelectTrigger>
                                        <SelectContent>
                                            {ewallets.map((ew) => (
                                                <SelectItem key={ew.key} value={ew.key}>{ew.name}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="space-y-2">
                                    <Label>No. Telepon</Label>
                                    <Input
                                        placeholder="08123456789"
                                        value={paymentForm.accountNumber}
                                        onChange={(e) => setPaymentForm({ ...paymentForm, accountNumber: e.target.value })}
                                        className="font-mono"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label>Nama Akun</Label>
                                    <Input
                                        placeholder="Nama pemilik akun"
                                        value={paymentForm.accountHolderName}
                                        onChange={(e) => setPaymentForm({ ...paymentForm, accountHolderName: e.target.value })}
                                    />
                                </div>
                            </TabsContent>
                        </Tabs>

                        <div className="bg-zinc-50 p-3 text-sm border border-zinc-200">
                            <div className="flex justify-between">
                                <span className="text-zinc-400">Biaya Transfer</span>
                                <span className="font-medium">Rp 2.775</span>
                            </div>
                            <div className="flex justify-between mt-1">
                                <span className="text-zinc-400">Total Charge</span>
                                <span className="font-bold">
                                    {activeBill ? formatIDR(activeBill.balanceDue + 2775) : "-"}
                                </span>
                            </div>
                        </div>
                    </div>

                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsPayOpen(false)} disabled={processing}>
                            Batal
                        </Button>
                        <Button onClick={handlePaySubmit} disabled={processing} className="bg-emerald-600 hover:bg-emerald-700 text-white">
                            {processing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            Konfirmasi Pembayaran
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

        </div>
    )
}
