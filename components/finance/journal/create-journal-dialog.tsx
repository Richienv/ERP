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
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover"
import { Calendar } from "@/components/ui/calendar"
import { ComboboxWithCreate, type ComboboxOption } from "@/components/ui/combobox-with-create"
import {
    NBDialog,
    NBDialogHeader,
    NBDialogBody,
    NBSection,
} from "@/components/ui/nb-dialog"
import { NB } from "@/lib/dialog-styles"
import { postJournalEntry } from "@/lib/actions/finance"
import { updateJournalEntry, getNextJournalRef } from "@/lib/actions/finance-gl"
import { formatIDR } from "@/lib/utils"
import { toast } from "sonner"
import { useQueryClient } from "@tanstack/react-query"
import { queryKeys } from "@/lib/query-keys"
import { format } from "date-fns"
import { id as localeId } from "date-fns/locale"

const JOURNAL_TYPES = [
    { value: "ADJ", label: "Penyesuaian" },
    { value: "KOR", label: "Koreksi" },
    { value: "OPN", label: "Saldo Awal" },
    { value: "CLS", label: "Jurnal Penutup" },
    { value: "RCL", label: "Reklasifikasi" },
    { value: "MEM", label: "Memorial" },
] as const

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
    const [journalType, setJournalType] = useState("")
    const [generatedRef, setGeneratedRef] = useState("")
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
        const existingRef = editEntry.reference || ""
        const matchedType = JOURNAL_TYPES.find(t => existingRef.startsWith(t.value))
        setJournalType(matchedType?.value || "")
        setGeneratedRef(existingRef)
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
        setJournalType("")
        setGeneratedRef("")
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

            // Generate sequential reference from type
            const reference = journalType
                ? (isEditMode ? generatedRef : await getNextJournalRef(journalType))
                : ""

            const result = isEditMode
                ? await updateJournalEntry(editEntry!.id, {
                    date,
                    description: desc,
                    reference,
                    lines: entryLines,
                })
                : await postJournalEntry({
                    date,
                    description: desc,
                    reference,
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
        <NBDialog open={open} onOpenChange={onOpenChange} size="wide">
            <NBDialogHeader
                icon={BookText}
                title={isEditMode ? "Edit Jurnal" : "Buat Jurnal Baru"}
                subtitle={isEditMode ? "Mengedit entri jurnal draft" : "Catat transaksi manual ke buku besar"}
            />

            <NBDialogBody>
                {/* ── Info section ── */}
                <NBSection icon={CalendarIcon} title="Informasi Jurnal">
                    <div className="grid grid-cols-3 gap-3">
                        {/* Date picker — Popover-based, keep as-is */}
                        <div>
                            <label className="text-[11px] font-bold uppercase tracking-wider text-zinc-600 dark:text-zinc-400 mb-1 block">
                                Tanggal <span className="text-red-500">*</span>
                            </label>
                            <Popover open={calOpen} onOpenChange={setCalOpen}>
                                <PopoverTrigger asChild>
                                    <Button
                                        variant="outline"
                                        className={`font-bold h-8 w-full justify-start text-left text-xs rounded-none border ${NB.inputActive}`}
                                    >
                                        <CalendarIcon className={`mr-2 h-3.5 w-3.5 ${NB.inputIconActive}`} />
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
                            <label className="text-[11px] font-bold uppercase tracking-wider text-zinc-600 dark:text-zinc-400 mb-1 block">
                                Deskripsi <span className="text-red-500">*</span>
                            </label>
                            <Input
                                value={desc}
                                onChange={e => setDesc(e.target.value)}
                                placeholder="Manual Adjustment..."
                                className={`border font-medium h-8 text-sm rounded-none placeholder:text-zinc-400 placeholder:italic placeholder:font-normal transition-colors ${
                                    desc
                                        ? "border-orange-400 dark:border-orange-500 bg-orange-50/50 dark:bg-orange-950/20 text-zinc-900 dark:text-white"
                                        : "border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900"
                                }`}
                            />
                        </div>

                        {/* Journal Type + Generated Ref — native select, keep as-is */}
                        <div>
                            <label className="text-[11px] font-bold uppercase tracking-wider text-zinc-600 dark:text-zinc-400 mb-1 block">Tipe Jurnal</label>
                            <div className="flex gap-1.5">
                                <select
                                    value={journalType}
                                    onChange={e => {
                                        setJournalType(e.target.value)
                                        if (e.target.value) {
                                            const year = new Date().getFullYear()
                                            setGeneratedRef(`${e.target.value}-${year}-···`)
                                        } else {
                                            setGeneratedRef("")
                                        }
                                    }}
                                    className={`border font-medium h-8 text-[11px] rounded-none px-2 flex-1 transition-colors cursor-pointer ${
                                        journalType
                                            ? "border-orange-400 dark:border-orange-500 bg-orange-50/50 dark:bg-orange-950/20 text-zinc-900 dark:text-white font-bold"
                                            : "border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-zinc-400"
                                    }`}
                                >
                                    <option value="">Pilih tipe...</option>
                                    {JOURNAL_TYPES.map(t => (
                                        <option key={t.value} value={t.value}>{t.value} — {t.label}</option>
                                    ))}
                                </select>
                                {generatedRef && (
                                    <div className="flex items-center px-2 h-8 border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-[10px] font-mono font-bold text-zinc-500 dark:text-zinc-400 whitespace-nowrap">
                                        {generatedRef}
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </NBSection>

                {/* ── Line items section — complex dynamic rows, keep internals as-is ── */}
                <div className="border border-zinc-200 dark:border-zinc-700">
                    <div className="bg-zinc-50 dark:bg-zinc-800/50 px-3 py-1.5 border-b border-zinc-200 dark:border-zinc-700 flex items-center gap-2">
                        <BookText className="h-3.5 w-3.5 text-zinc-400" />
                        <span className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Baris Jurnal</span>
                        <span className="text-[10px] font-medium text-zinc-400 ml-auto">
                            {lines.length} baris
                        </span>
                    </div>

                    {/* Column headers */}
                    <div className={`grid grid-cols-[24px_1.3fr_1fr_100px_100px_28px] gap-1.5 px-3 py-1.5 bg-zinc-100 dark:bg-zinc-800 border-b border-zinc-200 dark:border-zinc-700`}>
                        <div className="text-[9px] font-black uppercase tracking-widest text-zinc-400">#</div>
                        <div className="text-[9px] font-black uppercase tracking-widest text-zinc-400">Akun</div>
                        <div className="text-[9px] font-black uppercase tracking-widest text-zinc-400">Keterangan</div>
                        <div className="text-[9px] font-black uppercase tracking-widest text-zinc-400 text-right">
                            <span className="inline-flex items-center gap-1">
                                <span className="w-1 h-1 bg-emerald-500 inline-block" />
                                Debit
                            </span>
                        </div>
                        <div className="text-[9px] font-black uppercase tracking-widest text-zinc-400 text-right">
                            <span className="inline-flex items-center gap-1">
                                <span className="w-1 h-1 bg-red-500 inline-block" />
                                Kredit
                            </span>
                        </div>
                        <div></div>
                    </div>

                    {/* Rows */}
                    {lines.map((line, i) => {
                        const hasValue = (Number(line.debit) || 0) > 0 || (Number(line.credit) || 0) > 0
                        return (
                            <div
                                key={i}
                                className={`group/line grid grid-cols-[24px_1.3fr_1fr_100px_100px_28px] gap-1.5 px-3 py-1.5 items-center transition-colors border-b border-zinc-100 dark:border-zinc-800 last:border-b-0 ${
                                    hasValue ? "bg-white dark:bg-zinc-900" : "bg-zinc-50/30 dark:bg-zinc-800/10"
                                }`}
                            >
                                {/* Row number */}
                                <div className="flex items-center justify-center">
                                    <span className={`w-5 h-5 flex items-center justify-center text-[9px] font-black ${
                                        hasValue
                                            ? "bg-zinc-900 dark:bg-white text-white dark:text-black"
                                            : "bg-zinc-200 dark:bg-zinc-700 text-zinc-400 dark:text-zinc-500"
                                    }`}>
                                        {i + 1}
                                    </span>
                                </div>

                                {/* Account combobox — keep as-is */}
                                <div>
                                    <ComboboxWithCreate
                                        options={accountOptions}
                                        value={line.accountId}
                                        onChange={v => updateLine(i, { accountId: v })}
                                        placeholder="Cari akun..."
                                        searchPlaceholder="Ketik kode atau nama..."
                                        emptyMessage="Akun tidak ditemukan"
                                        className={`h-7 text-[11px] ${line.accountId
                                            ? "!border-orange-400 dark:!border-orange-500 !bg-orange-50/50 dark:!bg-orange-950/20"
                                            : "!border-zinc-200 dark:!border-zinc-700 !border"
                                        }`}
                                    />
                                </div>

                                {/* Per-line description */}
                                <div>
                                    <Input
                                        value={line.description}
                                        onChange={e => updateLine(i, { description: e.target.value })}
                                        placeholder="Opsional..."
                                        className={`border h-7 text-[11px] font-medium rounded-none placeholder:text-zinc-300 ${
                                            line.description
                                                ? "border-orange-400 dark:border-orange-500 bg-orange-50/50 dark:bg-orange-950/20"
                                                : "border-zinc-200 dark:border-zinc-700"
                                        }`}
                                    />
                                </div>

                                {/* Debit */}
                                <div className={`flex items-center border h-7 rounded-none transition-colors ${
                                    (Number(line.debit) || 0) > 0
                                        ? "border-emerald-400 dark:border-emerald-600 bg-emerald-50 dark:bg-emerald-950/20"
                                        : "border-zinc-200 dark:border-zinc-700 bg-zinc-50/50 dark:bg-zinc-800/30"
                                }`}>
                                    <span className={`pl-1.5 text-[9px] font-bold select-none ${
                                        (Number(line.debit) || 0) > 0 ? "text-emerald-500 dark:text-emerald-500" : "text-zinc-300 dark:text-zinc-600"
                                    }`}>Rp</span>
                                    <input
                                        type="text"
                                        inputMode="numeric"
                                        placeholder="0"
                                        className={`w-full h-full bg-transparent text-right text-[11px] font-mono font-bold pr-1.5 pl-1 outline-none placeholder:text-zinc-300 placeholder:font-normal ${
                                            (Number(line.debit) || 0) > 0 ? "text-emerald-700 dark:text-emerald-400" : ""
                                        }`}
                                        value={line.debit ? Number(line.debit).toLocaleString("id-ID") : ""}
                                        onChange={e => {
                                            const raw = e.target.value.replace(/\D/g, "")
                                            handleDebitChange(i, parseInt(raw) || 0)
                                        }}
                                    />
                                </div>

                                {/* Credit */}
                                <div className={`flex items-center border h-7 rounded-none transition-colors ${
                                    (Number(line.credit) || 0) > 0
                                        ? "border-red-400 dark:border-red-600 bg-red-50 dark:bg-red-950/20"
                                        : "border-zinc-200 dark:border-zinc-700 bg-zinc-50/50 dark:bg-zinc-800/30"
                                }`}>
                                    <span className={`pl-1.5 text-[9px] font-bold select-none ${
                                        (Number(line.credit) || 0) > 0 ? "text-red-500 dark:text-red-500" : "text-zinc-300 dark:text-zinc-600"
                                    }`}>Rp</span>
                                    <input
                                        type="text"
                                        inputMode="numeric"
                                        placeholder="0"
                                        className={`w-full h-full bg-transparent text-right text-[11px] font-mono font-bold pr-1.5 pl-1 outline-none placeholder:text-zinc-300 placeholder:font-normal ${
                                            (Number(line.credit) || 0) > 0 ? "text-red-700 dark:text-red-400" : ""
                                        }`}
                                        value={line.credit ? Number(line.credit).toLocaleString("id-ID") : ""}
                                        onChange={e => {
                                            const raw = e.target.value.replace(/\D/g, "")
                                            handleCreditChange(i, parseInt(raw) || 0)
                                        }}
                                    />
                                </div>

                                {/* Delete */}
                                <div className="flex justify-center">
                                    <button
                                        type="button"
                                        onClick={() => handleRemoveLine(i)}
                                        disabled={lines.length <= 2}
                                        className="w-5 h-5 flex items-center justify-center text-zinc-300 dark:text-zinc-600 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/20 transition-colors disabled:opacity-20 disabled:cursor-not-allowed"
                                    >
                                        <Trash2 className="h-3 w-3" />
                                    </button>
                                </div>
                            </div>
                        )
                    })}

                    {/* Add row button */}
                    <div className="px-3 py-2 border-t border-zinc-200 dark:border-zinc-700">
                        <button
                            type="button"
                            onClick={handleAddLine}
                            className="w-full py-1.5 text-[9px] font-black uppercase tracking-widest text-zinc-400 hover:text-black dark:hover:text-white border border-dashed border-zinc-200 dark:border-zinc-700 hover:border-black dark:hover:border-white transition-all flex items-center justify-center gap-1.5"
                        >
                            <Plus className="h-2.5 w-2.5" /> Tambah Baris
                        </button>
                    </div>

                    {/* Totals row */}
                    <div className="grid grid-cols-[24px_1.3fr_1fr_100px_100px_28px] gap-1.5 px-3 py-2 bg-zinc-100 dark:bg-zinc-800/80 border-t-2 border-black dark:border-white">
                        <div></div>
                        <div className="text-[9px] font-black uppercase tracking-widest text-zinc-500 flex items-center col-span-2">
                            Total — {lines.filter(l => (Number(l.debit) || 0) > 0 || (Number(l.credit) || 0) > 0).length} baris aktif
                        </div>
                        <div className="text-right font-mono font-black text-xs text-emerald-700 dark:text-emerald-400 tabular-nums">
                            {formatIDR(totalDebit)}
                        </div>
                        <div className="text-right font-mono font-black text-xs text-red-700 dark:text-red-400 tabular-nums">
                            {formatIDR(totalCredit)}
                        </div>
                        <div></div>
                    </div>
                </div>

                {/* ── Balance indicator — keep as-is ── */}
                <div
                    className={`flex items-center justify-between px-3 py-2 text-[9px] font-black uppercase tracking-widest border ${
                        isBalanced
                            ? "bg-emerald-50 dark:bg-emerald-950/20 text-emerald-800 dark:text-emerald-400 border-emerald-300 dark:border-emerald-600"
                            : "bg-red-50 dark:bg-red-950/20 text-red-800 dark:text-red-400 border-red-300 dark:border-red-600"
                    }`}
                >
                    <span className="flex items-center">
                        {isBalanced ? (
                            <><CheckCircle2 className="mr-1.5 h-3.5 w-3.5" /> Seimbang — Siap {isEditMode ? "Disimpan" : "Posting"}</>
                        ) : (
                            <><AlertCircle className="mr-1.5 h-3.5 w-3.5" /> Tidak Seimbang</>
                        )}
                    </span>
                    {!isBalanced && (
                        <span className="text-xs font-black tabular-nums">
                            Selisih {formatIDR(Math.abs(totalDebit - totalCredit))}
                        </span>
                    )}
                </div>
            </NBDialogBody>

            {/* ── Custom footer with left-side totals ── */}
            <div className="border-t border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800/50 px-4 py-2.5 flex items-center justify-between">
                <div className="flex items-center gap-2 text-[10px] text-zinc-400">
                    <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400">D: {formatIDR(totalDebit)}</span>
                    <span className="text-zinc-300 dark:text-zinc-600">|</span>
                    <span className="font-mono font-bold text-red-600 dark:text-red-400">K: {formatIDR(totalCredit)}</span>
                </div>
                <div className="flex items-center gap-2">
                    <Button
                        type="button"
                        variant="outline"
                        onClick={() => onOpenChange(false)}
                        className="border border-zinc-300 dark:border-zinc-600 text-zinc-500 font-bold uppercase text-[10px] tracking-wider px-4 h-8 rounded-none"
                    >
                        Batal
                    </Button>
                    <Button
                        onClick={handleSave}
                        disabled={!isBalanced || !desc.trim() || posting}
                        className={`${isEditMode
                            ? "bg-orange-500 text-white border border-orange-600 hover:bg-orange-600"
                            : "bg-black text-white border border-black hover:bg-zinc-800"
                        } font-black uppercase text-[10px] tracking-wider px-5 h-8 rounded-none gap-1.5 disabled:opacity-40 transition-colors`}
                    >
                        {posting ? (
                            isEditMode ? "Menyimpan..." : "Posting..."
                        ) : (
                            <><Save className="h-3 w-3" /> {isEditMode ? "Simpan" : "Post Entry"}</>
                        )}
                    </Button>
                </div>
            </div>
        </NBDialog>
    )
}
