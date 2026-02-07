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
import {
    Table,
    TableBody,
    TableCell,
    TableRow,
} from "@/components/ui/table"
import { getProfitLossStatement, getBalanceSheet, getCashFlowStatement } from "@/lib/actions/finance"
import { formatIDR } from "@/lib/utils"

export default function FinancialReportsPage() {
    const [reportType, setReportType] = useState("pnl")
    const [loading, setLoading] = useState(false)
    const [pnlData, setPnlData] = useState<any>(null)
    const [balanceSheetData, setBalanceSheetData] = useState<any>(null)
    const [cashFlowData, setCashFlowData] = useState<any>(null)

    // Date range for reports
    const currentYear = new Date().getFullYear()
    const [startDate] = useState(new Date(currentYear, 0, 1))
    const [endDate] = useState(new Date())

    useEffect(() => {
        loadFinancialData()
    }, [])

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
                        <Select value={reportType} onValueChange={setReportType}>
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
                        <Button variant="outline" className="w-full justify-start text-left font-normal border-black shadow-sm bg-white hover:bg-zinc-50">
                            <CalendarIcon className="mr-2 h-4 w-4" />
                            <span>Jan 2024 - Dec 2024</span>
                        </Button>
                    </div>

                    <Separator className="bg-black/10" />

                    <div className="space-y-2">
                        <label className="text-xs font-black uppercase">Comparison</label>
                        <div className="grid grid-cols-2 gap-2">
                            <Button variant="outline" className="bg-white border-zinc-300 hover:border-black hover:bg-zinc-100 text-xs font-bold">
                                Vs Last Month
                            </Button>
                            <Button variant="default" className="bg-black text-white hover:bg-zinc-800 border-black text-xs font-bold">
                                Vs Last Year
                            </Button>
                        </div>
                    </div>

                    <div className="space-y-2">
                        <label className="text-xs font-black uppercase">Department</label>
                        <div className="flex flex-wrap gap-2">
                            <Badge variant="secondary" className="bg-zinc-200 text-zinc-700 hover:bg-zinc-300 cursor-pointer">All Depts</Badge>
                            <Badge variant="outline" className="bg-white border-zinc-300 text-zinc-500 hover:border-black cursor-pointer">Sales</Badge>
                            <Badge variant="outline" className="bg-white border-zinc-300 text-zinc-500 hover:border-black cursor-pointer">Ops</Badge>
                        </div>
                    </div>
                </div>

                <div className="mt-auto space-y-3">
                    <Button className="w-full bg-emerald-600 text-white hover:bg-emerald-700 border border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] uppercase font-bold active:translate-y-1 active:shadow-none transition-all">
                        <Download className="mr-2 h-4 w-4" /> Export Pack
                    </Button>
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
                <Tabs value={reportType} onValueChange={setReportType} className="w-full">
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
