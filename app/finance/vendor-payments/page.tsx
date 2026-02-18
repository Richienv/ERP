"use client"

import { useEffect, useRef, useState, useMemo, type PointerEvent as ReactPointerEvent } from "react"
import Image from "next/image"
import {
    Banknote,
    History,
    PenLine,
    Landmark,
    ReceiptText,
    Search,
    CreditCard,
    Wallet,
    Hash,
    Plus,
    ChevronDown,
    ChevronUp,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Label } from "@/components/ui/label"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { recordVendorPayment, type VendorPayment } from "@/lib/actions/finance"
import { formatIDR } from "@/lib/utils"
import { toast } from "sonner"
import { useVendorPayments } from "@/hooks/use-vendor-payments"
import { useQueryClient } from "@tanstack/react-query"
import { queryKeys } from "@/lib/query-keys"

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
        if (typeof parsed === "object" && parsed) return parsed
    } catch { /* legacy notes string */ }
    return {}
}

export default function APCheckbookPage() {
    const { data, isLoading: loading } = useVendorPayments()
    const queryClient = useQueryClient()
    const payments = data?.payments ?? []
    const vendors = data?.vendors ?? []
    const [showForm, setShowForm] = useState(false)

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
        if (paymentMethod === "CHECK" && !checkNumber.trim()) {
            toast.error("Nomor cek wajib diisi untuk metode CHECK")
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
        if (paymentMethod === "CHECK" && !checkNumber.trim()) {
            toast.error("Nomor cek wajib diisi")
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
                toast.success(`Payment ${"paymentNumber" in result ? result.paymentNumber : ""} recorded`)
                resetPaymentForm()
                setShowForm(false)
                queryClient.invalidateQueries({ queryKey: queryKeys.vendorPayments.all })
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

    if (loading && payments.length === 0) {
        return (
            <div className="mf-page flex items-center justify-center">
                <div className="text-[10px] font-black uppercase tracking-widest text-zinc-400 animate-pulse">Loading...</div>
            </div>
        )
    }

    return (
        <div className="mf-page">

            {/* ═══ COMMAND HEADER ═══ */}
            <div className="border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] overflow-hidden bg-white dark:bg-zinc-900">
                <div className="px-6 py-4 flex items-center justify-between border-l-[6px] border-l-emerald-400">
                    <div className="flex items-center gap-3">
                        <Banknote className="h-5 w-5 text-emerald-500" />
                        <div>
                            <h1 className="text-xl font-black uppercase tracking-tight text-zinc-900 dark:text-white">
                                Pembayaran AP
                            </h1>
                            <p className="text-zinc-400 text-xs font-medium mt-0.5">
                                Transfer & cek pembayaran vendor dengan otorisasi tanda tangan
                            </p>
                        </div>
                    </div>
                    <Button
                        onClick={() => setShowForm(!showForm)}
                        className="bg-black text-white hover:bg-zinc-800 border-2 border-black shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] active:translate-y-[1px] active:shadow-none transition-all text-[10px] font-black uppercase tracking-widest h-9 px-4"
                    >
                        {showForm ? <><ChevronUp className="mr-2 h-3.5 w-3.5" /> Tutup Form</> : <><Plus className="mr-2 h-3.5 w-3.5" /> Buat Pembayaran</>}
                    </Button>
                </div>
            </div>

            {/* ═══ KPI PULSE STRIP ═══ */}
            <div className="bg-white dark:bg-zinc-900 border-2 border-black shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] overflow-hidden">
                <div className="grid grid-cols-2 md:grid-cols-4">
                    <div className="relative p-4 md:p-5 border-r-2 border-zinc-100 dark:border-zinc-800 border-b-2 md:border-b-0">
                        <div className="absolute top-0 left-0 right-0 h-1 bg-emerald-400" />
                        <div className="flex items-center gap-2 mb-2">
                            <History className="h-4 w-4 text-zinc-400" />
                            <span className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Total Bayar</span>
                        </div>
                        <div className="text-2xl md:text-3xl font-black tracking-tighter text-zinc-900 dark:text-white">{totalPayments}</div>
                        <div className="text-[10px] font-bold text-emerald-600 mt-1">{formatIDR(totalPaid)}</div>
                    </div>
                    <div className="relative p-4 md:p-5 border-r-2 border-zinc-100 dark:border-zinc-800 border-b-2 md:border-b-0">
                        <div className="absolute top-0 left-0 right-0 h-1 bg-blue-400" />
                        <div className="flex items-center gap-2 mb-2">
                            <CreditCard className="h-4 w-4 text-zinc-400" />
                            <span className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Transfer</span>
                        </div>
                        <div className="text-2xl md:text-3xl font-black tracking-tighter text-blue-600">{transferCount}</div>
                        <div className="text-[10px] font-bold text-blue-600 mt-1">Bank transfer</div>
                    </div>
                    <div className="relative p-4 md:p-5 border-r-2 border-zinc-100 dark:border-zinc-800">
                        <div className="absolute top-0 left-0 right-0 h-1 bg-amber-400" />
                        <div className="flex items-center gap-2 mb-2">
                            <Landmark className="h-4 w-4 text-zinc-400" />
                            <span className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Cek</span>
                        </div>
                        <div className="text-2xl md:text-3xl font-black tracking-tighter text-amber-600">{checkCount}</div>
                        <div className="text-[10px] font-bold text-amber-600 mt-1">Pembayaran cek</div>
                    </div>
                    <div className="relative p-4 md:p-5">
                        <div className="absolute top-0 left-0 right-0 h-1 bg-purple-400" />
                        <div className="flex items-center gap-2 mb-2">
                            <Wallet className="h-4 w-4 text-zinc-400" />
                            <span className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Kas</span>
                        </div>
                        <div className="text-2xl md:text-3xl font-black tracking-tighter text-purple-600">{payments.filter(p => p.method === "CASH").length}</div>
                        <div className="text-[10px] font-bold text-purple-600 mt-1">Tunai</div>
                    </div>
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
                                <Select value={selectedVendorId} onValueChange={(v) => { setSelectedVendorId(v); resetSignatureState() }}>
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
                                <Select value={paymentMethod} onValueChange={(v: PaymentMethod) => { setPaymentMethod(v); resetSignatureState() }}>
                                    <SelectTrigger className="border-2 border-black h-10 font-bold rounded-none">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="TRANSFER">Transfer</SelectItem>
                                        <SelectItem value="CHECK">Cek</SelectItem>
                                        <SelectItem value="CASH">Tunai</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>

                        {paymentMethod === "CHECK" && (
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-3 border-2 border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800">
                                <div className="space-y-2">
                                    <Label className="text-[10px] font-black uppercase tracking-widest text-zinc-500">No. Cek</Label>
                                    <Input value={checkNumber} onChange={(e) => { setCheckNumber(e.target.value); resetSignatureState() }} placeholder="CHK-000123" className="border-2 border-black h-9 rounded-none" />
                                </div>
                                <div className="space-y-2">
                                    <Label className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Bank</Label>
                                    <Input value={checkBank} onChange={(e) => { setCheckBank(e.target.value); resetSignatureState() }} placeholder="BCA / CIMB" className="border-2 border-black h-9 rounded-none" />
                                </div>
                                <div className="space-y-2">
                                    <Label className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Tanggal Cek</Label>
                                    <Input type="date" value={checkDate} onChange={(e) => { setCheckDate(e.target.value); resetSignatureState() }} className="border-2 border-black h-9 rounded-none" />
                                </div>
                            </div>
                        )}

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
                                        disabled={!isSigned || submitting || !amount || !selectedVendorId || (paymentMethod === "CHECK" && !checkNumber.trim())}
                                        className="bg-emerald-600 text-white hover:bg-emerald-700 border-2 border-black shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] active:translate-y-[1px] active:shadow-none transition-all text-[10px] font-black uppercase tracking-widest h-10 px-8 disabled:opacity-40"
                                    >
                                        {submitting ? "Processing..." : "Eksekusi Pembayaran"}
                                    </Button>
                                </DialogTrigger>
                                <DialogContent>
                                    <DialogHeader>
                                        <DialogTitle>Konfirmasi Pembayaran AP</DialogTitle>
                                        <DialogDescription>
                                            Metode: {paymentMethod} {paymentMethod === "CHECK" ? `| No. Cek: ${checkNumber}` : ""} | Jumlah: {formatIDR(Number(amount || 0))}
                                        </DialogDescription>
                                    </DialogHeader>
                                    <Button
                                        onClick={async () => { await handleSubmit(); setConfirmOpen(false) }}
                                        disabled={submitting}
                                        className="w-full bg-emerald-600 text-white hover:bg-emerald-700"
                                    >
                                        {submitting ? "Processing..." : "Konfirmasi & Eksekusi"}
                                    </Button>
                                </DialogContent>
                            </Dialog>
                        </div>
                    </div>
                </div>
            )}

            {/* ═══ SIGNATURE DIALOG ═══ */}
            <Dialog open={signatureDialogOpen} onOpenChange={setSignatureDialogOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2"><PenLine className="h-4 w-4" /> Otorisasi Tanda Tangan</DialogTitle>
                        <DialogDescription>Masukkan nama accountant lalu tanda tangan untuk mengotorisasi pembayaran AP.</DialogDescription>
                    </DialogHeader>
                    <div className="space-y-3">
                        <div className="space-y-1.5">
                            <Label>Nama Penandatangan</Label>
                            <Input value={draftSigner} onChange={(e) => setDraftSigner(e.target.value)} placeholder="Nama accountant" />
                        </div>
                        <div className="space-y-1.5">
                            <Label>Tanda Tangan</Label>
                            <canvas
                                ref={canvasRef}
                                width={520}
                                height={160}
                                className="w-full h-40 border-2 border-black bg-white touch-none"
                                onPointerDown={handlePointerDown}
                                onPointerMove={handlePointerMove}
                                onPointerUp={handlePointerUp}
                                onPointerLeave={handlePointerUp}
                            />
                            <div className="flex gap-2">
                                <Button type="button" variant="outline" onClick={clearSignature} className="flex-1">Hapus</Button>
                                <Button type="button" onClick={applySignature} className="flex-1">Simpan</Button>
                            </div>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>

            {/* ═══ PAYMENT HISTORY TABLE ═══ */}
            <div className="bg-white dark:bg-zinc-900 border-2 border-black shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] overflow-hidden">
                <div className="px-4 py-3 border-b-2 border-black bg-zinc-50 dark:bg-zinc-800 flex items-center justify-between">
                    <p className="text-[10px] font-black uppercase tracking-widest text-zinc-500 flex items-center gap-2">
                        <History className="h-3.5 w-3.5" /> Riwayat Pembayaran
                    </p>
                    <span className="text-[10px] font-black uppercase tracking-widest text-zinc-400">{payments.length} record</span>
                </div>

                {/* Table Header */}
                <div className="grid grid-cols-12 gap-2 px-4 py-2 border-b border-zinc-200 dark:border-zinc-700 text-[10px] font-black uppercase tracking-widest text-zinc-500">
                    <div className="col-span-2">No.</div>
                    <div className="col-span-3">Vendor</div>
                    <div className="col-span-1 text-center">Metode</div>
                    <div className="col-span-2">Referensi</div>
                    <div className="col-span-2">Penandatangan</div>
                    <div className="col-span-2 text-right">Jumlah</div>
                </div>

                {payments.length === 0 ? (
                    <div className="p-12 text-center">
                        <History className="h-8 w-8 mx-auto text-zinc-300 mb-2" />
                        <p className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Belum ada riwayat pembayaran</p>
                    </div>
                ) : (
                    payments.map((p) => {
                        const meta = parsePaymentMeta(p.notes)
                        return (
                            <div key={p.id} className="grid grid-cols-12 gap-2 px-4 py-3 border-b border-zinc-100 dark:border-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors items-center">
                                <div className="col-span-2">
                                    <span className="font-mono text-xs font-bold text-zinc-500">{p.number}</span>
                                    <p className="text-[10px] text-zinc-400">{new Date(p.date).toLocaleDateString("id-ID")}</p>
                                </div>
                                <div className="col-span-3">
                                    <p className="font-bold text-sm truncate">{p.vendor?.name}</p>
                                </div>
                                <div className="col-span-1 text-center">
                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[9px] font-black uppercase tracking-widest border border-zinc-300 bg-zinc-50 dark:bg-zinc-800">
                                        {p.method === "CHECK" ? <Landmark className="h-3 w-3" /> : <ReceiptText className="h-3 w-3" />}
                                        {p.method}
                                    </span>
                                </div>
                                <div className="col-span-2">
                                    <span className="font-mono text-xs text-zinc-500">{p.reference || meta.checkNumber || "-"}</span>
                                </div>
                                <div className="col-span-2">
                                    {meta.signedBy && <span className="text-[10px] font-bold text-blue-700">{meta.signedBy}</span>}
                                </div>
                                <div className="col-span-2 text-right">
                                    <span className="font-mono font-bold text-sm text-red-600">- {formatIDR(p.amount)}</span>
                                </div>
                            </div>
                        )
                    })
                )}
            </div>
        </div>
    )
}
