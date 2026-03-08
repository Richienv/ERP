"use client"

import { useState, useMemo } from "react"
import { BookOpen, Save, AlertCircle, CheckCircle2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { toast } from "sonner"
import { useOpeningBalances } from "@/hooks/use-opening-balances"
import { postOpeningBalances } from "@/lib/actions/finance-gl"
import { useQueryClient } from "@tanstack/react-query"
import { queryKeys } from "@/lib/query-keys"
import { formatIDR } from "@/lib/utils"
import { TablePageSkeleton } from "@/components/ui/page-skeleton"

const ACCOUNT_TYPE_LABELS: Record<string, string> = {
    ASSET: "Aset",
    LIABILITY: "Kewajiban",
    EQUITY: "Ekuitas",
    REVENUE: "Pendapatan",
    EXPENSE: "Beban",
}

const ACCOUNT_TYPE_COLORS: Record<string, string> = {
    ASSET: "bg-blue-100 text-blue-800 border-blue-300",
    LIABILITY: "bg-red-100 text-red-800 border-red-300",
    EQUITY: "bg-green-100 text-green-800 border-green-300",
    REVENUE: "bg-yellow-100 text-yellow-800 border-yellow-300",
    EXPENSE: "bg-orange-100 text-orange-800 border-orange-300",
}

type BalanceLine = { accountCode: string; debit: number; credit: number }

export default function OpeningBalancesPage() {
    const currentYear = new Date().getFullYear()
    const [year, setYear] = useState(currentYear)
    const { data, isLoading } = useOpeningBalances(year)
    const queryClient = useQueryClient()
    const [balances, setBalances] = useState<Record<string, { debit: string; credit: string }>>({})
    const [posting, setPosting] = useState(false)

    const accounts = data?.accounts
    const alreadyExists = data?.alreadyExists ?? false

    const { totalDebit, totalCredit, isBalanced, filledCount } = useMemo(() => {
        let deb = 0
        let cred = 0
        let count = 0
        for (const val of Object.values(balances)) {
            const d = parseFloat(val.debit) || 0
            const c = parseFloat(val.credit) || 0
            if (d > 0 || c > 0) count++
            deb += d
            cred += c
        }
        return {
            totalDebit: deb,
            totalCredit: cred,
            isBalanced: Math.abs(deb - cred) < 0.01 && deb > 0,
            filledCount: count,
        }
    }, [balances])

    const updateBalance = (code: string, field: "debit" | "credit", value: string) => {
        setBalances(prev => ({
            ...prev,
            [code]: {
                debit: field === "debit" ? value : (prev[code]?.debit ?? ""),
                credit: field === "credit" ? value : (prev[code]?.credit ?? ""),
            }
        }))
    }

    const handleSubmit = async () => {
        if (!isBalanced) {
            toast.error("Total Debit harus sama dengan Total Kredit")
            return
        }

        setPosting(true)
        try {
            const lines: BalanceLine[] = Object.entries(balances)
                .filter(([, v]) => (parseFloat(v.debit) || 0) > 0 || (parseFloat(v.credit) || 0) > 0)
                .map(([code, v]) => ({
                    accountCode: code,
                    debit: parseFloat(v.debit) || 0,
                    credit: parseFloat(v.credit) || 0,
                }))

            const result = await postOpeningBalances({ year, lines })

            if (result.success) {
                toast.success("Saldo awal berhasil disimpan")
                // Invalidate all related queries
                await Promise.all([
                    queryClient.invalidateQueries({ queryKey: queryKeys.openingBalances.all }),
                    queryClient.invalidateQueries({ queryKey: queryKeys.chartAccounts.all }),
                    queryClient.invalidateQueries({ queryKey: queryKeys.glAccounts.all }),
                    queryClient.invalidateQueries({ queryKey: queryKeys.journal.all }),
                    queryClient.invalidateQueries({ queryKey: queryKeys.financeReports.all }),
                ])
                setBalances({})
            } else {
                toast.error(result.error || "Gagal menyimpan saldo awal")
            }
        } catch {
            toast.error("Gagal menyimpan saldo awal")
        } finally {
            setPosting(false)
        }
    }

    if (isLoading || !data) return <TablePageSkeleton accentColor="bg-emerald-400" />

    return (
        <div className="mf-page">
            {/* Header */}
            <div className="border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] bg-emerald-700 text-white p-4 border-l-[6px] border-l-emerald-400">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <BookOpen className="h-6 w-6" />
                        <div>
                            <h1 className="text-xl font-bold uppercase tracking-wider">Saldo Awal</h1>
                            <p className="text-emerald-200 text-sm">Input saldo awal akun untuk memulai pembukuan</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-3">
                        <label className="text-sm font-medium">Tahun Fiskal:</label>
                        <Input
                            type="number"
                            value={year}
                            onChange={e => setYear(parseInt(e.target.value) || currentYear)}
                            className="w-24 border-2 border-white/30 bg-white/10 text-white placeholder:text-white/40"
                        />
                    </div>
                </div>
            </div>

            {/* KPI Strip */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div className="border-2 border-black shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] bg-white p-3">
                    <p className="text-xs font-bold uppercase text-zinc-500">Total Debit</p>
                    <p className="text-lg font-bold text-blue-700">{formatIDR(totalDebit)}</p>
                </div>
                <div className="border-2 border-black shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] bg-white p-3">
                    <p className="text-xs font-bold uppercase text-zinc-500">Total Kredit</p>
                    <p className="text-lg font-bold text-red-700">{formatIDR(totalCredit)}</p>
                </div>
                <div className="border-2 border-black shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] bg-white p-3">
                    <p className="text-xs font-bold uppercase text-zinc-500">Selisih</p>
                    <p className={`text-lg font-bold ${isBalanced ? "text-green-700" : "text-red-700"}`}>
                        {formatIDR(Math.abs(totalDebit - totalCredit))}
                    </p>
                </div>
                <div className="border-2 border-black shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] bg-white p-3">
                    <p className="text-xs font-bold uppercase text-zinc-500">Akun Terisi</p>
                    <p className="text-lg font-bold">{filledCount}</p>
                </div>
            </div>

            {/* Status */}
            {alreadyExists && (
                <div className="border-2 border-yellow-500 bg-yellow-50 p-3 flex items-center gap-2">
                    <AlertCircle className="h-5 w-5 text-yellow-600" />
                    <span className="text-sm font-medium text-yellow-800">
                        Saldo awal tahun {year} sudah pernah dibuat. Ubah tahun untuk membuat saldo baru.
                    </span>
                </div>
            )}

            {/* Account Groups */}
            {accounts && (["ASSET", "LIABILITY", "EQUITY", "REVENUE", "EXPENSE"] as const).map(type => {
                const group = accounts[type]
                if (!group || group.length === 0) return null

                return (
                    <div key={type} className="border-2 border-black shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] bg-white">
                        <div className={`px-4 py-2 border-b-2 border-black ${ACCOUNT_TYPE_COLORS[type]} flex items-center justify-between`}>
                            <span className="font-bold uppercase text-sm tracking-wider">
                                {ACCOUNT_TYPE_LABELS[type]}
                            </span>
                            <Badge variant="outline" className="border-black">
                                {group.length} akun
                            </Badge>
                        </div>
                        <div className="overflow-x-auto">
                            <table className="w-full">
                                <thead>
                                    <tr className="border-b border-zinc-200 text-xs uppercase text-zinc-500">
                                        <th className="text-left p-2 pl-4 w-24">Kode</th>
                                        <th className="text-left p-2">Nama Akun</th>
                                        <th className="text-left p-2 w-20">Saldo</th>
                                        <th className="text-right p-2 pr-4 w-48">Debit</th>
                                        <th className="text-right p-2 pr-4 w-48">Kredit</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {group.map((account: { id: string; code: string; name: string; type: string; balance: unknown }) => (
                                        <tr key={account.id} className="border-b border-zinc-100 hover:bg-zinc-50">
                                            <td className="p-2 pl-4 font-mono text-sm">{account.code}</td>
                                            <td className="p-2 text-sm">{account.name}</td>
                                            <td className="p-2 text-sm text-zinc-500">{formatIDR(Number(account.balance))}</td>
                                            <td className="p-2 pr-4">
                                                <Input
                                                    type="number"
                                                    min="0"
                                                    step="1"
                                                    placeholder="0"
                                                    value={balances[account.code]?.debit ?? ""}
                                                    onChange={e => updateBalance(account.code, "debit", e.target.value)}
                                                    disabled={alreadyExists || posting}
                                                    className="border-2 border-black text-right h-8 text-sm placeholder:text-zinc-300"
                                                />
                                            </td>
                                            <td className="p-2 pr-4">
                                                <Input
                                                    type="number"
                                                    min="0"
                                                    step="1"
                                                    placeholder="0"
                                                    value={balances[account.code]?.credit ?? ""}
                                                    onChange={e => updateBalance(account.code, "credit", e.target.value)}
                                                    disabled={alreadyExists || posting}
                                                    className="border-2 border-black text-right h-8 text-sm placeholder:text-zinc-300"
                                                />
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )
            })}

            {/* Submit */}
            <div className="flex items-center justify-between border-2 border-black shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] bg-white p-4">
                <div className="flex items-center gap-2">
                    {isBalanced ? (
                        <CheckCircle2 className="h-5 w-5 text-green-600" />
                    ) : (
                        <AlertCircle className="h-5 w-5 text-red-500" />
                    )}
                    <span className={`text-sm font-medium ${isBalanced ? "text-green-700" : "text-red-700"}`}>
                        {isBalanced
                            ? "Debit dan Kredit seimbang — siap disimpan"
                            : filledCount === 0
                                ? "Isi saldo debit/kredit pada akun di atas"
                                : `Selisih ${formatIDR(Math.abs(totalDebit - totalCredit))} — harus seimbang`
                        }
                    </span>
                </div>
                <Button
                    onClick={handleSubmit}
                    disabled={!isBalanced || alreadyExists || posting}
                    className="border-2 border-black shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-6 hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] transition-all"
                >
                    <Save className="h-4 w-4 mr-2" />
                    {posting ? "Menyimpan..." : "Simpan Saldo Awal"}
                </Button>
            </div>
        </div>
    )
}
