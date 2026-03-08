"use client"

import { useState, useMemo, useCallback } from "react"
import { useRouter } from "next/navigation"
import { useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { IconScale, IconDeviceFloppy, IconArrowLeft, IconAlertTriangle, IconCheck } from "@tabler/icons-react"
import { useOpeningBalances, type GLAccountRow } from "@/hooks/use-gl-accounts"
import { queryKeys } from "@/lib/query-keys"
import { TablePageSkeleton } from "@/components/ui/page-skeleton"
import { formatIDR } from "@/lib/utils"

const TYPE_LABELS: Record<string, string> = {
    ASSET: "Aset",
    LIABILITY: "Kewajiban",
    EQUITY: "Ekuitas",
    REVENUE: "Pendapatan",
    EXPENSE: "Beban",
}

const TYPE_COLORS: Record<string, string> = {
    ASSET: "bg-blue-500",
    LIABILITY: "bg-red-500",
    EQUITY: "bg-green-500",
    REVENUE: "bg-amber-500",
    EXPENSE: "bg-purple-500",
}

type BalanceMap = Record<string, { debit: string; credit: string }>

export default function OpeningBalancesPage() {
    const { data, isLoading } = useOpeningBalances()
    const router = useRouter()
    const queryClient = useQueryClient()
    const [submitting, setSubmitting] = useState(false)

    // Initialize balance inputs from existing data or empty
    const [balances, setBalances] = useState<BalanceMap>({})
    const [initialized, setInitialized] = useState(false)

    // Initialize from existing data once loaded
    if (data && !initialized) {
        const initial: BalanceMap = {}
        for (const type of Object.keys(data.grouped)) {
            for (const acc of data.grouped[type]) {
                const existing = data.existingLines[acc.id]
                initial[acc.id] = {
                    debit: existing?.debit ? String(existing.debit) : "",
                    credit: existing?.credit ? String(existing.credit) : "",
                }
            }
        }
        setBalances(initial)
        setInitialized(true)
    }

    const handleChange = useCallback(
        (accountId: string, field: "debit" | "credit", value: string) => {
            // Only allow numbers and dots
            const cleaned = value.replace(/[^0-9.]/g, "")
            setBalances((prev) => ({
                ...prev,
                [accountId]: {
                    ...prev[accountId],
                    [field]: cleaned,
                    // Clear the opposite field if this one is filled
                    ...(cleaned && field === "debit" ? { credit: "" } : {}),
                    ...(cleaned && field === "credit" ? { debit: "" } : {}),
                },
            }))
        },
        []
    )

    // Calculate totals
    const { totalDebit, totalCredit, isBalanced, nonZeroCount } = useMemo(() => {
        let td = 0
        let tc = 0
        let count = 0
        for (const val of Object.values(balances)) {
            const d = parseFloat(val.debit) || 0
            const c = parseFloat(val.credit) || 0
            td += d
            tc += c
            if (d > 0 || c > 0) count++
        }
        return {
            totalDebit: td,
            totalCredit: tc,
            isBalanced: Math.abs(td - tc) < 0.01 && (td > 0 || tc > 0),
            nonZeroCount: count,
        }
    }, [balances])

    const handleSubmit = async () => {
        if (!isBalanced) {
            toast.error("Total Debit harus sama dengan Total Kredit")
            return
        }

        setSubmitting(true)
        try {
            const lines = Object.entries(balances)
                .map(([accountId, val]) => ({
                    accountId,
                    debit: parseFloat(val.debit) || 0,
                    credit: parseFloat(val.credit) || 0,
                }))
                .filter((l) => l.debit > 0 || l.credit > 0)

            const res = await fetch("/api/finance/opening-balances", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    lines,
                    fiscalYearStart: "2026-01-01",
                }),
            })

            const json = await res.json()

            if (!res.ok || !json.success) {
                toast.error(json.error || "Gagal menyimpan saldo awal")
                return
            }

            toast.success(`Saldo awal berhasil disimpan (${json.data.lineCount} akun)`)

            // Invalidate related queries
            queryClient.invalidateQueries({ queryKey: queryKeys.openingBalances.all })
            queryClient.invalidateQueries({ queryKey: queryKeys.chartAccounts.all })
            queryClient.invalidateQueries({ queryKey: queryKeys.journal.all })
            queryClient.invalidateQueries({ queryKey: queryKeys.financeDashboard.all })
            queryClient.invalidateQueries({ queryKey: queryKeys.glAccounts.all })

            router.push("/finance/chart-accounts")
        } catch {
            toast.error("Terjadi kesalahan saat menyimpan")
        } finally {
            setSubmitting(false)
        }
    }

    if (isLoading || !data) {
        return <TablePageSkeleton accentColor="bg-emerald-400" />
    }

    return (
        <div className="mf-page">
            {/* Header */}
            <div className="border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] bg-white dark:bg-zinc-900 overflow-hidden">
                <div className="px-6 py-4 flex items-center justify-between border-l-[6px] border-l-emerald-500">
                    <div className="flex items-center gap-3">
                        <IconScale className="h-6 w-6 text-emerald-600" />
                        <div>
                            <h1 className="text-lg font-bold">Saldo Awal</h1>
                            <p className="text-sm text-zinc-500">
                                Input saldo awal akun untuk memulai pembukuan tahun fiskal 2026
                            </p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <button
                            onClick={() => router.push("/finance/chart-accounts")}
                            className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium border-2 border-black bg-white hover:bg-zinc-50 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] active:shadow-none active:translate-x-[2px] active:translate-y-[2px] transition-all"
                        >
                            <IconArrowLeft className="h-4 w-4" />
                            Kembali
                        </button>
                        <button
                            onClick={handleSubmit}
                            disabled={!isBalanced || submitting}
                            className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium border-2 border-black bg-emerald-500 text-white hover:bg-emerald-600 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] active:shadow-none active:translate-x-[2px] active:translate-y-[2px] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            <IconDeviceFloppy className="h-4 w-4" />
                            {submitting ? "Menyimpan..." : "Simpan Saldo Awal"}
                        </button>
                    </div>
                </div>
            </div>

            {/* Existing warning */}
            {data.hasExisting && (
                <div className="border-2 border-amber-500 bg-amber-50 dark:bg-amber-950/30 px-4 py-3 flex items-center gap-2 shadow-[2px_2px_0px_0px_rgba(0,0,0,0.3)]">
                    <IconAlertTriangle className="h-5 w-5 text-amber-600 shrink-0" />
                    <p className="text-sm text-amber-800 dark:text-amber-200">
                        Saldo awal sudah pernah diinput sebelumnya. Menyimpan ulang akan mengganti data yang lama.
                    </p>
                </div>
            )}

            {/* Balance summary strip */}
            <div className="border-2 border-black shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] bg-white dark:bg-zinc-900 overflow-hidden">
                <div className="grid grid-cols-1 md:grid-cols-3">
                    <div className="p-4 md:border-r-2 border-b-2 md:border-b-0 border-zinc-100 dark:border-zinc-800">
                        <p className="text-xs font-medium text-zinc-500 uppercase tracking-wide">Total Debit</p>
                        <p className="text-xl font-bold text-blue-600 mt-1">{formatIDR(totalDebit)}</p>
                    </div>
                    <div className="p-4 md:border-r-2 border-b-2 md:border-b-0 border-zinc-100 dark:border-zinc-800">
                        <p className="text-xs font-medium text-zinc-500 uppercase tracking-wide">Total Kredit</p>
                        <p className="text-xl font-bold text-red-600 mt-1">{formatIDR(totalCredit)}</p>
                    </div>
                    <div className="p-4">
                        <p className="text-xs font-medium text-zinc-500 uppercase tracking-wide">Status</p>
                        <div className="flex items-center gap-2 mt-1">
                            {isBalanced ? (
                                <>
                                    <IconCheck className="h-5 w-5 text-emerald-600" />
                                    <span className="text-xl font-bold text-emerald-600">Seimbang</span>
                                </>
                            ) : (
                                <>
                                    <IconAlertTriangle className="h-5 w-5 text-amber-600" />
                                    <span className="text-xl font-bold text-amber-600">
                                        {totalDebit === 0 && totalCredit === 0
                                            ? "Belum diisi"
                                            : `Selisih ${formatIDR(Math.abs(totalDebit - totalCredit))}`}
                                    </span>
                                </>
                            )}
                        </div>
                        <p className="text-xs text-zinc-400 mt-0.5">{nonZeroCount} akun terisi</p>
                    </div>
                </div>
            </div>

            {/* Account groups */}
            {Object.entries(data.grouped).map(([type, accounts]) => (
                <AccountGroup
                    key={type}
                    type={type}
                    accounts={accounts}
                    balances={balances}
                    onChange={handleChange}
                />
            ))}
        </div>
    )
}

