"use client"

import { useState, useEffect } from "react"
import { useQueryClient } from "@tanstack/react-query"
import { queryKeys } from "@/lib/query-keys"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { IconPlus, IconPencil, IconTrash } from "@tabler/icons-react"
import { CalendarDays, Repeat, FileText, Wallet } from "lucide-react"
import {
    NBDialog,
    NBDialogHeader,
    NBDialogBody,
    NBSection,
    NBInput,
    NBCurrencyInput,
    NBSelect,
    NBTextarea,
} from "@/components/ui/nb-dialog"
import {
    createCashflowPlanItem,
    updateCashflowPlanItem,
    deleteCashflowPlanItem,
} from "@/lib/actions/finance-cashflow"
import type { CashflowItem } from "@/lib/actions/finance-cashflow"

// ─── Props ──────────────────────────────────────────────────────────────────

interface CreateCashflowItemDialogProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    editItem?: CashflowItem | null
    glAccounts: { id: string; code: string; name: string }[]
    month: number
    year: number
}

// ─── Component ──────────────────────────────────────────────────────────────

export function CreateCashflowItemDialog({
    open,
    onOpenChange,
    editItem,
    glAccounts,
    month,
    year,
}: CreateCashflowItemDialogProps) {
    const queryClient = useQueryClient()
    const isEdit = !!editItem

    // Form state
    const defaultDate = `${year}-${String(month).padStart(2, "0")}-01`
    const [date, setDate] = useState(defaultDate)
    const [description, setDescription] = useState("")
    const [amount, setAmount] = useState("")
    const [direction, setDirection] = useState<"IN" | "OUT">("IN")
    const [glAccountId, setGlAccountId] = useState("")
    const [isRecurring, setIsRecurring] = useState(false)
    const [recurringPattern, setRecurringPattern] = useState("MONTHLY")
    const [recurringEndDate, setRecurringEndDate] = useState("")
    const [notes, setNotes] = useState("")
    const [submitting, setSubmitting] = useState(false)
    const [deleting, setDeleting] = useState(false)

    // Populate form on edit
    useEffect(() => {
        if (editItem) {
            setDate(editItem.date)
            setDescription(editItem.description)
            setAmount(String(editItem.amount))
            setDirection(editItem.direction)
            setIsRecurring(editItem.isRecurring)
            setNotes("")
            // GL account needs ID — we match by code from glAccounts prop
            if (editItem.glAccountCode) {
                const match = glAccounts.find(a => a.code === editItem.glAccountCode)
                if (match) setGlAccountId(match.id)
                else setGlAccountId("")
            } else {
                setGlAccountId("")
            }
        } else {
            // Reset for create mode
            setDate(`${year}-${String(month).padStart(2, "0")}-01`)
            setDescription("")
            setAmount("")
            setDirection("IN")
            setGlAccountId("")
            setIsRecurring(false)
            setRecurringPattern("MONTHLY")
            setRecurringEndDate("")
            setNotes("")
        }
    }, [editItem, open, month, year, glAccounts])

    async function handleSubmit() {
        if (!description.trim()) {
            toast.error("Deskripsi wajib diisi")
            return
        }
        const numAmount = parseFloat(amount)
        if (!numAmount || numAmount <= 0) {
            toast.error("Jumlah harus lebih dari 0")
            return
        }
        if (!glAccountId) {
            toast.error("Rekening wajib dipilih")
            return
        }

        setSubmitting(true)
        try {
            if (isEdit && editItem) {
                await updateCashflowPlanItem(editItem.id, {
                    date,
                    description: description.trim(),
                    amount: numAmount,
                    direction,
                    glAccountId: glAccountId || null,
                    isRecurring,
                    recurringPattern: isRecurring ? recurringPattern : null,
                    recurringEndDate: isRecurring && recurringEndDate ? recurringEndDate : null,
                    notes: notes.trim() || null,
                })
                toast.success("Item berhasil diperbarui")
            } else {
                await createCashflowPlanItem({
                    date,
                    description: description.trim(),
                    amount: numAmount,
                    direction,
                    glAccountId: glAccountId || undefined,
                    isRecurring,
                    recurringPattern: isRecurring ? recurringPattern : undefined,
                    recurringEndDate: isRecurring && recurringEndDate ? recurringEndDate : undefined,
                    notes: notes.trim() || undefined,
                })
                toast.success("Item berhasil ditambahkan")
            }

            await queryClient.invalidateQueries({ queryKey: queryKeys.cashflowPlan.all })
            onOpenChange(false)
        } catch {
            toast.error(isEdit ? "Gagal memperbarui item" : "Gagal menambahkan item")
        } finally {
            setSubmitting(false)
        }
    }

    async function handleDelete() {
        if (!editItem) return
        setDeleting(true)
        try {
            await deleteCashflowPlanItem(editItem.id)
            toast.success("Item berhasil dihapus")
            await queryClient.invalidateQueries({ queryKey: queryKeys.cashflowPlan.all })
            onOpenChange(false)
        } catch {
            toast.error("Gagal menghapus item")
        } finally {
            setDeleting(false)
        }
    }

    // Build GL account options with grouping prefix
    const glAccountOptions = glAccounts.map((a) => ({
        value: a.id,
        label: `${a.code} — ${a.name}`,
    }))

    const recurringPatternOptions = [
        { value: "WEEKLY", label: "Mingguan" },
        { value: "MONTHLY", label: "Bulanan" },
        { value: "QUARTERLY", label: "Kuartalan" },
        { value: "ANNUAL", label: "Tahunan" },
    ]

    return (
        <NBDialog open={open} onOpenChange={onOpenChange} size="narrow">
            <NBDialogHeader
                icon={isEdit ? IconPencil : IconPlus}
                title={isEdit ? "Edit Item Arus Kas" : "Tambah Item Arus Kas"}
            />

            <NBDialogBody>
                <NBSection icon={CalendarDays} title="Detail Item">
                    <NBInput
                        label="Tanggal"
                        required
                        type="date"
                        value={date}
                        onChange={setDate}
                    />

                    <NBInput
                        label="Deskripsi"
                        required
                        value={description}
                        onChange={setDescription}
                        placeholder="Pembayaran sewa..."
                    />

                    <NBCurrencyInput
                        label="Jumlah"
                        required
                        value={amount}
                        onChange={setAmount}
                    />
                </NBSection>

                <NBSection icon={Wallet} title="Arah & Rekening">
                    {/* Direction toggle — kept as custom widget */}
                    <div>
                        <label className="text-[11px] font-bold uppercase tracking-wider text-zinc-600 dark:text-zinc-400 mb-1 block">
                            Arah
                        </label>
                        <div className="flex gap-0">
                            <button
                                type="button"
                                onClick={() => setDirection("IN")}
                                className={`flex-1 border-2 border-black px-4 py-2 text-xs font-black uppercase tracking-wider transition-colors ${
                                    direction === "IN"
                                        ? "bg-emerald-400 text-black"
                                        : "bg-white text-zinc-400 hover:bg-zinc-50"
                                } border-r-0`}
                            >
                                Pemasukan
                            </button>
                            <button
                                type="button"
                                onClick={() => setDirection("OUT")}
                                className={`flex-1 border-2 border-black px-4 py-2 text-xs font-black uppercase tracking-wider transition-colors ${
                                    direction === "OUT"
                                        ? "bg-red-400 text-black"
                                        : "bg-white text-zinc-400 hover:bg-zinc-50"
                                }`}
                            >
                                Pengeluaran
                            </button>
                        </div>
                    </div>

                    <NBSelect
                        label="Rekening"
                        required
                        value={glAccountId}
                        onValueChange={setGlAccountId}
                        options={glAccountOptions}
                        placeholder="— Pilih rekening —"
                    />
                </NBSection>

                {/* Recurring checkbox + conditional fields */}
                <NBSection icon={Repeat} title="Pengulangan" optional>
                    <div className="flex items-center gap-2">
                        <Checkbox
                            id="recurring"
                            checked={isRecurring}
                            onCheckedChange={(checked) => setIsRecurring(checked === true)}
                        />
                        <label
                            htmlFor="recurring"
                            className="text-xs font-bold cursor-pointer select-none"
                        >
                            Berulang (Recurring)
                        </label>
                    </div>

                    {isRecurring && (
                        <div className="border-2 border-dashed border-zinc-300 p-4 space-y-3 bg-zinc-50">
                            <NBSelect
                                label="Pola"
                                value={recurringPattern}
                                onValueChange={setRecurringPattern}
                                options={recurringPatternOptions}
                            />
                            <NBInput
                                label="Sampai tanggal"
                                type="date"
                                value={recurringEndDate}
                                onChange={setRecurringEndDate}
                            />
                        </div>
                    )}
                </NBSection>

                <NBSection icon={FileText} title="Catatan" optional>
                    <NBTextarea
                        label="Catatan"
                        value={notes}
                        onChange={setNotes}
                        placeholder="Catatan tambahan..."
                    />
                </NBSection>

                {/* Actions — custom footer with delete button for edit mode */}
                <div className="flex items-center justify-between pt-2">
                    <div>
                        {isEdit && (
                            <Button
                                type="button"
                                variant="outline"
                                onClick={handleDelete}
                                disabled={deleting || submitting}
                                className="border-2 border-red-500 text-red-600 font-black uppercase text-xs tracking-wider px-4 h-9 rounded-none hover:bg-red-50"
                            >
                                <IconTrash size={14} className="mr-1" />
                                {deleting ? "Menghapus..." : "Hapus"}
                            </Button>
                        )}
                    </div>
                    <div className="flex items-center gap-2">
                        <Button
                            type="button"
                            variant="outline"
                            onClick={() => onOpenChange(false)}
                            disabled={submitting || deleting}
                            className="border border-zinc-300 dark:border-zinc-600 text-zinc-500 font-bold uppercase text-[10px] tracking-wider px-4 h-8 rounded-none disabled:opacity-50"
                        >
                            Batal
                        </Button>
                        <Button
                            type="button"
                            onClick={handleSubmit}
                            disabled={submitting || deleting}
                            className="bg-black text-white border border-black hover:bg-zinc-800 font-black uppercase text-[10px] tracking-wider px-5 h-8 rounded-none gap-1.5 disabled:opacity-50 transition-colors"
                        >
                            {submitting
                                ? "Menyimpan..."
                                : isEdit
                                ? "Perbarui"
                                : "Simpan"}
                        </Button>
                    </div>
                </div>
            </NBDialogBody>
        </NBDialog>
    )
}
