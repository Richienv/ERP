"use client"

import { useState, useEffect, useCallback } from "react"
import { NB } from "@/lib/dialog-styles"
import { formatIDR } from "@/lib/utils"
import { toast } from "sonner"
import { IconPlus, IconTrash, IconCheck, IconAlertTriangle, IconScale, IconCalendar } from "@tabler/icons-react"
import { getGLAccountsList, postOpeningBalancesGL } from "@/lib/actions/finance-gl"
import type { OpeningBalanceGLRow } from "@/lib/actions/finance-gl"
import { useQueryClient } from "@tanstack/react-query"
import { queryKeys } from "@/lib/query-keys"
import { motion, AnimatePresence } from "framer-motion"

interface GLAccountOption {
    id: string
    code: string
    name: string
    type: string
}

const TYPE_COLORS: Record<string, string> = {
    ASSET: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
    LIABILITY: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
    EQUITY: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400",
    REVENUE: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400",
    EXPENSE: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
}

const emptyRow = (): OpeningBalanceGLRow => ({
    accountCode: "",
    debit: 0,
    credit: 0,
})

export function OpeningBalancesGL() {
    const queryClient = useQueryClient()
    const [accounts, setAccounts] = useState<GLAccountOption[]>([])
    const [rows, setRows] = useState<OpeningBalanceGLRow[]>([emptyRow(), emptyRow(), emptyRow()])
    const [loading, setLoading] = useState(false)
    const [accountsLoading, setAccountsLoading] = useState(true)
    const [balanceDate, setBalanceDate] = useState(() => new Date().toISOString().slice(0, 10))

    useEffect(() => {
        getGLAccountsList().then((data) => {
            setAccounts(data)
            setAccountsLoading(false)
        })
    }, [])

    const addRow = useCallback(() => setRows((prev) => [...prev, emptyRow()]), [])

    const removeRow = useCallback((idx: number) => {
        setRows((prev) => prev.length <= 1 ? prev : prev.filter((_, i) => i !== idx))
    }, [])

    const updateRow = useCallback((idx: number, field: keyof OpeningBalanceGLRow, value: string | number) => {
        setRows((prev) =>
            prev.map((r, i) => (i === idx ? { ...r, [field]: value } : r))
        )
    }, [])

    const totalDebit = rows.reduce((s, r) => s + (Number(r.debit) || 0), 0)
    const totalCredit = rows.reduce((s, r) => s + (Number(r.credit) || 0), 0)
    const difference = Math.abs(totalDebit - totalCredit)
    const isBalanced = difference < 0.01
    const validRows = rows.filter(r => r.accountCode && (r.debit > 0 || r.credit > 0))

    const getAccountForCode = (code: string) => accounts.find(a => a.code === code)

    async function handleSubmit() {
        if (validRows.length === 0) {
            toast.error("Tidak ada baris yang valid")
            return
        }
        if (!isBalanced) {
            toast.error("Total debit dan kredit harus seimbang")
            return
        }
        setLoading(true)
        try {
            const result = await postOpeningBalancesGL({
                date: new Date(balanceDate),
                rows: validRows,
            })
            if (result.success) {
                toast.success("Saldo awal GL berhasil diposting ke jurnal")
                setRows([emptyRow(), emptyRow(), emptyRow()])
                queryClient.invalidateQueries({ queryKey: queryKeys.journal.all })
                queryClient.invalidateQueries({ queryKey: queryKeys.chartAccounts.all })
                queryClient.invalidateQueries({ queryKey: queryKeys.financeDashboard.all })
                queryClient.invalidateQueries({ queryKey: queryKeys.financeReports.all })
                queryClient.invalidateQueries({ queryKey: queryKeys.accountTransactions.all })
                queryClient.invalidateQueries({ queryKey: queryKeys.openingBalances.all })
            } else {
                toast.error(result.error || "Gagal menyimpan")
            }
        } catch (err: any) {
            toast.error(err.message || "Terjadi kesalahan")
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className="space-y-0">
            {/* ─── Instruction Card ─── */}
            <div className={NB.pageCard}>
                <div className="h-1 bg-gradient-to-r from-amber-500 via-yellow-400 to-amber-500" />

                <div className="px-5 py-4 flex items-start gap-4">
                    <div className="w-10 h-10 bg-amber-500 flex items-center justify-center shrink-0 mt-0.5">
                        <IconScale size={20} className="text-white" />
                    </div>
                    <div className="flex-1">
                        <h3 className="text-sm font-black uppercase tracking-wider text-zinc-900 dark:text-white">
                            Jurnal Saldo Awal Buku Besar
                        </h3>
                        <p className="text-zinc-500 text-xs font-medium mt-1 leading-relaxed">
                            Masukkan saldo awal untuk setiap akun GL pada tanggal migrasi. Total debit dan kredit <strong className="text-zinc-700 dark:text-zinc-300">harus seimbang</strong>.
                            Jurnal akan diposting otomatis dengan referensi OPENING-BALANCE.
                        </p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                        <IconCalendar size={14} className="text-zinc-400" />
                        <input
                            type="date"
                            value={balanceDate}
                            onChange={(e) => setBalanceDate(e.target.value)}
                            className={`${NB.inputSm} w-40 text-xs ${balanceDate ? NB.inputActive : NB.inputEmpty}`}
                        />
                    </div>
                </div>
            </div>

            {/* ─── Entry Table ─── */}
            <div className={NB.pageCard}>
                <div className="h-0.5 bg-zinc-200 dark:bg-zinc-700" />

                {/* Column Headers */}
                <div className="grid grid-cols-[40px_1fr_60px_180px_180px_40px] gap-0 bg-zinc-900 dark:bg-zinc-950">
                    <div className="px-3 py-2.5 text-[10px] font-black uppercase tracking-widest text-zinc-500">#</div>
                    <div className="px-3 py-2.5 text-[10px] font-black uppercase tracking-widest text-zinc-400">Akun</div>
                    <div className="px-3 py-2.5 text-[10px] font-black uppercase tracking-widest text-zinc-500">Tipe</div>
                    <div className="px-3 py-2.5 text-[10px] font-black uppercase tracking-widest text-emerald-500 text-right">Debit (IDR)</div>
                    <div className="px-3 py-2.5 text-[10px] font-black uppercase tracking-widest text-red-400 text-right">Kredit (IDR)</div>
                    <div />
                </div>

                {/* Data Rows */}
                <div className="divide-y divide-zinc-100 dark:divide-zinc-800">
                    <AnimatePresence>
                        {rows.map((row, idx) => {
                            const account = getAccountForCode(row.accountCode)
                            return (
                                <motion.div
                                    key={idx}
                                    initial={{ opacity: 0, height: 0 }}
                                    animate={{ opacity: 1, height: "auto" }}
                                    exit={{ opacity: 0, height: 0 }}
                                    className={`grid grid-cols-[40px_1fr_60px_180px_180px_40px] gap-0 items-center group hover:bg-orange-50/30 dark:hover:bg-orange-950/10 transition-colors ${
                                        row.accountCode ? "bg-white dark:bg-zinc-900" : "bg-zinc-50/50 dark:bg-zinc-900/50"
                                    }`}
                                >
                                    <div className="px-3 py-2 text-xs text-zinc-300 font-black">{idx + 1}</div>
                                    <div className="px-2 py-1.5">
                                        <select
                                            value={row.accountCode}
                                            onChange={(e) => updateRow(idx, "accountCode", e.target.value)}
                                            className={`w-full h-8 text-xs font-bold border rounded-none px-2 transition-all ${
                                                row.accountCode
                                                    ? "border-orange-400 bg-orange-50/50 dark:border-orange-500 dark:bg-orange-950/20"
                                                    : "border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900"
                                            }`}
                                            disabled={accountsLoading}
                                        >
                                            <option value="">Pilih akun...</option>
                                            {accounts.map((a) => (
                                                <option key={a.id} value={a.code}>{a.code} — {a.name}</option>
                                            ))}
                                        </select>
                                    </div>
                                    <div className="px-2 py-1.5">
                                        {account && (
                                            <span className={`text-[9px] font-black uppercase px-1.5 py-0.5 ${TYPE_COLORS[account.type] || "bg-zinc-100 text-zinc-600"}`}>
                                                {account.type.slice(0, 3)}
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
                                                row.debit > 0
                                                    ? "border-emerald-400 bg-emerald-50/50 text-emerald-700 dark:border-emerald-500 dark:bg-emerald-950/20 dark:text-emerald-400"
                                                    : "border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-zinc-400"
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
                                                row.credit > 0
                                                    ? "border-red-400 bg-red-50/50 text-red-700 dark:border-red-500 dark:bg-red-950/20 dark:text-red-400"
                                                    : "border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-zinc-400"
                                            }`}
                                            min={0}
                                        />
                                    </div>
                                    <div className="px-2 py-1.5 flex justify-center">
                                        <button
                                            onClick={() => removeRow(idx)}
                                            className="opacity-0 group-hover:opacity-100 text-zinc-300 hover:text-red-500 transition-all"
                                            disabled={rows.length <= 1}
                                        >
                                            <IconTrash size={14} />
                                        </button>
                                    </div>
                                </motion.div>
                            )
                        })}
                    </AnimatePresence>
                </div>

                {/* Totals Row */}
                <div className="grid grid-cols-[40px_1fr_60px_180px_180px_40px] gap-0 items-center bg-zinc-900 dark:bg-zinc-950 border-t-2 border-black">
                    <div />
                    <div className="px-3 py-3 text-[10px] font-black uppercase tracking-widest text-zinc-400">Total</div>
                    <div />
                    <div className="px-3 py-3 text-right">
                        <span className="font-mono text-sm font-black text-emerald-400">{formatIDR(totalDebit)}</span>
                    </div>
                    <div className="px-3 py-3 text-right">
                        <span className="font-mono text-sm font-black text-red-400">{formatIDR(totalCredit)}</span>
                    </div>
                    <div />
                </div>

                {/* Balance Status + Actions Bar */}
                <div className="px-5 py-3 flex items-center justify-between bg-white dark:bg-zinc-900 border-t border-zinc-200 dark:border-zinc-800">
                    <div className="flex items-center gap-3">
                        <button
                            onClick={addRow}
                            className={`${NB.toolbarBtn} flex items-center gap-1.5`}
                        >
                            <IconPlus size={14} />
                            Tambah Baris
                        </button>

                        {validRows.length > 0 && (
                            <motion.div
                                initial={{ opacity: 0, scale: 0.9 }}
                                animate={{ opacity: 1, scale: 1 }}
                                className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-black uppercase tracking-wider ${
                                    isBalanced
                                        ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400"
                                        : "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"
                                }`}
                            >
                                {isBalanced ? <IconCheck size={14} /> : <IconAlertTriangle size={14} />}
                                {isBalanced ? "Seimbang" : `Selisih ${formatIDR(difference)}`}
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
        </div>
    )
}
