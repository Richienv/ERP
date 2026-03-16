"use client"

import { useState, useEffect, useCallback } from "react"
import { NB } from "@/lib/dialog-styles"
import { formatIDR } from "@/lib/utils"
import { toast } from "sonner"
import { IconPlus, IconTrash, IconCheck, IconAlertTriangle, IconCalendar } from "@tabler/icons-react"
import { getGLAccountsList, postOpeningBalancesGL } from "@/lib/actions/finance-gl"
import type { OpeningBalanceGLRow } from "@/lib/actions/finance-gl"
import { useQueryClient } from "@tanstack/react-query"
import { queryKeys } from "@/lib/query-keys"
import { motion, AnimatePresence } from "framer-motion"
import { ComboboxWithCreate, type ComboboxOption } from "@/components/ui/combobox-with-create"

interface GLAccountOption {
    id: string
    code: string
    name: string
    type: string
}

const TYPE_BADGE: Record<string, { label: string; cls: string }> = {
    ASSET: { label: "Aset", cls: "bg-blue-500/10 text-blue-600 dark:text-blue-400" },
    LIABILITY: { label: "Liabilitas", cls: "bg-red-500/10 text-red-600 dark:text-red-400" },
    EQUITY: { label: "Ekuitas", cls: "bg-purple-500/10 text-purple-600 dark:text-purple-400" },
    REVENUE: { label: "Pendapatan", cls: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400" },
    EXPENSE: { label: "Beban", cls: "bg-amber-500/10 text-amber-600 dark:text-amber-400" },
}

const emptyRow = (): OpeningBalanceGLRow => ({ accountCode: "", debit: 0, credit: 0 })

export function OpeningBalancesGL() {
    const queryClient = useQueryClient()
    const [accounts, setAccounts] = useState<GLAccountOption[]>([])
    const [rows, setRows] = useState<OpeningBalanceGLRow[]>([emptyRow(), emptyRow(), emptyRow()])
    const [loading, setLoading] = useState(false)
    const [accountsLoading, setAccountsLoading] = useState(true)
    const [balanceDate, setBalanceDate] = useState(() => new Date().toISOString().slice(0, 10))

    useEffect(() => {
        getGLAccountsList().then((data) => { setAccounts(data); setAccountsLoading(false) })
    }, [])

    const addRow = useCallback(() => setRows((prev) => [...prev, emptyRow()]), [])
    const removeRow = useCallback((idx: number) => {
        setRows((prev) => prev.length <= 1 ? prev : prev.filter((_, i) => i !== idx))
    }, [])
    const updateRow = useCallback((idx: number, field: keyof OpeningBalanceGLRow, value: string | number) => {
        setRows((prev) => prev.map((r, i) => (i === idx ? { ...r, [field]: value } : r)))
    }, [])

    const totalDebit = rows.reduce((s, r) => s + (Number(r.debit) || 0), 0)
    const totalCredit = rows.reduce((s, r) => s + (Number(r.credit) || 0), 0)
    const difference = Math.abs(totalDebit - totalCredit)
    const isBalanced = difference < 0.01
    const validRows = rows.filter(r => r.accountCode && (r.debit > 0 || r.credit > 0))
    const getAccountForCode = (code: string) => accounts.find(a => a.code === code)

    const accountOptions: ComboboxOption[] = accounts.map(a => ({
        value: a.code,
        label: a.name,
        subtitle: a.code,
    }))

    async function handleSubmit() {
        if (validRows.length === 0) { toast.error("Tidak ada baris yang valid"); return }
        if (!isBalanced) { toast.error("Total debit dan kredit harus seimbang"); return }
        setLoading(true)
        try {
            const result = await postOpeningBalancesGL({ date: new Date(balanceDate), rows: validRows })
            if (result.success) {
                toast.success("Saldo awal GL berhasil diposting ke jurnal")
                setRows([emptyRow(), emptyRow(), emptyRow()])
                queryClient.invalidateQueries({ queryKey: queryKeys.journal.all })
                queryClient.invalidateQueries({ queryKey: queryKeys.chartAccounts.all })
                queryClient.invalidateQueries({ queryKey: queryKeys.financeDashboard.all })
                queryClient.invalidateQueries({ queryKey: queryKeys.financeReports.all })
                queryClient.invalidateQueries({ queryKey: queryKeys.accountTransactions.all })
                queryClient.invalidateQueries({ queryKey: queryKeys.openingBalances.all })
            } else { toast.error(result.error || "Gagal menyimpan") }
        } catch (err: any) { toast.error(err.message || "Terjadi kesalahan") }
        finally { setLoading(false) }
    }

    return (
        <div className="border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] overflow-hidden bg-white dark:bg-zinc-900">
            {/* Orange accent bar */}
            <div className="h-1 bg-gradient-to-r from-amber-500 via-yellow-400 to-amber-500" />

            {/* Instruction + Date — inside the card as a banner */}
            <div className="px-5 py-3 flex items-center justify-between border-b border-zinc-200 dark:border-zinc-800 bg-amber-50/50 dark:bg-amber-950/10">
                <p className="text-xs font-medium text-zinc-600 dark:text-zinc-400">
                    Masukkan saldo awal GL pada tanggal migrasi. Total debit &amp; kredit <strong className="text-zinc-900 dark:text-zinc-200">harus seimbang</strong>. Jurnal diposting otomatis.
                </p>
                <div className="flex items-center gap-2 shrink-0 ml-4">
                    <IconCalendar size={14} className="text-amber-500" />
                    <input
                        type="date"
                        value={balanceDate}
                        onChange={(e) => setBalanceDate(e.target.value)}
                        className={`h-8 text-xs font-bold border rounded-none px-2 transition-all ${balanceDate ? "border-amber-400 bg-amber-50 dark:border-amber-500 dark:bg-amber-950/30" : "border-zinc-300 bg-white"}`}
                    />
                </div>
            </div>

            {/* Column Headers */}
            <div className="grid grid-cols-[36px_1fr_80px_170px_170px_36px] gap-0 bg-zinc-50 dark:bg-zinc-800/50 border-b-2 border-black">
                <div className="px-2 py-2 text-[10px] font-black uppercase tracking-widest text-zinc-400 text-center">#</div>
                <div className="px-3 py-2 text-[10px] font-black uppercase tracking-widest text-zinc-500">Akun</div>
                <div className="px-2 py-2 text-[10px] font-black uppercase tracking-widest text-zinc-400 text-center">Tipe</div>
                <div className="px-3 py-2 text-[10px] font-black uppercase tracking-widest text-zinc-500 text-right">Debit</div>
                <div className="px-3 py-2 text-[10px] font-black uppercase tracking-widest text-zinc-500 text-right">Kredit</div>
                <div />
            </div>

            {/* Data Rows */}
            <div className="divide-y divide-zinc-100 dark:divide-zinc-800">
                <AnimatePresence>
                    {rows.map((row, idx) => {
                        const account = getAccountForCode(row.accountCode)
                        const badge = account ? TYPE_BADGE[account.type] : null
                        return (
                            <motion.div
                                key={idx}
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                exit={{ opacity: 0 }}
                                className="grid grid-cols-[36px_1fr_80px_170px_170px_36px] gap-0 items-center group hover:bg-zinc-50 dark:hover:bg-zinc-800/30 transition-colors"
                            >
                                <div className="px-2 py-2 text-[11px] text-zinc-300 font-black text-center">{idx + 1}</div>
                                <div className="px-2 py-1.5">
                                    <ComboboxWithCreate
                                        options={accountOptions}
                                        value={row.accountCode}
                                        onChange={(v) => updateRow(idx, "accountCode", v)}
                                        placeholder="Pilih akun..."
                                        searchPlaceholder="Cari kode atau nama..."
                                        emptyMessage="Akun tidak ditemukan"
                                        isLoading={accountsLoading}
                                        className="h-8 text-xs"
                                    />
                                </div>
                                <div className="px-2 py-1.5 flex justify-center">
                                    {badge && (
                                        <span className={`text-[9px] font-black uppercase px-1.5 py-0.5 whitespace-nowrap ${badge.cls}`}>
                                            {badge.label}
                                        </span>
                                    )}
                                </div>
                                <div className="px-2 py-1.5">
                                    <input
                                        type="number"
                                        value={row.debit || ""}
                                        onChange={(e) => updateRow(idx, "debit", Number(e.target.value) || 0)}
                                        placeholder="0"
                                        className={`w-full h-8 text-xs font-mono font-bold text-right border rounded-none px-2 transition-all ${
                                            row.debit > 0 ? "border-emerald-400 bg-emerald-50/50 text-emerald-700 dark:border-emerald-500 dark:bg-emerald-950/20 dark:text-emerald-400" : "border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-zinc-400"
                                        }`}
                                        min={0}
                                    />
                                </div>
                                <div className="px-2 py-1.5">
                                    <input
                                        type="number"
                                        value={row.credit || ""}
                                        onChange={(e) => updateRow(idx, "credit", Number(e.target.value) || 0)}
                                        placeholder="0"
                                        className={`w-full h-8 text-xs font-mono font-bold text-right border rounded-none px-2 transition-all ${
                                            row.credit > 0 ? "border-red-400 bg-red-50/50 text-red-700 dark:border-red-500 dark:bg-red-950/20 dark:text-red-400" : "border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-zinc-400"
                                        }`}
                                        min={0}
                                    />
                                </div>
                                <div className="flex justify-center">
                                    <button
                                        onClick={() => removeRow(idx)}
                                        className="opacity-0 group-hover:opacity-100 text-zinc-300 hover:text-red-500 transition-all p-1"
                                        disabled={rows.length <= 1}
                                    >
                                        <IconTrash size={13} />
                                    </button>
                                </div>
                            </motion.div>
                        )
                    })}
                </AnimatePresence>
            </div>

            {/* Totals Row */}
            <div className="grid grid-cols-[36px_1fr_80px_170px_170px_36px] gap-0 items-center border-t-2 border-black bg-zinc-50 dark:bg-zinc-800/50">
                <div />
                <div className="px-3 py-2.5 text-[10px] font-black uppercase tracking-widest text-zinc-500">Total</div>
                <div />
                <div className="px-3 py-2.5 text-right">
                    <span className="font-mono text-sm font-black text-emerald-600 dark:text-emerald-400 tabular-nums">{formatIDR(totalDebit)}</span>
                </div>
                <div className="px-3 py-2.5 text-right">
                    <span className="font-mono text-sm font-black text-red-600 dark:text-red-400 tabular-nums">{formatIDR(totalCredit)}</span>
                </div>
                <div />
            </div>

            {/* Footer: Add Row + Balance Status + Submit */}
            <div className="px-5 py-3 flex items-center justify-between border-t border-zinc-200 dark:border-zinc-800">
                <div className="flex items-center gap-3">
                    <button onClick={addRow} className={`${NB.toolbarBtn} flex items-center gap-1.5`}>
                        <IconPlus size={14} /> Tambah Baris
                    </button>

                    {validRows.length > 0 && (
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            className={`flex items-center gap-1.5 px-3 py-1.5 text-[10px] font-black uppercase tracking-wider border ${
                                isBalanced
                                    ? "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-400 dark:border-emerald-800"
                                    : "bg-red-50 text-red-700 border-red-200 dark:bg-red-900/20 dark:text-red-400 dark:border-red-800"
                            }`}
                        >
                            {isBalanced ? <IconCheck size={12} /> : <IconAlertTriangle size={12} />}
                            {isBalanced ? "Seimbang — siap posting" : `Selisih ${formatIDR(difference)}`}
                        </motion.div>
                    )}
                </div>

                <button
                    onClick={handleSubmit}
                    disabled={loading || validRows.length === 0 || !isBalanced}
                    className={`${NB.submitBtnOrange} disabled:opacity-40 disabled:cursor-not-allowed disabled:translate-y-0 disabled:shadow-none`}
                >
                    {loading ? "Memposting..." : `Posting ${validRows.length} Saldo Awal`}
                </button>
            </div>
        </div>
    )
}
