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
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
    Card,
    CardContent,
    CardHeader,
    CardTitle,
} from "@/components/ui/card"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Separator } from "@/components/ui/separator"
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
    const [comparisonMode, setComparisonMode] = useState<"LAST_MONTH" | "LAST_YEAR">("LAST_YEAR")
    const [department, setDepartment] = useState<"ALL" | "SALES" | "OPS">("ALL")
    const [dateDialogOpen, setDateDialogOpen] = useState(false)
    const [exportDialogOpen, setExportDialogOpen] = useState(false)
    const [exportFormat, setExportFormat] = useState<"CSV" | "XLS">("CSV")

    // Date range for reports
    const currentYear = new Date().getFullYear()
    const [startDate, setStartDate] = useState(new Date(currentYear, 0, 1))
    const [endDate, setEndDate] = useState(new Date())
    const [draftStartDate, setDraftStartDate] = useState(new Date(currentYear, 0, 1).toISOString().slice(0, 10))
    const [draftEndDate, setDraftEndDate] = useState(new Date().toISOString().slice(0, 10))

    useEffect(() => {
        loadFinancialData()
    }, [startDate, endDate])

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
        toast.success("Rentang tanggal laporan diperbarui")
    }

    function getExportRows() {
        if (reportType === "pnl" && pnlData) {
            const rows: Array<Record<string, string | number>> = [
                { metric: "Revenue", amount: Number(pnlData.revenue || 0) },
                { metric: "Cost of Goods Sold", amount: Number(pnlData.costOfGoodsSold || 0) },
                { metric: "Gross Profit", amount: Number(pnlData.grossProfit || 0) },
                { metric: "Operating Expenses", amount: Number(pnlData.totalOperatingExpenses || 0) },
                { metric: "Operating Income", amount: Number(pnlData.operatingIncome || 0) },
                { metric: "Tax Expense", amount: Number(pnlData.taxExpense || 0) },
                { metric: "Net Income", amount: Number(pnlData.netIncome || 0) },
            ]
            return rows
        }

        if (reportType === "bs" && balanceSheetData) {
            const rows: Array<Record<string, string | number>> = []
            rows.push({ section: "Assets", metric: "Total Current Assets", amount: Number(balanceSheetData.assets?.totalCurrentAssets || 0) })
            rows.push({ section: "Assets", metric: "Total Fixed Assets", amount: Number(balanceSheetData.assets?.totalFixedAssets || 0) })
            rows.push({ section: "Assets", metric: "Total Assets", amount: Number(balanceSheetData.assets?.totalAssets || 0) })
            rows.push({ section: "Liabilities", metric: "Total Liabilities", amount: Number(balanceSheetData.liabilities?.totalLiabilities || 0) })
            rows.push({ section: "Equity", metric: "Total Equity", amount: Number(balanceSheetData.equity?.totalEquity || 0) })
            rows.push({ section: "Checks", metric: "Assets = Liabilities + Equity", amount: Number(balanceSheetData.liabilitiesAndEquity?.total || 0) })
            return rows
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
        if (rows.length === 0) {
            toast.error("Data laporan tidak tersedia untuk diexport")
            return
        }

        const stamp = new Date().toISOString().slice(0, 10)
        if (exportFormat === "CSV") {
            const headers = Object.keys(rows[0])
            const csv = [
                headers.join(","),
                ...rows.map((row) => headers.map((h) => `"${String(row[h] ?? "").replaceAll('"', '""')}"`).join(",")),
            ].join("\n")

            const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" })
            const url = URL.createObjectURL(blob)
            const a = document.createElement("a")
            a.href = url
            a.download = `financial-report-${reportType}-${stamp}.csv`
            a.click()
            URL.revokeObjectURL(url)
        } else {
            const ws = XLSX.utils.json_to_sheet(rows)
            const wb = XLSX.utils.book_new()
            XLSX.utils.book_append_sheet(wb, ws, "Report")
            XLSX.writeFile(wb, `financial-report-${reportType}-${stamp}.xls`, { bookType: "xls" })
        }

        setExportDialogOpen(false)
        toast.success(`Export ${exportFormat} berhasil diunduh`)
    }

    return (
        <div className="flex-1 space-y-0 p-0 font-sans h-[calc(100vh-theme(spacing.16))] flex overflow-hidden">

            {/* LEFT: Analyst Sidebar Controls */}
            <div className="w-80 bg-zinc-50 border-r border-black/20 p-6 flex flex-col gap-8 shrink-0 overflow-y-auto">
                <div>
                    <h2 className="text-xl font-black font-serif tracking-tight mb-1">Report Controls</h2>
                    <p className="text-xs font-bold text-muted-foreground uppercase">Configure your view</p>
                </div>

                <div className="space-y-4">
                    <div className="space-y-2">
                        <label className="text-xs font-black uppercase">Report Type</label>
                        <Select value={reportType} onValueChange={(value) => setReportType(value as "pnl" | "bs" | "cf")}>
                            <SelectTrigger className="border-black shadow-sm bg-white font-bold h-10">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="pnl">Profit & Loss (P&L)</SelectItem>
                                <SelectItem value="bs">Balance Sheet</SelectItem>
                                <SelectItem value="cf">Cash Flow</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>

                    <div className="space-y-2">
                        <label className="text-xs font-black uppercase">Date Range</label>
                        <Dialog open={dateDialogOpen} onOpenChange={setDateDialogOpen}>
                            <DialogTrigger asChild>
                                <Button variant="outline" className="w-full justify-start text-left font-normal border-black shadow-sm bg-white hover:bg-zinc-50">
                                    <CalendarIcon className="mr-2 h-4 w-4" />
                                    <span>
                                        {startDate.toLocaleDateString("id-ID")} - {endDate.toLocaleDateString("id-ID")}
                                    </span>
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
                                    <Button onClick={applyDateRange} className="w-full">Apply Date Range</Button>
                                </div>
                            </DialogContent>
                        </Dialog>
                    </div>

                    <Separator className="bg-black/10" />

                    <div className="space-y-2">
                        <label className="text-xs font-black uppercase">Comparison</label>
                        <div className="grid grid-cols-2 gap-2">
                            <Button
                                variant={comparisonMode === "LAST_MONTH" ? "default" : "outline"}
                                className={comparisonMode === "LAST_MONTH" ? "bg-black text-white hover:bg-zinc-800 border-black text-xs font-bold" : "bg-white border-zinc-300 hover:border-black hover:bg-zinc-100 text-xs font-bold"}
                                onClick={() => setComparisonMode("LAST_MONTH")}
                            >
                                Vs Last Month
                            </Button>
                            <Button
                                variant={comparisonMode === "LAST_YEAR" ? "default" : "outline"}
                                className={comparisonMode === "LAST_YEAR" ? "bg-black text-white hover:bg-zinc-800 border-black text-xs font-bold" : "bg-white border-zinc-300 hover:border-black hover:bg-zinc-100 text-xs font-bold"}
                                onClick={() => setComparisonMode("LAST_YEAR")}
                            >
                                Vs Last Year
                            </Button>
                        </div>
                    </div>

                    <div className="space-y-2">
                        <label className="text-xs font-black uppercase">Department</label>
                        <div className="flex flex-wrap gap-2">
                            <Badge onClick={() => setDepartment("ALL")} variant={department === "ALL" ? "secondary" : "outline"} className={`${department === "ALL" ? "bg-zinc-200 text-zinc-700" : "bg-white border-zinc-300 text-zinc-500"} hover:border-black cursor-pointer`}>
                                All Depts
                            </Badge>
                            <Badge onClick={() => setDepartment("SALES")} variant={department === "SALES" ? "secondary" : "outline"} className={`${department === "SALES" ? "bg-zinc-200 text-zinc-700" : "bg-white border-zinc-300 text-zinc-500"} hover:border-black cursor-pointer`}>
                                Sales
                            </Badge>
                            <Badge onClick={() => setDepartment("OPS")} variant={department === "OPS" ? "secondary" : "outline"} className={`${department === "OPS" ? "bg-zinc-200 text-zinc-700" : "bg-white border-zinc-300 text-zinc-500"} hover:border-black cursor-pointer`}>
                                Ops
                            </Badge>
                        </div>
                    </div>
                </div>

                <div className="mt-auto space-y-3">
                    <Dialog open={exportDialogOpen} onOpenChange={setExportDialogOpen}>
                        <DialogTrigger asChild>
                            <Button className="w-full bg-emerald-600 text-white hover:bg-emerald-700 border border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] uppercase font-bold active:translate-y-1 active:shadow-none transition-all">
                                <Download className="mr-2 h-4 w-4" /> Export Pack
                            </Button>
                        </DialogTrigger>
                        <DialogContent>
                            <DialogHeader>
                                <DialogTitle>Export Financial Report</DialogTitle>
                                <DialogDescription>Unduh laporan aktif dalam format CSV atau XLS.</DialogDescription>
                            </DialogHeader>
                            <div className="space-y-1.5">
                                <Label>Format</Label>
                                <Select value={exportFormat} onValueChange={(value) => setExportFormat(value as "CSV" | "XLS")}>
                                    <SelectTrigger><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="CSV">CSV</SelectItem>
                                        <SelectItem value="XLS">XLS</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            <Button onClick={exportReportPack} className="w-full">
                                Download
                            </Button>
                        </DialogContent>
                    </Dialog>
                </div>
            </div>

            {/* RIGHT: Main Canvas */}
            <div className="flex-1 bg-white p-8 overflow-y-auto flex flex-col gap-8">

                {/* Canvas Header */}
                <div className="flex items-center justify-between border-b pb-6 border-black">
                    <div>
                        <div className="flex items-center gap-3 mb-2">
                            <Badge className="bg-black text-white px-3 h-6 uppercase text-[10px] tracking-widest font-black">
                                Fiscal {currentYear}
                            </Badge>
                            <span className="text-zinc-400 font-bold text-xs uppercase">
                                {loading ? "Loading..." : "Consolidated View"}
                            </span>
                        </div>
                        <h1 className="text-4xl font-black font-serif uppercase tracking-tight">
                            {reportType === "pnl" && "Profit & Loss Statement"}
                            {reportType === "bs" && "Balance Sheet"}
                            {reportType === "cf" && "Cash Flow Statement"}
                        </h1>
                    </div>
                    <div className="text-right">
                        <p className="text-xs font-bold uppercase text-muted-foreground">
                            {reportType === "pnl" && "Net Profit (YTD)"}
                            {reportType === "bs" && "Total Assets"}
                            {reportType === "cf" && "Net Cash Change"}
                        </p>
                        <p className="text-4xl font-black tracking-tight text-emerald-600">
                            {loading ? "..." : reportType === "pnl" && formatIDR(pnlData?.netIncome || 0)}
                            {reportType === "bs" && formatIDR(balanceSheetData?.assets?.totalAssets || 0)}
                            {reportType === "cf" && formatIDR(cashFlowData?.netIncreaseInCash || 0)}
                        </p>
                        {!loading && (
                            <div className="flex items-center justify-end gap-1 text-emerald-600 font-bold text-xs mt-1">
                                <TrendingUp className="h-3 w-3" />
                                {reportType === "pnl" && pnlData?.netIncome >= 0 ? "+Profit" : "-Loss"}
                                {reportType === "bs" && "Assets = L+E"}
                                {reportType === "cf" && cashFlowData?.netIncreaseInCash >= 0 ? "+Increase" : "-Decrease"}
                            </div>
                        )}
                    </div>
                </div>

                {/* Financial Statements Tabs */}
                <Tabs value={reportType} onValueChange={(value) => setReportType(value as "pnl" | "bs" | "cf")} className="w-full">
                    <TabsList className="grid w-full grid-cols-3 border-2 border-black">
                        <TabsTrigger value="pnl" className="font-bold uppercase data-[state=active]:bg-black data-[state=active]:text-white">
                            <TrendingUp className="h-4 w-4 mr-2" /> P&L
                        </TabsTrigger>
                        <TabsTrigger value="bs" className="font-bold uppercase data-[state=active]:bg-black data-[state=active]:text-white">
                            <Building className="h-4 w-4 mr-2" /> Balance Sheet
                        </TabsTrigger>
                        <TabsTrigger value="cf" className="font-bold uppercase data-[state=active]:bg-black data-[state=active]:text-white">
                            <Wallet className="h-4 w-4 mr-2" /> Cash Flow
                        </TabsTrigger>
                    </TabsList>

                    {/* P&L Content */}
                    <TabsContent value="pnl" className="space-y-6">
                        {loading ? (
                            <div className="text-center py-12 font-bold">Loading P&L Data...</div>
                        ) : pnlData ? (
                            <>
                                {/* P&L Summary Cards */}
                                <div className="grid grid-cols-4 gap-4">
                                    <Card className="border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
                                        <CardHeader className="pb-2">
                                            <CardTitle className="text-xs font-bold uppercase text-zinc-500">Revenue</CardTitle>
                                        </CardHeader>
                                        <CardContent>
                                            <div className="text-2xl font-black text-emerald-600">
                                                {formatIDR(pnlData.revenue)}
                                            </div>
                                        </CardContent>
                                    </Card>
                                    <Card className="border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
                                        <CardHeader className="pb-2">
                                            <CardTitle className="text-xs font-bold uppercase text-zinc-500">Gross Profit</CardTitle>
                                        </CardHeader>
                                        <CardContent>
                                            <div className="text-2xl font-black text-blue-600">
                                                {formatIDR(pnlData.grossProfit)}
                                            </div>
                                        </CardContent>
                                    </Card>
                                    <Card className="border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
                                        <CardHeader className="pb-2">
                                            <CardTitle className="text-xs font-bold uppercase text-zinc-500">Operating Income</CardTitle>
                                        </CardHeader>
                                        <CardContent>
                                            <div className="text-2xl font-black text-indigo-600">
                                                {formatIDR(pnlData.operatingIncome)}
                                            </div>
                                        </CardContent>
                                    </Card>
                                    <Card className="border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
                                        <CardHeader className="pb-2">
                                            <CardTitle className="text-xs font-bold uppercase text-zinc-500">Net Income</CardTitle>
                                        </CardHeader>
                                        <CardContent>
                                            <div className={`text-2xl font-black ${pnlData.netIncome >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                                                {formatIDR(pnlData.netIncome)}
                                            </div>
                                        </CardContent>
                                    </Card>
                                </div>

                                {/* P&L Detail Table */}
                                <Card className="border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
                                    <CardHeader className="bg-zinc-100 border-b border-black">
                                        <CardTitle className="font-black uppercase flex items-center gap-2">
                                            <FileText className="h-5 w-5" /> P&L Detail
                                        </CardTitle>
                                    </CardHeader>
                                    <CardContent className="p-0">
                                        <Table>
                                            <TableBody>
                                                <TableRow className="font-black bg-zinc-50">
                                                    <TableCell className="w-[60%]">Revenue</TableCell>
                                                    <TableCell className="text-right font-mono">{formatIDR(pnlData.revenue)}</TableCell>
                                                </TableRow>
                                                <TableRow>
                                                    <TableCell className="pl-8">Cost of Goods Sold</TableCell>
                                                    <TableCell className="text-right font-mono text-red-600">({formatIDR(pnlData.costOfGoodsSold)})</TableCell>
                                                </TableRow>
                                                <TableRow className="font-bold bg-zinc-100">
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
                                                <TableRow className="font-bold bg-zinc-100">
                                                    <TableCell>Operating Income</TableCell>
                                                    <TableCell className="text-right font-mono text-indigo-600">{formatIDR(pnlData.operatingIncome)}</TableCell>
                                                </TableRow>
                                                <TableRow>
                                                    <TableCell className="pl-8">Tax Expense</TableCell>
                                                    <TableCell className="text-right font-mono text-red-600">({formatIDR(pnlData.taxExpense)})</TableCell>
                                                </TableRow>
                                                <TableRow className="font-black bg-emerald-100">
                                                    <TableCell>NET INCOME</TableCell>
                                                    <TableCell className={`text-right font-mono ${pnlData.netIncome >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                                                        {formatIDR(pnlData.netIncome)}
                                                    </TableCell>
                                                </TableRow>
                                            </TableBody>
                                        </Table>
                                    </CardContent>
                                </Card>
                            </>
                        ) : (
                            <div className="text-center py-12 text-zinc-500 font-bold">No P&L data available</div>
                        )}
                    </TabsContent>

                    {/* Balance Sheet Content */}
                    <TabsContent value="bs" className="space-y-6">
                        {loading ? (
                            <div className="text-center py-12 font-bold">Loading Balance Sheet...</div>
                        ) : balanceSheetData ? (
                            <div className="grid md:grid-cols-2 gap-6">
                                {/* Assets */}
                                <Card className="border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
                                    <CardHeader className="bg-emerald-50 border-b border-black">
                                        <CardTitle className="font-black uppercase flex items-center gap-2 text-emerald-700">
                                            <TrendingUp className="h-5 w-5" /> Assets
                                        </CardTitle>
                                    </CardHeader>
                                    <CardContent className="p-0">
                                        <Table>
                                            <TableBody>
                                                <TableRow className="bg-emerald-50/50 font-bold">
                                                    <TableCell>Current Assets</TableCell>
                                                    <TableCell className="text-right font-mono">{formatIDR(balanceSheetData.assets?.totalCurrentAssets)}</TableCell>
                                                </TableRow>
                                                {balanceSheetData.assets?.currentAssets?.slice(0, 5).map((asset: any, idx: number) => (
                                                    <TableRow key={idx}>
                                                        <TableCell className="pl-8 text-sm text-zinc-500">{asset.name}</TableCell>
                                                        <TableCell className="text-right font-mono text-sm">{formatIDR(asset.amount)}</TableCell>
                                                    </TableRow>
                                                ))}
                                                <TableRow className="bg-zinc-50 font-bold">
                                                    <TableCell>Fixed Assets</TableCell>
                                                    <TableCell className="text-right font-mono">{formatIDR(balanceSheetData.assets?.totalFixedAssets)}</TableCell>
                                                </TableRow>
                                                <TableRow className="font-black bg-emerald-100">
                                                    <TableCell>TOTAL ASSETS</TableCell>
                                                    <TableCell className="text-right font-mono text-emerald-700">{formatIDR(balanceSheetData.assets?.totalAssets)}</TableCell>
                                                </TableRow>
                                            </TableBody>
                                        </Table>
                                    </CardContent>
                                </Card>

                                {/* Liabilities & Equity */}
                                <div className="space-y-6">
                                    <Card className="border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
                                        <CardHeader className="bg-red-50 border-b border-black">
                                            <CardTitle className="font-black uppercase flex items-center gap-2 text-red-700">
                                                <TrendingDown className="h-5 w-5" /> Liabilities
                                            </CardTitle>
                                        </CardHeader>
                                        <CardContent className="p-0">
                                            <Table>
                                                <TableBody>
                                                    <TableRow className="bg-red-50/50 font-bold">
                                                        <TableCell>Current Liabilities</TableCell>
                                                        <TableCell className="text-right font-mono">{formatIDR(balanceSheetData.liabilities?.totalCurrentLiabilities)}</TableCell>
                                                    </TableRow>
                                                    {balanceSheetData.liabilities?.currentLiabilities?.slice(0, 3).map((liab: any, idx: number) => (
                                                        <TableRow key={idx}>
                                                            <TableCell className="pl-8 text-sm text-zinc-500">{liab.name}</TableCell>
                                                            <TableCell className="text-right font-mono text-sm">{formatIDR(liab.amount)}</TableCell>
                                                        </TableRow>
                                                    ))}
                                                    <TableRow className="font-black bg-red-100">
                                                        <TableCell>TOTAL LIABILITIES</TableCell>
                                                        <TableCell className="text-right font-mono text-red-700">{formatIDR(balanceSheetData.liabilities?.totalLiabilities)}</TableCell>
                                                    </TableRow>
                                                </TableBody>
                                            </Table>
                                        </CardContent>
                                    </Card>

                                    <Card className="border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
                                        <CardHeader className="bg-blue-50 border-b border-black">
                                            <CardTitle className="font-black uppercase flex items-center gap-2 text-blue-700">
                                                <Building className="h-5 w-5" /> Equity
                                            </CardTitle>
                                        </CardHeader>
                                        <CardContent className="p-0">
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
                                                    <TableRow className="font-black bg-blue-100">
                                                        <TableCell>TOTAL EQUITY</TableCell>
                                                        <TableCell className="text-right font-mono text-blue-700">{formatIDR(balanceSheetData.equity?.totalEquity)}</TableCell>
                                                    </TableRow>
                                                </TableBody>
                                            </Table>
                                        </CardContent>
                                    </Card>
                                </div>
                            </div>
                        ) : (
                            <div className="text-center py-12 text-zinc-500 font-bold">No Balance Sheet data available</div>
                        )}
                    </TabsContent>

                    {/* Cash Flow Content */}
                    <TabsContent value="cf" className="space-y-6">
                        {loading ? (
                            <div className="text-center py-12 font-bold">Loading Cash Flow...</div>
                        ) : cashFlowData ? (
                            <>
                                <div className="grid grid-cols-4 gap-4">
                                    <Card className="border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
                                        <CardHeader className="pb-2">
                                            <CardTitle className="text-xs font-bold uppercase text-zinc-500">Operating</CardTitle>
                                        </CardHeader>
                                        <CardContent>
                                            <div className={`text-2xl font-black ${cashFlowData.operatingActivities?.netCashFromOperating >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                                                {formatIDR(cashFlowData.operatingActivities?.netCashFromOperating)}
                                            </div>
                                        </CardContent>
                                    </Card>
                                    <Card className="border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
                                        <CardHeader className="pb-2">
                                            <CardTitle className="text-xs font-bold uppercase text-zinc-500">Investing</CardTitle>
                                        </CardHeader>
                                        <CardContent>
                                            <div className={`text-2xl font-black ${cashFlowData.investingActivities?.netCashFromInvesting >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                                                {formatIDR(cashFlowData.investingActivities?.netCashFromInvesting)}
                                            </div>
                                        </CardContent>
                                    </Card>
                                    <Card className="border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
                                        <CardHeader className="pb-2">
                                            <CardTitle className="text-xs font-bold uppercase text-zinc-500">Financing</CardTitle>
                                        </CardHeader>
                                        <CardContent>
                                            <div className={`text-2xl font-black ${cashFlowData.financingActivities?.netCashFromFinancing >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                                                {formatIDR(cashFlowData.financingActivities?.netCashFromFinancing)}
                                            </div>
                                        </CardContent>
                                    </Card>
                                    <Card className="border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
                                        <CardHeader className="pb-2">
                                            <CardTitle className="text-xs font-bold uppercase text-zinc-500">Net Change</CardTitle>
                                        </CardHeader>
                                        <CardContent>
                                            <div className={`text-2xl font-black ${cashFlowData.netIncreaseInCash >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                                                {formatIDR(cashFlowData.netIncreaseInCash)}
                                            </div>
                                        </CardContent>
                                    </Card>
                                </div>

                                <Card className="border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
                                    <CardHeader className="bg-zinc-100 border-b border-black">
                                        <CardTitle className="font-black uppercase flex items-center gap-2">
                                            <Wallet className="h-5 w-5" /> Cash Flow Detail
                                        </CardTitle>
                                    </CardHeader>
                                    <CardContent className="p-0">
                                        <Table>
                                            <TableBody>
                                                <TableRow className="bg-emerald-50/50 font-bold">
                                                    <TableCell colSpan={2}>Operating Activities</TableCell>
                                                </TableRow>
                                                <TableRow>
                                                    <TableCell className="pl-8">Net Income</TableCell>
                                                    <TableCell className="text-right font-mono">{formatIDR(cashFlowData.operatingActivities?.netIncome)}</TableCell>
                                                </TableRow>
                                                {cashFlowData.operatingActivities?.changesInWorkingCapital?.map((adj: any, idx: number) => (
                                                    <TableRow key={idx}>
                                                        <TableCell className="pl-8 text-sm text-zinc-500">{adj.description}</TableCell>
                                                        <TableCell className={`text-right font-mono text-sm ${adj.amount >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                                                            {formatIDR(adj.amount)}
                                                        </TableCell>
                                                    </TableRow>
                                                ))}
                                                <TableRow className="font-bold bg-zinc-50">
                                                    <TableCell>Net Cash from Operating</TableCell>
                                                    <TableCell className={`text-right font-mono ${cashFlowData.operatingActivities?.netCashFromOperating >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                                                        {formatIDR(cashFlowData.operatingActivities?.netCashFromOperating)}
                                                    </TableCell>
                                                </TableRow>

                                                <TableRow className="bg-zinc-50 font-bold">
                                                    <TableCell colSpan={2}>Investing Activities</TableCell>
                                                </TableRow>
                                                {cashFlowData.investingActivities?.items?.map((item: any, idx: number) => (
                                                    <TableRow key={idx}>
                                                        <TableCell className="pl-8 text-sm text-zinc-500">{item.description}</TableCell>
                                                        <TableCell className={`text-right font-mono text-sm ${item.amount >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                                                            {formatIDR(item.amount)}
                                                        </TableCell>
                                                    </TableRow>
                                                ))}
                                                <TableRow className="font-bold bg-zinc-50">
                                                    <TableCell>Net Cash from Investing</TableCell>
                                                    <TableCell className={`text-right font-mono ${cashFlowData.investingActivities?.netCashFromInvesting >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                                                        {formatIDR(cashFlowData.investingActivities?.netCashFromInvesting)}
                                                    </TableCell>
                                                </TableRow>

                                                <TableRow className="bg-zinc-50 font-bold">
                                                    <TableCell colSpan={2}>Financing Activities</TableCell>
                                                </TableRow>
                                                {cashFlowData.financingActivities?.items?.map((item: any, idx: number) => (
                                                    <TableRow key={idx}>
                                                        <TableCell className="pl-8 text-sm text-zinc-500">{item.description}</TableCell>
                                                        <TableCell className={`text-right font-mono text-sm ${item.amount >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                                                            {formatIDR(item.amount)}
                                                        </TableCell>
                                                    </TableRow>
                                                ))}
                                                <TableRow className="font-bold bg-zinc-50">
                                                    <TableCell>Net Cash from Financing</TableCell>
                                                    <TableCell className={`text-right font-mono ${cashFlowData.financingActivities?.netCashFromFinancing >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                                                        {formatIDR(cashFlowData.financingActivities?.netCashFromFinancing)}
                                                    </TableCell>
                                                </TableRow>

                                                <TableRow className="font-black bg-emerald-100">
                                                    <TableCell>NET INCREASE IN CASH</TableCell>
                                                    <TableCell className={`text-right font-mono ${cashFlowData.netIncreaseInCash >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                                                        {formatIDR(cashFlowData.netIncreaseInCash)}
                                                    </TableCell>
                                                </TableRow>
                                                <TableRow>
                                                    <TableCell>Ending Cash Balance</TableCell>
                                                    <TableCell className="text-right font-mono text-emerald-700">{formatIDR(cashFlowData.endingCash)}</TableCell>
                                                </TableRow>
                                            </TableBody>
                                        </Table>
                                    </CardContent>
                                </Card>
                            </>
                        ) : (
                            <div className="text-center py-12 text-zinc-500 font-bold">No Cash Flow data available</div>
                        )}
                    </TabsContent>
                </Tabs>

            </div>
        </div>
    )
}
