"use client"

import { useState, useMemo } from "react"
import { Input } from "@/components/ui/input"
import { CheckCircle2, FileText } from "lucide-react"
import { NB } from "@/lib/dialog-styles"
import { formatIDR } from "@/lib/utils"
import { toast } from "sonner"
import { useDCNoteFormData } from "@/hooks/use-credit-debit-notes"
import { settleDCNote } from "@/lib/actions/finance-dcnotes"
import { useQueryClient } from "@tanstack/react-query"
import { queryKeys } from "@/lib/query-keys"
import {
    NBDialog,
    NBDialogHeader,
    NBDialogBody,
    NBDialogFooter,
    NBSection,
} from "@/components/ui/nb-dialog"

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
        <NBDialog open={open} onOpenChange={onOpenChange} size="wide">
            <NBDialogHeader icon={CheckCircle2} title={`Terapkan ${note.number}`} subtitle="Pilih invoice untuk menerapkan nota ini" />

            <NBDialogBody>
                {/* ─── Note Summary ─── */}
                <NBSection icon={FileText} title="Ringkasan Nota">
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
                </NBSection>

                {/* ─── Outstanding Invoices ─── */}
                <NBSection icon={FileText} title="Invoice Outstanding">
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
                </NBSection>
            </NBDialogBody>

            <NBDialogFooter
                onCancel={() => onOpenChange(false)}
                onSubmit={handleSubmit}
                submitting={submitting}
                submitLabel="Terapkan"
                disabled={totalApplied <= 0 || invoices.length === 0}
            />
        </NBDialog>
    )
}
