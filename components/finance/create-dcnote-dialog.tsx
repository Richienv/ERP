"use client"

import { useState } from "react"
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
import {
    ArrowDownLeft,
    ArrowUpRight,
    ArrowLeft,
    Plus,
    Trash2,
    FileText,
    Send,
    Loader2,
} from "lucide-react"
import { NB } from "@/lib/dialog-styles"
import { formatIDR } from "@/lib/utils"
import { toast } from "sonner"
import { useDCNoteFormData } from "@/hooks/use-credit-debit-notes"
import { createDCNote, createAndPostDCNote } from "@/lib/actions/finance-dcnotes"
import { useQueryClient } from "@tanstack/react-query"
import { queryKeys } from "@/lib/query-keys"

interface CreateDCNoteDialogProps {
    open: boolean
    onOpenChange: (open: boolean) => void
}

type DCNoteType = "SALES_CN" | "SALES_DN" | "PURCHASE_DN" | "PURCHASE_CN"

interface LineItem {
    id: string
    description: string
    quantity: number
    unitPrice: number
    includePPN: boolean
}

type NoteKind = "CREDIT" | "DEBIT"

const KIND_CARDS: {
    kind: NoteKind
    label: string
    desc: string
    color: "blue" | "orange"
    icon: typeof ArrowDownLeft
}[] = [
    { kind: "CREDIT", label: "Nota Kredit", desc: "Pengurangan tagihan / hutang", color: "blue", icon: ArrowDownLeft },
    { kind: "DEBIT", label: "Nota Debit", desc: "Penambahan tagihan / hutang", color: "orange", icon: ArrowUpRight },
]

const REASON_OPTIONS: Record<string, { value: string; label: string }[]> = {
    SALES_CN: [
        { value: "RET_DEFECT", label: "Barang Cacat/Rusak" },
        { value: "RET_WRONG", label: "Barang Tidak Sesuai" },
        { value: "RET_QUALITY", label: "Kualitas Tidak Standar" },
        { value: "RET_EXCESS", label: "Kelebihan Kirim" },
        { value: "RET_EXPIRED", label: "Barang Kadaluarsa" },
        { value: "ADJ_OVERCHARGE", label: "Kelebihan Tagih" },
        { value: "ADJ_DISCOUNT", label: "Diskon Belum Dipotong" },
        { value: "ORD_CANCEL", label: "Pembatalan Pesanan" },
        { value: "ADJ_GOODWILL", label: "Penyesuaian Goodwill" },
    ],
    SALES_DN: [
        { value: "ADJ_UNDERCHARGE", label: "Kekurangan Tagih" },
        { value: "ADJ_ADDCHARGE", label: "Biaya Tambahan" },
        { value: "ADJ_PENALTY", label: "Penalti / Denda" },
    ],
    PURCHASE_DN: [
        { value: "RET_DEFECT", label: "Barang Cacat/Rusak" },
        { value: "RET_WRONG", label: "Barang Tidak Sesuai" },
        { value: "RET_QUALITY", label: "Kualitas Tidak Standar" },
        { value: "RET_EXCESS", label: "Kelebihan Kirim" },
        { value: "RET_EXPIRED", label: "Barang Kadaluarsa" },
        { value: "ADJ_OVERCHARGE", label: "Kelebihan Tagih" },
        { value: "ADJ_DISCOUNT", label: "Diskon Belum Dipotong" },
        { value: "ORD_CANCEL", label: "Pembatalan Pesanan" },
    ],
    PURCHASE_CN: [
        { value: "ADJ_REBATE", label: "Potongan Volume" },
        { value: "ADJ_DISCOUNT", label: "Diskon Belum Dipotong" },
        { value: "ADJ_GOODWILL", label: "Penyesuaian Goodwill" },
        { value: "SVC_CANCEL", label: "Pembatalan Jasa" },
        { value: "SVC_SHORT", label: "Jasa Tidak Lengkap" },
    ],
}

function newItem(): LineItem {
    return {
        id: crypto.randomUUID(),
        description: "",
        quantity: 1,
        unitPrice: 0,
        includePPN: false,
    }
}

