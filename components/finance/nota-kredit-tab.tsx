"use client"

import { useState } from "react"
import { queryKeys } from "@/lib/query-keys"
import { Plus, FileText, Eye } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { SelectItem } from "@/components/ui/select"
import {
    Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { formatIDR } from "@/lib/utils"
import { toast } from "sonner"
import { useCreditDebitNotes } from "@/hooks/use-credit-debit-notes"
import { createCreditNote } from "@/lib/actions/finance"
import { useQueryClient } from "@tanstack/react-query"
import {
    NBDialog, NBDialogHeader, NBDialogBody, NBDialogFooter,
    NBSection, NBSelect, NBCurrencyInput, NBInput, NBTextarea,
} from "@/components/ui/nb-dialog"
import { DCNoteDetailDialog } from "@/components/finance/dcnote-detail-dialog"

const REASON_CODES = [
    { code: "RET-GOODS", label: "Retur Barang" },
    { code: "ADJ-PRICE", label: "Koreksi Harga" },
    { code: "ADJ-DISCOUNT", label: "Diskon Tambahan" },
    { code: "SVC-CANCEL", label: "Pembatalan Jasa" },
    { code: "OTHER", label: "Lainnya" },
]

export function NotaKreditTab() {
    const { data, isLoading } = useCreditDebitNotes()
    const queryClient = useQueryClient()
    const [showDialog, setShowDialog] = useState(false)
    const [submitting, setSubmitting] = useState(false)
    const [detailNoteId, setDetailNoteId] = useState<string | null>(null)
    const [showDetail, setShowDetail] = useState(false)
    const [includePPN, setIncludePPN] = useState(true)
    const [form, setForm] = useState({
        customerId: "",
        reason: "",
        amount: "",
        notes: "",
        date: new Date().toISOString().split("T")[0],
    })

    const creditNotes = (data?.notes ?? []).filter((n: any) => n.type === "CREDIT_NOTE")
    const customers = data?.customers ?? []
    const revenueAccounts = data?.revenueAccounts ?? []
    const arAccounts = data?.arAccounts ?? []

    const subtotal = Number(form.amount) || 0
    const ppnAmount = includePPN ? Math.round(subtotal * 0.11) : 0
    const total = subtotal + ppnAmount

    const totalCN = creditNotes.reduce((sum: number, n: any) => sum + Number(n.amount || 0), 0)
    const pendingCN = creditNotes.filter((n: any) => n.status === "DRAFT").length
    const postedCN = creditNotes.filter((n: any) => n.status === "POSTED").length

    const resetForm = () => {
        setForm({ customerId: "", reason: "", amount: "", notes: "", date: new Date().toISOString().split("T")[0] })
        setIncludePPN(true)
    }

    const handleSubmit = async () => {
        if (!form.customerId || subtotal <= 0 || !form.reason) {
            toast.error("Lengkapi Customer, Jumlah, dan Alasan")
            return
        }

        const defaultRevenue = revenueAccounts[0]
        const defaultAR = arAccounts[0]
        if (!defaultRevenue || !defaultAR) {
            toast.error("Akun Revenue atau AR tidak ditemukan. Pastikan Chart of Accounts sudah diatur.")
            return
        }

        setSubmitting(true)
        try {
            const reasonLabel = REASON_CODES.find(r => r.code === form.reason)?.label ?? form.reason
            const result = await createCreditNote({
                customerId: form.customerId,
                amount: total,
                reason: `[${form.reason}] ${reasonLabel}${form.notes ? ` — ${form.notes}` : ""}`,
                date: new Date(form.date + "T12:00:00"),
                revenueAccountId: defaultRevenue.id,
                arAccountId: defaultAR.id,
            })

            if (result.success) {
                toast.success(`Nota Kredit ${result.number} berhasil dibuat`)
                setShowDialog(false)
                resetForm()
                queryClient.invalidateQueries({ queryKey: queryKeys.dcNotes.all })
                queryClient.invalidateQueries({ queryKey: queryKeys.invoices.all })
                queryClient.invalidateQueries({ queryKey: queryKeys.journal.all })
                queryClient.invalidateQueries({ queryKey: queryKeys.arPayments.all })
                queryClient.invalidateQueries({ queryKey: queryKeys.financeDashboard.all })
                queryClient.invalidateQueries({ queryKey: queryKeys.financeReports.all })
                queryClient.invalidateQueries({ queryKey: queryKeys.accountTransactions.all })
            } else {
                toast.error(result.error || "Gagal membuat Nota Kredit")
            }
        } catch {
            toast.error("Terjadi kesalahan")
        } finally {
            setSubmitting(false)
        }
    }

    if (isLoading) {
        return <div className="p-8 text-center text-zinc-400 text-xs font-bold uppercase animate-pulse">Memuat...</div>
    }

    return (
        <div className="space-y-4">
            {/* KPI Strip */}
            <div className="grid grid-cols-3 gap-3">
                {[
                    { label: "Total Nota Kredit", value: formatIDR(totalCN), color: "bg-blue-50 border-blue-200" },
                    { label: "Pending / Draft", value: String(pendingCN), color: "bg-zinc-50 border-zinc-200" },
                    { label: "Posted", value: String(postedCN), color: "bg-emerald-50 border-emerald-200" },
                ].map((kpi) => (
                    <div key={kpi.label} className={`border-2 border-black shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] p-3 ${kpi.color}`}>
                        <p className="text-[9px] font-black uppercase tracking-widest text-zinc-400">{kpi.label}</p>
                        <p className="text-lg font-black mt-1">{kpi.value}</p>
                    </div>
                ))}
            </div>

            {/* Action Bar */}
            <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-zinc-400 uppercase tracking-widest">{creditNotes.length} Nota Kredit</span>
                <Button onClick={() => setShowDialog(true)} className="bg-black text-white font-bold text-xs uppercase tracking-wider border-2 border-black shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] hover:shadow-none hover:translate-x-[3px] hover:translate-y-[3px] transition-all">
                    <Plus className="h-3.5 w-3.5 mr-1.5" /> Buat Nota Kredit
                </Button>
            </div>

            {/* Table */}
            <div className="border-2 border-black shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] overflow-hidden bg-white">
                <Table>
                    <TableHeader>
                        <TableRow className="bg-zinc-50">
                            <TableHead className="text-[10px] font-black uppercase tracking-widest">No</TableHead>
                            <TableHead className="text-[10px] font-black uppercase tracking-widest">Customer</TableHead>
                            <TableHead className="text-[10px] font-black uppercase tracking-widest">Invoice</TableHead>
                            <TableHead className="text-[10px] font-black uppercase tracking-widest">Alasan</TableHead>
                            <TableHead className="text-[10px] font-black uppercase tracking-widest text-right">Jumlah</TableHead>
                            <TableHead className="text-[10px] font-black uppercase tracking-widest">Status</TableHead>
                            <TableHead className="text-[10px] font-black uppercase tracking-widest">Tanggal</TableHead>
                            <TableHead className="text-[10px] font-black uppercase tracking-widest text-center w-16">Aksi</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {creditNotes.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={8} className="text-center py-8 text-zinc-400 text-xs font-bold uppercase">
                                    Belum ada nota kredit
                                </TableCell>
                            </TableRow>
                        ) : (
                            creditNotes.map((note: any) => (
                                <TableRow key={note.id}>
                                    <TableCell className="font-mono font-bold text-sm">{note.number}</TableCell>
                                    <TableCell className="text-sm">{note.party || "-"}</TableCell>
                                    <TableCell className="font-mono text-xs font-bold text-blue-600">{note.invoiceNumber || "—"}</TableCell>
                                    <TableCell className="text-sm text-zinc-500 max-w-[200px] truncate">{note.reason}</TableCell>
                                    <TableCell className="text-right font-mono font-bold">{formatIDR(Number(note.amount || 0))}</TableCell>
                                    <TableCell>
                                        <Badge variant="outline" className={`text-[9px] font-black uppercase ${
                                            note.status === "DRAFT" ? "border-zinc-300 text-zinc-500" :
                                            note.status === "POSTED" ? "border-blue-300 text-blue-600 bg-blue-50" :
                                            "border-zinc-300 text-zinc-500"
                                        }`}>{note.status}</Badge>
                                    </TableCell>
                                    <TableCell className="text-xs text-zinc-500">{new Date(note.date).toLocaleDateString("id-ID")}</TableCell>
                                    <TableCell className="text-center">
                                        <button
                                            type="button"
                                            title="Lihat Detail"
                                            onClick={() => { setDetailNoteId(note.id); setShowDetail(true) }}
                                            className="flex items-center justify-center w-7 h-7 mx-auto border border-zinc-200 hover:border-black hover:bg-zinc-50 transition-colors"
                                        >
                                            <Eye className="h-3.5 w-3.5" />
                                        </button>
                                    </TableCell>
                                </TableRow>
                            ))
                        )}
                    </TableBody>
                </Table>
            </div>

            {/* Create Dialog */}
            <NBDialog open={showDialog} onOpenChange={setShowDialog}>
                <NBDialogHeader
                    icon={FileText}
                    title="Buat Nota Kredit"
                    subtitle="Retur pelanggan atau koreksi invoice"
                />
                <NBDialogBody>
                    <NBSection icon={FileText} title="Data Nota Kredit">
                        <NBSelect
                            label="Customer"
                            required
                            value={form.customerId}
                            onValueChange={(v) => setForm(f => ({ ...f, customerId: v }))}
                            placeholder="Pilih customer..."
                        >
                            {customers.map((c: any) => (
                                <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                            ))}
                        </NBSelect>

                        <NBSelect
                            label="Alasan"
                            required
                            value={form.reason}
                            onValueChange={(v) => setForm(f => ({ ...f, reason: v }))}
                            placeholder="Pilih alasan..."
                            options={REASON_CODES.map(r => ({ value: r.code, label: r.label }))}
                        />

                        <NBCurrencyInput
                            label="Jumlah (sebelum PPN)"
                            required
                            value={form.amount}
                            onChange={(v) => setForm(f => ({ ...f, amount: v }))}
                        />

                        {/* PPN */}
                        <div className="flex items-center gap-2">
                            <Checkbox
                                checked={includePPN}
                                onCheckedChange={(c) => setIncludePPN(!!c)}
                                className="border-2 border-black"
                            />
                            <span className="text-sm font-medium">Termasuk PPN 11%</span>
                            {includePPN && ppnAmount > 0 && (
                                <span className="text-xs text-zinc-500 ml-auto font-mono">PPN: {formatIDR(ppnAmount)}</span>
                            )}
                        </div>

                        <NBInput
                            label="Tanggal"
                            type="date"
                            value={form.date}
                            onChange={(v) => setForm(f => ({ ...f, date: v }))}
                        />

                        <NBTextarea
                            label="Catatan"
                            value={form.notes}
                            onChange={(v) => setForm(f => ({ ...f, notes: v }))}
                            placeholder="Keterangan tambahan..."
                            rows={2}
                        />
                    </NBSection>

                    {/* GL Preview */}
                    {subtotal > 0 && (
                        <div className="bg-zinc-50 border-2 border-black p-3">
                            <p className="text-[11px] font-bold uppercase tracking-wider text-zinc-600 mb-1 block">Preview Jurnal</p>
                            <div className="space-y-1 text-xs font-mono">
                                <div className="flex justify-between"><span>DR 4000 Pendapatan Penjualan</span><span className="font-bold">{formatIDR(subtotal)}</span></div>
                                {ppnAmount > 0 && (
                                    <div className="flex justify-between"><span>DR 2110 PPN Keluaran</span><span>{formatIDR(ppnAmount)}</span></div>
                                )}
                                <div className="flex justify-between text-zinc-500"><span>CR 1100 Piutang Usaha</span><span>{formatIDR(total)}</span></div>
                                <div className="border-t border-black pt-1 flex justify-between font-bold"><span>Total</span><span>{formatIDR(total)}</span></div>
                            </div>
                        </div>
                    )}
                </NBDialogBody>
                <NBDialogFooter
                    onCancel={() => setShowDialog(false)}
                    onSubmit={handleSubmit}
                    submitting={submitting}
                    submitLabel="Simpan & Posting"
                />
            </NBDialog>

            <DCNoteDetailDialog
                noteId={detailNoteId}
                open={showDetail}
                onOpenChange={setShowDetail}
            />
        </div>
    )
}
