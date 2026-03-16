"use client"

import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react"
import { useSearchParams } from "next/navigation"
import Image from "next/image"
import {
    Banknote,
    History,
    PenLine,
    PenTool,
    Landmark,
    Plus,
    ChevronDown,
    ChevronUp,
    Download,
    Loader2,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { NB } from "@/lib/dialog-styles"
import { recordVendorPayment } from "@/lib/actions/finance"
import { formatIDR } from "@/lib/utils"
import { toast } from "sonner"
import { useVendorPayments } from "@/hooks/use-vendor-payments"
import { useQueryClient } from "@tanstack/react-query"
import { queryKeys } from "@/lib/query-keys"
import { VendorMultiPaymentDialog } from "@/components/finance/vendor-multi-payment-dialog"
import { useBankAccounts } from "@/hooks/use-bank-accounts"
import { exportToExcel } from "@/lib/table-export"
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
    BANK_FORMATS,
    generateBankFile,
    downloadBankFile,
    getBankCode,
    type BankFormat,
    type PaymentExportRow,
} from "@/lib/bank-csv-generator"

type PaymentMethod = "TRANSFER" | "CHECK" | "GIRO" | "CASH"

interface PaymentMeta {
    signedBy?: string
    signedAt?: string
    method?: PaymentMethod
    checkNumber?: string
    checkBank?: string
    checkDate?: string
}

const parsePaymentMeta = (notes?: string): PaymentMeta => {
    if (!notes) return {}
    try {
        const parsed = JSON.parse(notes)
        if (typeof parsed === "object" && parsed) return parsed
    } catch { /* legacy notes string */ }
    return {}
}

