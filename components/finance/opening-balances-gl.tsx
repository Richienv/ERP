"use client"

import { useState, useEffect, useCallback } from "react"
import { NB } from "@/lib/dialog-styles"
import { formatIDR } from "@/lib/utils"
import { toast } from "sonner"
import { IconPlus, IconTrash } from "@tabler/icons-react"
import { getGLAccountsList, postOpeningBalancesGL } from "@/lib/actions/finance-gl"
import type { OpeningBalanceGLRow } from "@/lib/actions/finance-gl"
import { useQueryClient } from "@tanstack/react-query"
import { queryKeys } from "@/lib/query-keys"

interface GLAccountOption {
    id: string
    code: string
    name: string
    type: string
}

const emptyRow = (): OpeningBalanceGLRow => ({
    accountCode: "",
    debit: 0,
    credit: 0,
})

export function OpeningBalancesGL() {
    const queryClient = useQueryClient()
    const [accounts, setAccounts] = useState<GLAccountOption[]>([])
    const [rows, setRows] = useState<OpeningBalanceGLRow[]>([emptyRow()])
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
    const isBalanced = Math.abs(totalDebit - totalCredit) < 0.01
    const validRows = rows.filter(r => r.accountCode && (r.debit > 0 || r.credit > 0))

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
                setRows([emptyRow()])
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
        <div className="space-y-6">
            {/* Info banner */}
            <div className="border-2 border-black p-4 bg-amber-50 border-l-[6px] border-l-amber-500">
                <p className="text-sm font-bold">
                    Masukkan saldo awal untuk setiap akun GL pada tanggal migrasi. Total debit dan kredit harus seimbang. Jurnal akan diposting otomatis.
                </p>
            </div>

            {/* Date picker */}
            <div className="flex items-center gap-4">
                <label className={NB.label}>Tanggal Saldo Awal</label>
                <input
                    type="date"
                    value={balanceDate}
                    onChange={(e) => setBalanceDate(e.target.value)}
                    className={`${NB.input} w-48`}
                />
            </div>

            {/* Table */}
            <div className={NB.tableWrap}>
                <table className="w-full">
                    <thead>
                        <tr className={NB.tableHead}>
                            <th className={`${NB.tableHeadCell} w-8 text-center`}>#</th>
                            <th className={`${NB.tableHeadCell} min-w-[300px]`}>Akun</th>
                            <th className={`${NB.tableHeadCell} min-w-[160px] text-right`}>Debit (IDR)</th>
                            <th className={`${NB.tableHeadCell} min-w-[160px] text-right`}>Kredit (IDR)</th>
                            <th className={`${NB.tableHeadCell} w-12`} />
                        </tr>
                    </thead>
                    <tbody>
                        {rows.map((row, idx) => (
                            <tr key={idx} className={NB.tableRow}>
                                <td className={`${NB.tableCell} text-center text-xs text-zinc-400 font-bold`}>{idx + 1}</td>
                                <td className={NB.tableCell}>
                                    <select
                                        value={row.accountCode}
                                        onChange={(e) => updateRow(idx, "accountCode", e.target.value)}
                                        className={`${NB.select} text-sm`}
                                        disabled={accountsLoading}
                                    >
                                        <option value="">-- Pilih Akun --</option>
                                        {accounts.map((a) => (
                                            <option key={a.id} value={a.code}>{a.code} — {a.name}</option>
                                        ))}
                                    </select>
                                </td>
                                <td className={NB.tableCell}>
                                    <input
                                        type="number"
                                        value={row.debit || ""}
                                        onChange={(e) => updateRow(idx, "debit", Number(e.target.value) || 0)}
                                        placeholder="0"
                                        className={`${NB.inputMono} w-full text-sm text-right`}
                                        min={0}
                                    />
                                </td>
                                <td className={NB.tableCell}>
                                    <input
                                        type="number"
                                        value={row.credit || ""}
                                        onChange={(e) => updateRow(idx, "credit", Number(e.target.value) || 0)}
                                        placeholder="0"
                                        className={`${NB.inputMono} w-full text-sm text-right`}
                                        min={0}
                                    />
                                </td>
                                <td className={NB.tableCell}>
                                    <button
                                        onClick={() => removeRow(idx)}
                                        className="text-zinc-400 hover:text-red-500 transition-colors"
                                        disabled={rows.length <= 1}
                                    >
                                        <IconTrash size={16} />
                                    </button>
                                </td>
                            </tr>
                        ))}
                        {/* Totals row */}
                        <tr className="border-t-2 border-black bg-zinc-50">
                            <td className={NB.tableCell} />
                            <td className={`${NB.tableCell} text-right font-black uppercase text-xs tracking-wider`}>Total</td>
                            <td className={`${NB.tableCell} text-right font-black font-mono`}>{formatIDR(totalDebit)}</td>
                            <td className={`${NB.tableCell} text-right font-black font-mono`}>{formatIDR(totalCredit)}</td>
                            <td className={NB.tableCell} />
                        </tr>
                    </tbody>
                </table>
            </div>

            {/* Balance indicator */}
            {validRows.length > 0 && (
                <div className={`border-2 border-black px-4 py-2 text-sm font-bold ${isBalanced ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700"}`}>
                    {isBalanced
                        ? "Seimbang — siap diposting"
                        : `Tidak seimbang — selisih ${formatIDR(Math.abs(totalDebit - totalCredit))}`
                    }
                </div>
            )}

            {/* Footer */}
            <div className="flex items-center justify-between">
                <button
                    onClick={addRow}
                    className="flex items-center gap-1.5 px-4 py-2 border-2 border-black bg-white hover:bg-zinc-50 font-black uppercase text-xs tracking-wider transition-all"
                >
                    <IconPlus size={14} />
                    Tambah Baris
                </button>

                <button
                    onClick={handleSubmit}
                    disabled={loading || validRows.length === 0 || !isBalanced}
                    className={`${NB.submitBtn} px-8 py-2.5 disabled:opacity-50 disabled:cursor-not-allowed`}
                >
                    {loading ? "Memposting..." : `Posting ${validRows.length} Saldo Awal GL`}
                </button>
            </div>
        </div>
    )
}
