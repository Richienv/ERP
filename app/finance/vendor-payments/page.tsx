"use client"

import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react"
import Image from "next/image"
import { Banknote, ChevronRight, History, PenLine, Landmark, ReceiptText } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { getVendorPayments, recordVendorPayment, type VendorPayment } from "@/lib/actions/finance"
import { getVendors } from "@/lib/actions/procurement"
import { formatIDR } from "@/lib/utils"
import { toast } from "sonner"

type PaymentMethod = "TRANSFER" | "CHECK" | "CASH"

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
        if (typeof parsed === "object" && parsed) {
            return parsed
        }
    } catch {
        // legacy notes string
    }
    return {}
}

export default function APCheckbookPage() {
    const [payments, setPayments] = useState<VendorPayment[]>([])
    const [vendors, setVendors] = useState<any[]>([])

    const [selectedVendorId, setSelectedVendorId] = useState("")
    const [amount, setAmount] = useState("")
    const [reference, setReference] = useState("")
    const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("TRANSFER")
    const [checkNumber, setCheckNumber] = useState("")
    const [checkBank, setCheckBank] = useState("")
    const [checkDate, setCheckDate] = useState("")

    const [isSigned, setIsSigned] = useState(false)
    const [signatureDialogOpen, setSignatureDialogOpen] = useState(false)
    const [confirmOpen, setConfirmOpen] = useState(false)
    const [loading, setLoading] = useState(true)
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
        setPaymentMethod("TRANSFER")
        setCheckNumber("")
        setCheckBank("")
        setCheckDate("")
        setDraftSigner("")
        resetSignatureState()
    }

    useEffect(() => {
        loadData()
    }, [])

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

    async function loadData() {
        setLoading(true)
        const [payData, venData] = await Promise.all([getVendorPayments(), getVendors()])
        setPayments(payData)
        setVendors(venData)
        setLoading(false)
    }

    const handleSign = () => {
        if (!selectedVendorId || !amount) {
            toast.error("Please select vendor and amount first")
            return
        }
        if (paymentMethod === "CHECK" && !checkNumber.trim()) {
            toast.error("Check number is required for CHECK payment")
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

    const handlePointerUp = () => {
        isDrawingRef.current = false
    }

    const clearSignature = () => {
        const canvas = canvasRef.current
        if (!canvas) return
        const ctx = canvas.getContext("2d")
        if (!ctx) return

        const dpr = window.devicePixelRatio || 1
        const width = canvas.width / dpr
        const height = canvas.height / dpr
        ctx.clearRect(0, 0, width, height)
        setHasInk(false)
    }

    const applySignature = () => {
        const canvas = canvasRef.current
        if (!canvas || !draftSigner.trim() || !hasInk) {
            toast.error("Isi nama penandatangan dan tanda tangan terlebih dahulu")
            return
        }
        const dataUrl = canvas.toDataURL("image/png")
        setSignatureDataUrl(dataUrl)
        setSignedBy(draftSigner.trim())
        setIsSigned(true)
        setSignatureDialogOpen(false)
        toast.success("Signature authorized")
    }

    const handleSubmit = async () => {
        const numericAmount = Number(amount)
        if (!selectedVendorId || !numericAmount || numericAmount <= 0) {
            toast.error("Vendor and amount are required")
            return
        }
        if (paymentMethod === "CHECK" && !checkNumber.trim()) {
            toast.error("Check number is required")
            return
        }
        if (!isSigned || !signatureDataUrl || !signedBy) {
            toast.error("Signature authorization is required")
            return
        }

        setSubmitting(true)
        try {
            const paymentMeta: PaymentMeta = {
                signedBy,
                signedAt: new Date().toISOString(),
                method: paymentMethod,
                checkNumber: paymentMethod === "CHECK" ? checkNumber.trim() : undefined,
                checkBank: paymentMethod === "CHECK" ? checkBank.trim() || undefined : undefined,
                checkDate: paymentMethod === "CHECK" ? checkDate || undefined : undefined,
            }

            const result = await recordVendorPayment({
                supplierId: selectedVendorId,
                amount: numericAmount,
                method: paymentMethod,
                reference: paymentMethod === "CHECK" ? checkNumber.trim() : reference.trim() || undefined,
                notes: JSON.stringify(paymentMeta),
            })

            if (result.success) {
                toast.success(`Payment ${"paymentNumber" in result ? result.paymentNumber : ""} recorded successfully`)
                resetPaymentForm()
                const updatedPayments = await getVendorPayments()
                setPayments(updatedPayments)
            } else {
                toast.error(("error" in result ? result.error : "Failed to record payment") || "Failed to record payment")
            }
        } catch {
            toast.error("An error occurred")
        } finally {
            setSubmitting(false)
        }
    }

    if (loading && payments.length === 0) {
        return <div className="p-8 text-center font-bold">Loading payment system...</div>
    }

    return (
        <div className="flex-1 space-y-6 p-4 md:p-8 pt-6 font-sans h-[calc(100vh-theme(spacing.16))] flex flex-col">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 shrink-0">
                <div>
                    <h2 className="text-3xl font-black font-serif tracking-tight text-black flex items-center gap-2">Payment Checkbook</h2>
                    <p className="text-muted-foreground mt-1 font-medium">AP transfer/check payments with mandatory accountant signature authorization.</p>
                </div>
            </div>

            <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 gap-8 min-h-0 items-start">
                <div className="lg:col-span-7 space-y-6">
                    <Card className="border-4 border-black bg-[#fdfdfd] shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] relative overflow-hidden">
                        <div className="absolute inset-0 opacity-[0.05] pointer-events-none" style={{ backgroundImage: "radial-gradient(#4a5568 1px, transparent 1px)", backgroundSize: "10px 10px" }} />
                        <div className="absolute left-0 top-0 bottom-0 w-16 border-r-2 border-dashed border-zinc-300 bg-zinc-50/50 hidden md:block" />

                        <CardContent className="p-8 md:pl-24 relative z-10 space-y-8">
                            <div className="flex justify-between items-start gap-6">
                                <div className="flex items-center gap-2 text-zinc-400 font-bold uppercase tracking-widest text-xs">
                                    <Banknote className="h-4 w-4" /> Payment Authorization Slip
                                </div>
                                <div className="w-52">
                                    <Label className="text-[10px] uppercase text-muted-foreground">Method</Label>
                                    <Select
                                        value={paymentMethod}
                                        onValueChange={(value: PaymentMethod) => {
                                            setPaymentMethod(value)
                                            resetSignatureState()
                                        }}
                                    >
                                        <SelectTrigger className="h-9 bg-white border-black/20 font-semibold">
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="TRANSFER">TRANSFER</SelectItem>
                                            <SelectItem value="CHECK">CHECK</SelectItem>
                                            <SelectItem value="CASH">CASH</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>

                            <div className="flex items-end gap-4 relative">
                                <Label className="uppercase font-bold text-xs w-24 shrink-0 pb-2">Pay To The Order Of</Label>
                                <div className="flex-1 border-b-2 border-black/20 relative">
                                    <Select
                                        value={selectedVendorId}
                                        onValueChange={(value) => {
                                            setSelectedVendorId(value)
                                            resetSignatureState()
                                        }}
                                    >
                                        <SelectTrigger className="border-0 shadow-none focus:ring-0 bg-transparent font-serif text-2xl font-bold px-0 h-auto">
                                            <SelectValue placeholder="Select Vendor..." />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {vendors.map((v) => (
                                                <SelectItem key={v.id} value={v.id}>{v.name}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="w-48 border-2 border-black/10 bg-zinc-50 p-2 rounded flex items-center gap-1">
                                    <span className="font-bold text-zinc-400">Rp</span>
                                    <Input
                                        value={amount}
                                        onChange={(e) => {
                                            setAmount(e.target.value)
                                            resetSignatureState()
                                        }}
                                        className="border-0 shadow-none focus-visible:ring-0 bg-transparent font-mono text-xl font-black px-0 h-auto text-right"
                                        placeholder="0.00"
                                    />
                                </div>
                            </div>

                            <div className="flex items-end gap-4">
                                <Label className="uppercase font-bold text-xs w-12 shrink-0 pb-2">Memo</Label>
                                <div className="flex-1 border-b-2 border-black/20">
                                    <Input
                                        value={reference}
                                        onChange={(e) => {
                                            setReference(e.target.value)
                                            resetSignatureState()
                                        }}
                                        className="border-0 shadow-none focus-visible:ring-0 bg-transparent font-medium px-0 h-auto"
                                        placeholder="Invoice # / transfer ref..."
                                    />
                                </div>
                            </div>

                            {paymentMethod === "CHECK" && (
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 rounded-lg border border-black/15 bg-zinc-50 p-3">
                                    <div>
                                        <Label className="text-[10px] uppercase text-muted-foreground">Check No.</Label>
                                        <Input
                                            value={checkNumber}
                                            onChange={(e) => {
                                                setCheckNumber(e.target.value)
                                                resetSignatureState()
                                            }}
                                            placeholder="CHK-000123"
                                            className="h-9 bg-white"
                                        />
                                    </div>
                                    <div>
                                        <Label className="text-[10px] uppercase text-muted-foreground">Bank</Label>
                                        <Input
                                            value={checkBank}
                                            onChange={(e) => {
                                                setCheckBank(e.target.value)
                                                resetSignatureState()
                                            }}
                                            placeholder="BCA / CIMB"
                                            className="h-9 bg-white"
                                        />
                                    </div>
                                    <div>
                                        <Label className="text-[10px] uppercase text-muted-foreground">Check Date</Label>
                                        <Input
                                            type="date"
                                            value={checkDate}
                                            onChange={(e) => {
                                                setCheckDate(e.target.value)
                                                resetSignatureState()
                                            }}
                                            className="h-9 bg-white"
                                        />
                                    </div>
                                </div>
                            )}

                            <div className="flex justify-end pt-8">
                                <div className="w-64 relative">
                                    {isSigned ? (
                                        <div className="text-center border-b-2 border-black pb-1">
                                            <Image src={signatureDataUrl} alt="signature" width={220} height={56} className="mx-auto h-14 w-auto object-contain" />
                                            <p className="text-[10px] font-bold uppercase tracking-wide text-blue-900">Signed: {signedBy}</p>
                                        </div>
                                    ) : (
                                        <div className="border-b-2 border-black pb-4 text-center">
                                            <button
                                                type="button"
                                                onClick={handleSign}
                                                className="inline-flex items-center justify-center rounded-md border border-black/30 bg-white px-3 py-1.5 text-xs font-bold uppercase hover:bg-zinc-100"
                                            >
                                                Click to Sign
                                            </button>
                                        </div>
                                    )}
                                    <Label className="mt-2 block text-xs font-bold uppercase text-muted-foreground w-full text-center">Authorized Signature</Label>
                                </div>
                            </div>

                            <div className="flex justify-end">
                                <Button type="button" variant="outline" className="h-9 border-black/30 text-xs font-bold uppercase" onClick={handleSign}>
                                    {isSigned ? "Re-sign Check" : "Sign Check"}
                                </Button>
                            </div>
                        </CardContent>
                    </Card>

                    <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
                        <DialogTrigger asChild>
                            <Button
                                disabled={!isSigned || submitting || !amount || !selectedVendorId || (paymentMethod === "CHECK" && !checkNumber.trim())}
                                className={`w-full h-16 text-xl uppercase font-black tracking-widest transition-all shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] active:shadow-none active:translate-y-1 ${isSigned ? "bg-black text-white hover:bg-emerald-600" : "bg-zinc-200 text-zinc-400 cursor-not-allowed"}`}
                            >
                                {submitting ? "Processing..." : isSigned ? (
                                    <span className="flex items-center gap-2">Execute Payment <ChevronRight className="h-6 w-6" /></span>
                                ) : (
                                    "Sign to Continue"
                                )}
                            </Button>
                        </DialogTrigger>
                        <DialogContent>
                            <DialogHeader>
                                <DialogTitle>Konfirmasi Pembayaran AP</DialogTitle>
                                <DialogDescription>
                                    Metode: {paymentMethod} {paymentMethod === "CHECK" ? `| Check No: ${checkNumber}` : ""} | Jumlah: {formatIDR(Number(amount || 0))}
                                </DialogDescription>
                            </DialogHeader>
                            <Button
                                onClick={async () => {
                                    await handleSubmit()
                                    setConfirmOpen(false)
                                }}
                                disabled={submitting}
                                className="w-full"
                            >
                                {submitting ? "Processing..." : "Konfirmasi & Eksekusi Pembayaran"}
                            </Button>
                        </DialogContent>
                    </Dialog>

                    <Dialog open={signatureDialogOpen} onOpenChange={setSignatureDialogOpen}>
                        <DialogContent>
                            <DialogHeader>
                                <DialogTitle className="flex items-center gap-2"><PenLine className="h-4 w-4" /> Authorize Signature</DialogTitle>
                                <DialogDescription>Masukkan nama accountant lalu tanda tangan untuk mengotorisasi pembayaran AP.</DialogDescription>
                            </DialogHeader>
                            <div className="space-y-3">
                                <div className="space-y-1.5">
                                    <Label>Signed By</Label>
                                    <Input value={draftSigner} onChange={(e) => setDraftSigner(e.target.value)} placeholder="Nama accountant" />
                                </div>
                                <div className="space-y-1.5">
                                    <Label>Signature</Label>
                                    <canvas
                                        ref={canvasRef}
                                        width={520}
                                        height={160}
                                        className="w-full h-40 border border-zinc-300 rounded-md bg-white touch-none"
                                        onPointerDown={handlePointerDown}
                                        onPointerMove={handlePointerMove}
                                        onPointerUp={handlePointerUp}
                                        onPointerLeave={handlePointerUp}
                                    />
                                    <div className="flex gap-2">
                                        <Button type="button" variant="outline" onClick={clearSignature} className="flex-1">Clear</Button>
                                        <Button type="button" onClick={applySignature} className="flex-1">Save Signature</Button>
                                    </div>
                                </div>
                            </div>
                        </DialogContent>
                    </Dialog>
                </div>

                <div className="lg:col-span-5 border bg-white border-black shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] rounded-xl overflow-hidden flex flex-col h-[600px]">
                    <div className="bg-zinc-100 p-4 border-b border-black flex items-center justify-between">
                        <h3 className="font-black uppercase text-sm flex items-center gap-2"><History className="h-4 w-4" /> Check Register</h3>
                        <Badge className="bg-black text-white">History</Badge>
                    </div>
                    <div className="overflow-y-auto flex-1 p-0">
                        {payments.length === 0 ? (
                            <div className="p-8 text-center text-zinc-400 font-medium italic">No payment history found</div>
                        ) : (
                            <Table>
                                <TableHeader>
                                    <TableRow className="hover:bg-transparent bg-zinc-50/50">
                                        <TableHead className="font-bold text-black uppercase text-xs w-[100px]">No.</TableHead>
                                        <TableHead className="font-bold text-black uppercase text-xs">Payee</TableHead>
                                        <TableHead className="font-bold text-black uppercase text-xs">Method</TableHead>
                                        <TableHead className="font-bold text-black uppercase text-xs">Reference</TableHead>
                                        <TableHead className="text-right font-bold text-black uppercase text-xs">Amount</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {payments.map((p) => {
                                        const meta = parsePaymentMeta(p.notes)
                                        return (
                                            <TableRow key={p.id} className="hover:bg-zinc-50 border-b border-black/5">
                                                <TableCell className="font-mono text-xs text-muted-foreground">{p.number}</TableCell>
                                                <TableCell>
                                                    <div className="font-bold text-sm">{p.vendor?.name}</div>
                                                    <div className="text-[10px] text-muted-foreground uppercase">{new Date(p.date).toLocaleDateString()}</div>
                                                    {meta.signedBy && <div className="text-[10px] text-blue-700 font-semibold">Signed: {meta.signedBy}</div>}
                                                </TableCell>
                                                <TableCell>
                                                    <Badge variant="outline" className="text-[10px] flex items-center gap-1 w-fit">
                                                        {p.method === "CHECK" ? <Landmark className="h-3 w-3" /> : <ReceiptText className="h-3 w-3" />}
                                                        {p.method}
                                                    </Badge>
                                                </TableCell>
                                                <TableCell className="font-mono text-xs text-muted-foreground">
                                                    {p.reference || meta.checkNumber || "-"}
                                                </TableCell>
                                                <TableCell className="text-right font-mono font-medium text-red-600">- {formatIDR(p.amount)}</TableCell>
                                            </TableRow>
                                        )
                                    })}
                                </TableBody>
                            </Table>
                        )}
                    </div>
                </div>
            </div>
        </div>
    )
}