export default function APCheckbookPage() {
    const searchParams = useSearchParams()
    const highlightPaymentId = searchParams.get("highlight")
    const { data, isLoading: loading } = useVendorPayments()
    const queryClient = useQueryClient()
    const payments = data?.payments ?? []
    const vendors = data?.vendors ?? []
    const openBills = data?.openBills ?? []
    const apBalances = data?.apBalances ?? []
    const [showForm, setShowForm] = useState(false)
    const [showMultiPay, setShowMultiPay] = useState(false)

    const [selectedVendorId, setSelectedVendorId] = useState("")
    const [amount, setAmount] = useState("")
    const [reference, setReference] = useState("")
    const [selectedBillId, setSelectedBillId] = useState("")
    const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("TRANSFER")
    const [bankAccountCode, setBankAccountCode] = useState("1010")
    const { data: bankAccounts } = useBankAccounts()
    const [checkNumber, setCheckNumber] = useState("")
    const [checkBank, setCheckBank] = useState("")
    const [checkDate, setCheckDate] = useState("")

    const [isSigned, setIsSigned] = useState(false)
    const [signatureDialogOpen, setSignatureDialogOpen] = useState(false)
    const [confirmOpen, setConfirmOpen] = useState(false)

    // Auto-scroll to highlighted payment from ?highlight= param
    useEffect(() => {
        if (!highlightPaymentId || loading) return
        const timer = setTimeout(() => {
            const el = document.querySelector(`[data-vendor-payment-id="${highlightPaymentId}"]`)
            if (el) el.scrollIntoView({ behavior: "smooth", block: "center" })
        }, 300)
        return () => clearTimeout(timer)
    }, [highlightPaymentId, loading])
    const [submitting, setSubmitting] = useState(false)
    const [signedBy, setSignedBy] = useState("")
    const [signatureDataUrl, setSignatureDataUrl] = useState("")
    const [draftSigner, setDraftSigner] = useState("")
    const [hasInk, setHasInk] = useState(false)

    const canvasRef = useRef<HTMLCanvasElement | null>(null)
    const isDrawingRef = useRef(false)

    const resetSignatureState = () => {
        setIsSigned(false)
        setSignedBy("")
        setSignatureDataUrl("")
        setHasInk(false)
    }

    const resetPaymentForm = () => {
        setSelectedVendorId("")
        setAmount("")
        setReference("")
        setSelectedBillId("")
        setPaymentMethod("TRANSFER")
        setCheckNumber("")
        setCheckBank("")
        setCheckDate("")
        setDraftSigner("")
        resetSignatureState()
    }

    useEffect(() => {
        if (!signatureDialogOpen) return
        const canvas = canvasRef.current
        if (!canvas) return
        const dpr = window.devicePixelRatio || 1
        const rect = canvas.getBoundingClientRect()
        canvas.width = Math.max(1, Math.floor(rect.width * dpr))
        canvas.height = Math.max(1, Math.floor(rect.height * dpr))
        const ctx = canvas.getContext("2d")
        if (!ctx) return
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
        ctx.clearRect(0, 0, rect.width, rect.height)
        ctx.strokeStyle = "#111111"
        ctx.lineWidth = 2
        ctx.lineCap = "round"
        ctx.lineJoin = "round"
        setHasInk(false)
    }, [signatureDialogOpen])

    const handleSign = () => {
        if (!selectedVendorId || !amount) {
            toast.error("Pilih vendor dan jumlah terlebih dahulu")
            return
        }
        if ((paymentMethod === "CHECK" || paymentMethod === "GIRO") && !checkNumber.trim()) {
            toast.error(paymentMethod === "GIRO" ? "Nomor giro wajib diisi untuk metode GIRO" : "Nomor cek wajib diisi untuk metode CHECK")
            return
        }
        setSignatureDialogOpen(true)
    }

    const getCanvasPoint = (event: ReactPointerEvent<HTMLCanvasElement>) => {
        const canvas = canvasRef.current
        if (!canvas) return null
        const rect = canvas.getBoundingClientRect()
        return { x: event.clientX - rect.left, y: event.clientY - rect.top }
    }

    const handlePointerDown = (event: ReactPointerEvent<HTMLCanvasElement>) => {
        const point = getCanvasPoint(event)
        if (!point) return
        const ctx = canvasRef.current?.getContext("2d")
        if (!ctx) return
        isDrawingRef.current = true
        ctx.beginPath()
        ctx.moveTo(point.x, point.y)
    }

    const handlePointerMove = (event: ReactPointerEvent<HTMLCanvasElement>) => {
        if (!isDrawingRef.current) return
        const point = getCanvasPoint(event)
        if (!point) return
        const ctx = canvasRef.current?.getContext("2d")
        if (!ctx) return
        ctx.lineTo(point.x, point.y)
        ctx.stroke()
        setHasInk(true)
    }

    const handlePointerUp = () => { isDrawingRef.current = false }

    const clearSignature = () => {
        const canvas = canvasRef.current
        if (!canvas) return
        const ctx = canvas.getContext("2d")
        if (!ctx) return
        const dpr = window.devicePixelRatio || 1
        ctx.clearRect(0, 0, canvas.width / dpr, canvas.height / dpr)
        setHasInk(false)
    }

    const applySignature = () => {
        const canvas = canvasRef.current
        if (!canvas || !draftSigner.trim() || !hasInk) {
            toast.error("Isi nama penandatangan dan tanda tangan terlebih dahulu")
            return
        }
        setSignatureDataUrl(canvas.toDataURL("image/png"))
        setSignedBy(draftSigner.trim())
        setIsSigned(true)
        setSignatureDialogOpen(false)
        toast.success("Tanda tangan berhasil")
    }

    const handleSubmit = async () => {
        const numericAmount = Number(amount)
        if (!selectedVendorId || !numericAmount || numericAmount <= 0) {
            toast.error("Vendor dan jumlah wajib diisi")
            return
        }
        if (!selectedBillId) {
            toast.error("Pilih tagihan vendor untuk mengalokasikan pembayaran")
            return
        }
        if ((paymentMethod === "CHECK" || paymentMethod === "GIRO") && !checkNumber.trim()) {
            toast.error(paymentMethod === "GIRO" ? "Nomor giro wajib diisi" : "Nomor cek wajib diisi")
            return
        }
        if (!isSigned || !signatureDataUrl || !signedBy) {
            toast.error("Otorisasi tanda tangan diperlukan")
            return
        }

        setSubmitting(true)
        try {
            const paymentMeta: PaymentMeta = {
                signedBy,
                signedAt: new Date().toISOString(),
                method: paymentMethod,
                checkNumber: (paymentMethod === "CHECK" || paymentMethod === "GIRO") ? checkNumber.trim() : undefined,
                checkBank: (paymentMethod === "CHECK" || paymentMethod === "GIRO") ? checkBank.trim() || undefined : undefined,
                checkDate: (paymentMethod === "CHECK" || paymentMethod === "GIRO") ? checkDate || undefined : undefined,
            }
            const result = await recordVendorPayment({
                supplierId: selectedVendorId,
                amount: numericAmount,
                method: paymentMethod as "CASH" | "TRANSFER" | "CHECK",
                bankAccountCode,
                reference: paymentMethod === "CHECK" ? checkNumber.trim() : reference.trim() || undefined,
                notes: JSON.stringify(paymentMeta),
            })
            if (result.success) {
                toast.success(`Payment ${"paymentNumber" in result ? result.paymentNumber : ""} recorded`)
                resetPaymentForm()
                setShowForm(false)
                queryClient.invalidateQueries({ queryKey: queryKeys.vendorPayments.all })
                queryClient.invalidateQueries({ queryKey: queryKeys.bills.all })
                queryClient.invalidateQueries({ queryKey: queryKeys.invoices.all })
                queryClient.invalidateQueries({ queryKey: queryKeys.financeDashboard.all })
                queryClient.invalidateQueries({ queryKey: queryKeys.journal.all })
                queryClient.invalidateQueries({ queryKey: queryKeys.financeReports.all })
                queryClient.invalidateQueries({ queryKey: queryKeys.accountTransactions.all })
                queryClient.invalidateQueries({ queryKey: queryKeys.chartAccounts.all })
            } else {
                toast.error(("error" in result ? result.error : "Failed to record payment") || "Failed to record payment")
            }
        } catch {
            toast.error("Terjadi kesalahan")
        } finally {
            setSubmitting(false)
        }
    }

    // KPI calculations
    const totalPayments = payments.length
    const transferCount = payments.filter(p => p.method === "TRANSFER").length
    const checkCount = payments.filter(p => p.method === "CHECK").length
    const totalPaid = payments.reduce((sum, p) => sum + p.amount, 0)

    // Bank CSV export handler
    const handleBankExport = (format: BankFormat) => {
        if (payments.length === 0) {
            toast.error("Tidak ada pembayaran untuk diekspor")
            return
        }
        const rows: PaymentExportRow[] = payments.map((p: any) => {
            const meta = parsePaymentMeta(p.notes)
            const bankName = p.vendor?.bankName || ""
            const d = new Date(p.date)
            const dd = String(d.getDate()).padStart(2, "0")
            const mm = String(d.getMonth() + 1).padStart(2, "0")
            const yyyy = d.getFullYear()
            return {
                transferDate: `${dd}/${mm}/${yyyy}`,
                beneficiaryAccount: p.vendor?.bankAccountNumber || "",
                beneficiaryName: p.vendor?.bankAccountName || p.vendor?.name || "",
                beneficiaryBank: bankName,
                beneficiaryBankCode: getBankCode(bankName),
                amount: Number(p.amount),
                remark: p.reference || meta.checkNumber || `Payment ${p.number}`,
                reference: p.number || "",
            }
        })
        const content = generateBankFile(rows, format)
        const today = new Date()
        const filename = `transfer-vendor-${today.getFullYear()}${String(today.getMonth() + 1).padStart(2, "0")}${String(today.getDate()).padStart(2, "0")}`
        downloadBankFile(content, filename, format)
        toast.success(`${rows.length} transaksi diekspor ke ${format.name}`)
    }

    if (loading && payments.length === 0) {
        return (
            <div className="mf-page flex items-center justify-center">
                <div className="text-[10px] font-black uppercase tracking-widest text-zinc-400 animate-pulse">Loading...</div>
            </div>
        )
    }

    const cashCount = payments.filter(p => p.method === "CASH").length

    return (
        <div className="mf-page">

            {/* ═══ UNIFIED CARD: Toolbar + KPI + Table ═══ */}
            <div className={NB.pageCard}>
                <div className={NB.pageAccent} />

                {/* Row 1: Toolbar */}
                <div className={`px-5 py-2.5 flex items-center justify-between ${NB.pageRowBorder}`}>
                    <p className="text-[11px] font-bold text-zinc-400">
                        Transfer & cek pembayaran vendor dengan otorisasi
                    </p>
                    <div className="flex items-center gap-0">
                        <Button
                            variant="outline"
                            onClick={() => {
                                const cols = [
                                    { header: "Vendor", accessorKey: "vendorName" },
                                    { header: "Jumlah", accessorKey: "amount" },
                                    { header: "Metode", accessorKey: "method" },
                                    { header: "Referensi", accessorKey: "reference" },
                                    { header: "No. Tagihan", accessorKey: "billNumber" },
                                    { header: "Tanggal", accessorKey: "date" },
                                ]
                                const rows = payments.map((p: any) => {
                                    const meta = parsePaymentMeta(p.notes)
                                    return {
                                        vendorName: p.vendor?.name || "-",
                                        amount: Number(p.amount),
                                        method: meta.method || p.method || "-",
                                        reference: p.reference || "-",
                                        billNumber: p.invoice?.number || "-",
                                        date: new Date(p.createdAt).toLocaleDateString("id-ID"),
                                    }
                                })
                                exportToExcel(cols, rows as Record<string, unknown>[], { filename: "pembayaran-ap" })
                            }}
                            className={`${NB.toolbarBtn} ${NB.toolbarBtnJoin}`}
                        >
                            <Download className="h-3.5 w-3.5 mr-1" /> Export
                        </Button>
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button
                                    variant="outline"
                                    disabled={payments.length === 0}
                                    className={`${NB.toolbarBtn} ${NB.toolbarBtnJoin}`}
                                >
                                    <Landmark className="h-3.5 w-3.5 mr-1" /> Download Transfer <ChevronDown className="ml-1 h-3 w-3" />
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="border border-zinc-300 shadow-md rounded-none">
                                {BANK_FORMATS.map((fmt) => (
                                    <DropdownMenuItem
                                        key={fmt.name}
                                        onClick={() => handleBankExport(fmt)}
                                        className="text-xs font-bold cursor-pointer"
                                    >
                                        <Download className="mr-2 h-3.5 w-3.5" />
                                        {fmt.name} (.{fmt.extension})
                                    </DropdownMenuItem>
                                ))}
                            </DropdownMenuContent>
                        </DropdownMenu>
                        <Button
                            variant="outline"
                            onClick={() => setShowMultiPay(true)}
                            className={NB.toolbarBtn}
                        >
                            <Banknote className="h-3.5 w-3.5 mr-1" /> Multi-Bayar
                        </Button>
                        <Button
                            onClick={() => setShowForm(!showForm)}
                            className={NB.toolbarBtnPrimary}
                        >
                            {showForm ? <><ChevronUp className="h-3.5 w-3.5 mr-1" /> Tutup</> : <><Plus className="h-3.5 w-3.5 mr-1" /> Buat Pembayaran</>}
                        </Button>
                    </div>
                </div>

                {/* Row 2: KPI Strip */}
                <div className={`${NB.kpiStrip} ${NB.pageRowBorder}`}>
                    {[
                        { label: "Total Bayar", count: totalPayments, amount: formatIDR(totalPaid), dot: "bg-orange-500" },
                        { label: "Transfer", count: transferCount, amount: null, dot: "bg-blue-500" },
                        { label: "Cek/Giro", count: checkCount, amount: null, dot: "bg-amber-500" },
                        { label: "Kas", count: cashCount, amount: null, dot: "bg-zinc-400" },
                    ].map((kpi) => (
                        <div key={kpi.label} className={NB.kpiCell}>
                            <div className="flex items-center gap-1.5">
                                <span className={`w-2 h-2 ${kpi.dot}`} />
                                <span className={NB.kpiLabel}>{kpi.label}</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <span className={NB.kpiCount}>{kpi.count}</span>
                                {kpi.amount && <span className={NB.kpiAmount}>{kpi.amount}</span>}
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* ═══ PAYMENT FORM (Collapsible) ═══ */}
            {showForm && (
                <div className="bg-white dark:bg-zinc-900 border-2 border-black shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] overflow-hidden">
                    <div className="px-4 py-3 border-b-2 border-black bg-zinc-50 dark:bg-zinc-800">
                        <p className="text-[10px] font-black uppercase tracking-widest text-zinc-500 flex items-center gap-2">
                            <PenLine className="h-3.5 w-3.5" /> Form Pembayaran Baru
                        </p>
                    </div>
                    <div className="p-4 space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div className="space-y-2">
                                <Label className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Vendor</Label>
                                <Select value={selectedVendorId} onValueChange={(v) => { setSelectedVendorId(v); setSelectedBillId(""); resetSignatureState() }}>
                                    <SelectTrigger className="border-2 border-black h-10 font-bold rounded-none">
                                        <SelectValue placeholder="Pilih vendor..." />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {vendors.map((v) => <SelectItem key={v.id} value={v.id}>{v.name}</SelectItem>)}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-2">
                                <Label className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Jumlah (Rp)</Label>
                                <Input
                                    value={amount}
                                    onChange={(e) => { setAmount(e.target.value); resetSignatureState() }}
                                    placeholder="0"
                                    className="border-2 border-black font-mono font-black h-10 text-right rounded-none"
                                />
                            </div>
                            <div className="space-y-2">
                                <Label className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Metode</Label>
                                <Select value={paymentMethod} onValueChange={(v: PaymentMethod) => {
                                    setPaymentMethod(v)
                                    setBankAccountCode(v === "CASH" ? "1000" : "1010")
                                    resetSignatureState()
                                }}>
                                    <SelectTrigger className="border-2 border-black h-10 font-bold rounded-none">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="TRANSFER">Transfer Bank</SelectItem>
                                        <SelectItem value="CHECK">Cek</SelectItem>
                                        <SelectItem value="GIRO">Giro</SelectItem>
                                        <SelectItem value="CASH">Tunai</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-2">
                                <Label className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Akun Pembayaran <span className="text-red-500">*</span></Label>
                                <Select value={bankAccountCode} onValueChange={(v) => { setBankAccountCode(v); resetSignatureState() }}>
                                    <SelectTrigger className="border-2 border-black h-10 font-bold rounded-none">
                                        <SelectValue placeholder="Pilih akun..." />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {(bankAccounts || []).map(acc => (
                                            <SelectItem key={acc.code} value={acc.code}>
                                                {acc.code} — {acc.name}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>

                        {(paymentMethod === "CHECK" || paymentMethod === "GIRO") && (
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-3 border-2 border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800">
                                <div className="space-y-2">
                                    <Label className="text-[10px] font-black uppercase tracking-widest text-zinc-500">{paymentMethod === "GIRO" ? "No. Giro" : "No. Cek"}</Label>
                                    <Input value={checkNumber} onChange={(e) => { setCheckNumber(e.target.value); resetSignatureState() }} placeholder={paymentMethod === "GIRO" ? "GR-000123" : "CHK-000123"} className="border-2 border-black h-9 rounded-none" />
                                </div>
                                <div className="space-y-2">
                                    <Label className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Bank</Label>
                                    <Input value={checkBank} onChange={(e) => { setCheckBank(e.target.value); resetSignatureState() }} placeholder="BCA / CIMB" className="border-2 border-black h-9 rounded-none" />
                                </div>
                                <div className="space-y-2">
                                    <Label className="text-[10px] font-black uppercase tracking-widest text-zinc-500">{paymentMethod === "GIRO" ? "Tanggal Jatuh Tempo" : "Tanggal Cek"}</Label>
                                    <Input type="date" value={checkDate} onChange={(e) => { setCheckDate(e.target.value); resetSignatureState() }} className="border-2 border-black h-9 rounded-none" />
                                </div>
                            </div>
                        )}

                        {/* Bill Allocation */}
                        <div className="space-y-2">
                            <Label className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Tagihan Vendor <span className="text-red-500">*</span></Label>
                            <Select value={selectedBillId} onValueChange={(v) => { setSelectedBillId(v); resetSignatureState() }}>
                                <SelectTrigger className="border-2 border-black h-10 font-bold rounded-none">
                                    <SelectValue placeholder="Pilih tagihan vendor..." />
                                </SelectTrigger>
                                <SelectContent>
                                    {openBills
                                        .filter((b: any) => !selectedVendorId || b.vendor?.id === selectedVendorId)
                                        .map((b: any) => (
                                            <SelectItem key={b.id} value={b.id}>
                                                {b.number} — {b.vendor?.name ?? "?"} — Sisa: {formatIDR(b.balanceDue)} {b.isOverdue ? "⚠️" : ""}
                                            </SelectItem>
                                        ))}
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Referensi / Memo</Label>
                                <Input value={reference} onChange={(e) => { setReference(e.target.value); resetSignatureState() }} placeholder="Invoice # / transfer ref..." className="border-2 border-black h-10 rounded-none" />
                            </div>
                            <div className="space-y-2">
                                <Label className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Otorisasi</Label>
                                <div className="flex items-center gap-2">
                                    {isSigned ? (
                                        <div className="flex items-center gap-3 border-2 border-black px-3 py-1.5 bg-emerald-50 flex-1">
                                            <Image src={signatureDataUrl} alt="signature" width={80} height={24} className="h-6 w-auto object-contain" />
                                            <span className="text-[10px] font-black uppercase text-emerald-700">Signed: {signedBy}</span>
                                        </div>
                                    ) : (
                                        <div className="flex-1 border-2 border-dashed border-zinc-300 px-3 py-2 text-center">
                                            <span className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Belum ditandatangani</span>
                                        </div>
                                    )}
                                    <Button
                                        variant="outline"
                                        onClick={handleSign}
                                        className="border-2 border-black text-[10px] font-black uppercase tracking-widest h-10 rounded-none"
                                    >
                                        <PenLine className="mr-2 h-3.5 w-3.5" /> {isSigned ? "Ulang" : "Tanda Tangan"}
                                    </Button>
                                </div>
                            </div>
                        </div>

                        {/* Submit */}
                        <div className="flex justify-end pt-2">
                            <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
                                <DialogTrigger asChild>
                                    <Button
                                        disabled={!isSigned || submitting || !amount || !selectedVendorId || ((paymentMethod === "CHECK" || paymentMethod === "GIRO") && !checkNumber.trim())}
                                        className="bg-emerald-600 text-white hover:bg-emerald-700 border-2 border-black shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] active:translate-y-[1px] active:shadow-none transition-all text-[10px] font-black uppercase tracking-widest h-10 px-8 disabled:opacity-40"
                                    >
                                        {submitting ? "Processing..." : "Eksekusi Pembayaran"}
                                    </Button>
                                </DialogTrigger>
                                <DialogContent className={NB.contentNarrow}>
                                    <DialogHeader className={NB.header}>
                                        <DialogTitle className={NB.title}><Banknote className="h-5 w-5" /> Konfirmasi Pembayaran AP</DialogTitle>
                                        <p className={NB.subtitle}>Verifikasi detail sebelum eksekusi pembayaran</p>
                                    </DialogHeader>
                                    <div className="px-6 py-5 space-y-4">
                                        <div className="space-y-3">
                                            <div className="flex items-center justify-between">
                                                <label className={NB.label}>Metode</label>
                                                <span className="text-sm font-bold">{paymentMethod}{paymentMethod === "CHECK" ? ` — No. Cek: ${checkNumber}` : paymentMethod === "GIRO" ? ` — No. Giro: ${checkNumber}` : ""}</span>
                                            </div>
                                            <div className="flex items-center justify-between">
                                                <label className={NB.label}>Vendor</label>
                                                <span className="text-sm font-bold truncate ml-4">{vendors.find(v => v.id === selectedVendorId)?.name || "-"}</span>
                                            </div>
                                            <div className="flex items-center justify-between">
                                                <label className={NB.label}>Jumlah</label>
                                                <div className="relative">
                                                    <span className="font-mono font-black text-lg text-emerald-700">{formatIDR(Number(amount || 0))}</span>
                                                </div>
                                            </div>
                                        </div>
                                        <div className={NB.footer}>
                                            <Button type="button" variant="outline" onClick={() => setConfirmOpen(false)} className={NB.cancelBtn}>Batal</Button>
                                            <Button
                                                onClick={async () => { await handleSubmit(); setConfirmOpen(false) }}
                                                disabled={submitting}
                                                className={NB.submitBtn}
                                            >
                                                {submitting ? <><Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" /> Processing...</> : "Konfirmasi & Eksekusi"}
                                            </Button>
                                        </div>
                                    </div>
                                </DialogContent>
                            </Dialog>
                        </div>
                    </div>
                </div>
            )}

            {/* ═══ SIGNATURE DIALOG ═══ */}
            <Dialog open={signatureDialogOpen} onOpenChange={setSignatureDialogOpen}>
                <DialogContent className={NB.contentNarrow}>
                    <DialogHeader className={NB.header}>
                        <DialogTitle className={NB.title}><PenTool className="h-5 w-5" /> Otorisasi Tanda Tangan</DialogTitle>
                        <p className={NB.subtitle}>Masukkan nama accountant lalu tanda tangan untuk mengotorisasi pembayaran AP</p>
                    </DialogHeader>
                    <div className="px-6 py-5 space-y-4">
                        <div className="space-y-1.5">
                            <label className={NB.label}>Nama Penandatangan <span className={NB.labelRequired}>*</span></label>
                            <Input value={draftSigner} onChange={(e) => setDraftSigner(e.target.value)} placeholder="Nama..." className={NB.input} />
                        </div>
                        <div className="space-y-1.5">
                            <label className={NB.label}>Tanda Tangan <span className={NB.labelRequired}>*</span></label>
                            <canvas
                                ref={canvasRef}
                                width={520}
                                height={160}
                                className="w-full h-40 border-2 border-black bg-white touch-none rounded-none"
                                onPointerDown={handlePointerDown}
                                onPointerMove={handlePointerMove}
                                onPointerUp={handlePointerUp}
                                onPointerLeave={handlePointerUp}
                            />
                        </div>
                        <div className={NB.footer}>
                            <Button type="button" variant="outline" onClick={clearSignature} className={NB.cancelBtn}>Hapus</Button>
                            <Button type="button" onClick={applySignature} className={NB.submitBtn}>Simpan</Button>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>

            {/* ═══ MULTI-PAYMENT DIALOG ═══ */}
            <VendorMultiPaymentDialog
                open={showMultiPay}
                onOpenChange={setShowMultiPay}
                vendors={vendors}
                openBills={openBills}
                vendorAPBalances={apBalances}
            />

            {/* ═══ PAYMENT HISTORY (inside unified card) ═══ */}
            <div className={NB.pageCard}>
                <div className={NB.pageAccent} />

                {/* Table header row */}
                <div className="grid grid-cols-12 gap-2 px-4 py-2 bg-zinc-50/80 dark:bg-zinc-800/30 border-b border-zinc-200 dark:border-zinc-700 text-[9px] font-black uppercase tracking-widest text-zinc-400">
                    <div className="col-span-2">No.</div>
                    <div className="col-span-3">Vendor</div>
                    <div className="col-span-1 text-center">Metode</div>
                    <div className="col-span-2">Referensi</div>
                    <div className="col-span-2">Penandatangan</div>
                    <div className="col-span-2 text-right">Jumlah</div>
                </div>

                {payments.length === 0 ? (
                    <div className="py-12 text-center">
                        <History className="h-6 w-6 mx-auto text-zinc-200 dark:text-zinc-700 mb-2" />
                        <p className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Belum ada riwayat pembayaran</p>
                    </div>
                ) : (
                    payments.map((p, idx) => {
                        const meta = parsePaymentMeta(p.notes)
                        return (
                            <div key={p.id} data-vendor-payment-id={p.id} className={`grid grid-cols-12 gap-2 px-4 py-2.5 border-b border-zinc-100 dark:border-zinc-800 hover:bg-orange-50/30 dark:hover:bg-orange-950/10 transition-colors items-center ${
                                highlightPaymentId === p.id ? "bg-emerald-50 dark:bg-emerald-950/30 border-l-4 border-l-emerald-500" : idx % 2 !== 0 ? "bg-zinc-50/40 dark:bg-zinc-800/10" : ""
                            }`}>
                                <div className="col-span-2">
                                    <span className="font-mono text-[11px] font-bold text-zinc-600 dark:text-zinc-300">{p.number}</span>
                                    <p className="text-[10px] text-zinc-400">{new Date(p.date).toLocaleDateString("id-ID")}</p>
                                </div>
                                <div className="col-span-3">
                                    <p className="font-bold text-sm truncate text-zinc-900 dark:text-zinc-100">{p.vendor?.name}</p>
                                </div>
                                <div className="col-span-1 text-center">
                                    <span className="inline-flex items-center px-1.5 py-0.5 text-[8px] font-black uppercase tracking-widest border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800">
                                        {p.method}
                                    </span>
                                </div>
                                <div className="col-span-2">
                                    <span className="font-mono text-[11px] text-zinc-500">{p.reference || meta.checkNumber || "-"}</span>
                                </div>
                                <div className="col-span-2">
                                    {meta.signedBy && <span className="text-[10px] font-bold text-zinc-600 dark:text-zinc-400">{meta.signedBy}</span>}
                                </div>
                                <div className="col-span-2 text-right">
                                    <span className="font-mono font-bold text-sm text-red-600 dark:text-red-400 tabular-nums">{formatIDR(p.amount)}</span>
                                </div>
                            </div>
                        )
                    })
                )}

                {/* Table footer */}
                {payments.length > 0 && (
                    <div className="px-4 py-2 bg-zinc-50/80 dark:bg-zinc-800/30 border-t border-zinc-200 dark:border-zinc-700 flex items-center justify-between">
                        <span className="text-[10px] font-bold text-zinc-400">{payments.length} pembayaran</span>
                        <span className="font-mono font-black text-sm text-red-600 dark:text-red-400 tabular-nums">Total: {formatIDR(totalPaid)}</span>
                    </div>
                )}
            </div>
        </div>
    )
}
