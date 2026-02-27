"use client"

import { useState } from "react"
import {
    FileText,
    Plus,
    ArrowDownLeft,
    ArrowUpRight,
    ChevronUp,
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
import { formatIDR } from "@/lib/utils"
import { toast } from "sonner"
import { useCreditDebitNotes } from "@/hooks/use-credit-debit-notes"
import { createCreditNote, createDebitNote } from "@/lib/actions/finance"
import { useQueryClient } from "@tanstack/react-query"

type NoteType = "CREDIT_NOTE" | "DEBIT_NOTE"

export default function CreditDebitNotesPage() {
    const { data, isLoading } = useCreditDebitNotes()
    const queryClient = useQueryClient()
    const notes = data?.notes ?? []
    const customers = data?.customers ?? []
    const suppliers = data?.suppliers ?? []
    const revenueAccounts = data?.revenueAccounts ?? []
    const arAccounts = data?.arAccounts ?? []
    const apAccounts = data?.apAccounts ?? []
    const expenseAccounts = data?.expenseAccounts ?? []

    const [showForm, setShowForm] = useState(false)
    const [noteType, setNoteType] = useState<NoteType>("CREDIT_NOTE")
    const [submitting, setSubmitting] = useState(false)
    const [form, setForm] = useState({
        partyId: "",
        amount: "",
        reason: "",
        date: new Date().toISOString().split("T")[0],
        accountId1: "",
        accountId2: "",
    })

    const resetForm = () => setForm({ partyId: "", amount: "", reason: "", date: new Date().toISOString().split("T")[0], accountId1: "", accountId2: "" })

    const handleSubmit = async () => {
        const amount = Number(form.amount)
        if (!form.partyId || amount <= 0 || !form.reason.trim()) {
            toast.error("Lengkapi semua field yang diperlukan")
            return
        }
        if (!form.accountId1 || !form.accountId2) {
            toast.error("Pilih kedua akun COA")
            return
        }

        setSubmitting(true)
        try {
            let result: any
            if (noteType === "CREDIT_NOTE") {
                result = await createCreditNote({
                    customerId: form.partyId,
                    amount,
                    reason: form.reason.trim(),
                    date: new Date(form.date + "T12:00:00"),
                    revenueAccountId: form.accountId1,
                    arAccountId: form.accountId2,
                })
            } else {
                result = await createDebitNote({
                    supplierId: form.partyId,
                    amount,
                    reason: form.reason.trim(),
                    date: new Date(form.date + "T12:00:00"),
                    apAccountId: form.accountId1,
                    expenseAccountId: form.accountId2,
                })
            }

            if (result.success) {
                toast.success(`${noteType === "CREDIT_NOTE" ? "Credit" : "Debit"} Note ${result.number} berhasil dibuat`)
                resetForm()
                setShowForm(false)
                queryClient.invalidateQueries({ queryKey: ["credit-debit-notes"] })
                queryClient.invalidateQueries({ queryKey: ["journal"] })
            } else {
                toast.error(result.error || "Gagal membuat note")
            }
        } catch {
            toast.error("Terjadi kesalahan")
        } finally {
            setSubmitting(false)
        }
    }

    const cnCount = notes.filter((n: any) => n.type === "CREDIT_NOTE").length
    const dnCount = notes.filter((n: any) => n.type === "DEBIT_NOTE").length
    const totalCN = notes.filter((n: any) => n.type === "CREDIT_NOTE").reduce((s: number, n: any) => s + n.amount, 0)
    const totalDN = notes.filter((n: any) => n.type === "DEBIT_NOTE").reduce((s: number, n: any) => s + n.amount, 0)

    return (
        <div className="mf-page">

            {/* ═══ HEADER ═══ */}
            <div className="border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] overflow-hidden bg-white dark:bg-zinc-900">
                <div className="px-6 py-4 flex items-center justify-between border-l-[6px] border-l-violet-400">
                    <div className="flex items-center gap-3">
                        <FileText className="h-5 w-5 text-violet-500" />
                        <div>
                            <h1 className="text-xl font-black uppercase tracking-tight text-zinc-900 dark:text-white">
                                Credit & Debit Notes
                            </h1>
                            <p className="text-zinc-400 text-xs font-medium mt-0.5">
                                Retur pelanggan (CN) dan retur ke vendor (DN)
                            </p>
                        </div>
                    </div>
                    <Button
                        onClick={() => setShowForm(!showForm)}
                        className="bg-black text-white hover:bg-zinc-800 border-2 border-black shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] active:translate-y-[1px] active:shadow-none transition-all text-[10px] font-black uppercase tracking-widest h-9 px-4"
                    >
                        {showForm ? <><ChevronUp className="mr-2 h-3.5 w-3.5" /> Tutup</> : <><Plus className="mr-2 h-3.5 w-3.5" /> Buat Note</>}
                    </Button>
                </div>
            </div>

            {/* ═══ KPI ═══ */}
            <div className="bg-white dark:bg-zinc-900 border-2 border-black shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] overflow-hidden">
                <div className="grid grid-cols-2 md:grid-cols-4">
                    <div className="relative p-4 border-r-2 border-zinc-100">
                        <div className="absolute top-0 left-0 right-0 h-1 bg-blue-400" />
                        <div className="text-[10px] font-black uppercase tracking-widest text-zinc-500 mb-1">Credit Notes</div>
                        <div className="text-2xl font-black text-blue-600">{cnCount}</div>
                    </div>
                    <div className="relative p-4 border-r-2 border-zinc-100">
                        <div className="absolute top-0 left-0 right-0 h-1 bg-blue-400" />
                        <div className="text-[10px] font-black uppercase tracking-widest text-zinc-500 mb-1">Total CN</div>
                        <div className="text-xl font-black text-blue-600">{formatIDR(totalCN)}</div>
                    </div>
                    <div className="relative p-4 border-r-2 border-zinc-100">
                        <div className="absolute top-0 left-0 right-0 h-1 bg-orange-400" />
                        <div className="text-[10px] font-black uppercase tracking-widest text-zinc-500 mb-1">Debit Notes</div>
                        <div className="text-2xl font-black text-orange-600">{dnCount}</div>
                    </div>
                    <div className="relative p-4">
                        <div className="absolute top-0 left-0 right-0 h-1 bg-orange-400" />
                        <div className="text-[10px] font-black uppercase tracking-widest text-zinc-500 mb-1">Total DN</div>
                        <div className="text-xl font-black text-orange-600">{formatIDR(totalDN)}</div>
                    </div>
                </div>
            </div>

            {/* ═══ FORM ═══ */}
            {showForm && (
                <div className="bg-white dark:bg-zinc-900 border-2 border-black shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] overflow-hidden">
                    <div className="px-4 py-3 border-b-2 border-black bg-zinc-50">
                        <div className="flex gap-2">
                            <button
                                onClick={() => { setNoteType("CREDIT_NOTE"); resetForm() }}
                                className={`px-4 py-2 text-[10px] font-black uppercase tracking-widest border-2 transition-all ${noteType === "CREDIT_NOTE" ? "border-blue-600 bg-blue-50 text-blue-700" : "border-zinc-200 text-zinc-400"}`}
                            >
                                <ArrowDownLeft className="h-3 w-3 inline mr-1" /> Credit Note (Retur Customer)
                            </button>
                            <button
                                onClick={() => { setNoteType("DEBIT_NOTE"); resetForm() }}
                                className={`px-4 py-2 text-[10px] font-black uppercase tracking-widest border-2 transition-all ${noteType === "DEBIT_NOTE" ? "border-orange-600 bg-orange-50 text-orange-700" : "border-zinc-200 text-zinc-400"}`}
                            >
                                <ArrowUpRight className="h-3 w-3 inline mr-1" /> Debit Note (Retur ke Vendor)
                            </button>
                        </div>
                    </div>

                    <div className="p-4 space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div className="space-y-2">
                                <Label className="text-[10px] font-black uppercase tracking-widest text-zinc-500">
                                    {noteType === "CREDIT_NOTE" ? "Customer" : "Supplier"} <span className="text-red-500">*</span>
                                </Label>
                                <Select value={form.partyId} onValueChange={(v) => setForm(f => ({ ...f, partyId: v }))}>
                                    <SelectTrigger className="border-2 border-black h-10 font-bold rounded-none">
                                        <SelectValue placeholder={noteType === "CREDIT_NOTE" ? "Pilih customer..." : "Pilih supplier..."} />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {(noteType === "CREDIT_NOTE" ? customers : suppliers).map((p: any) => (
                                            <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-2">
                                <Label className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Jumlah (Rp) <span className="text-red-500">*</span></Label>
                                <Input
                                    type="number"
                                    value={form.amount}
                                    onChange={(e) => setForm(f => ({ ...f, amount: e.target.value }))}
                                    placeholder="0"
                                    className="border-2 border-black font-mono font-black h-10 text-right rounded-none"
                                />
                            </div>
                            <div className="space-y-2">
                                <Label className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Tanggal</Label>
                                <Input
                                    type="date"
                                    value={form.date}
                                    onChange={(e) => setForm(f => ({ ...f, date: e.target.value }))}
                                    className="border-2 border-black h-10 rounded-none"
                                />
                            </div>
                        </div>

                        <div className="space-y-2">
                            <Label className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Alasan / Keterangan <span className="text-red-500">*</span></Label>
                            <Input
                                value={form.reason}
                                onChange={(e) => setForm(f => ({ ...f, reason: e.target.value }))}
                                placeholder="Barang rusak / Retur barang / Diskon tambahan"
                                className="border-2 border-black h-10 rounded-none"
                            />
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label className="text-[10px] font-black uppercase tracking-widest text-zinc-500">
                                    {noteType === "CREDIT_NOTE" ? "Akun Revenue (Debit)" : "Akun AP (Debit)"} <span className="text-red-500">*</span>
                                </Label>
                                <Select value={form.accountId1} onValueChange={(v) => setForm(f => ({ ...f, accountId1: v }))}>
                                    <SelectTrigger className="border-2 border-black h-10 font-bold rounded-none">
                                        <SelectValue placeholder="Pilih akun..." />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {(noteType === "CREDIT_NOTE" ? revenueAccounts : apAccounts).map((a: any) => (
                                            <SelectItem key={a.id} value={a.id}>{a.code} — {a.name}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-2">
                                <Label className="text-[10px] font-black uppercase tracking-widest text-zinc-500">
                                    {noteType === "CREDIT_NOTE" ? "Akun AR / Piutang (Credit)" : "Akun Expense (Credit)"} <span className="text-red-500">*</span>
                                </Label>
                                <Select value={form.accountId2} onValueChange={(v) => setForm(f => ({ ...f, accountId2: v }))}>
                                    <SelectTrigger className="border-2 border-black h-10 font-bold rounded-none">
                                        <SelectValue placeholder="Pilih akun..." />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {(noteType === "CREDIT_NOTE" ? arAccounts : expenseAccounts).map((a: any) => (
                                            <SelectItem key={a.id} value={a.id}>{a.code} — {a.name}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>

                        <div className="flex justify-end pt-2">
                            <Button
                                onClick={handleSubmit}
                                disabled={submitting}
                                className={`text-white border-2 border-black shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] active:translate-y-[1px] active:shadow-none transition-all text-[10px] font-black uppercase tracking-widest h-10 px-8 disabled:opacity-40 ${noteType === "CREDIT_NOTE" ? "bg-blue-600 hover:bg-blue-700" : "bg-orange-600 hover:bg-orange-700"
                                    }`}
                            >
                                {submitting ? "Menyimpan..." : `Buat ${noteType === "CREDIT_NOTE" ? "Credit" : "Debit"} Note`}
                            </Button>
                        </div>
                    </div>
                </div>
            )}

            {/* ═══ TABLE ═══ */}
            <div className="bg-white dark:bg-zinc-900 border-2 border-black shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] overflow-hidden">
                <div className="px-4 py-3 border-b-2 border-black bg-zinc-50 flex items-center justify-between">
                    <span className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Riwayat CN/DN</span>
                    <span className="text-[10px] font-black uppercase tracking-widest text-zinc-400">{notes.length} records</span>
                </div>

                <div className="hidden md:grid grid-cols-12 gap-2 px-4 py-2 border-b border-zinc-200 text-[10px] font-black uppercase tracking-widest text-zinc-500">
                    <div className="col-span-1">Tipe</div>
                    <div className="col-span-2">No.</div>
                    <div className="col-span-2">Tanggal</div>
                    <div className="col-span-3">Pihak</div>
                    <div className="col-span-2">Alasan</div>
                    <div className="col-span-2 text-right">Jumlah</div>
                </div>

                {isLoading ? (
                    <div className="p-12 text-center">
                        <p className="text-[10px] font-black uppercase tracking-widest text-zinc-400 animate-pulse">Memuat...</p>
                    </div>
                ) : notes.length === 0 ? (
                    <div className="p-12 text-center">
                        <FileText className="h-8 w-8 mx-auto text-zinc-300 mb-2" />
                        <p className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Belum ada credit/debit notes</p>
                    </div>
                ) : (
                    notes.map((n: any) => (
                        <div key={n.id} className="grid grid-cols-12 gap-2 px-4 py-3 border-b border-zinc-100 hover:bg-zinc-50 transition-colors items-center">
                            <div className="col-span-1">
                                <span className={`text-[9px] font-black uppercase px-2 py-0.5 border rounded-sm ${n.type === "CREDIT_NOTE" ? "bg-blue-50 border-blue-200 text-blue-600" : "bg-orange-50 border-orange-200 text-orange-600"
                                    }`}>{n.type === "CREDIT_NOTE" ? "CN" : "DN"}</span>
                            </div>
                            <div className="col-span-2">
                                <span className="font-mono text-xs font-bold text-zinc-500">{n.number}</span>
                            </div>
                            <div className="col-span-2">
                                <span className="text-xs text-zinc-500">{new Date(n.date).toLocaleDateString("id-ID")}</span>
                            </div>
                            <div className="col-span-3">
                                <p className="text-sm font-medium truncate">{n.party}</p>
                            </div>
                            <div className="col-span-2">
                                <p className="text-xs text-zinc-500 truncate">{n.reason}</p>
                            </div>
                            <div className="col-span-2 text-right">
                                <span className={`font-mono font-bold text-sm ${n.type === "CREDIT_NOTE" ? "text-blue-600" : "text-orange-600"}`}>
                                    {formatIDR(n.amount)}
                                </span>
                            </div>
                        </div>
                    ))
                )}
            </div>
        </div>
    )
}
