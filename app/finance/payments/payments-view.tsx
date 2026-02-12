"use client"

import { useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { formatIDR } from "@/lib/utils"
import {
    ArrowRightLeft,
    BadgeCheck,
    CalendarClock,
    CircleDollarSign,
    FileText,
    Plus,
    RefreshCcw,
    Search,
    Wallet
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle
} from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
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
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogTrigger
} from "@/components/ui/dialog"
import { matchPaymentToInvoice, recordARPayment } from "@/lib/actions/finance"
import { toast } from "sonner"

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
}

const METHOD_LABEL: Record<PaymentMethod, string> = {
    CASH: "Tunai",
    TRANSFER: "Transfer",
    CHECK: "Cek",
    CARD: "Kartu"
}

const EMPTY_INVOICE_VALUE = "__NO_INVOICE__"

const todayAsInput = () => new Date().toISOString().slice(0, 10)

export function ARPaymentsView({ unallocated, openInvoices, stats }: ARPaymentsViewProps) {
    const router = useRouter()
    const [processing, setProcessing] = useState<string | null>(null)
    const [selectedPaymentId, setSelectedPaymentId] = useState<string | null>(null)
    const [selectedInvoiceId, setSelectedInvoiceId] = useState<string | null>(null)
    const [paymentQuery, setPaymentQuery] = useState("")
    const [invoiceQuery, setInvoiceQuery] = useState("")
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

    const filteredPayments = useMemo(() => {
        const keyword = paymentQuery.trim().toLowerCase()
        if (!keyword) return unallocated
        return unallocated.filter((item) =>
            [item.number, item.from, item.method, item.reference ?? ""]
                .join(" ")
                .toLowerCase()
                .includes(keyword)
        )
    }, [paymentQuery, unallocated])

    const filteredInvoices = useMemo(() => {
        const keyword = invoiceQuery.trim().toLowerCase()
        return openInvoices.filter((invoice) => {
            if (selectedPayment?.customerId && invoice.customer?.id !== selectedPayment.customerId) {
                return false
            }
            if (!keyword) return true
            return [invoice.number, invoice.customer?.name ?? ""].join(" ").toLowerCase().includes(keyword)
        })
    }, [invoiceQuery, openInvoices, selectedPayment])

    const handleMatch = async (paymentId: string, invoiceId: string) => {
        setProcessing(paymentId)
        try {
            const result = await matchPaymentToInvoice(paymentId, invoiceId)
            if (result.success) {
                toast.success("message" in result ? result.message : "Pembayaran berhasil dialokasikan")
                setSelectedPaymentId(null)
                setSelectedInvoiceId(null)
                router.refresh()
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
            router.refresh()
        } catch {
            toast.error("Terjadi kesalahan saat mencatat penerimaan")
        } finally {
            setSubmittingPayment(false)
        }
    }

    const canMatch = Boolean(selectedPayment && selectedInvoice && !paymentInvoiceMismatch && !processing)

    return (
        <div className="flex-1 space-y-6 p-4 pt-6 md:p-8">
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <div>
                    <h1 className="text-3xl font-serif font-bold tracking-tight text-zinc-900">Penerimaan Piutang (AR)</h1>
                    <p className="mt-1 text-sm text-muted-foreground">
                        Alur kerja: pilih pembayaran masuk, pilih invoice tujuan, lalu konfirmasi alokasi.
                    </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                    <Button variant="outline" onClick={() => router.refresh()}>
                        <RefreshCcw className="mr-2 h-4 w-4" />
                        Segarkan Data
                    </Button>
                    <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
                        <DialogTrigger asChild>
                            <Button className="bg-black text-white hover:bg-zinc-800">
                                <Plus className="mr-2 h-4 w-4" />
                                Catat Penerimaan
                            </Button>
                        </DialogTrigger>
                        <DialogContent className="max-w-2xl">
                            <DialogHeader>
                                <DialogTitle>Catat Penerimaan Baru</DialogTitle>
                                <DialogDescription>
                                    Isi data penerimaan pelanggan. Anda bisa simpan sebagai dana belum dialokasikan atau langsung kaitkan ke invoice.
                                </DialogDescription>
                            </DialogHeader>

                            <div className="grid gap-4 py-2 md:grid-cols-2">
                                <div className="grid gap-2">
                                    <Label htmlFor="ar-customer">Pelanggan</Label>
                                    <Select
                                        value={createForm.customerId || EMPTY_INVOICE_VALUE}
                                        onValueChange={(value) =>
                                            setCreateForm((prev) => ({
                                                ...prev,
                                                customerId: value === EMPTY_INVOICE_VALUE ? "" : value
                                            }))
                                        }
                                    >
                                        <SelectTrigger id="ar-customer">
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

                                <div className="grid gap-2">
                                    <Label htmlFor="ar-amount">Nominal</Label>
                                    <Input
                                        id="ar-amount"
                                        type="number"
                                        min={0}
                                        step="0.01"
                                        value={createForm.amount}
                                        onChange={(event) =>
                                            setCreateForm((prev) => ({ ...prev, amount: event.target.value }))
                                        }
                                        placeholder="Contoh: 250000"
                                    />
                                </div>

                                <div className="grid gap-2">
                                    <Label htmlFor="ar-date">Tanggal Penerimaan</Label>
                                    <Input
                                        id="ar-date"
                                        type="date"
                                        value={createForm.date}
                                        onChange={(event) =>
                                            setCreateForm((prev) => ({ ...prev, date: event.target.value }))
                                        }
                                    />
                                </div>

                                <div className="grid gap-2">
                                    <Label htmlFor="ar-method">Metode Pembayaran</Label>
                                    <Select
                                        value={createForm.method}
                                        onValueChange={(value) =>
                                            setCreateForm((prev) => ({ ...prev, method: value as PaymentMethod }))
                                        }
                                    >
                                        <SelectTrigger id="ar-method">
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

                                <div className="grid gap-2 md:col-span-2">
                                    <Label htmlFor="ar-invoice">Hubungkan ke Invoice (Opsional)</Label>
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
                                        <SelectTrigger id="ar-invoice">
                                            <SelectValue placeholder="Pilih invoice jika ingin langsung dialokasikan" />
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

                                <div className="grid gap-2">
                                    <Label htmlFor="ar-reference">Referensi (Opsional)</Label>
                                    <Input
                                        id="ar-reference"
                                        value={createForm.reference}
                                        onChange={(event) =>
                                            setCreateForm((prev) => ({ ...prev, reference: event.target.value }))
                                        }
                                        placeholder="No. transfer / no. cek"
                                    />
                                </div>

                                <div className="grid gap-2">
                                    <Label htmlFor="ar-notes">Catatan (Opsional)</Label>
                                    <Textarea
                                        id="ar-notes"
                                        className="min-h-24"
                                        value={createForm.notes}
                                        onChange={(event) =>
                                            setCreateForm((prev) => ({ ...prev, notes: event.target.value }))
                                        }
                                        placeholder="Catatan tambahan"
                                    />
                                </div>
                            </div>

                            <div className="flex justify-end gap-2">
                                <Button variant="outline" onClick={() => setIsCreateDialogOpen(false)}>
                                    Batal
                                </Button>
                                <Button
                                    className="bg-black text-white hover:bg-zinc-800"
                                    onClick={handleCreatePayment}
                                    disabled={submittingPayment}
                                >
                                    {submittingPayment ? "Menyimpan..." : "Simpan Penerimaan"}
                                </Button>
                            </div>
                        </DialogContent>
                    </Dialog>
                </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                <Card className="border-zinc-200 shadow-sm">
                    <CardContent className="p-5">
                        <div className="mb-3 flex items-center justify-between">
                            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Dana Belum Dialokasikan</p>
                            <Wallet className="h-4 w-4 text-emerald-600" />
                        </div>
                        <p className="text-2xl font-bold">{formatIDR(stats.unallocatedAmount)}</p>
                        <p className="mt-1 text-xs text-muted-foreground">{stats.unallocatedCount} transaksi menunggu alokasi</p>
                    </CardContent>
                </Card>

                <Card className="border-zinc-200 shadow-sm">
                    <CardContent className="p-5">
                        <div className="mb-3 flex items-center justify-between">
                            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Invoice Terbuka</p>
                            <FileText className="h-4 w-4 text-blue-600" />
                        </div>
                        <p className="text-2xl font-bold">{stats.openInvoicesCount}</p>
                        <p className="mt-1 text-xs text-muted-foreground">Invoice belum lunas / parsial</p>
                    </CardContent>
                </Card>

                <Card className="border-zinc-200 shadow-sm">
                    <CardContent className="p-5">
                        <div className="mb-3 flex items-center justify-between">
                            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Total Piutang Berjalan</p>
                            <CircleDollarSign className="h-4 w-4 text-amber-600" />
                        </div>
                        <p className="text-2xl font-bold">{formatIDR(stats.outstandingAmount)}</p>
                        <p className="mt-1 text-xs text-muted-foreground">Saldo invoice yang belum tertagih</p>
                    </CardContent>
                </Card>

                <Card className="border-zinc-200 shadow-sm">
                    <CardContent className="p-5">
                        <div className="mb-3 flex items-center justify-between">
                            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Penerimaan Hari Ini</p>
                            <CalendarClock className="h-4 w-4 text-violet-600" />
                        </div>
                        <p className="text-2xl font-bold">{formatIDR(stats.todayPayments)}</p>
                        <p className="mt-1 text-xs text-muted-foreground">Total pembayaran masuk hari ini</p>
                    </CardContent>
                </Card>
            </div>

            <div className="grid gap-6 xl:grid-cols-[360px_minmax(0,1fr)]">
                <Card className="border-zinc-200 shadow-sm">
                    <CardHeader className="space-y-3">
                        <CardTitle className="text-lg">Langkah 1: Pilih Pembayaran</CardTitle>
                        <CardDescription>Daftar dana masuk yang belum dialokasikan ke invoice.</CardDescription>
                        <div className="relative">
                            <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                            <Input
                                value={paymentQuery}
                                onChange={(event) => setPaymentQuery(event.target.value)}
                                className="pl-9"
                                placeholder="Cari nomor, pelanggan, metode"
                            />
                        </div>
                    </CardHeader>
                    <CardContent className="space-y-3">
                        {filteredPayments.length === 0 ? (
                            <div className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">
                                Tidak ada pembayaran yang cocok.
                            </div>
                        ) : (
                            filteredPayments.map((item) => {
                                const isSelected = selectedPaymentId === item.id
                                return (
                                    <button
                                        type="button"
                                        key={item.id}
                                        className={`w-full rounded-xl border p-3 text-left transition ${isSelected
                                            ? "border-black bg-zinc-100"
                                            : "border-zinc-200 bg-white hover:border-zinc-400"
                                            }`}
                                        onClick={() => {
                                            setSelectedPaymentId(item.id)
                                            setSelectedInvoiceId(null)
                                        }}
                                    >
                                        <div className="mb-1 flex items-center justify-between gap-2">
                                            <Badge variant={isSelected ? "default" : "outline"}>{item.number}</Badge>
                                            <span className="text-xs text-muted-foreground">
                                                {new Date(item.date).toLocaleDateString("id-ID")}
                                            </span>
                                        </div>
                                        <p className="font-semibold">{item.from}</p>
                                        <div className="mt-1 flex items-center justify-between text-xs text-muted-foreground">
                                            <span>{item.method}</span>
                                            <span className="font-semibold text-emerald-700">{formatIDR(item.amount)}</span>
                                        </div>
                                    </button>
                                )
                            })
                        )}
                    </CardContent>
                </Card>

                <div className="space-y-6">
                    <Card className="border-zinc-200 shadow-sm">
                        <CardHeader className="space-y-3">
                            <CardTitle className="text-lg">Langkah 2: Pilih Invoice Tujuan</CardTitle>
                            <CardDescription>
                                {selectedPayment
                                    ? `Invoice difilter untuk pelanggan: ${selectedPayment.from}`
                                    : "Pilih pembayaran terlebih dahulu agar daftar invoice terfilter otomatis."}
                            </CardDescription>
                            <div className="relative">
                                <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                                <Input
                                    value={invoiceQuery}
                                    onChange={(event) => setInvoiceQuery(event.target.value)}
                                    className="pl-9"
                                    placeholder="Cari nomor invoice / pelanggan"
                                />
                            </div>
                        </CardHeader>
                        <CardContent className="space-y-3">
                            {!selectedPayment ? (
                                <div className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">
                                    Silakan pilih pembayaran pada panel kiri.
                                </div>
                            ) : filteredInvoices.length === 0 ? (
                                <div className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">
                                    Tidak ada invoice yang cocok untuk pembayaran ini.
                                </div>
                            ) : (
                                filteredInvoices.map((invoice) => {
                                    const isSelected = selectedInvoiceId === invoice.id
                                    return (
                                        <button
                                            key={invoice.id}
                                            type="button"
                                            onClick={() => setSelectedInvoiceId(invoice.id)}
                                            className={`w-full rounded-xl border p-3 text-left transition ${isSelected
                                                ? "border-black bg-zinc-100"
                                                : "border-zinc-200 bg-white hover:border-zinc-400"
                                                }`}
                                        >
                                            <div className="mb-2 flex items-center justify-between gap-2">
                                                <span className="font-semibold">{invoice.number}</span>
                                                <Badge variant={invoice.isOverdue ? "destructive" : "outline"}>
                                                    {invoice.isOverdue ? "Terlambat" : "Belum Jatuh Tempo"}
                                                </Badge>
                                            </div>
                                            <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
                                                <span className="text-muted-foreground">
                                                    {invoice.customer?.name ?? "Tanpa pelanggan"}
                                                </span>
                                                <span className="font-semibold">{formatIDR(invoice.balanceDue)}</span>
                                            </div>
                                            <p className="mt-1 text-xs text-muted-foreground">
                                                Jatuh tempo {new Date(invoice.dueDate).toLocaleDateString("id-ID")}
                                            </p>
                                        </button>
                                    )
                                })
                            )}
                        </CardContent>
                    </Card>

                    <Card className="border-zinc-200 shadow-sm">
                        <CardHeader>
                            <CardTitle className="text-lg">Langkah 3: Konfirmasi Alokasi</CardTitle>
                            <CardDescription>
                                Pastikan nominal dan pelanggan sudah benar sebelum dialokasikan.
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="grid gap-3 md:grid-cols-2">
                                <div className="rounded-lg border bg-zinc-50 p-3">
                                    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Pembayaran Terpilih</p>
                                    {selectedPayment ? (
                                        <div className="mt-2 space-y-1 text-sm">
                                            <p className="font-semibold">{selectedPayment.number}</p>
                                            <p>{selectedPayment.from}</p>
                                            <p className="font-semibold text-emerald-700">{formatIDR(selectedPayment.amount)}</p>
                                            <p className="text-xs text-muted-foreground">
                                                Metode: {METHOD_LABEL[selectedPayment.method as PaymentMethod] ?? selectedPayment.method}
                                            </p>
                                        </div>
                                    ) : (
                                        <p className="mt-2 text-sm text-muted-foreground">Belum ada pembayaran dipilih.</p>
                                    )}
                                </div>

                                <div className="rounded-lg border bg-zinc-50 p-3">
                                    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Invoice Tujuan</p>
                                    {selectedInvoice ? (
                                        <div className="mt-2 space-y-1 text-sm">
                                            <p className="font-semibold">{selectedInvoice.number}</p>
                                            <p>{selectedInvoice.customer?.name ?? "Tanpa pelanggan"}</p>
                                            <p className="font-semibold">{formatIDR(selectedInvoice.balanceDue)}</p>
                                            <p className="text-xs text-muted-foreground">
                                                Jatuh tempo: {new Date(selectedInvoice.dueDate).toLocaleDateString("id-ID")}
                                            </p>
                                        </div>
                                    ) : (
                                        <p className="mt-2 text-sm text-muted-foreground">Belum ada invoice dipilih.</p>
                                    )}
                                </div>
                            </div>

                            {paymentInvoiceMismatch && (
                                <div className="rounded-lg border border-red-300 bg-red-50 p-3 text-sm text-red-700">
                                    Pelanggan pembayaran tidak sama dengan pelanggan invoice. Pilih invoice yang sesuai.
                                </div>
                            )}

                            <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border bg-zinc-50 p-3">
                                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                    <ArrowRightLeft className="h-4 w-4" />
                                    <span>Alokasi akan mengurangi saldo invoice dan membuat jurnal otomatis.</span>
                                </div>
                                <Button
                                    className="bg-black text-white hover:bg-zinc-800"
                                    disabled={!canMatch}
                                    onClick={() => selectedPayment && selectedInvoice && handleMatch(selectedPayment.id, selectedInvoice.id)}
                                >
                                    <BadgeCheck className="mr-2 h-4 w-4" />
                                    {processing ? "Memproses..." : "Alokasikan Pembayaran"}
                                </Button>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            </div>
        </div>
    )
}