function AccountGroup({
    type,
    accounts,
    balances,
    onChange,
}: {
    type: string
    accounts: GLAccountRow[]
    balances: BalanceMap
    onChange: (accountId: string, field: "debit" | "credit", value: string) => void
}) {
    if (accounts.length === 0) return null

    return (
        <div className="border-2 border-black shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] bg-white dark:bg-zinc-900 overflow-hidden">
            {/* Group header */}
            <div className="px-4 py-3 border-b-2 border-black bg-zinc-50 dark:bg-zinc-800 flex items-center gap-2">
                <div className={`w-3 h-3 rounded-full ${TYPE_COLORS[type] || "bg-zinc-400"}`} />
                <h2 className="font-bold text-sm uppercase tracking-wide">
                    {TYPE_LABELS[type] || type}
                </h2>
                <span className="text-xs text-zinc-400 ml-1">({accounts.length} akun)</span>
            </div>

            {/* Table */}
            <div className="overflow-x-auto">
                <table className="w-full text-sm">
                    <thead>
                        <tr className="border-b border-zinc-200 dark:border-zinc-700 bg-zinc-50/50 dark:bg-zinc-800/50">
                            <th className="text-left px-4 py-2.5 font-semibold text-zinc-600 dark:text-zinc-400 w-24">
                                Kode
                            </th>
                            <th className="text-left px-4 py-2.5 font-semibold text-zinc-600 dark:text-zinc-400">
                                Nama Akun
                            </th>
                            <th className="text-right px-4 py-2.5 font-semibold text-zinc-600 dark:text-zinc-400 w-48">
                                Debit (Rp)
                            </th>
                            <th className="text-right px-4 py-2.5 font-semibold text-zinc-600 dark:text-zinc-400 w-48">
                                Kredit (Rp)
                            </th>
                        </tr>
                    </thead>
                    <tbody>
                        {accounts.map((acc, i) => {
                            const bal = balances[acc.id] || { debit: "", credit: "" }
                            return (
                                <tr
                                    key={acc.id}
                                    className={`border-b border-zinc-100 dark:border-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors ${
                                        i % 2 === 0 ? "" : "bg-zinc-25 dark:bg-zinc-900/50"
                                    }`}
                                >
                                    <td className="px-4 py-2 font-mono text-xs text-zinc-500">
                                        {acc.code}
                                    </td>
                                    <td className="px-4 py-2 font-medium">{acc.name}</td>
                                    <td className="px-4 py-2">
                                        <input
                                            type="text"
                                            inputMode="numeric"
                                            value={bal.debit}
                                            onChange={(e) =>
                                                onChange(acc.id, "debit", e.target.value)
                                            }
                                            placeholder="0"
                                            className="w-full text-right px-3 py-1.5 border-2 border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 focus:border-blue-500 focus:outline-none font-mono text-sm placeholder:text-zinc-300 transition-colors"
                                        />
                                    </td>
                                    <td className="px-4 py-2">
                                        <input
                                            type="text"
                                            inputMode="numeric"
                                            value={bal.credit}
                                            onChange={(e) =>
                                                onChange(acc.id, "credit", e.target.value)
                                            }
                                            placeholder="0"
                                            className="w-full text-right px-3 py-1.5 border-2 border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 focus:border-red-500 focus:outline-none font-mono text-sm placeholder:text-zinc-300 transition-colors"
                                        />
                                    </td>
                                </tr>
                            )
                        })}
                    </tbody>
                </table>
            </div>
        </div>
    )
}
