"use client"

import { useState, useEffect } from "react"
import {
    Calendar as CalendarIcon,
    Download,
    TrendingUp,
    FileText,
    TrendingDown,
    Wallet,
    Building,
    BarChart3,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
    Table,
    TableBody,
    TableCell,
    TableRow,
} from "@/components/ui/table"
import { getProfitLossStatement, getBalanceSheet, getCashFlowStatement } from "@/lib/actions/finance"
import { formatIDR } from "@/lib/utils"
import { toast } from "sonner"
import * as XLSX from "xlsx"

export default function FinancialReportsPage() {
    const [reportType, setReportType] = useState<"pnl" | "bs" | "cf">("pnl")
    const [loading, setLoading] = useState(false)
    const [pnlData, setPnlData] = useState<any>(null)
    const [balanceSheetData, setBalanceSheetData] = useState<any>(null)
    const [cashFlowData, setCashFlowData] = useState<any>(null)
    const [dateDialogOpen, setDateDialogOpen] = useState(false)
    const [exportDialogOpen, setExportDialogOpen] = useState(false)
    const [exportFormat, setExportFormat] = useState<"CSV" | "XLS">("CSV")

    const currentYear = new Date().getFullYear()
    const [startDate, setStartDate] = useState(new Date(currentYear, 0, 1))
    const [endDate, setEndDate] = useState(new Date())
    const [draftStartDate, setDraftStartDate] = useState(new Date(currentYear, 0, 1).toISOString().slice(0, 10))
    const [draftEndDate, setDraftEndDate] = useState(new Date().toISOString().slice(0, 10))

    useEffect(() => { loadFinancialData() }, [startDate, endDate])

    async function loadFinancialData() {
        setLoading(true)
        try {
            const [pnl, bs, cf] = await Promise.all([
                getProfitLossStatement(startDate.toISOString(), endDate.toISOString()),
                getBalanceSheet(endDate.toISOString()),
                getCashFlowStatement(startDate.toISOString(), endDate.toISOString())
            ])
            setPnlData(pnl)
            setBalanceSheetData(bs)
            setCashFlowData(cf)
        } catch (error) {
            console.error("Error loading financial data:", error)
        }
        setLoading(false)
    }

    function applyDateRange() {
        const nextStart = new Date(draftStartDate)
        const nextEnd = new Date(draftEndDate)
        if (Number.isNaN(nextStart.getTime()) || Number.isNaN(nextEnd.getTime()) || nextStart > nextEnd) {
            toast.error("Rentang tanggal tidak valid")
            return
        }
        setStartDate(nextStart)
        setEndDate(nextEnd)
        setDateDialogOpen(false)
        toast.success("Rentang tanggal diperbarui")
    }

    function getExportRows() {
        if (reportType === "pnl" && pnlData) {
            return [
                { metric: "Revenue", amount: Number(pnlData.revenue || 0) },
                { metric: "Cost of Goods Sold", amount: Number(pnlData.costOfGoodsSold || 0) },
                { metric: "Gross Profit", amount: Number(pnlData.grossProfit || 0) },
                { metric: "Operating Expenses", amount: Number(pnlData.totalOperatingExpenses || 0) },
                { metric: "Operating Income", amount: Number(pnlData.operatingIncome || 0) },
                { metric: "Tax Expense", amount: Number(pnlData.taxExpense || 0) },
                { metric: "Net Income", amount: Number(pnlData.netIncome || 0) },
            ]
        }
        if (reportType === "bs" && balanceSheetData) {
            return [
                { section: "Assets", metric: "Total Current Assets", amount: Number(balanceSheetData.assets?.totalCurrentAssets || 0) },
                { section: "Assets", metric: "Total Fixed Assets", amount: Number(balanceSheetData.assets?.totalFixedAssets || 0) },
                { section: "Assets", metric: "Total Assets", amount: Number(balanceSheetData.assets?.totalAssets || 0) },
                { section: "Liabilities", metric: "Total Liabilities", amount: Number(balanceSheetData.liabilities?.totalLiabilities || 0) },
                { section: "Equity", metric: "Total Equity", amount: Number(balanceSheetData.equity?.totalEquity || 0) },
                { section: "Checks", metric: "Assets = Liabilities + Equity", amount: Number(balanceSheetData.liabilitiesAndEquity?.total || 0) },
            ]
        }
        if (reportType === "cf" && cashFlowData) {
            return [
                { section: "Operating", amount: Number(cashFlowData.operatingActivities || 0) },
                { section: "Investing", amount: Number(cashFlowData.investingActivities || 0) },
                { section: "Financing", amount: Number(cashFlowData.financingActivities || 0) },
                { section: "Net Increase in Cash", amount: Number(cashFlowData.netIncreaseInCash || 0) },
            ]
        }
        return []
    }

    function exportReportPack() {
        const rows = getExportRows()
        if (rows.length === 0) { toast.error("Data laporan tidak tersedia"); return }
        const stamp = new Date().toISOString().slice(0, 10)
        if (exportFormat === "CSV") {
            const headers = Object.keys(rows[0])
            const csv = [headers.join(","), ...rows.map((row) => headers.map((h) => `"${String(row[h as keyof typeof row] ?? "").replaceAll('"', '""')}"`).join(","))].join("\n")
            const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" })
            const url = URL.createObjectURL(blob)
            const a = document.createElement("a"); a.href = url; a.download = `financial-report-${reportType}-${stamp}.csv`; a.click()
            URL.revokeObjectURL(url)
        } else {
            const ws = XLSX.utils.json_to_sheet(rows)
            const wb = XLSX.utils.book_new()
            XLSX.utils.book_append_sheet(wb, ws, "Report")
            XLSX.writeFile(wb, `financial-report-${reportType}-${stamp}.xls`, { bookType: "xls" })
        }
        setExportDialogOpen(false)
        toast.success(`Export ${exportFormat} berhasil`)
    }

    const reportTabs = ["pnl", "bs", "cf"] as const
    const reportLabels: Record<string, string> = { pnl: "Laba Rugi", bs: "Neraca", cf: "Arus Kas" }

    // KPI values
    const kpiPrimary = reportType === "pnl" ? formatIDR(pnlData?.netIncome || 0)
        : reportType === "bs" ? formatIDR(balanceSheetData?.assets?.totalAssets || 0)
        : formatIDR(cashFlowData?.netIncreaseInCash || 0)
    const kpiLabel = reportType === "pnl" ? "Net Income" : reportType === "bs" ? "Total Assets" : "Net Cash Change"

    return (
        <div className="p-4 md:p-6 lg:p-8 pt-6 w-full space-y-4 bg-zinc-50 dark:bg-black min-h-screen">

            {/* ═══ COMMAND HEADER ═══ */}
            <div className="border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] overflow-hidden bg-white dark:bg-zinc-900">
                <div className="px-6 py-4 flex items-center justify-between border-l-[6px] border-l-blue-400">
                    <div className="flex items-center gap-3">
                        <BarChart3 className="h-5 w-5 text-blue-500" />
                        <div>
                            <h1 className="text-xl font-black uppercase tracking-tight text-zinc-900 dark:text-white">
                                Laporan Keuangan
                            </h1>
                            <p className="text-zinc-400 text-xs font-medium mt-0.5">
                                Fiscal {currentYear} &bull; {startDate.toLocaleDateString("id-ID")} - {endDate.toLocaleDateString("id-ID")}
                            </p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <Dialog open={dateDialogOpen} onOpenChange={setDateDialogOpen}>
                            <DialogTrigger asChild>
                                <Button variant="outline" className="border-2 border-black text-[10px] font-black uppercase tracking-widest h-9 px-4 rounded-none shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:shadow-none">
                                    <CalendarIcon className="mr-2 h-3.5 w-3.5" /> Periode
                                </Button>
                            </DialogTrigger>
                            <DialogContent>
                                <DialogHeader>
                                    <DialogTitle>Pilih Rentang Tanggal</DialogTitle>
                                    <DialogDescription>Atur periode laporan keuangan.</DialogDescription>
                                </DialogHeader>
                                <div className="space-y-3">
                                    <div className="space-y-1.5">
                                        <Label>Tanggal Mulai</Label>
                                        <Input type="date" value={draftStartDate} onChange={(e) => setDraftStartDate(e.target.value)} />
                                    </div>
                                    <div className="space-y-1.5">
                                        <Label>Tanggal Akhir</Label>
                                        <Input type="date" value={draftEndDate} onChange={(e) => setDraftEndDate(e.target.value)} />
                                    </div>
                                    <Button onClick={applyDateRange} className="w-full">Terapkan</Button>
                                </div>
                            </DialogContent>
                        </Dialog>
                        <Dialog open={exportDialogOpen} onOpenChange={setExportDialogOpen}>
                            <DialogTrigger asChild>
                                <Button className="bg-emerald-600 text-white hover:bg-emerald-700 border-2 border-black shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] active:translate-y-[1px] active:shadow-none transition-all text-[10px] font-black uppercase tracking-widest h-9 px-4">
                                    <Download className="mr-2 h-3.5 w-3.5" /> Export
                                </Button>
                            </DialogTrigger>
                            <DialogContent>
                                <DialogHeader>
                                    <DialogTitle>Export Laporan</DialogTitle>
                                    <DialogDescription>Unduh laporan dalam format CSV atau XLS.</DialogDescription>
                                </DialogHeader>
                                <div className="space-y-3">
                                    <div className="space-y-1.5">
                                        <Label>Format</Label>
                                        <Select value={exportFormat} onValueChange={(v) => setExportFormat(v as "CSV" | "XLS")}>
                                            <SelectTrigger><SelectValue /></SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="CSV">CSV</SelectItem>
                                                <SelectItem value="XLS">XLS</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    <Button onClick={exportReportPack} className="w-full">Download</Button>
                                </div>
                            </DialogContent>
                        </Dialog>
                    </div>
                </div>
            </div>

            {/* ═══ KPI PULSE STRIP ═══ */}
            <div className="bg-white dark:bg-zinc-900 border-2 border-black shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] overflow-hidden">
                <div className="grid grid-cols-2 md:grid-cols-4">
                    <div className="relative p-4 md:p-5 border-r-2 border-zinc-100 dark:border-zinc-800 border-b-2 md:border-b-0">
                        <div className="absolute top-0 left-0 right-0 h-1 bg-blue-400" />
                        <div className="flex items-center gap-2 mb-2">
                            <TrendingUp className="h-4 w-4 text-zinc-400" />
                            <span className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Revenue</span>
                        </div>
                        <div className="text-2xl md:text-3xl font-black tracking-tighter text-zinc-900 dark:text-white">{loading ? "..." : formatIDR(pnlData?.revenue || 0)}</div>
                        <div className="text-[10px] font-bold text-blue-600 mt-1">Pendapatan</div>
                    </div>
                    <div className="relative p-4 md:p-5 border-r-2 border-zinc-100 dark:border-zinc-800 border-b-2 md:border-b-0">
                        <div className="absolute top-0 left-0 right-0 h-1 bg-emerald-400" />
                        <div className="flex items-center gap-2 mb-2">
                            <FileText className="h-4 w-4 text-zinc-400" />
                            <span className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Net Income</span>
                        </div>
                        <div className={`text-2xl md:text-3xl font-black tracking-tighter ${(pnlData?.netIncome || 0) >= 0 ? "text-emerald-600" : "text-red-600"}`}>{loading ? "..." : formatIDR(pnlData?.netIncome || 0)}</div>
                        <div className="text-[10px] font-bold text-emerald-600 mt-1">Laba bersih</div>
                    </div>
                    <div className="relative p-4 md:p-5 border-r-2 border-zinc-100 dark:border-zinc-800">
                        <div className="absolute top-0 left-0 right-0 h-1 bg-indigo-400" />
                        <div className="flex items-center gap-2 mb-2">
                            <Building className="h-4 w-4 text-zinc-400" />
                            <span className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Total Assets</span>
                        </div>
                        <div className="text-2xl md:text-3xl font-black tracking-tighter text-indigo-600">{loading ? "..." : formatIDR(balanceSheetData?.assets?.totalAssets || 0)}</div>
                        <div className="text-[10px] font-bold text-indigo-600 mt-1">Aset perusahaan</div>
                    </div>
                    <div className="relative p-4 md:p-5">
                        <div className="absolute top-0 left-0 right-0 h-1 bg-amber-400" />
                        <div className="flex items-center gap-2 mb-2">
                            <Wallet className="h-4 w-4 text-zinc-400" />
                            <span className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Cash Flow</span>
                        </div>
                        <div className={`text-2xl md:text-3xl font-black tracking-tighter ${(cashFlowData?.netIncreaseInCash || 0) >= 0 ? "text-amber-600" : "text-red-600"}`}>{loading ? "..." : formatIDR(cashFlowData?.netIncreaseInCash || 0)}</div>
                        <div className="text-[10px] font-bold text-amber-600 mt-1">Perubahan kas</div>
                    </div>
                </div>
            </div>

            {/* ═══ REPORT TYPE SELECTOR ═══ */}
            <div className="bg-white dark:bg-zinc-900 border-2 border-black shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] overflow-hidden">
                <div className="px-4 py-3 flex items-center gap-3">
                    <div className="flex border-2 border-black">
                        {reportTabs.map((t) => (
                            <button
                                key={t}
                                onClick={() => setReportType(t)}
                                className={`px-4 py-2 text-[10px] font-black uppercase tracking-widest transition-all border-r border-black last:border-r-0 flex items-center gap-2 ${
                                    reportType === t ? "bg-black text-white" : "bg-white text-zinc-400 hover:bg-zinc-50"
                                }`}
                            >
                                {t === "pnl" && <TrendingUp className="h-3.5 w-3.5" />}
                                {t === "bs" && <Building className="h-3.5 w-3.5" />}
                                {t === "cf" && <Wallet className="h-3.5 w-3.5" />}
                                {reportLabels[t]}
                            </button>
                        ))}
                    </div>
                    <div className="text-[10px] font-black uppercase tracking-widest text-zinc-400 hidden md:block">
                        {loading ? "Memuat..." : "Data tersedia"}
                    </div>
                </div>
            </div>

            {/* ═══ REPORT CONTENT ═══ */}
            {loading ? (
                <div className="bg-white dark:bg-zinc-900 border-2 border-black shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] p-12 text-center">
                    <p className="text-[10px] font-black uppercase tracking-widest text-zinc-400 animate-pulse">Memuat data laporan...</p>
                </div>
            ) : (
                <>
                    {/* P&L */}
                    {reportType === "pnl" && pnlData && (
                        <div className="bg-white dark:bg-zinc-900 border-2 border-black shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] overflow-hidden">
                            <div className="px-4 py-3 border-b-2 border-black bg-zinc-50 dark:bg-zinc-800 flex items-center gap-2">
                                <FileText className="h-4 w-4 text-zinc-500" />
                                <span className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Laporan Laba Rugi</span>
                            </div>
                            <Table>
                                <TableBody>
                                    <TableRow className="font-black bg-zinc-50 dark:bg-zinc-800">
                                        <TableCell className="w-[60%]">Revenue</TableCell>
                                        <TableCell className="text-right font-mono">{formatIDR(pnlData.revenue)}</TableCell>
                                    </TableRow>
                                    <TableRow>
                                        <TableCell className="pl-8">Cost of Goods Sold</TableCell>
                                        <TableCell className="text-right font-mono text-red-600">({formatIDR(pnlData.costOfGoodsSold)})</TableCell>
                                    </TableRow>
                                    <TableRow className="font-bold bg-blue-50 dark:bg-blue-900/20">
                                        <TableCell>Gross Profit</TableCell>
                                        <TableCell className="text-right font-mono text-blue-600">{formatIDR(pnlData.grossProfit)}</TableCell>
                                    </TableRow>
                                    <TableRow>
                                        <TableCell className="pl-8">Operating Expenses</TableCell>
                                        <TableCell className="text-right font-mono text-red-600">({formatIDR(pnlData.totalOperatingExpenses)})</TableCell>
                                    </TableRow>
                                    {pnlData.operatingExpenses?.map((exp: any, idx: number) => (
                                        <TableRow key={idx}>
                                            <TableCell className="pl-12 text-sm text-zinc-500">{exp.category}</TableCell>
                                            <TableCell className="text-right font-mono text-sm text-red-600">({formatIDR(exp.amount)})</TableCell>
                                        </TableRow>
                                    ))}
                                    <TableRow className="font-bold bg-indigo-50 dark:bg-indigo-900/20">
                                        <TableCell>Operating Income</TableCell>
                                        <TableCell className="text-right font-mono text-indigo-600">{formatIDR(pnlData.operatingIncome)}</TableCell>
                                    </TableRow>
                                    <TableRow>
                                        <TableCell className="pl-8">Tax Expense</TableCell>
                                        <TableCell className="text-right font-mono text-red-600">({formatIDR(pnlData.taxExpense)})</TableCell>
                                    </TableRow>
                                    <TableRow className="font-black bg-emerald-50 dark:bg-emerald-900/20 border-t-2 border-black">
                                        <TableCell className="text-lg">NET INCOME</TableCell>
                                        <TableCell className={`text-right font-mono text-lg ${pnlData.netIncome >= 0 ? "text-emerald-600" : "text-red-600"}`}>
                                            {formatIDR(pnlData.netIncome)}
                                        </TableCell>
                                    </TableRow>
                                </TableBody>
                            </Table>
                        </div>
                    )}

                    {/* Balance Sheet */}
                    {reportType === "bs" && balanceSheetData && (
                        <div className="grid md:grid-cols-2 gap-4">
                            {/* Assets */}
                            <div className="bg-white dark:bg-zinc-900 border-2 border-black shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] overflow-hidden">
                                <div className="px-4 py-3 border-b-2 border-black bg-emerald-50 dark:bg-emerald-900/20 flex items-center gap-2">
                                    <TrendingUp className="h-4 w-4 text-emerald-600" />
                                    <span className="text-[10px] font-black uppercase tracking-widest text-emerald-700">Assets</span>
                                </div>
                                <Table>
                                    <TableBody>
                                        <TableRow className="bg-emerald-50/50 dark:bg-emerald-900/10 font-bold">
                                            <TableCell>Current Assets</TableCell>
                                            <TableCell className="text-right font-mono">{formatIDR(balanceSheetData.assets?.totalCurrentAssets)}</TableCell>
                                        </TableRow>
                                        {balanceSheetData.assets?.currentAssets?.slice(0, 5).map((asset: any, idx: number) => (
                                            <TableRow key={idx}>
                                                <TableCell className="pl-8 text-sm text-zinc-500">{asset.name}</TableCell>
                                                <TableCell className="text-right font-mono text-sm">{formatIDR(asset.amount)}</TableCell>
                                            </TableRow>
                                        ))}
                                        <TableRow className="bg-zinc-50 dark:bg-zinc-800 font-bold">
                                            <TableCell>Fixed Assets</TableCell>
                                            <TableCell className="text-right font-mono">{formatIDR(balanceSheetData.assets?.totalFixedAssets)}</TableCell>
                                        </TableRow>
                                        <TableRow className="font-black bg-emerald-100 dark:bg-emerald-900/30 border-t-2 border-black">
                                            <TableCell>TOTAL ASSETS</TableCell>
                                            <TableCell className="text-right font-mono text-emerald-700">{formatIDR(balanceSheetData.assets?.totalAssets)}</TableCell>
                                        </TableRow>
                                    </TableBody>
                                </Table>
                            </div>

                            {/* Liabilities & Equity */}
                            <div className="space-y-4">
                                <div className="bg-white dark:bg-zinc-900 border-2 border-black shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] overflow-hidden">
                                    <div className="px-4 py-3 border-b-2 border-black bg-red-50 dark:bg-red-900/20 flex items-center gap-2">
                                        <TrendingDown className="h-4 w-4 text-red-600" />
                                        <span className="text-[10px] font-black uppercase tracking-widest text-red-700">Liabilities</span>
                                    </div>
                                    <Table>
                                        <TableBody>
                                            <TableRow className="bg-red-50/50 dark:bg-red-900/10 font-bold">
                                                <TableCell>Current Liabilities</TableCell>
                                                <TableCell className="text-right font-mono">{formatIDR(balanceSheetData.liabilities?.totalCurrentLiabilities)}</TableCell>
                                            </TableRow>
                                            {balanceSheetData.liabilities?.currentLiabilities?.slice(0, 3).map((liab: any, idx: number) => (
                                                <TableRow key={idx}>
                                                    <TableCell className="pl-8 text-sm text-zinc-500">{liab.name}</TableCell>
                                                    <TableCell className="text-right font-mono text-sm">{formatIDR(liab.amount)}</TableCell>
                                                </TableRow>
                                            ))}
                                            <TableRow className="font-black bg-red-100 dark:bg-red-900/30 border-t-2 border-black">
                                                <TableCell>TOTAL LIABILITIES</TableCell>
                                                <TableCell className="text-right font-mono text-red-700">{formatIDR(balanceSheetData.liabilities?.totalLiabilities)}</TableCell>
                                            </TableRow>
                                        </TableBody>
                                    </Table>
                                </div>

                                <div className="bg-white dark:bg-zinc-900 border-2 border-black shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] overflow-hidden">
                                    <div className="px-4 py-3 border-b-2 border-black bg-blue-50 dark:bg-blue-900/20 flex items-center gap-2">
                                        <Building className="h-4 w-4 text-blue-600" />
                                        <span className="text-[10px] font-black uppercase tracking-widest text-blue-700">Equity</span>
                                    </div>
                                    <Table>
                                        <TableBody>
                                            {balanceSheetData.equity?.capital?.slice(0, 3).map((cap: any, idx: number) => (
                                                <TableRow key={idx}>
                                                    <TableCell className="text-sm text-zinc-500">{cap.name}</TableCell>
                                                    <TableCell className="text-right font-mono text-sm">{formatIDR(cap.amount)}</TableCell>
                                                </TableRow>
                                            ))}
                                            <TableRow>
                                                <TableCell className="text-sm text-zinc-500">Retained Earnings</TableCell>
                                                <TableCell className="text-right font-mono text-sm">{formatIDR(balanceSheetData.equity?.retainedEarnings)}</TableCell>
                                            </TableRow>
                                            <TableRow className="font-black bg-blue-100 dark:bg-blue-900/30 border-t-2 border-black">
                                                <TableCell>TOTAL EQUITY</TableCell>
                                                <TableCell className="text-right font-mono text-blue-700">{formatIDR(balanceSheetData.equity?.totalEquity)}</TableCell>
                                            </TableRow>
                                        </TableBody>
                                    </Table>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Cash Flow */}
                    {reportType === "cf" && cashFlowData && (
                        <div className="bg-white dark:bg-zinc-900 border-2 border-black shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] overflow-hidden">
                            <div className="px-4 py-3 border-b-2 border-black bg-zinc-50 dark:bg-zinc-800 flex items-center gap-2">
                                <Wallet className="h-4 w-4 text-zinc-500" />
                                <span className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Laporan Arus Kas</span>
                            </div>
                            <Table>
                                <TableBody>
                                    <TableRow className="bg-emerald-50/50 dark:bg-emerald-900/10 font-bold">
                                        <TableCell colSpan={2}>Operating Activities</TableCell>
                                    </TableRow>
                                    <TableRow>
                                        <TableCell className="pl-8">Net Income</TableCell>
                                        <TableCell className="text-right font-mono">{formatIDR(cashFlowData.operatingActivities?.netIncome)}</TableCell>
                                    </TableRow>
                                    {cashFlowData.operatingActivities?.changesInWorkingCapital?.map((adj: any, idx: number) => (
                                        <TableRow key={idx}>
                                            <TableCell className="pl-8 text-sm text-zinc-500">{adj.description}</TableCell>
                                            <TableCell className={`text-right font-mono text-sm ${adj.amount >= 0 ? "text-emerald-600" : "text-red-600"}`}>{formatIDR(adj.amount)}</TableCell>
                                        </TableRow>
                                    ))}
                                    <TableRow className="font-bold bg-zinc-50 dark:bg-zinc-800">
                                        <TableCell>Net Cash from Operating</TableCell>
                                        <TableCell className={`text-right font-mono ${cashFlowData.operatingActivities?.netCashFromOperating >= 0 ? "text-emerald-600" : "text-red-600"}`}>{formatIDR(cashFlowData.operatingActivities?.netCashFromOperating)}</TableCell>
                                    </TableRow>

                                    <TableRow className="bg-zinc-50 dark:bg-zinc-800 font-bold">
                                        <TableCell colSpan={2}>Investing Activities</TableCell>
                                    </TableRow>
                                    {cashFlowData.investingActivities?.items?.map((item: any, idx: number) => (
                                        <TableRow key={idx}>
                                            <TableCell className="pl-8 text-sm text-zinc-500">{item.description}</TableCell>
                                            <TableCell className={`text-right font-mono text-sm ${item.amount >= 0 ? "text-emerald-600" : "text-red-600"}`}>{formatIDR(item.amount)}</TableCell>
                                        </TableRow>
                                    ))}
                                    <TableRow className="font-bold bg-zinc-50 dark:bg-zinc-800">
                                        <TableCell>Net Cash from Investing</TableCell>
                                        <TableCell className={`text-right font-mono ${cashFlowData.investingActivities?.netCashFromInvesting >= 0 ? "text-emerald-600" : "text-red-600"}`}>{formatIDR(cashFlowData.investingActivities?.netCashFromInvesting)}</TableCell>
                                    </TableRow>

                                    <TableRow className="bg-zinc-50 dark:bg-zinc-800 font-bold">
                                        <TableCell colSpan={2}>Financing Activities</TableCell>
                                    </TableRow>
                                    {cashFlowData.financingActivities?.items?.map((item: any, idx: number) => (
                                        <TableRow key={idx}>
                                            <TableCell className="pl-8 text-sm text-zinc-500">{item.description}</TableCell>
                                            <TableCell className={`text-right font-mono text-sm ${item.amount >= 0 ? "text-emerald-600" : "text-red-600"}`}>{formatIDR(item.amount)}</TableCell>
                                        </TableRow>
                                    ))}
                                    <TableRow className="font-bold bg-zinc-50 dark:bg-zinc-800">
                                        <TableCell>Net Cash from Financing</TableCell>
                                        <TableCell className={`text-right font-mono ${cashFlowData.financingActivities?.netCashFromFinancing >= 0 ? "text-emerald-600" : "text-red-600"}`}>{formatIDR(cashFlowData.financingActivities?.netCashFromFinancing)}</TableCell>
                                    </TableRow>

                                    <TableRow className="font-black bg-emerald-50 dark:bg-emerald-900/20 border-t-2 border-black">
                                        <TableCell className="text-lg">NET INCREASE IN CASH</TableCell>
                                        <TableCell className={`text-right font-mono text-lg ${cashFlowData.netIncreaseInCash >= 0 ? "text-emerald-600" : "text-red-600"}`}>{formatIDR(cashFlowData.netIncreaseInCash)}</TableCell>
                                    </TableRow>
                                    <TableRow>
                                        <TableCell>Ending Cash Balance</TableCell>
                                        <TableCell className="text-right font-mono text-emerald-700 font-bold">{formatIDR(cashFlowData.endingCash)}</TableCell>
                                    </TableRow>
                                </TableBody>
                            </Table>
                        </div>
                    )}

                    {!pnlData && !balanceSheetData && !cashFlowData && (
                        <div className="bg-white dark:bg-zinc-900 border-2 border-black shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] p-12 text-center">
                            <BarChart3 className="h-8 w-8 mx-auto text-zinc-300 mb-2" />
                            <p className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Data laporan tidak tersedia</p>
                        </div>
                    )}
                </>
            )}
        </div>
    )
}
