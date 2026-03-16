"use client"

import { useState } from "react"
import { queryKeys } from "@/lib/query-keys"
import { Plus, FileText, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
// Textarea removed — using Input for compact layout
import { Checkbox } from "@/components/ui/checkbox"
import {
    Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select"
import {
    Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog"
import {
    Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table"
// Badge removed — using inline span for status
import { formatIDR } from "@/lib/utils"
import { toast } from "sonner"
import { useCreditDebitNotes } from "@/hooks/use-credit-debit-notes"
import { createDebitNote } from "@/lib/actions/finance"
import { useQueryClient } from "@tanstack/react-query"
import { NB } from "@/lib/dialog-styles"

const REASON_CODES = [
    { code: "RET-DEFECT", label: "Barang Cacat/Rusak" },
    { code: "RET-WRONG", label: "Barang Tidak Sesuai" },
    { code: "RET-QUALITY", label: "Kualitas Tidak Standar" },
    { code: "ADJ-OVERCHARGE", label: "Koreksi Harga (Kelebihan Bayar)" },
    { code: "ADJ-DISCOUNT", label: "Diskon Belum Dipotong" },
    { code: "OTHER", label: "Lainnya" },
]

export function NotaDebitTab() {
    const { data, isLoading } = useCreditDebitNotes()
    const queryClient = useQueryClient()
    const [showDialog, setShowDialog] = useState(false)
    const [submitting, setSubmitting] = useState(false)
    const [includePPN, setIncludePPN] = useState(true)
    const [form, setForm] = useState({
        supplierId: "",
        reason: "",
        amount: "",
        notes: "",
        date: new Date().toISOString().split("T")[0],
    })

    const debitNotes = (data?.notes ?? []).filter((n: any) => n.type === "DEBIT_NOTE")
    const suppliers = data?.suppliers ?? []
    const apAccounts = data?.apAccounts ?? []
    const expenseAccounts = data?.expenseAccounts ?? []

    const subtotal = Number(form.amount) || 0
    const ppnAmount = includePPN ? Math.round(subtotal * 0.11) : 0
    const total = subtotal + ppnAmount

    const totalDN = debitNotes.reduce((sum: number, n: any) => sum + Number(n.amount || 0), 0)
    const pendingDN = debitNotes.filter((n: any) => n.status === "DRAFT").length
    const postedDN = debitNotes.filter((n: any) => n.status === "POSTED").length

    const resetForm = () => {
        setForm({ supplierId: "", reason: "", amount: "", notes: "", date: new Date().toISOString().split("T")[0] })
        setIncludePPN(true)
    }

    const handleSubmit = async () => {
        if (!form.supplierId || subtotal <= 0 || !form.reason) {
            toast.error("Lengkapi Supplier, Jumlah, dan Alasan")
            return
        }

        const defaultAP = apAccounts[0]
        const defaultExpense = expenseAccounts[0]
        if (!defaultAP || !defaultExpense) {
            toast.error("Akun AP atau Beban tidak ditemukan. Pastikan Chart of Accounts sudah diatur.")
            return
        }

        setSubmitting(true)
        try {
            const reasonLabel = REASON_CODES.find(r => r.code === form.reason)?.label ?? form.reason
            const result = await createDebitNote({
                supplierId: form.supplierId,
                amount: total,
                reason: `[${form.reason}] ${reasonLabel}${form.notes ? ` — ${form.notes}` : ""}`,
                date: new Date(form.date + "T12:00:00"),
                apAccountId: defaultAP.id,
                expenseAccountId: defaultExpense.id,
            })

            if (result.success) {
                toast.success(`Nota Debit ${result.number} berhasil dibuat`)
                setShowDialog(false)
                resetForm()
                queryClient.invalidateQueries({ queryKey: queryKeys.dcNotes.all })
                queryClient.invalidateQueries({ queryKey: queryKeys.bills.all })
                queryClient.invalidateQueries({ queryKey: queryKeys.journal.all })
                queryClient.invalidateQueries({ queryKey: queryKeys.financeDashboard.all })
                queryClient.invalidateQueries({ queryKey: queryKeys.financeReports.all })
                queryClient.invalidateQueries({ queryKey: queryKeys.accountTransactions.all })
                queryClient.invalidateQueries({ queryKey: queryKeys.vendorPayments.all })
            } else {
                toast.error(result.error || "Gagal membuat Nota Debit")
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
            {/* ═══ UNIFIED CARD: Toolbar + KPI + Table ═══ */}
            <div className={NB.pageCard}>
                <div className={NB.pageAccent} />

                {/* Row 1: Toolbar */}
                <div className={`px-5 py-2.5 flex items-center justify-between ${NB.pageRowBorder}`}>
                    <p className="text-[11px] font-bold text-zinc-400">
                        Koreksi tagihan supplier atau retur barang
                    </p>
                    <Button onClick={() => setShowDialog(true)} className={NB.toolbarBtnPrimary}>
                        <Plus className="h-3.5 w-3.5 mr-1" /> Buat Nota Debit
                    </Button>
                </div>

                {/* Row 2: KPI Strip */}
                <div className={`${NB.kpiStrip} ${NB.pageRowBorder}`}>
                    {[
                        { label: "Total Nota Debit", count: null, amount: formatIDR(totalDN), dot: "bg-orange-500" },
                        { label: "Draft", count: pendingDN, amount: null, dot: "bg-zinc-400" },
                        { label: "Posted", count: postedDN, amount: null, dot: "bg-emerald-500" },
                    ].map((kpi) => (
                        <div key={kpi.label} className={NB.kpiCell}>
                            <div className="flex items-center gap-1.5">
                                <span className={`w-2 h-2 ${kpi.dot}`} />
                                <span className={NB.kpiLabel}>{kpi.label}</span>
                            </div>
                            <div className="flex items-center gap-2">
                                {kpi.count !== null && <span className={NB.kpiCount}>{kpi.count}</span>}
                                {kpi.amount && <span className={NB.kpiAmount}>{kpi.amount}</span>}
                            </div>
                        </div>
                    ))}
                </div>

                {/* Row 3: Table */}
                <Table>
                    <TableHeader>
                        <TableRow className="bg-zinc-50/80 dark:bg-zinc-800/30">
                            <TableHead className="text-[9px] font-black uppercase tracking-widest text-zinc-400">No</TableHead>
                            <TableHead className="text-[9px] font-black uppercase tracking-widest text-zinc-400">Supplier</TableHead>
                            <TableHead className="text-[9px] font-black uppercase tracking-widest text-zinc-400">Alasan</TableHead>
                            <TableHead className="text-[9px] font-black uppercase tracking-widest text-zinc-400 text-right">Jumlah</TableHead>
                            <TableHead className="text-[9px] font-black uppercase tracking-widest text-zinc-400">Status</TableHead>
                            <TableHead className="text-[9px] font-black uppercase tracking-widest text-zinc-400">Tanggal</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {debitNotes.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={6} className="text-center py-10 text-zinc-400 text-[10px] font-bold uppercase tracking-widest">
                                    Belum ada nota debit
                                </TableCell>
                            </TableRow>
                        ) : (
                            debitNotes.map((note: any) => (
                                <TableRow key={note.id} className="hover:bg-orange-50/30 dark:hover:bg-orange-950/10 transition-colors">
                                    <TableCell className="font-mono font-bold text-[11px] text-zinc-600 dark:text-zinc-300">{note.number}</TableCell>
                                    <TableCell className="text-sm font-medium">{note.party || "-"}</TableCell>
                                    <TableCell className="text-sm text-zinc-500 max-w-[200px] truncate">{note.reason}</TableCell>
                                    <TableCell className="text-right font-mono font-bold text-sm tabular-nums">{formatIDR(Number(note.amount || 0))}</TableCell>
                                    <TableCell>
                                        <span className={`inline-flex items-center px-1.5 py-0.5 text-[8px] font-black uppercase tracking-widest border rounded-none ${
                                            note.status === "POSTED" ? "border-emerald-300 text-emerald-600 bg-emerald-50 dark:bg-emerald-950/20" :
                                            "border-zinc-200 text-zinc-500 bg-zinc-50 dark:bg-zinc-800"
                                        }`}>{note.status}</span>
                                    </TableCell>
                                    <TableCell className="text-[11px] text-zinc-500">{new Date(note.date).toLocaleDateString("id-ID")}</TableCell>
                                </TableRow>
                            ))
                        )}
                    </TableBody>
                </Table>
            </div>

            {/* Create Dialog */}
            <Dialog open={showDialog} onOpenChange={setShowDialog}>
                <DialogContent className="max-w-2xl sm:max-w-2xl p-0 border-2 border-black shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] rounded-none overflow-hidden gap-0">
                    <DialogHeader className="bg-black text-white px-5 py-3">
                        <DialogTitle className="text-sm font-black uppercase tracking-wider text-white flex items-center gap-2">
                            <FileText className="h-4 w-4" /> Buat Nota Debit
                        </DialogTitle>
                        <p className={NB.subtitle}>Koreksi tagihan supplier atau retur barang</p>
                    </DialogHeader>

                    <div className={NB.scroll}>
                        <div className="p-4 space-y-3">
                            {/* Data Section */}
                            <div className="border border-zinc-200 dark:border-zinc-700">
                                <div className="bg-zinc-50 dark:bg-zinc-800/50 px-3 py-1.5 border-b border-zinc-200 dark:border-zinc-700 flex items-center gap-2">
                                    <FileText className="h-3.5 w-3.5 text-zinc-400" />
                                    <span className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Data Nota Debit</span>
                                </div>
                                <div className="p-3 space-y-3">
                                    <div className="grid grid-cols-2 gap-3">
                                        <div>
                                            <label className={NB.label}>Supplier <span className={NB.labelRequired}>*</span></label>
                                            <Select value={form.supplierId} onValueChange={(v) => setForm(f => ({ ...f, supplierId: v }))}>
                                                <SelectTrigger className={`h-8 text-sm rounded-none border ${
                                                    form.supplierId ? "border-orange-400 bg-orange-50/50 font-bold" : "border-zinc-300 bg-white"
                                                }`}>
                                                    <SelectValue placeholder="Pilih supplier..." />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    {suppliers.map((s: any) => (
                                                        <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                        </div>
                                        <div>
                                            <label className={NB.label}>Alasan <span className={NB.labelRequired}>*</span></label>
                                            <Select value={form.reason} onValueChange={(v) => setForm(f => ({ ...f, reason: v }))}>
                                                <SelectTrigger className={`h-8 text-sm rounded-none border ${
                                                    form.reason ? "border-orange-400 bg-orange-50/50 font-bold" : "border-zinc-300 bg-white"
                                                }`}>
                                                    <SelectValue placeholder="Pilih alasan..." />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    {REASON_CODES.map((r) => (
                                                        <SelectItem key={r.code} value={r.code}>{r.label}</SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-3 gap-3">
                                        <div>
                                            <label className={NB.label}>Jumlah (sebelum PPN) <span className={NB.labelRequired}>*</span></label>
                                            <div className={`flex items-center border h-8 rounded-none transition-colors ${
                                                subtotal > 0 ? "border-emerald-400 bg-emerald-50" : "border-zinc-300 bg-white"
                                            }`}>
                                                <span className={`pl-2 text-[10px] font-bold select-none ${subtotal > 0 ? "text-emerald-500" : "text-zinc-300"}`}>Rp</span>
                                                <input
                                                    type="text"
                                                    inputMode="numeric"
                                                    placeholder="0"
                                                    className={`w-full h-full bg-transparent text-right text-sm font-mono font-bold pr-2 pl-1 outline-none placeholder:text-zinc-300 ${
                                                        subtotal > 0 ? "text-emerald-700" : ""
                                                    }`}
                                                    value={subtotal ? subtotal.toLocaleString("id-ID") : ""}
                                                    onChange={(e) => {
                                                        const raw = e.target.value.replace(/\D/g, "")
                                                        setForm(f => ({ ...f, amount: raw }))
                                                    }}
                                                />
                                            </div>
                                        </div>
                                        <div>
                                            <label className={NB.label}>Tanggal</label>
                                            <Input
                                                type="date"
                                                value={form.date}
                                                onChange={(e) => setForm(f => ({ ...f, date: e.target.value }))}
                                                className={`border font-medium h-8 text-sm rounded-none ${
                                                    form.date ? "border-orange-400 bg-orange-50/50" : "border-zinc-300 bg-white"
                                                }`}
                                            />
                                        </div>
                                        <div>
                                            <label className={NB.label}>Catatan</label>
                                            <Input
                                                value={form.notes}
                                                onChange={(e) => setForm(f => ({ ...f, notes: e.target.value }))}
                                                placeholder="Keterangan..."
                                                className={`border font-medium h-8 text-sm rounded-none placeholder:text-zinc-400 placeholder:italic ${
                                                    form.notes ? "border-orange-400 bg-orange-50/50" : "border-zinc-300 bg-white"
                                                }`}
                                            />
                                        </div>
                                    </div>

                                    {/* PPN toggle */}
                                    <div className="flex items-center gap-2 pt-1">
                                        <Checkbox checked={includePPN} onCheckedChange={(c) => setIncludePPN(!!c)} className="border border-zinc-300 rounded-none" />
                                        <span className="text-[11px] font-medium text-zinc-600">Termasuk PPN 11%</span>
                                        {includePPN && ppnAmount > 0 && (
                                            <span className="text-[11px] text-zinc-400 ml-auto font-mono font-bold">PPN: {formatIDR(ppnAmount)}</span>
                                        )}
                                    </div>
                                </div>
                            </div>

                            {/* GL Preview */}
                            {subtotal > 0 && (
                                <div className="border border-zinc-200 dark:border-zinc-700">
                                    <div className="bg-zinc-50 dark:bg-zinc-800/50 px-3 py-1.5 border-b border-zinc-200 dark:border-zinc-700">
                                        <span className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Preview Jurnal</span>
                                    </div>
                                    <div className="p-3 space-y-1 text-[11px] font-mono">
                                        <div className="flex justify-between"><span className="text-zinc-600">DR 2100 Hutang Usaha</span><span className="font-bold text-emerald-700">{formatIDR(total)}</span></div>
                                        <div className="flex justify-between text-zinc-400"><span>CR 5000 HPP</span><span>{formatIDR(subtotal)}</span></div>
                                        {ppnAmount > 0 && (
                                            <div className="flex justify-between text-zinc-400"><span>CR 1330 PPN Masukan</span><span>{formatIDR(ppnAmount)}</span></div>
                                        )}
                                        <div className="border-t border-zinc-200 pt-1 flex justify-between font-bold text-zinc-900"><span>Total</span><span>{formatIDR(total)}</span></div>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Footer */}
                    <div className="border-t border-zinc-200 bg-zinc-50 px-4 py-2.5 flex items-center justify-end gap-2">
                        <Button variant="outline" onClick={() => setShowDialog(false)} className="border border-zinc-300 text-zinc-500 font-bold uppercase text-[10px] tracking-wider px-4 h-8 rounded-none">
                            Batal
                        </Button>
                        <Button
                            onClick={handleSubmit}
                            disabled={submitting}
                            className="bg-black text-white border border-black hover:bg-zinc-800 font-black uppercase text-[10px] tracking-wider px-5 h-8 rounded-none gap-1.5 disabled:opacity-40 transition-colors"
                        >
                            {submitting ? <><Loader2 className="h-3 w-3 animate-spin" /> Menyimpan...</> : "Simpan & Posting"}
                        </Button>
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    )
}
