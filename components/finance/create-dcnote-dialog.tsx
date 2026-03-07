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
} from "lucide-react"
import { NB } from "@/lib/dialog-styles"
import { formatIDR } from "@/lib/utils"
import { toast } from "sonner"
import { useDCNoteFormData } from "@/hooks/use-credit-debit-notes"
import { createDCNote, postDCNote } from "@/lib/actions/finance-dcnotes"
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

const TYPE_CARDS: {
    type: DCNoteType
    label: string
    desc: string
    color: "blue" | "orange"
    icon: typeof ArrowDownLeft
}[] = [
    { type: "SALES_CN", label: "Nota Kredit Penjualan", desc: "Kurangi piutang customer", color: "blue", icon: ArrowDownLeft },
    { type: "SALES_DN", label: "Nota Debit Penjualan", desc: "Tambah tagihan ke customer", color: "orange", icon: ArrowUpRight },
    { type: "PURCHASE_DN", label: "Nota Debit Pembelian", desc: "Kurangi hutang ke supplier", color: "orange", icon: ArrowUpRight },
    { type: "PURCHASE_CN", label: "Nota Kredit Pembelian", desc: "Supplier memberikan kredit", color: "blue", icon: ArrowDownLeft },
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
    const [selectedType, setSelectedType] = useState<DCNoteType | null>(null)

    // Form fields
    const [partyId, setPartyId] = useState("")
    const [originalInvoiceId, setOriginalInvoiceId] = useState("")
    const [reasonCode, setReasonCode] = useState("")
    const [reference, setReference] = useState("")
    const [issueDate, setIssueDate] = useState(new Date().toISOString().split("T")[0])
    const [notes, setNotes] = useState("")
    const [items, setItems] = useState<LineItem[]>([newItem()])
    const [submitting, setSubmitting] = useState(false)

    const isSalesType = selectedType === "SALES_CN" || selectedType === "SALES_DN"

    const resetForm = () => {
        setStep(1)
        setSelectedType(null)
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

    const selectType = (type: DCNoteType) => {
        setSelectedType(type)
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

        setSubmitting(true)
        try {
            const result = await createDCNote({
                type: selectedType as any,
                reasonCode,
                customerId: isSalesType ? partyId : undefined,
                supplierId: !isSalesType ? partyId : undefined,
                originalInvoiceId: originalInvoiceId || undefined,
                originalReference: reference || undefined,
                issueDate: new Date(issueDate + "T12:00:00"),
                notes: notes || undefined,
                items: items.map(item => ({
                    description: item.description,
                    quantity: item.quantity,
                    unitPrice: item.unitPrice,
                    includePPN: item.includePPN,
                })),
            })

            if (!result.success) {
                toast.error(result.error || "Gagal membuat nota")
                return
            }

            // Post immediately if requested
            if (andPost && result.id) {
                const postResult = await postDCNote(result.id)
                if (!postResult.success) {
                    toast.warning(`Nota ${result.number} tersimpan, tapi gagal diposting: ${postResult.error}`)
                } else {
                    toast.success(`Nota ${result.number} berhasil dibuat & diposting`)
                }
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
                        {step === 1 ? "Buat Nota Baru" : `Buat ${TYPE_CARDS.find(c => c.type === selectedType)?.label || "Nota"}`}
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
                                {TYPE_CARDS.map(card => {
                                    const Icon = card.icon
                                    const borderColor = card.color === "blue" ? "border-blue-400" : "border-orange-400"
                                    const hoverBg = card.color === "blue" ? "hover:bg-blue-50" : "hover:bg-orange-50"
                                    const textColor = card.color === "blue" ? "text-blue-600" : "text-orange-600"
                                    return (
                                        <button
                                            key={card.type}
                                            onClick={() => selectType(card.type)}
                                            className={`border-2 border-black p-5 text-left transition-all ${hoverBg} shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] hover:translate-y-[1px] hover:shadow-[1px_1px_0px_0px_rgba(0,0,0,1)]`}
                                        >
                                            <div className={`flex items-center gap-2 mb-2 ${textColor}`}>
                                                <Icon className="h-5 w-5" />
                                                <span className="font-black text-sm uppercase tracking-wide">{card.label}</span>
                                            </div>
                                            <p className="text-xs text-zinc-500 font-medium">{card.desc}</p>
                                            <div className={`h-1 mt-3 ${borderColor.replace("border-", "bg-")}`} />
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
                                        {/* Items Table */}
                                        <div className={NB.tableWrap}>
                                            <div className={NB.tableHead}>
                                                <div className="grid grid-cols-12 gap-2">
                                                    <div className={`col-span-4 ${NB.tableHeadCell}`}>Deskripsi</div>
                                                    <div className={`col-span-2 ${NB.tableHeadCell}`}>Qty</div>
                                                    <div className={`col-span-2 ${NB.tableHeadCell}`}>Harga Satuan</div>
                                                    <div className={`col-span-1 ${NB.tableHeadCell} text-center`}>PPN</div>
                                                    <div className={`col-span-2 ${NB.tableHeadCell} text-right`}>Jumlah</div>
                                                    <div className={`col-span-1 ${NB.tableHeadCell}`}></div>
                                                </div>
                                            </div>
                                            {items.map(item => {
                                                const lineAmount = item.quantity * item.unitPrice
                                                const linePPN = item.includePPN ? Math.round(lineAmount * 0.11) : 0
                                                const lineTotal = lineAmount + linePPN
                                                return (
                                                    <div key={item.id} className={NB.tableRow}>
                                                        <div className="grid grid-cols-12 gap-2 items-center">
                                                            <div className={`col-span-4 ${NB.tableCell}`}>
                                                                <Input
                                                                    value={item.description}
                                                                    onChange={e => updateItem(item.id, "description", e.target.value)}
                                                                    placeholder="Deskripsi"
                                                                    className="border border-zinc-300 h-8 text-sm rounded-none placeholder:text-zinc-300 placeholder:font-normal"
                                                                />
                                                            </div>
                                                            <div className={`col-span-2 ${NB.tableCell}`}>
                                                                <Input
                                                                    type="number"
                                                                    value={item.quantity || ""}
                                                                    onChange={e => updateItem(item.id, "quantity", Number(e.target.value) || 0)}
                                                                    placeholder="1"
                                                                    min={1}
                                                                    className="border border-zinc-300 h-8 text-sm font-mono text-right rounded-none placeholder:text-zinc-300 placeholder:font-normal"
                                                                />
                                                            </div>
                                                            <div className={`col-span-2 ${NB.tableCell}`}>
                                                                <Input
                                                                    type="number"
                                                                    value={item.unitPrice || ""}
                                                                    onChange={e => updateItem(item.id, "unitPrice", Number(e.target.value) || 0)}
                                                                    placeholder="0"
                                                                    min={0}
                                                                    className="border border-zinc-300 h-8 text-sm font-mono text-right rounded-none placeholder:text-zinc-300 placeholder:font-normal"
                                                                />
                                                            </div>
                                                            <div className={`col-span-1 ${NB.tableCell} text-center`}>
                                                                <input
                                                                    type="checkbox"
                                                                    checked={item.includePPN}
                                                                    onChange={e => updateItem(item.id, "includePPN", e.target.checked)}
                                                                    className="h-4 w-4 accent-black"
                                                                />
                                                            </div>
                                                            <div className={`col-span-2 ${NB.tableCell} text-right`}>
                                                                <span className="font-mono text-sm font-bold">{formatIDR(lineTotal)}</span>
                                                            </div>
                                                            <div className={`col-span-1 ${NB.tableCell} text-center`}>
                                                                {items.length > 1 && (
                                                                    <button
                                                                        onClick={() => removeItem(item.id)}
                                                                        className="text-red-400 hover:text-red-600 transition-colors"
                                                                    >
                                                                        <Trash2 className="h-3.5 w-3.5" />
                                                                    </button>
                                                                )}
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
                                        disabled={submitting}
                                    >
                                        Batal
                                    </Button>
                                    <Button
                                        onClick={() => handleSubmit(false)}
                                        disabled={submitting}
                                        className={NB.submitBtn}
                                    >
                                        <FileText className="h-3.5 w-3.5 mr-1.5" />
                                        {submitting ? "Menyimpan..." : "Simpan Draft"}
                                    </Button>
                                    <Button
                                        onClick={() => handleSubmit(true)}
                                        disabled={submitting}
                                        className="bg-emerald-700 text-white border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:translate-y-[2px] hover:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] transition-all font-black uppercase text-xs tracking-wider px-6 h-9 rounded-none"
                                    >
                                        <Send className="h-3.5 w-3.5 mr-1.5" />
                                        {submitting ? "Menyimpan..." : "Simpan & Posting"}
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
