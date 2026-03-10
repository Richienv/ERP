"use client"

import { useState, useEffect } from "react"
import { useQueryClient } from "@tanstack/react-query"
import { queryKeys } from "@/lib/query-keys"
import { toast } from "sonner"
import { NB } from "@/lib/dialog-styles"
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Checkbox } from "@/components/ui/checkbox"
import { IconPlus, IconPencil, IconTrash } from "@tabler/icons-react"
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

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className={NB.contentNarrow}>
                <DialogHeader className={NB.header}>
                    <DialogTitle className={NB.title}>
                        {isEdit ? (
                            <>
                                <IconPencil size={20} />
                                Edit Item Arus Kas
                            </>
                        ) : (
                            <>
                                <IconPlus size={20} />
                                Tambah Item Arus Kas
                            </>
                        )}
                    </DialogTitle>
                </DialogHeader>

                <div className="p-6 space-y-4">
                    {/* Tanggal */}
                    <div>
                        <label className={NB.label}>
                            Tanggal <span className={NB.labelRequired}>*</span>
                        </label>
                        <Input
                            type="date"
                            value={date}
                            onChange={(e) => setDate(e.target.value)}
                            className={NB.input}
                        />
                    </div>

                    {/* Deskripsi */}
                    <div>
                        <label className={NB.label}>
                            Deskripsi <span className={NB.labelRequired}>*</span>
                        </label>
                        <Input
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            placeholder="Pembayaran sewa..."
                            className={NB.input}
                        />
                    </div>

                    {/* Jumlah */}
                    <div>
                        <label className={NB.label}>
                            Jumlah (Rp) <span className={NB.labelRequired}>*</span>
                        </label>
                        <Input
                            type="number"
                            value={amount}
                            onChange={(e) => setAmount(e.target.value)}
                            placeholder="5000000"
                            min={0}
                            className={NB.input}
                        />
                    </div>

                    {/* Arah — Direction toggle */}
                    <div>
                        <label className={NB.label}>Arah</label>
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

                    {/* Rekening — GL Account select */}
                    <div>
                        <label className={NB.label}>Rekening</label>
                        <select
                            value={glAccountId}
                            onChange={(e) => setGlAccountId(e.target.value)}
                            className={NB.select}
                        >
                            <option value="">— Pilih rekening —</option>
                            <optgroup label="Rekening Bank">
                                {glAccounts.filter(a => a.code.startsWith("10")).map((a) => (
                                    <option key={a.id} value={a.id}>
                                        {a.code} — {a.name}
                                    </option>
                                ))}
                            </optgroup>
                            {glAccounts.filter(a => !a.code.startsWith("10")).length > 0 && (
                                <optgroup label="Akun Lainnya">
                                    {glAccounts.filter(a => !a.code.startsWith("10")).map((a) => (
                                        <option key={a.id} value={a.id}>
                                            {a.code} — {a.name}
                                        </option>
                                    ))}
                                </optgroup>
                            )}
                        </select>
                    </div>

                    {/* Recurring checkbox */}
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

                    {/* Recurring options — only when checked */}
                    {isRecurring && (
                        <div className="border-2 border-dashed border-zinc-300 p-4 space-y-3 bg-zinc-50">
                            <div>
                                <label className={NB.label}>Pola</label>
                                <select
                                    value={recurringPattern}
                                    onChange={(e) => setRecurringPattern(e.target.value)}
                                    className={NB.select}
                                >
                                    <option value="WEEKLY">Mingguan</option>
                                    <option value="MONTHLY">Bulanan</option>
                                    <option value="QUARTERLY">Kuartalan</option>
                                    <option value="ANNUAL">Tahunan</option>
                                </select>
                            </div>
                            <div>
                                <label className={NB.label}>Sampai tanggal</label>
                                <Input
                                    type="date"
                                    value={recurringEndDate}
                                    onChange={(e) => setRecurringEndDate(e.target.value)}
                                    className={NB.input}
                                />
                            </div>
                        </div>
                    )}

                    {/* Catatan */}
                    <div>
                        <label className={NB.label}>Catatan</label>
                        <Textarea
                            value={notes}
                            onChange={(e) => setNotes(e.target.value)}
                            placeholder="Catatan tambahan..."
                            className={NB.textarea}
                        />
                    </div>

                    {/* Actions */}
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
                        <div className="flex items-center gap-3">
                            <Button
                                type="button"
                                variant="outline"
                                onClick={() => onOpenChange(false)}
                                disabled={submitting || deleting}
                                className={NB.cancelBtn}
                            >
                                Batal
                            </Button>
                            <Button
                                type="button"
                                onClick={handleSubmit}
                                disabled={submitting || deleting}
                                className={NB.submitBtn}
                            >
                                {submitting
                                    ? "Menyimpan..."
                                    : isEdit
                                    ? "Perbarui"
                                    : "Simpan"}
                            </Button>
                        </div>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    )
}
