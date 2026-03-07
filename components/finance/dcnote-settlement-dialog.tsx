"use client"

import { useState, useMemo } from "react"
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { CheckCircle2, FileText } from "lucide-react"
import { NB } from "@/lib/dialog-styles"
import { formatIDR } from "@/lib/utils"
import { toast } from "sonner"
import { useDCNoteFormData } from "@/hooks/use-credit-debit-notes"
import { settleDCNote } from "@/lib/actions/finance-dcnotes"
import { useQueryClient } from "@tanstack/react-query"
import { queryKeys } from "@/lib/query-keys"

interface DCNoteSettlementDialogProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    note: any
}

const TYPE_LABELS: Record<string, string> = {
    SALES_CN: "NK Penjualan",
    SALES_DN: "ND Penjualan",
    PURCHASE_DN: "ND Pembelian",
    PURCHASE_CN: "NK Pembelian",
}

export function DCNoteSettlementDialog({ open, onOpenChange, note }: DCNoteSettlementDialogProps) {
    const queryClient = useQueryClient()
    const { data: formData } = useDCNoteFormData()
    const [submitting, setSubmitting] = useState(false)
    const [amounts, setAmounts] = useState<Record<string, number>>({})

    const isSalesType = note.type === "SALES_CN" || note.type === "SALES_DN"
    const remaining = note.totalAmount - note.settledAmount

    // Filter invoices by the note's party
    const invoices = useMemo(() => {
        if (!formData) return []
        if (isSalesType) {
            return (formData.outstandingCustomerInvoices ?? []).filter(
                (inv: any) => inv.customerId === note.customerId
            )
        } else {
            return (formData.outstandingSupplierBills ?? []).filter(
                (inv: any) => inv.supplierId === note.supplierId
            )
        }
    }, [formData, isSalesType, note.customerId, note.supplierId])

    // Auto-fill on first mount: if only one invoice and remaining fits, pre-fill
    const totalApplied = Object.values(amounts).reduce((sum, v) => sum + (v || 0), 0)
    const remainingAfterApply = remaining - totalApplied

    const updateAmount = (invoiceId: string, value: number) => {
        setAmounts(prev => ({ ...prev, [invoiceId]: value }))
    }

    const handleSubmit = async () => {
        const settlements = Object.entries(amounts)
            .filter(([, amount]) => amount > 0)
            .map(([invoiceId, amount]) => ({ invoiceId, amount }))

        if (settlements.length === 0) {
            toast.error("Masukkan jumlah yang akan diterapkan")
            return
        }

        if (totalApplied > remaining + 0.01) {
            toast.error(`Total terapan (${formatIDR(totalApplied)}) melebihi sisa nota (${formatIDR(remaining)})`)
            return
        }

        // Validate each settlement against invoice balance
        for (const s of settlements) {
            const inv = invoices.find((i: any) => i.id === s.invoiceId)
            if (inv && s.amount > inv.balanceDue + 0.01) {
                toast.error(`Jumlah untuk ${inv.number} melebihi sisa invoice (${formatIDR(inv.balanceDue)})`)
                return
            }
        }

        setSubmitting(true)
        try {
            const result = await settleDCNote(note.id, settlements)
            if (result.success) {
                toast.success("Nota berhasil diterapkan ke invoice")
                queryClient.invalidateQueries({ queryKey: queryKeys.dcNotes.all })
                queryClient.invalidateQueries({ queryKey: queryKeys.invoices.all })
                queryClient.invalidateQueries({ queryKey: queryKeys.bills.all })
                onOpenChange(false)
            } else {
                toast.error(result.error || "Gagal menerapkan nota")
            }
        } catch {
            toast.error("Terjadi kesalahan")
        } finally {
            setSubmitting(false)
        }
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className={NB.contentWide}>
                {/* Header */}
                <DialogHeader className={NB.header}>
                    <DialogTitle className={NB.title}>
                        <CheckCircle2 className="h-5 w-5" />
                        Terapkan {note.number}
                    </DialogTitle>
                    <p className={NB.subtitle}>
                        Pilih invoice untuk menerapkan nota ini
                    </p>
                </DialogHeader>

                <ScrollArea className={NB.scroll}>
                    <div className="p-6 space-y-5">
                        {/* ─── Note Summary ─── */}
                        <div className={NB.section}>
                            <div className={NB.sectionHead}>
                                <FileText className="h-4 w-4" />
                                <span className={NB.sectionTitle}>Ringkasan Nota</span>
                            </div>
                            <div className="p-4">
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                    <div>
                                        <div className="text-[10px] font-black uppercase tracking-widest text-zinc-400 mb-1">Tipe</div>
                                        <div className="text-sm font-bold">{TYPE_LABELS[note.type] || note.type}</div>
                                    </div>
                                    <div>
                                        <div className="text-[10px] font-black uppercase tracking-widest text-zinc-400 mb-1">Total Nota</div>
                                        <div className="text-sm font-mono font-bold">{formatIDR(note.totalAmount)}</div>
                                    </div>
                                    <div>
                                        <div className="text-[10px] font-black uppercase tracking-widest text-zinc-400 mb-1">Sudah Diterapkan</div>
                                        <div className="text-sm font-mono font-bold text-emerald-600">{formatIDR(note.settledAmount)}</div>
                                    </div>
                                    <div>
                                        <div className="text-[10px] font-black uppercase tracking-widest text-zinc-400 mb-1">Sisa</div>
                                        <div className="text-sm font-mono font-black text-blue-600">{formatIDR(remaining)}</div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* ─── Outstanding Invoices ─── */}
                        <div className={NB.section}>
                            <div className={NB.sectionHead}>
                                <span className={NB.sectionTitle}>Invoice Outstanding</span>
                            </div>
                            <div className="p-4">
                                {invoices.length === 0 ? (
                                    <div className="py-8 text-center">
                                        <FileText className="h-8 w-8 mx-auto text-zinc-300 mb-2" />
                                        <p className="text-[10px] font-black uppercase tracking-widest text-zinc-400">
                                            Tidak ada invoice outstanding untuk pihak ini
                                        </p>
                                    </div>
                                ) : (
                                    <div className={NB.tableWrap}>
                                        <div className={NB.tableHead}>
                                            <div className="grid grid-cols-12 gap-2">
                                                <div className={`col-span-3 ${NB.tableHeadCell}`}>No. Invoice</div>
                                                <div className={`col-span-2 ${NB.tableHeadCell}`}>Tanggal</div>
                                                <div className={`col-span-2 ${NB.tableHeadCell} text-right`}>Total</div>
                                                <div className={`col-span-2 ${NB.tableHeadCell} text-right`}>Sisa</div>
                                                <div className={`col-span-3 ${NB.tableHeadCell} text-right`}>Jumlah Terapkan</div>
                                            </div>
                                        </div>
                                        {invoices.map((inv: any) => (
                                            <div key={inv.id} className={NB.tableRow}>
                                                <div className="grid grid-cols-12 gap-2 items-center">
                                                    <div className={`col-span-3 ${NB.tableCell}`}>
                                                        <span className="font-mono text-xs font-bold text-zinc-700">{inv.number}</span>
                                                    </div>
                                                    <div className={`col-span-2 ${NB.tableCell}`}>
                                                        <span className="text-xs text-zinc-500">-</span>
                                                    </div>
                                                    <div className={`col-span-2 ${NB.tableCell} text-right`}>
                                                        <span className="font-mono text-xs text-zinc-500">{formatIDR(inv.totalAmount)}</span>
                                                    </div>
                                                    <div className={`col-span-2 ${NB.tableCell} text-right`}>
                                                        <span className="font-mono text-xs font-bold text-blue-600">{formatIDR(inv.balanceDue)}</span>
                                                    </div>
                                                    <div className={`col-span-3 ${NB.tableCell} text-right`}>
                                                        <Input
                                                            type="number"
                                                            value={amounts[inv.id] || ""}
                                                            onChange={e => updateAmount(inv.id, Number(e.target.value) || 0)}
                                                            placeholder="0"
                                                            min={0}
                                                            max={Math.min(inv.balanceDue, remaining)}
                                                            className="border border-zinc-300 h-8 text-sm font-mono text-right rounded-none w-full placeholder:text-zinc-300 placeholder:font-normal"
                                                        />
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}

                                {/* Running total */}
                                {invoices.length > 0 && (
                                    <div className="mt-4 flex justify-end">
                                        <div className="w-72 space-y-1 border-t-2 border-black pt-3">
                                            <div className="flex justify-between text-xs font-bold text-zinc-500">
                                                <span>Total diterapkan</span>
                                                <span className={`font-mono ${totalApplied > remaining + 0.01 ? "text-red-600" : "text-emerald-600"}`}>
                                                    {formatIDR(totalApplied)}
                                                </span>
                                            </div>
                                            <div className="flex justify-between text-xs font-bold text-zinc-500">
                                                <span>Sisa nota setelah</span>
                                                <span className="font-mono">{formatIDR(Math.max(0, remainingAfterApply))}</span>
                                            </div>
                                            <div className="flex justify-between text-sm font-black pt-1 border-t border-zinc-200">
                                                <span>Sisa nota</span>
                                                <span className="font-mono">{formatIDR(remaining)} <span className="text-zinc-400 text-xs font-normal">total</span></span>
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* ─── Footer ─── */}
                        <div className="flex items-center justify-end gap-3 pt-2">
                            <Button
                                variant="outline"
                                onClick={() => onOpenChange(false)}
                                className={NB.cancelBtn}
                                disabled={submitting}
                            >
                                Batal
                            </Button>
                            <Button
                                onClick={handleSubmit}
                                disabled={submitting || totalApplied <= 0 || invoices.length === 0}
                                className="bg-emerald-700 text-white border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:translate-y-[2px] hover:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] transition-all font-black uppercase text-xs tracking-wider px-8 h-9 rounded-none disabled:opacity-40"
                            >
                                <CheckCircle2 className="h-3.5 w-3.5 mr-1.5" />
                                {submitting ? "Memproses..." : "Terapkan"}
                            </Button>
                        </div>
                    </div>
                </ScrollArea>
            </DialogContent>
        </Dialog>
    )
}
