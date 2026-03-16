"use client"

import { useState } from "react"
import {
    BookText,
    Plus,
    Save,
    Trash2,
    CheckCircle2,
    AlertCircle,
    CalendarIcon,
    Hash,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog"
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover"
import { Calendar } from "@/components/ui/calendar"
import { ComboboxWithCreate, type ComboboxOption } from "@/components/ui/combobox-with-create"
import { NB } from "@/lib/dialog-styles"
import { postJournalEntry } from "@/lib/actions/finance"
import { updateJournalEntry } from "@/lib/actions/finance-gl"
import { formatIDR } from "@/lib/utils"
import { toast } from "sonner"
import { useQueryClient } from "@tanstack/react-query"
import { queryKeys } from "@/lib/query-keys"
import { format } from "date-fns"
import { id as localeId } from "date-fns/locale"

interface JournalLine {
    accountId: string
    description: string
    debit: number
    credit: number
}

interface EditEntry {
    id: string
    date: Date
    description: string
    reference?: string
    lines: { account: { code: string; name: string }; debit: number; credit: number; description?: string }[]
}

interface CreateJournalDialogProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    glAccounts: { id: string; code: string; name: string }[]
    editEntry?: EditEntry | null
}

export function CreateJournalDialog({ open, onOpenChange, glAccounts, editEntry }: CreateJournalDialogProps) {
    const queryClient = useQueryClient()
    const isEditMode = !!editEntry
    const [date, setDate] = useState<Date>(new Date())
    const [calOpen, setCalOpen] = useState(false)
    const [desc, setDesc] = useState("")
    const [ref, setRef] = useState("")
    const [posting, setPosting] = useState(false)
    const [lines, setLines] = useState<JournalLine[]>([
        { accountId: "", description: "", debit: 0, credit: 0 },
        { accountId: "", description: "", debit: 0, credit: 0 },
    ])

    // Pre-fill form when editEntry changes
    const [lastEditId, setLastEditId] = useState<string | null>(null)
    if (editEntry && editEntry.id !== lastEditId) {
        setLastEditId(editEntry.id)
        setDate(new Date(editEntry.date))
        setDesc(editEntry.description)
        setRef(editEntry.reference || "")
        setLines(editEntry.lines.map(l => {
            const acc = glAccounts.find(a => a.code === l.account.code)
            return {
                accountId: acc?.id || "",
                description: l.description || "",
                debit: l.debit,
                credit: l.credit,
            }
        }))
    }

    const totalDebit = lines.reduce((acc, l) => acc + (Number(l.debit) || 0), 0)
    const totalCredit = lines.reduce((acc, l) => acc + (Number(l.credit) || 0), 0)
    const isBalanced = Math.abs(totalDebit - totalCredit) < 0.01 && totalDebit > 0

    const accountOptions: ComboboxOption[] = glAccounts.map(a => ({
        value: a.id,
        label: a.name,
        subtitle: a.code,
    }))

    const updateLine = (i: number, patch: Partial<JournalLine>) => {
        setLines(prev => prev.map((l, idx) => idx === i ? { ...l, ...patch } : l))
    }

    const handleDebitChange = (i: number, val: number) => {
        updateLine(i, { debit: val, ...(val > 0 ? { credit: 0 } : {}) })
    }

    const handleCreditChange = (i: number, val: number) => {
        updateLine(i, { credit: val, ...(val > 0 ? { debit: 0 } : {}) })
    }

    const handleAddLine = () => {
        setLines(prev => [...prev, { accountId: "", description: "", debit: 0, credit: 0 }])
    }

    const handleRemoveLine = (i: number) => {
        if (lines.length <= 2) return
        setLines(prev => prev.filter((_, idx) => idx !== i))
    }

    const resetForm = () => {
        setDate(new Date())
        setDesc("")
        setRef("")
        setLastEditId(null)
        setLines([
            { accountId: "", description: "", debit: 0, credit: 0 },
            { accountId: "", description: "", debit: 0, credit: 0 },
        ])
    }

    const handleSave = async () => {
        if (!isBalanced || !desc.trim()) return
        setPosting(true)
        try {
            const validLines = lines.filter(l => (Number(l.debit) > 0 || Number(l.credit) > 0))
            if (validLines.length < 2) {
                toast.error("Minimal dua baris akun dengan nominal")
                return
            }

            const hasInvalidLine = validLines.some(l => {
                const d = Number(l.debit) || 0
                const c = Number(l.credit) || 0
                return !l.accountId || (d > 0 && c > 0) || (d <= 0 && c <= 0)
            })
            if (hasInvalidLine) {
                toast.error("Setiap baris harus punya akun, dan hanya debit atau kredit yang bernilai")
                return
            }

            const entryLines = validLines.map(l => {
                const acc = glAccounts.find(a => a.id === l.accountId)
                if (!acc) throw new Error("Account mapping not found")
                return {
                    accountCode: acc.code,
                    debit: l.debit,
                    credit: l.credit,
                    description: l.description.trim() || desc.trim(),
                }
            })

            const result = isEditMode
                ? await updateJournalEntry(editEntry!.id, {
                    date,
                    description: desc,
                    reference: ref,
                    lines: entryLines,
                })
                : await postJournalEntry({
                    date,
                    description: desc,
                    reference: ref,
                    lines: entryLines,
                })

            if (result.success) {
                toast.success(isEditMode ? "Jurnal berhasil diperbarui" : "Jurnal berhasil diposting")
                resetForm()
                onOpenChange(false)
                queryClient.invalidateQueries({ queryKey: queryKeys.journal.all })
                queryClient.invalidateQueries({ queryKey: queryKeys.financeDashboard.all })
                queryClient.invalidateQueries({ queryKey: queryKeys.chartAccounts.all })
                queryClient.invalidateQueries({ queryKey: queryKeys.glAccounts.all })
                queryClient.invalidateQueries({ queryKey: queryKeys.financeReports.all })
            } else {
                toast.error(("error" in result ? String(result.error) : "Gagal posting entry") || "Gagal posting entry")
            }
        } catch {
            toast.error("Terjadi kesalahan saat posting")
        } finally {
            setPosting(false)
        }
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-[92vw] sm:max-w-[92vw] w-full p-0 border-2 border-black shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] rounded-none overflow-hidden gap-0">
                {/* ── Black header ── */}
                <DialogHeader className={NB.header}>
                    <DialogTitle className={NB.title}>
                        <BookText className="h-5 w-5" /> {isEditMode ? "Edit Jurnal" : "Buat Jurnal Baru"}
                    </DialogTitle>
                    <p className={NB.subtitle}>
                        {isEditMode ? `Mengedit entri jurnal draft` : "Catat transaksi manual ke buku besar"}
                    </p>
                </DialogHeader>

                {/* ── Scrollable body ── */}
                <div className="max-h-[65vh] overflow-y-auto">
                    <div className="p-5 space-y-5">
                        {/* ── Info section ── */}
                        <div className={NB.section}>
                            <div className={NB.sectionHead}>
                                <CalendarIcon className="h-4 w-4 text-zinc-500" />
                                <span className={NB.sectionTitle}>Informasi Jurnal</span>
                            </div>
                            <div className={NB.sectionBody}>
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                    {/* Date picker */}
                                    <div>
                                        <label className={NB.label}>
                                            Tanggal <span className={NB.labelRequired}>*</span>
                                        </label>
                                        <Popover open={calOpen} onOpenChange={setCalOpen}>
                                            <PopoverTrigger asChild>
                                                <Button
                                                    variant="outline"
                                                    className={`${NB.input} w-full justify-start text-left font-bold`}
                                                >
                                                    <CalendarIcon className="mr-2 h-4 w-4 text-zinc-400" />
                                                    {format(date, "dd MMM yyyy", { locale: localeId })}
                                                </Button>
                                            </PopoverTrigger>
                                            <PopoverContent className="w-auto p-0 border-2 border-black rounded-none shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]" align="start">
                                                <Calendar
                                                    mode="single"
                                                    selected={date}
                                                    onSelect={(d) => {
                                                        if (d) setDate(d)
                                                        setCalOpen(false)
                                                    }}
                                                />
                                            </PopoverContent>
                                        </Popover>
                                    </div>

                                    {/* Description */}
                                    <div>
                                        <label className={NB.label}>
                                            Deskripsi <span className={NB.labelRequired}>*</span>
                                        </label>
                                        <Input
                                            value={desc}
                                            onChange={e => setDesc(e.target.value)}
                                            placeholder="Manual Adjustment..."
                                            className={NB.input}
                                        />
                                    </div>

                                    {/* Reference */}
                                    <div>
                                        <label className={NB.label}>Referensi</label>
                                        <Input
                                            value={ref}
                                            onChange={e => setRef(e.target.value)}
                                            placeholder="REF-001"
                                            className={NB.input}
                                        />
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* ── Line items ── */}
                        <div className={NB.section}>
                            <div className={NB.sectionHead}>
                                <BookText className="h-4 w-4 text-zinc-500" />
                                <span className={NB.sectionTitle}>Baris Jurnal</span>
                                <span className={NB.sectionHint}>
                                    {lines.length} baris
                                </span>
                            </div>

                            {/* Column headers */}
                            <div className={`grid grid-cols-[36px_1.2fr_1fr_150px_150px_40px] gap-2 px-4 py-2.5 ${NB.tableHead}`}>
                                <div className={NB.tableHeadCell}>#</div>
                                <div className={NB.tableHeadCell}>Akun</div>
                                <div className={NB.tableHeadCell}>Keterangan</div>
                                <div className={`${NB.tableHeadCell} text-right`}>
                                    <span className="inline-flex items-center gap-1">
                                        <span className="w-1.5 h-1.5 bg-emerald-500 inline-block" />
                                        Debit
                                    </span>
                                </div>
                                <div className={`${NB.tableHeadCell} text-right`}>
                                    <span className="inline-flex items-center gap-1">
                                        <span className="w-1.5 h-1.5 bg-red-500 inline-block" />
                                        Kredit
                                    </span>
                                </div>
                                <div className={NB.tableHeadCell}></div>
                            </div>

                            {/* Rows */}
                            {lines.map((line, i) => {
                                const hasValue = (Number(line.debit) || 0) > 0 || (Number(line.credit) || 0) > 0
                                return (
                                    <div
                                        key={i}
                                        className={`group/line grid grid-cols-[36px_1.2fr_1fr_150px_150px_40px] gap-2 px-4 py-2.5 items-center transition-colors ${NB.tableRow} ${
                                            hasValue ? "bg-white dark:bg-zinc-900" : "bg-zinc-50/50 dark:bg-zinc-800/20"
                                        }`}
                                    >
                                        {/* Row number */}
                                        <div className="flex items-center justify-center">
                                            <span className={`w-6 h-6 flex items-center justify-center text-[10px] font-black ${
                                                hasValue
                                                    ? "bg-zinc-900 dark:bg-white text-white dark:text-black"
                                                    : "bg-zinc-200 dark:bg-zinc-700 text-zinc-400 dark:text-zinc-500"
                                            }`}>
                                                {i + 1}
                                            </span>
                                        </div>

                                        {/* Account combobox */}
                                        <div>
                                            <ComboboxWithCreate
                                                options={accountOptions}
                                                value={line.accountId}
                                                onChange={v => updateLine(i, { accountId: v })}
                                                placeholder="Cari akun..."
                                                searchPlaceholder="Ketik kode atau nama..."
                                                emptyMessage="Akun tidak ditemukan"
                                                className="h-9 text-xs"
                                            />
                                        </div>

                                        {/* Per-line description */}
                                        <div>
                                            <Input
                                                value={line.description}
                                                onChange={e => updateLine(i, { description: e.target.value })}
                                                placeholder="Opsional..."
                                                className="border border-zinc-200 dark:border-zinc-700 h-9 text-xs font-medium rounded-none placeholder:text-zinc-300"
                                            />
                                        </div>

                                        {/* Debit */}
                                        <div>
                                            <Input
                                                type="number"
                                                placeholder="0"
                                                className={`border h-9 text-right text-xs font-mono font-bold rounded-none placeholder:text-zinc-300 placeholder:font-normal ${
                                                    (Number(line.debit) || 0) > 0
                                                        ? "border-emerald-400 dark:border-emerald-600 bg-emerald-50 dark:bg-emerald-950/20 text-emerald-700 dark:text-emerald-400"
                                                        : "border-zinc-200 dark:border-zinc-700 bg-zinc-50/50 dark:bg-zinc-800/30"
                                                }`}
                                                value={line.debit || ""}
                                                onChange={e => handleDebitChange(i, parseFloat(e.target.value) || 0)}
                                            />
                                        </div>

                                        {/* Credit */}
                                        <div>
                                            <Input
                                                type="number"
                                                placeholder="0"
                                                className={`border h-9 text-right text-xs font-mono font-bold rounded-none placeholder:text-zinc-300 placeholder:font-normal ${
                                                    (Number(line.credit) || 0) > 0
                                                        ? "border-red-400 dark:border-red-600 bg-red-50 dark:bg-red-950/20 text-red-700 dark:text-red-400"
                                                        : "border-zinc-200 dark:border-zinc-700 bg-zinc-50/50 dark:bg-zinc-800/30"
                                                }`}
                                                value={line.credit || ""}
                                                onChange={e => handleCreditChange(i, parseFloat(e.target.value) || 0)}
                                            />
                                        </div>

                                        {/* Delete */}
                                        <div className="flex justify-center">
                                            <button
                                                type="button"
                                                onClick={() => handleRemoveLine(i)}
                                                disabled={lines.length <= 2}
                                                className="w-7 h-7 flex items-center justify-center text-zinc-300 dark:text-zinc-600 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/20 transition-colors disabled:opacity-20 disabled:cursor-not-allowed"
                                            >
                                                <Trash2 className="h-3.5 w-3.5" />
                                            </button>
                                        </div>
                                    </div>
                                )
                            })}

                            {/* Add row button */}
                            <div className="px-4 py-3 border-t border-zinc-200 dark:border-zinc-700">
                                <button
                                    type="button"
                                    onClick={handleAddLine}
                                    className="w-full py-2.5 text-[10px] font-black uppercase tracking-widest text-zinc-400 hover:text-black dark:hover:text-white border-2 border-dashed border-zinc-200 dark:border-zinc-700 hover:border-black dark:hover:border-white transition-all flex items-center justify-center gap-2"
                                >
                                    <Plus className="h-3 w-3" /> Tambah Baris
                                </button>
                            </div>

                            {/* Totals row */}
                            <div className="grid grid-cols-[36px_1.2fr_1fr_150px_150px_40px] gap-2 px-4 py-3 bg-zinc-100 dark:bg-zinc-800/80 border-t-2 border-black dark:border-white">
                                <div></div>
                                <div className="text-[10px] font-black uppercase tracking-widest text-zinc-500 flex items-center col-span-2">
                                    Total — {lines.filter(l => (Number(l.debit) || 0) > 0 || (Number(l.credit) || 0) > 0).length} baris aktif
                                </div>
                                <div className="text-right font-mono font-black text-sm text-emerald-700 dark:text-emerald-400 tabular-nums">
                                    {formatIDR(totalDebit)}
                                </div>
                                <div className="text-right font-mono font-black text-sm text-red-700 dark:text-red-400 tabular-nums">
                                    {formatIDR(totalCredit)}
                                </div>
                                <div></div>
                            </div>
                        </div>

                        {/* ── Balance indicator ── */}
                        <div
                            className={`flex items-center justify-between p-3 text-[10px] font-black uppercase tracking-widest border-2 ${
                                isBalanced
                                    ? "bg-emerald-50 dark:bg-emerald-950/20 text-emerald-800 dark:text-emerald-400 border-emerald-400 dark:border-emerald-600"
                                    : "bg-red-50 dark:bg-red-950/20 text-red-800 dark:text-red-400 border-red-400 dark:border-red-600"
                            }`}
                        >
                            <span className="flex items-center">
                                {isBalanced ? (
                                    <><CheckCircle2 className="mr-2 h-4 w-4" /> Seimbang — Siap {isEditMode ? "Disimpan" : "Posting"}</>
                                ) : (
                                    <><AlertCircle className="mr-2 h-4 w-4" /> Tidak Seimbang</>
                                )}
                            </span>
                            {!isBalanced && (
                                <span className="text-sm font-black tabular-nums">
                                    Selisih {formatIDR(Math.abs(totalDebit - totalCredit))}
                                </span>
                            )}
                        </div>
                    </div>
                </div>

                {/* ── Sticky footer ── */}
                <div className="border-t-2 border-black dark:border-white bg-zinc-50 dark:bg-zinc-800/50 px-5 py-3 flex items-center justify-between">
                    <div className="flex items-center gap-3 text-xs text-zinc-400">
                        <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400">D: {formatIDR(totalDebit)}</span>
                        <span className="text-zinc-300 dark:text-zinc-600">|</span>
                        <span className="font-mono font-bold text-red-600 dark:text-red-400">K: {formatIDR(totalCredit)}</span>
                    </div>
                    <div className="flex items-center gap-3">
                        <Button
                            type="button"
                            variant="outline"
                            onClick={() => onOpenChange(false)}
                            className={NB.cancelBtn}
                        >
                            Batal
                        </Button>
                        <Button
                            onClick={handleSave}
                            disabled={!isBalanced || !desc.trim() || posting}
                            className={`${isEditMode ? NB.submitBtnOrange : NB.submitBtn} gap-2 disabled:opacity-40`}
                        >
                            {posting ? (
                                isEditMode ? "Menyimpan..." : "Posting..."
                            ) : (
                                <><Save className="h-3.5 w-3.5" /> {isEditMode ? "Simpan Perubahan" : "Post Entry"}</>
                            )}
                        </Button>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    )
}
