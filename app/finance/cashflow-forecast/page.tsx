"use client"

import { Fragment, useState } from "react"
import { useQueryClient } from "@tanstack/react-query"
import { useCashflowForecast } from "@/hooks/use-cashflow-forecast"
import { TablePageSkeleton } from "@/components/ui/page-skeleton"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { formatCurrency } from "@/lib/utils"
import { queryKeys } from "@/lib/query-keys"
import { IconRefresh, IconChevronDown, IconChevronRight, IconTrendingUp, IconTrendingDown, IconWallet, IconCash } from "@tabler/icons-react"
import {
    ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from "recharts"

export const dynamic = "force-dynamic"

const CATEGORY_LABELS: Record<string, string> = {
    AR_INVOICE: "Piutang (AR Invoice)",
    AP_BILL: "Hutang (AP Bill)",
    PO_DIRECT: "Purchase Order",
    PAYROLL: "Gaji Karyawan",
    BPJS: "BPJS",
    WO_COST: "Biaya Produksi",
    PETTY_CASH: "Kas Kecil",
    RECURRING_JOURNAL: "Jurnal Berulang",
    BUDGET_ALLOCATION: "Anggaran",
    FUNDING_CAPITAL: "Modal Masuk",
    EQUITY_WITHDRAWAL: "Penarikan Ekuitas",
    LOAN_DISBURSEMENT: "Pencairan Pinjaman",
    LOAN_REPAYMENT: "Cicilan Pinjaman",
    MANUAL: "Manual",
    RECURRING_INCOME: "Pendapatan Berulang",
    RECURRING_EXPENSE: "Pengeluaran Berulang",
}

export default function CashflowForecastPage() {
    const { data, isLoading } = useCashflowForecast(6)
    const queryClient = useQueryClient()
    const [expandedMonth, setExpandedMonth] = useState<string | null>(null)

    if (isLoading || !data) return <TablePageSkeleton accentColor="bg-purple-400" />

    const chartData = data.months.map((m) => ({
        name: m.label,
        "Kas Masuk": m.totalIn,
        "Kas Keluar": m.totalOut,
        "Saldo": m.runningBalance,
    }))

    const handleRefresh = () => {
        queryClient.invalidateQueries({ queryKey: queryKeys.cashflowForecast.all })
    }

    return (
        <div className="mf-page">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold">Proyeksi Arus Kas</h1>
                    <p className="text-sm text-muted-foreground">Proyeksi 6 bulan ke depan dari semua modul</p>
                </div>
                <Button variant="outline" size="sm" onClick={handleRefresh} className="border-2 border-black">
                    <IconRefresh className="h-4 w-4 mr-1" /> Refresh
                </Button>
            </div>

            {/* KPI Strip */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <Card className="border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
                    <CardContent className="p-4">
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <IconWallet className="h-4 w-4" /> Saldo Awal
                        </div>
                        <div className="text-xl font-bold mt-1">{formatCurrency(data.startingBalance)}</div>
                        <div className="text-xs text-muted-foreground">Bulan ini</div>
                    </CardContent>
                </Card>
                <Card className="border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
                    <CardContent className="p-4">
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <IconTrendingUp className="h-4 w-4 text-green-600" /> Kas Masuk Proyeksi
                        </div>
                        <div className="text-xl font-bold mt-1 text-green-600">{formatCurrency(data.totals.totalIn)}</div>
                        <div className="text-xs text-muted-foreground">6 bulan</div>
                    </CardContent>
                </Card>
                <Card className="border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
                    <CardContent className="p-4">
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <IconTrendingDown className="h-4 w-4 text-red-600" /> Kas Keluar Proyeksi
                        </div>
                        <div className="text-xl font-bold mt-1 text-red-600">{formatCurrency(data.totals.totalOut)}</div>
                        <div className="text-xs text-muted-foreground">6 bulan</div>
                    </CardContent>
                </Card>
                <Card className="border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
                    <CardContent className="p-4">
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <IconCash className="h-4 w-4" /> Saldo Akhir Proyeksi
                        </div>
                        <div className="text-xl font-bold mt-1">{formatCurrency(data.totals.endingBalance)}</div>
                        <div className="text-xs text-muted-foreground">Proyeksi akhir</div>
                    </CardContent>
                </Card>
            </div>

            {/* Chart */}
            <Card className="border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
                <CardHeader>
                    <CardTitle className="text-lg">Grafik Arus Kas</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="h-[350px]">
                        <ResponsiveContainer width="100%" height="100%">
                            <ComposedChart data={chartData}>
                                <CartesianGrid strokeDasharray="3 3" />
                                <XAxis dataKey="name" fontSize={12} />
                                <YAxis fontSize={12} tickFormatter={(v: number) => `${(v / 1000000).toFixed(0)}M`} />
                                <Tooltip formatter={(value: number) => formatCurrency(value)} labelStyle={{ fontWeight: "bold" }} />
                                <Legend />
                                <Bar dataKey="Kas Masuk" fill="#22c55e" />
                                <Bar dataKey="Kas Keluar" fill="#ef4444" />
                                <Line type="monotone" dataKey="Saldo" stroke="#6366f1" strokeWidth={2} dot={{ r: 4 }} />
                            </ComposedChart>
                        </ResponsiveContainer>
                    </div>
                </CardContent>
            </Card>

            {/* Detail Table with expandable rows */}
            <Card className="border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
                <CardHeader>
                    <CardTitle className="text-lg">Detail Bulanan</CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="border-b-2 border-black bg-muted/50">
                                    <th className="text-left p-3 font-semibold">Bulan</th>
                                    <th className="text-right p-3 font-semibold">Kas Masuk</th>
                                    <th className="text-right p-3 font-semibold">Kas Keluar</th>
                                    <th className="text-right p-3 font-semibold">Net</th>
                                    <th className="text-right p-3 font-semibold">Saldo</th>
                                </tr>
                            </thead>
                            <tbody>
                                {data.months.map((m) => {
                                    const key = `${m.month}-${m.year}`
                                    const isExpanded = expandedMonth === key
                                    const inBreakdown = m.breakdown.filter((b) => b.direction === "IN").sort((a, b) => b.amount - a.amount)
                                    const outBreakdown = m.breakdown.filter((b) => b.direction === "OUT").sort((a, b) => b.amount - a.amount)
                                    return (
                                        <Fragment key={key}>
                                            <tr
                                                className="border-b hover:bg-muted/30 cursor-pointer"
                                                onClick={() => setExpandedMonth(isExpanded ? null : key)}
                                            >
                                                <td className="p-3 font-medium">
                                                    <span className="flex items-center gap-1">
                                                        {isExpanded ? <IconChevronDown className="h-4 w-4" /> : <IconChevronRight className="h-4 w-4" />}
                                                        {m.label}
                                                    </span>
                                                </td>
                                                <td className="p-3 text-right text-green-600">{formatCurrency(m.totalIn)}</td>
                                                <td className="p-3 text-right text-red-600">{formatCurrency(m.totalOut)}</td>
                                                <td className={`p-3 text-right font-medium ${m.netFlow >= 0 ? "text-green-600" : "text-red-600"}`}>
                                                    {m.netFlow >= 0 ? "+" : ""}{formatCurrency(m.netFlow)}
                                                </td>
                                                <td className="p-3 text-right font-bold">{formatCurrency(m.runningBalance)}</td>
                                            </tr>
                                            {isExpanded && (
                                                <tr>
                                                    <td colSpan={5} className="p-0">
                                                        <div className="bg-muted/20 px-8 py-3 space-y-3">
                                                            {inBreakdown.length > 0 && (
                                                                <div>
                                                                    <div className="text-xs font-semibold text-green-700 mb-1">Kas Masuk:</div>
                                                                    {inBreakdown.map((b) => (
                                                                        <div key={b.category} className="flex justify-between text-xs py-0.5">
                                                                            <span className="text-muted-foreground">{CATEGORY_LABELS[b.category] || b.category}</span>
                                                                            <span className="text-green-600">{formatCurrency(b.amount)} ({b.itemCount} item)</span>
                                                                        </div>
                                                                    ))}
                                                                </div>
                                                            )}
                                                            {outBreakdown.length > 0 && (
                                                                <div>
                                                                    <div className="text-xs font-semibold text-red-700 mb-1">Kas Keluar:</div>
                                                                    {outBreakdown.map((b) => (
                                                                        <div key={b.category} className="flex justify-between text-xs py-0.5">
                                                                            <span className="text-muted-foreground">{CATEGORY_LABELS[b.category] || b.category}</span>
                                                                            <span className="text-red-600">{formatCurrency(b.amount)} ({b.itemCount} item)</span>
                                                                        </div>
                                                                    ))}
                                                                </div>
                                                            )}
                                                            {m.breakdown.length === 0 && (
                                                                <div className="text-xs text-muted-foreground italic">Tidak ada proyeksi untuk bulan ini</div>
                                                            )}
                                                        </div>
                                                    </td>
                                                </tr>
                                            )}
                                        </Fragment>
                                    )
                                })}
                            </tbody>
                        </table>
                    </div>
                </CardContent>
            </Card>
        </div>
    )
}
