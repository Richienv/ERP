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
    Search
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
    Card,
    CardContent
} from "@/components/ui/card"
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
    const [billMeta, setBillMeta] = useState({ page: 1, pageSize: 12, total: 0, totalPages: 1 })
    const [queryState, setQueryState] = useState({ q: "", status: "__all__" })
    const [activeBill, setActiveBill] = useState<VendorBill | null>(null)
    const [stamped, setStamped] = useState(false)
    const [loading, setLoading] = useState(true)
    const [processing, setProcessing] = useState(false)

    // Banks data
    const [banks, setBanks] = useState<BankOption[]>([])
    const [ewallets, setEwallets] = useState<BankOption[]>([])

    // Dialog States
    const [isPayOpen, setIsPayOpen] = useState(false)
    const [isDisputeOpen, setIsDisputeOpen] = useState(false)
    const [disputeReason, setDisputeReason] = useState("")

    // Payment form
    const [paymentForm, setPaymentForm] = useState({
        bankCode: "",
        accountNumber: "",
        accountHolderName: "",
        description: ""
    })
    const router = useRouter()
    const pathname = usePathname()
    const searchParams = useSearchParams()

    useEffect(() => {
        loadBills()
    }, [searchParams.toString()])

    useEffect(() => {
        loadBanks()
    }, [])

    useEffect(() => {
        if (activeBill && activeBill.vendor) {
            // Pre-fill from vendor data if available
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
                pageSize: Number(searchParams.get("size") || "12"),
            }
            const data = await getVendorBillsRegistry(query)
            setBills(data.rows)
            setBillMeta(data.meta)
            setQueryState({
                q: data.query.q || "",
                status: data.query.status || "__all__",
            })
            if (data.rows.length > 0 && (!activeBill || !data.rows.some((row) => row.id === activeBill.id))) {
                setActiveBill(data.rows[0])
            } else if (data.rows.length === 0) {
                setActiveBill(null)
            }
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

        // Validation
        if (!paymentForm.bankCode) {
            toast.error("Please select a bank")
            return
        }
        if (!paymentForm.accountNumber) {
            toast.error("Please enter account number")
            return
        }
        if (!paymentForm.accountHolderName) {
            toast.error("Please enter account holder name")
            return
        }

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

                setTimeout(() => {
                    setStamped(false)
                    loadBills()
                }, 2000)
            } else {
                toast.error('error' in result ? result.error : "Failed to process payment")
            }
        } catch (error: any) {
            toast.error(error.message || "An error occurred")
        } finally {
            setProcessing(false)
        }
    }

    if (loading && bills.length === 0) {
        return (
            <div className="p-8 flex items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
        )
    }

    return (
        <div className="flex-1 space-y-6 p-4 md:p-8 pt-6 font-sans h-[calc(100vh-theme(spacing.16))] flex flex-col">

            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 shrink-0">
                <div>
                    <h2 className="text-3xl font-black font-serif tracking-tight text-black flex items-center gap-2">
                        Tagihan Vendor
                    </h2>
                    <p className="text-muted-foreground mt-1 font-medium">Review, approve, and pay vendor invoices via Xendit.</p>
                </div>
                <Button className="bg-red-600 text-white hover:bg-red-700 border border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] uppercase font-bold tracking-wide transition-all active:translate-y-1 active:shadow-none">
                    <Plus className="mr-2 h-4 w-4" /> Scan New Bill
                </Button>
            </div>

            <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 gap-8 min-h-0 items-start">

                {/* Left: Bill List */}
                <div className="lg:col-span-4 space-y-4 overflow-y-auto h-full pr-2">
                    <div className="rounded-lg border bg-white p-3 space-y-3">
                        <div className="relative">
                            <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-zinc-400" />
                            <Input
                                className="pl-9"
                                placeholder="Cari nomor bill / vendor..."
                                value={queryState.q}
                                onChange={(e) => setQueryState((prev) => ({ ...prev, q: e.target.value }))}
                            />
                        </div>
                        <div className="flex items-center gap-2">
                            <Select value={queryState.status} onValueChange={(value) => setQueryState((prev) => ({ ...prev, status: value }))}>
                                <SelectTrigger className="h-9">
                                    <SelectValue placeholder="Semua status" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="__all__">Semua Status</SelectItem>
                                    <SelectItem value="DRAFT">Draft</SelectItem>
                                    <SelectItem value="ISSUED">Issued</SelectItem>
                                    <SelectItem value="PARTIAL">Partial</SelectItem>
                                    <SelectItem value="OVERDUE">Overdue</SelectItem>
                                    <SelectItem value="DISPUTED">Disputed</SelectItem>
                                </SelectContent>
                            </Select>
                            <Button size="sm" variant="secondary" onClick={applyFilters}>Terapkan</Button>
                        </div>
                        <div className="text-xs text-zinc-500 flex justify-between">
                            <span>Total {billMeta.total}</span>
                            <span>Page {billMeta.page}/{billMeta.totalPages}</span>
                        </div>
                    </div>
                    <h3 className="font-black uppercase text-sm text-zinc-500 mb-2">Pending ({billMeta.total})</h3>
                    {bills.length === 0 ? (
                        <div className="p-4 border-2 border-dashed border-zinc-200 rounded-lg text-center text-zinc-400 font-medium">
                            <CheckCircle2 className="h-8 w-8 mx-auto mb-2 text-emerald-500" />
                            All bills are paid!
                        </div>
                    ) : (
                        bills.map((bill) => (
                            <div
                                key={bill.id}
                                onClick={() => { setActiveBill(bill); setStamped(false); }}
                                className={`group cursor-pointer relative ${activeBill && bill.id === activeBill.id ? 'z-10' : 'z-0'}`}
                            >
                                <Card className={`border-2 transition-all ${activeBill && bill.id === activeBill.id ? 'border-black bg-white shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] translate-x-2' : 'border-black/10 bg-zinc-50 hover:bg-white hover:border-black/50'}`}>
                                    {bill.isOverdue && (
                                        <div className="absolute -top-2 -right-2 bg-red-500 text-white text-[10px] font-black uppercase px-2 py-0.5 rotate-12 shadow-sm z-20">
                                            Overdue
                                        </div>
                                    )}
                                    {bill.status === 'DISPUTED' && (
                                        <div className="absolute -top-2 -right-2 bg-amber-500 text-white text-[10px] font-black uppercase px-2 py-0.5 rotate-12 shadow-sm z-20">
                                            Disputed
                                        </div>
                                    )}
                                    <CardContent className="p-4">
                                        <div className="flex justify-between items-start mb-2">
                                            <Badge variant="outline" className="font-mono font-bold text-[10px]">{bill.number}</Badge>
                                            <span className="text-xs font-bold text-muted-foreground">{new Date(bill.dueDate).toLocaleDateString('id-ID')}</span>
                                        </div>
                                        <h4 className="font-black text-sm truncate">{bill.vendor?.name || 'Unknown Vendor'}</h4>
                                        <p className="text-lg font-bold text-black/80">{formatIDR(bill.amount)}</p>
                                    </CardContent>
                                </Card>
                            </div>
                        ))
                    )}
                    <div className="flex items-center justify-between gap-2 pt-2">
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setPage(billMeta.page - 1)}
                            disabled={billMeta.page <= 1}
                        >
                            Prev
                        </Button>
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setPage(billMeta.page + 1)}
                            disabled={billMeta.page >= billMeta.totalPages}
                        >
                            Next
                        </Button>
                    </div>
                </div>

                {/* Right: Active Bill Detail */}
                <div className="lg:col-span-8 h-full flex flex-col">
                    {activeBill ? (
                        <Card className="flex-1 border-4 border-black shadow-[12px_12px_0px_0px_rgba(0,0,0,1)] bg-white relative overflow-hidden flex flex-col">

                            {/* Background Pattern */}
                            <div className="absolute inset-0 opacity-[0.03] pointer-events-none" style={{ backgroundImage: 'radial-gradient(circle, #000 1px, transparent 1px)', backgroundSize: '20px 20px' }} />

                            <div className="p-8 flex-1 relative z-10">
                                {/* Stamp Animation */}
                                {stamped && (
                                    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-50 animate-in zoom-in-50 duration-300">
                                        <div className="border-8 border-emerald-600 text-emerald-600 font-black text-6xl uppercase px-8 py-4 -rotate-12 opacity-80 mix-blend-multiply tracking-widest">
                                            PAID
                                        </div>
                                    </div>
                                )}

                                <div className="flex justify-between items-start border-b-2 border-black pb-6 mb-6">
                                    <div>
                                        <h1 className="text-4xl font-black font-serif uppercase tracking-tighter">{activeBill.vendor?.name}</h1>
                                        <p className="text-lg font-medium text-zinc-500 mt-1">
                                            Invoice #{activeBill.number} • Due {new Date(activeBill.dueDate).toLocaleDateString('id-ID')}
                                        </p>
                                    </div>
                                    <div className="text-right">
                                        <p className="text-sm font-bold uppercase text-zinc-400">Total Amount</p>
                                        <p className="text-5xl font-black tracking-tighter mt-1">{formatIDR(activeBill.amount)}</p>
                                    </div>
                                </div>

                                {/* Bill Details */}
                                <div className="space-y-6">
                                    <div className="grid grid-cols-2 gap-8">
                                        <div>
                                            <h3 className="text-xs font-black uppercase text-zinc-400 mb-2 tracking-widest">Status</h3>
                                            <Badge className={`px-4 py-1 uppercase font-bold text-sm tracking-wide ${activeBill.status === 'PAID' ? 'bg-emerald-600' :
                                                activeBill.status === 'DISPUTED' ? 'bg-amber-500' : 'bg-black'
                                                } text-white`}>
                                                {activeBill.status}
                                            </Badge>
                                        </div>
                                        <div>
                                            <h3 className="text-xs font-black uppercase text-zinc-400 mb-2 tracking-widest">Balance Due</h3>
                                            <p className="text-2xl font-black text-red-600">{formatIDR(activeBill.balanceDue)}</p>
                                        </div>
                                    </div>

                                    {/* Vendor Bank Info */}
                                    {activeBill.vendor?.bankAccountNumber && (
                                        <div className="bg-zinc-50 p-6 border-2 border-black/5 rounded-xl">
                                            <div className="flex items-center gap-3 mb-4">
                                                <Building2 className="h-5 w-5 text-black" />
                                                <h3 className="font-black uppercase text-sm tracking-wide">Saved Bank Details</h3>
                                            </div>
                                            <div className="grid grid-cols-3 gap-4 text-sm">
                                                <div>
                                                    <p className="text-zinc-400 font-medium">Bank</p>
                                                    <p className="font-bold">{activeBill.vendor.bankName || '-'}</p>
                                                </div>
                                                <div>
                                                    <p className="text-zinc-400 font-medium">Account Number</p>
                                                    <p className="font-bold font-mono">{activeBill.vendor.bankAccountNumber}</p>
                                                </div>
                                                <div>
                                                    <p className="text-zinc-400 font-medium">Account Name</p>
                                                    <p className="font-bold">{activeBill.vendor.bankAccountName || '-'}</p>
                                                </div>
                                            </div>
                                        </div>
                                    )}

                                    <div className="bg-zinc-50 p-6 border-2 border-black/5 rounded-xl">
                                        <div className="flex items-center gap-3 mb-4">
                                            <Receipt className="h-5 w-5 text-black" />
                                            <h3 className="font-black uppercase text-sm tracking-wide">Payment Info</h3>
                                        </div>
                                        <p className="font-medium text-zinc-600">
                                            Payment will be processed via <strong>Xendit</strong>.
                                            Funds will be transferred directly to the vendor's bank account.
                                        </p>
                                    </div>
                                </div>
                            </div>

                            {/* Action Footer */}
                            <div className="bg-zinc-100 p-6 border-t-4 border-black flex items-center justify-between gap-6 relative z-20">
                                <div className="flex gap-4">
                                    <Button
                                        variant="outline"
                                        onClick={() => setIsDisputeOpen(true)}
                                        disabled={activeBill.status === 'PAID'}
                                        className="h-14 px-8 border-2 border-zinc-300 text-zinc-500 hover:border-red-500 hover:text-red-600 uppercase font-black text-lg"
                                    >
                                        <XCircle className="mr-2 h-6 w-6" /> Dispute
                                    </Button>
                                </div>
                                <div className="flex gap-4">
                                    <Button
                                        onClick={() => setIsPayOpen(true)}
                                        disabled={activeBill.status === 'PAID' || activeBill.balanceDue <= 0}
                                        className="h-14 px-10 bg-emerald-600 text-white hover:bg-emerald-700 hover:scale-105 border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] uppercase font-black text-xl tracking-widest transition-all active:translate-y-1 active:shadow-none disabled:opacity-50"
                                    >
                                        <CreditCard className="mr-3 h-6 w-6" /> PAY NOW
                                    </Button>
                                </div>
                            </div>
                        </Card>
                    ) : (
                        <div className="flex-1 flex items-center justify-center border-4 border-dashed border-zinc-200 rounded-2xl">
                            <p className="text-zinc-400 font-bold text-lg uppercase tracking-widest italic">Select a bill to review</p>
                        </div>
                    )}
                </div>
            </div>

            {/* Dispute Dialog */}
            <Dialog open={isDisputeOpen} onOpenChange={setIsDisputeOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <AlertCircle className="h-5 w-5 text-amber-500" />
                            Dispute Bill
                        </DialogTitle>
                        <DialogDescription>
                            Please provide a reason for disputing this bill. The vendor will be notified.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                        <div className="space-y-2">
                            <Label htmlFor="reason">Reason</Label>
                            <Textarea
                                id="reason"
                                placeholder="e.g. Incorrect amount, Damaged goods, Wrong invoice..."
                                value={disputeReason}
                                onChange={(e) => setDisputeReason(e.target.value)}
                                rows={4}
                            />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsDisputeOpen(false)} disabled={processing}>
                            Cancel
                        </Button>
                        <Button variant="destructive" onClick={handleDisputeSubmit} disabled={processing}>
                            {processing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            Submit Dispute
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Pay Dialog */}
            <Dialog open={isPayOpen} onOpenChange={setIsPayOpen}>
                <DialogContent className="sm:max-w-[500px]">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <CreditCard className="h-5 w-5 text-emerald-600" />
                            Pay via Xendit
                        </DialogTitle>
                        <DialogDescription>
                            Confirm payment details. Funds will be transferred via Xendit.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-4 py-4">
                        {/* Amount Display */}
                        <div className="bg-emerald-50 border-2 border-emerald-200 rounded-lg p-4 text-center">
                            <p className="text-sm font-medium text-emerald-700">Amount to Pay</p>
                            <p className="text-3xl font-black text-emerald-700">
                                {activeBill ? formatIDR(activeBill.balanceDue) : '-'}
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
                                    <Select
                                        value={paymentForm.bankCode}
                                        onValueChange={(v) => setPaymentForm({ ...paymentForm, bankCode: v })}
                                    >
                                        <SelectTrigger>
                                            <SelectValue placeholder="Select bank..." />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {banks.map((bank) => (
                                                <SelectItem key={bank.key} value={bank.key}>
                                                    {bank.name}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>

                                <div className="space-y-2">
                                    <Label>Account Number</Label>
                                    <Input
                                        placeholder="1234567890"
                                        value={paymentForm.accountNumber}
                                        onChange={(e) => setPaymentForm({ ...paymentForm, accountNumber: e.target.value })}
                                        className="font-mono"
                                    />
                                </div>

                                <div className="space-y-2">
                                    <Label>Account Holder Name</Label>
                                    <Input
                                        placeholder="Nama sesuai rekening"
                                        value={paymentForm.accountHolderName}
                                        onChange={(e) => setPaymentForm({ ...paymentForm, accountHolderName: e.target.value })}
                                    />
                                    <p className="text-xs text-muted-foreground">Must match exactly with bank records</p>
                                </div>
                            </TabsContent>

                            <TabsContent value="ewallet" className="space-y-4 mt-4">
                                <div className="space-y-2">
                                    <Label>E-Wallet</Label>
                                    <Select
                                        value={paymentForm.bankCode}
                                        onValueChange={(v) => setPaymentForm({ ...paymentForm, bankCode: v })}
                                    >
                                        <SelectTrigger>
                                            <SelectValue placeholder="Select e-wallet..." />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {ewallets.map((ew) => (
                                                <SelectItem key={ew.key} value={ew.key}>
                                                    {ew.name}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>

                                <div className="space-y-2">
                                    <Label>Phone Number</Label>
                                    <Input
                                        placeholder="08123456789"
                                        value={paymentForm.accountNumber}
                                        onChange={(e) => setPaymentForm({ ...paymentForm, accountNumber: e.target.value })}
                                        className="font-mono"
                                    />
                                </div>

                                <div className="space-y-2">
                                    <Label>Account Name</Label>
                                    <Input
                                        placeholder="Nama pemilik akun"
                                        value={paymentForm.accountHolderName}
                                        onChange={(e) => setPaymentForm({ ...paymentForm, accountHolderName: e.target.value })}
                                    />
                                </div>
                            </TabsContent>
                        </Tabs>

                        {/* Fee Info */}
                        <div className="bg-zinc-50 rounded-lg p-3 text-sm">
                            <div className="flex justify-between">
                                <span className="text-muted-foreground">Transfer Fee</span>
                                <span className="font-medium">Rp 2.775</span>
                            </div>
                            <div className="flex justify-between mt-1">
                                <span className="text-muted-foreground">Total Charge</span>
                                <span className="font-bold">
                                    {activeBill ? formatIDR(activeBill.balanceDue + 2775) : '-'}
                                </span>
                            </div>
                        </div>
                    </div>

                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsPayOpen(false)} disabled={processing}>
                            Cancel
                        </Button>
                        <Button onClick={handlePaySubmit} disabled={processing} className="bg-emerald-600 hover:bg-emerald-700 text-white">
                            {processing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            Confirm Payment
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

        </div>
    )
}