export function CreateDCNoteDialog({ open, onOpenChange }: CreateDCNoteDialogProps) {
    const queryClient = useQueryClient()
    const { data: formData } = useDCNoteFormData()

    // Steps
    const [step, setStep] = useState<1 | 2>(1)
    const [selectedKind, setSelectedKind] = useState<NoteKind | null>(null)
    const [partyType, setPartyType] = useState<"customer" | "supplier">("customer")

    // Form fields
    const [partyId, setPartyId] = useState("")
    const [originalInvoiceId, setOriginalInvoiceId] = useState("")
    const [reasonCode, setReasonCode] = useState("")
    const [reference, setReference] = useState("")
    const [issueDate, setIssueDate] = useState(new Date().toISOString().split("T")[0])
    const [notes, setNotes] = useState("")
    const [items, setItems] = useState<LineItem[]>([newItem()])
    const [submitting, setSubmitting] = useState<false | "draft" | "post">(false)

    // Derive the full DCNoteType from kind + partyType
    const selectedType: DCNoteType | null = selectedKind
        ? (partyType === "customer"
            ? (selectedKind === "CREDIT" ? "SALES_CN" : "SALES_DN")
            : (selectedKind === "CREDIT" ? "PURCHASE_CN" : "PURCHASE_DN"))
        : null
    const isSalesType = partyType === "customer"

    const resetForm = () => {
        setStep(1)
        setSelectedKind(null)
        setPartyType("customer")
        setPartyId("")
        setOriginalInvoiceId("")
        setReasonCode("")
        setReference("")
        setIssueDate(new Date().toISOString().split("T")[0])
        setNotes("")
        setItems([newItem()])
    }

    const handleOpenChange = (open: boolean) => {
        if (!open) resetForm()
        onOpenChange(open)
    }

    const selectKind = (kind: NoteKind) => {
        setSelectedKind(kind)
        setPartyId("")
        setOriginalInvoiceId("")
        setReasonCode("")
        setStep(2)
    }

    // Parties & invoices for selected type
    const parties = isSalesType
        ? (formData?.customers ?? [])
        : (formData?.suppliers ?? [])

    const invoices = isSalesType
        ? (formData?.outstandingCustomerInvoices ?? []).filter((inv: any) => !partyId || inv.customerId === partyId)
        : (formData?.outstandingSupplierBills ?? []).filter((inv: any) => !partyId || inv.supplierId === partyId)

    const reasons = selectedType ? (REASON_OPTIONS[selectedType] ?? []) : []

    // ──────── Item Operations ────────
    const updateItem = (id: string, field: keyof LineItem, value: any) => {
        setItems(prev => prev.map(item =>
            item.id === id ? { ...item, [field]: value } : item
        ))
    }
    const removeItem = (id: string) => {
        setItems(prev => prev.filter(item => item.id !== id))
    }
    const addItem = () => {
        setItems(prev => [...prev, newItem()])
    }

    // ──────── Totals ────────
    const subtotal = items.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0)
    const ppnTotal = items.reduce((sum, item) => {
        const amount = item.quantity * item.unitPrice
        return sum + (item.includePPN ? Math.round(amount * 0.11) : 0)
    }, 0)
    const total = subtotal + ppnTotal

    // ──────── Submit ────────
    const handleSubmit = async (andPost: boolean) => {
        if (!selectedType) return
        if (!partyId) {
            toast.error(isSalesType ? "Pilih customer" : "Pilih supplier")
            return
        }
        if (!reasonCode) {
            toast.error("Pilih alasan")
            return
        }
        if (items.length === 0 || items.some(i => !i.description.trim() || i.unitPrice <= 0)) {
            toast.error("Lengkapi semua item (deskripsi & harga)")
            return
        }

        setSubmitting(andPost ? "post" : "draft")
        try {
            const payload = {
                type: selectedType as any,
                reasonCode,
                customerId: isSalesType ? partyId : undefined,
                supplierId: !isSalesType ? partyId : undefined,
                originalInvoiceId: originalInvoiceId && originalInvoiceId !== "none" ? originalInvoiceId : undefined,
                originalReference: reference || undefined,
                issueDate: new Date(issueDate + "T12:00:00"),
                notes: notes || undefined,
                items: items.map(item => ({
                    description: item.description,
                    quantity: item.quantity,
                    unitPrice: item.unitPrice,
                    includePPN: item.includePPN,
                })),
            }

            // Use combined action for post to avoid double server round-trip
            const result = andPost
                ? await createAndPostDCNote(payload)
                : await createDCNote(payload)

            if (!result.success) {
                toast.error(result.error || "Gagal membuat nota")
                return
            }

            if (andPost) {
                toast.success(`Nota ${result.number} berhasil dibuat & diposting`)
            } else {
                toast.success(`Nota ${result.number} berhasil disimpan sebagai draft`)
            }

            // Invalidate caches
            queryClient.invalidateQueries({ queryKey: queryKeys.dcNotes.all })
            queryClient.invalidateQueries({ queryKey: queryKeys.invoices.all })
            queryClient.invalidateQueries({ queryKey: queryKeys.journal.all })
            queryClient.invalidateQueries({ queryKey: queryKeys.bills.all })

            handleOpenChange(false)
        } catch {
            toast.error("Terjadi kesalahan")
        } finally {
            setSubmitting(false)
        }
    }

    return (
        <Dialog open={open} onOpenChange={handleOpenChange}>
            <DialogContent className={NB.contentWide}>
                {/* Header */}
                <DialogHeader className={NB.header}>
                    <DialogTitle className={NB.title}>
                        <FileText className="h-5 w-5" />
                        {step === 1 ? "Buat Nota Baru" : `Buat ${KIND_CARDS.find(c => c.kind === selectedKind)?.label || "Nota"}`}
                    </DialogTitle>
                    <p className={NB.subtitle}>
                        {step === 1 ? "Pilih jenis nota yang ingin dibuat" : "Lengkapi detail nota"}
                    </p>
                </DialogHeader>

                <ScrollArea className={NB.scroll}>
                    <div className="p-6 space-y-5">
                        {/* ══════ STEP 1: Type Selection ══════ */}
                        {step === 1 && (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {KIND_CARDS.map(card => {
                                    const Icon = card.icon
                                    const hoverBg = card.color === "blue" ? "hover:bg-blue-50" : "hover:bg-orange-50"
                                    const textColor = card.color === "blue" ? "text-blue-600" : "text-orange-600"
                                    const barColor = card.color === "blue" ? "bg-blue-400" : "bg-orange-400"
                                    return (
                                        <button
                                            key={card.kind}
                                            onClick={() => selectKind(card.kind)}
                                            className={`border-2 border-black p-6 text-left transition-all ${hoverBg} shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] hover:translate-y-[1px] hover:shadow-[1px_1px_0px_0px_rgba(0,0,0,1)]`}
                                        >
                                            <div className={`flex items-center gap-2 mb-2 ${textColor}`}>
                                                <Icon className="h-6 w-6" />
                                                <span className="font-black text-base uppercase tracking-wide">{card.label}</span>
                                            </div>
                                            <p className="text-xs text-zinc-500 font-medium">{card.desc}</p>
                                            <div className={`h-1.5 mt-4 ${barColor} rounded-full`} />
                                        </button>
                                    )
                                })}
                            </div>
                        )}

                        {/* ══════ STEP 2: Form ══════ */}
                        {step === 2 && selectedType && (
                            <>
                                {/* Back button */}
                                <button
                                    onClick={() => setStep(1)}
                                    className="flex items-center gap-1 text-xs font-bold text-zinc-500 hover:text-zinc-700 transition-colors"
                                >
                                    <ArrowLeft className="h-3.5 w-3.5" /> Kembali pilih jenis
                                </button>

                                {/* ─── Party & Invoice Section ─── */}
                                <div className={NB.section}>
                                    <div className={NB.sectionHead}>
                                        <span className={NB.sectionTitle}>Detail Nota</span>
                                    </div>
                                    <div className={NB.sectionBody}>
                                        {/* Party type toggle */}
                                        <div>
                                            <label className={NB.label}>Untuk <span className={NB.labelRequired}>*</span></label>
                                            <div className="flex gap-0 border-2 border-black w-fit">
                                                <button
                                                    type="button"
                                                    onClick={() => { setPartyType("customer"); setPartyId(""); setOriginalInvoiceId(""); setReasonCode("") }}
                                                    className={`px-5 py-2 text-xs font-black uppercase tracking-widest transition-colors ${partyType === "customer" ? "bg-black text-white" : "bg-white text-zinc-500 hover:bg-zinc-50"}`}
                                                >
                                                    Customer
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => { setPartyType("supplier"); setPartyId(""); setOriginalInvoiceId(""); setReasonCode("") }}
                                                    className={`px-5 py-2 text-xs font-black uppercase tracking-widest transition-colors border-l-2 border-black ${partyType === "supplier" ? "bg-black text-white" : "bg-white text-zinc-500 hover:bg-zinc-50"}`}
                                                >
                                                    Supplier
                                                </button>
                                            </div>
                                        </div>

                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                            {/* Party */}
                                            <div>
                                                <label className={NB.label}>
                                                    {isSalesType ? "Customer" : "Supplier"} <span className={NB.labelRequired}>*</span>
                                                </label>
                                                <Select value={partyId} onValueChange={v => { setPartyId(v); setOriginalInvoiceId("") }}>
                                                    <SelectTrigger className={NB.select}>
                                                        <SelectValue placeholder="Pilih..." />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        {parties.map((p: any) => (
                                                            <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                                                        ))}
                                                    </SelectContent>
                                                </Select>
                                            </div>

                                            {/* Original Invoice (optional) */}
                                            <div>
                                                <label className={NB.label}>
                                                    Invoice Asal <span className="text-zinc-300">(opsional)</span>
                                                </label>
                                                <Select value={originalInvoiceId} onValueChange={setOriginalInvoiceId}>
                                                    <SelectTrigger className={NB.select}>
                                                        <SelectValue placeholder="Pilih..." />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        <SelectItem value="none">Tidak ada</SelectItem>
                                                        {invoices.map((inv: any) => (
                                                            <SelectItem key={inv.id} value={inv.id}>
                                                                {inv.number} — {formatIDR(inv.balanceDue)}
                                                            </SelectItem>
                                                        ))}
                                                    </SelectContent>
                                                </Select>
                                            </div>
                                        </div>

                                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                            {/* Reason */}
                                            <div>
                                                <label className={NB.label}>
                                                    Alasan <span className={NB.labelRequired}>*</span>
                                                </label>
                                                <Select value={reasonCode} onValueChange={setReasonCode}>
                                                    <SelectTrigger className={NB.select}>
                                                        <SelectValue placeholder="Pilih..." />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        {reasons.map(r => (
                                                            <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>
                                                        ))}
                                                    </SelectContent>
                                                </Select>
                                            </div>

                                            {/* Reference */}
                                            <div>
                                                <label className={NB.label}>Referensi</label>
                                                <Input
                                                    value={reference}
                                                    onChange={e => setReference(e.target.value)}
                                                    placeholder="Opsional"
                                                    className={NB.input}
                                                />
                                            </div>

                                            {/* Date */}
                                            <div>
                                                <label className={NB.label}>
                                                    Tanggal <span className={NB.labelRequired}>*</span>
                                                </label>
                                                <Input
                                                    type="date"
                                                    value={issueDate}
                                                    onChange={e => setIssueDate(e.target.value)}
                                                    className={NB.input}
                                                />
                                            </div>
                                        </div>

                                        {/* Notes */}
                                        <div>
                                            <label className={NB.label}>Catatan</label>
                                            <Textarea
                                                value={notes}
                                                onChange={e => setNotes(e.target.value)}
                                                placeholder="Opsional"
                                                className={NB.textarea}
                                                rows={2}
                                            />
                                        </div>
                                    </div>
                                </div>

                                {/* ─── Line Items Section ─── */}
                                <div className={NB.section}>
                                    <div className={NB.sectionHead}>
                                        <span className={NB.sectionTitle}>Item</span>
                                    </div>
                                    <div className="p-4">
                                        {/* Items list */}
                                        <div className="space-y-3">
                                            {items.map((item, idx) => {
                                                const lineAmount = item.quantity * item.unitPrice
                                                const linePPN = item.includePPN ? Math.round(lineAmount * 0.11) : 0
                                                const lineTotal = lineAmount + linePPN
                                                return (
                                                    <div key={item.id} className="border-2 border-black p-3 space-y-3">
                                                        <div className="flex items-center justify-between">
                                                            <span className="text-[9px] font-black uppercase tracking-widest text-zinc-400">Item {idx + 1}</span>
                                                            {items.length > 1 && (
                                                                <button
                                                                    onClick={() => removeItem(item.id)}
                                                                    className="text-red-400 hover:text-red-600 transition-colors"
                                                                >
                                                                    <Trash2 className="h-3.5 w-3.5" />
                                                                </button>
                                                            )}
                                                        </div>
                                                        {/* Description - full width */}
                                                        <div>
                                                            <label className="text-[9px] font-black uppercase tracking-widest text-zinc-500 mb-1 block">Deskripsi</label>
                                                            <Input
                                                                value={item.description}
                                                                onChange={e => updateItem(item.id, "description", e.target.value)}
                                                                placeholder="Deskripsi item..."
                                                                className="border-2 border-zinc-300 h-9 text-sm rounded-none placeholder:text-zinc-300"
                                                            />
                                                        </div>
                                                        {/* Qty, Harga, PPN, Jumlah - row */}
                                                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                                                            <div>
                                                                <label className="text-[9px] font-black uppercase tracking-widest text-zinc-500 mb-1 block">Qty</label>
                                                                <Input
                                                                    type="number"
                                                                    value={item.quantity || ""}
                                                                    onChange={e => updateItem(item.id, "quantity", Number(e.target.value) || 0)}
                                                                    placeholder="1"
                                                                    min={1}
                                                                    className="border-2 border-zinc-300 h-9 text-sm font-mono text-right rounded-none placeholder:text-zinc-300"
                                                                />
                                                            </div>
                                                            <div>
                                                                <label className="text-[9px] font-black uppercase tracking-widest text-zinc-500 mb-1 block">Harga Satuan</label>
                                                                <Input
                                                                    type="number"
                                                                    value={item.unitPrice || ""}
                                                                    onChange={e => updateItem(item.id, "unitPrice", Number(e.target.value) || 0)}
                                                                    placeholder="0"
                                                                    min={0}
                                                                    className="border-2 border-zinc-300 h-9 text-sm font-mono text-right rounded-none placeholder:text-zinc-300"
                                                                />
                                                            </div>
                                                            <div className="flex flex-col">
                                                                <label className="text-[9px] font-black uppercase tracking-widest text-zinc-500 mb-1 block">PPN 11%</label>
                                                                <div className="flex items-center gap-2 h-9">
                                                                    <input
                                                                        type="checkbox"
                                                                        checked={item.includePPN}
                                                                        onChange={e => updateItem(item.id, "includePPN", e.target.checked)}
                                                                        className="h-4 w-4 accent-black"
                                                                    />
                                                                    <span className="text-xs text-zinc-500">{item.includePPN ? formatIDR(linePPN) : "Tidak"}</span>
                                                                </div>
                                                            </div>
                                                            <div className="flex flex-col">
                                                                <label className="text-[9px] font-black uppercase tracking-widest text-zinc-500 mb-1 block">Jumlah</label>
                                                                <div className="h-9 flex items-center justify-end">
                                                                    <span className="font-mono text-sm font-black">{formatIDR(lineTotal)}</span>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    </div>
                                                )
                                            })}
                                        </div>

                                        {/* Add item */}
                                        <button
                                            onClick={addItem}
                                            className="mt-3 flex items-center gap-1 text-[10px] font-black uppercase tracking-widest text-zinc-500 hover:text-black transition-colors"
                                        >
                                            <Plus className="h-3.5 w-3.5" /> Tambah Item
                                        </button>

                                        {/* Totals */}
                                        <div className="mt-4 flex justify-end">
                                            <div className="w-64 space-y-1 border-t-2 border-black pt-3">
                                                <div className="flex justify-between text-xs font-bold text-zinc-500">
                                                    <span>Subtotal</span>
                                                    <span className="font-mono">{formatIDR(subtotal)}</span>
                                                </div>
                                                <div className="flex justify-between text-xs font-bold text-zinc-500">
                                                    <span>PPN (11%)</span>
                                                    <span className="font-mono">{formatIDR(ppnTotal)}</span>
                                                </div>
                                                <div className="flex justify-between text-sm font-black pt-1 border-t border-zinc-200">
                                                    <span>TOTAL</span>
                                                    <span className="font-mono">{formatIDR(total)}</span>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* ─── Footer Buttons ─── */}
                                <div className="flex items-center justify-end gap-3 pt-2">
                                    <Button
                                        variant="outline"
                                        onClick={() => handleOpenChange(false)}
                                        className={NB.cancelBtn}
                                        disabled={!!submitting}
                                    >
                                        Batal
                                    </Button>
                                    <Button
                                        onClick={() => handleSubmit(false)}
                                        disabled={!!submitting}
                                        className={NB.submitBtn}
                                    >
                                        {submitting === "draft" ? (
                                            <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                                        ) : (
                                            <FileText className="h-3.5 w-3.5 mr-1.5" />
                                        )}
                                        {submitting === "draft" ? "Menyimpan..." : "Simpan Draft"}
                                    </Button>
                                    <Button
                                        onClick={() => handleSubmit(true)}
                                        disabled={!!submitting}
                                        className="bg-emerald-700 text-white border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:translate-y-[2px] hover:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] transition-all font-black uppercase text-xs tracking-wider px-6 h-9 rounded-none disabled:opacity-50"
                                    >
                                        {submitting === "post" ? (
                                            <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                                        ) : (
                                            <Send className="h-3.5 w-3.5 mr-1.5" />
                                        )}
                                        {submitting === "post" ? "Menyimpan..." : "Simpan & Posting"}
                                    </Button>
                                </div>
                            </>
                        )}
                    </div>
                </ScrollArea>
            </DialogContent>
        </Dialog>
    )
}
