"use client"

import { useState } from "react"
import {
    Calendar as CalendarIcon,
    Download,
    Share2,
    PieChart,
    BarChart3,
    TrendingUp,
    ArrowUpRight,
    ArrowDownRight,
    Filter,
    Maximize2,
    Search,
    Building2,
    CreditCard,
    FileText
} from "lucide-react"
import { motion, AnimatePresence } from "framer-motion"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import {
    Card,
    CardContent,
    CardHeader,
    CardTitle,
    CardDescription
} from "@/components/ui/card"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
import { Separator } from "@/components/ui/separator"
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table"

// Mock Data for the Chart
const monthlyData = [
    { month: "Jan", value: 40, label: "Januari" },
    { month: "Feb", value: 65, label: "Februari" },
    { month: "Mar", value: 55, label: "Maret" },
    { month: "Apr", value: 80, label: "April" },
    { month: "May", value: 70, label: "Mei" },
    { month: "Jun", value: 90, label: "Juni" },
    { month: "Jul", value: 100, label: "Juli" },
    { month: "Aug", value: 85, label: "Agustus" },
    { month: "Sep", value: 95, label: "September" },
    { month: "Oct", value: 75, label: "Oktober" },
    { month: "Nov", value: 60, label: "November" },
    { month: "Dec", value: 80, label: "Desember" },
]

// Mock Rich Data for Transactions
const transactionsDB: Record<string, any[]> = {
    "Jan": [
        { id: "TRX-001", date: "Jan 12, 2024", vendor: "PT. Indo Garment", bank: "BCA Corporate", inv: "INV/2024/001", po: "PO-9921", amount: "Rp 125.000.000", status: "Completed" },
        { id: "TRX-002", date: "Jan 15, 2024", vendor: "CV. Sinar Abadi", bank: "Mandiri Biz", inv: "INV/2024/022", po: "PO-9925", amount: "Rp 45.200.000", status: "Processing" },
        { id: "TRX-003", date: "Jan 28, 2024", vendor: "Logistik Express", bank: "BCA Corporate", inv: "INV/2024/089", po: "PO-9930", amount: "Rp 8.500.000", status: "Completed" },
    ],
    "Feb": [
        { id: "TRX-004", date: "Feb 02, 2024", vendor: "Zhejiang Textile Co", bank: "USD Account", inv: "INT/2024/005", po: "PO-1002", amount: "$ 12,500.00", status: "Completed" },
        { id: "TRX-005", date: "Feb 10, 2024", vendor: "PT. Indo Garment", bank: "BCA Corporate", inv: "INV/2024/112", po: "PO-1005", amount: "Rp 210.000.000", status: "Completed" },
    ],
    "Jun": [
        { id: "TRX-021", date: "Jun 05, 2024", vendor: "CV. Berkah Jaya", bank: "Mandiri Biz", inv: "INV/2024/551", po: "PO-1205", amount: "Rp 88.000.000", status: "Pending" },
        { id: "TRX-022", date: "Jun 12, 2024", vendor: "PT. Tekstil Utama", bank: "BCA Corporate", inv: "INV/2024/567", po: "PO-1210", amount: "Rp 350.000.000", status: "Completed" },
        { id: "TRX-023", date: "Jun 18, 2024", vendor: "Global Logistics", bank: "Petty Cash", inv: "CSH/2024/099", po: "-", amount: "Rp 2.500.000", status: "Completed" },
        { id: "TRX-024", date: "Jun 25, 2024", vendor: "Office Supplies Co", bank: "BCA Corporate", inv: "INV/2024/601", po: "PO-1215", amount: "Rp 15.250.000", status: "Completed" },
    ],
    "Jul": [
        { id: "TRX-030", date: "Jul 01, 2024", vendor: "PT. Maju Mundur", bank: "BCA Corporate", inv: "INV/2024/701", po: "PO-1332", amount: "Rp 500.000.000", status: "Completed" },
    ]
}

export default function FinancialReportsPage() {
    const [reportType, setReportType] = useState("pnl")
    const [selectedMonth, setSelectedMonth] = useState("Jun")

    const currentData = transactionsDB[selectedMonth] || [
        { id: "TRX-999", date: `${selectedMonth} 15, 2024`, vendor: "General Vendor A", bank: "BCA Corporate", inv: `INV/2024/${selectedMonth}01`, po: "PO-XXXX", amount: "Rp 0", status: "No Data" }
    ]

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
                            <Badge className="bg-black text-white px-3 h-6 uppercase text-[10px] tracking-widest font-black">Fiscal 2024</Badge>
                            <span className="text-zinc-400 font-bold text-xs uppercase">Consolidated View</span>
                        </div>
                        <h1 className="text-4xl font-black font-serif uppercase tracking-tight">Profit & Loss Statement</h1>
                    </div>
                    <div className="text-right">
                        <p className="text-xs font-bold uppercase text-muted-foreground">Net Profit (YTD)</p>
                        <p className="text-4xl font-black tracking-tight text-emerald-600">Rp 1.28 B</p>
                        <div className="flex items-center justify-end gap-1 text-emerald-600 font-bold text-xs mt-1">
                            <TrendingUp className="h-3 w-3" /> +12.5% vs Last Year
                        </div>
                    </div>
                </div>

                {/* Visual Bar Chart (3D White Shirt Style) - Interactive */}
                <div className="h-80 border-2 border-black bg-zinc-50/50 rounded-xl p-8 flex flex-col relative overflow-hidden shadow-sm">
                    <div className="absolute top-4 right-4 flex gap-2">
                        <Button size="icon" variant="ghost" className="h-8 w-8"><Maximize2 className="h-4 w-4" /></Button>
                    </div>
                    <h3 className="text-sm font-black uppercase text-zinc-500 mb-8 flex items-center gap-2">
                        <BarChart3 className="h-4 w-4" /> Revenue Growth Trend
                    </h3>

                    {/* Bars Container */}
                    <div className="flex-1 flex items-end justify-between gap-4 px-2">
                        {monthlyData.map((data, i) => {
                            const isSelected = selectedMonth === data.month;
                            return (
                                <div key={i} className="flex-1 h-full flex items-end group relative rounded-t-sm px-1" onClick={() => setSelectedMonth(data.month)}>
                                    {/* The 3D "Shirt" Bar */}
                                    <motion.div
                                        initial={{ height: 0 }}
                                        animate={{ height: `${data.value}%` }}
                                        transition={{ duration: 0.5, delay: i * 0.05 }}
                                        className={`w-full border-2 border-black rounded-t-2xl relative shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] hover:shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:translate-x-[2px] hover:translate-y-[2px] transition-all cursor-pointer ${isSelected ? 'bg-black' : 'bg-white'}`}
                                    >
                                        {/* Floating Label (Pill) */}
                                        <div className={`absolute -top-10 left-1/2 -translate-x-1/2 text-[10px] font-bold py-1 px-3 rounded-full opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-10 pointer-events-none ${isSelected ? 'bg-zinc-800 text-white' : 'bg-black text-white'}`}>
                                            Rp {data.value * 1.2}M
                                        </div>
                                    </motion.div>
                                </div>
                            )
                        })}
                    </div>
                    <div className="flex justify-between px-2 mt-4 text-[10px] font-black text-zinc-400 uppercase tracking-widest">
                        {monthlyData.map(m => (
                            <span key={m.month} className={selectedMonth === m.month ? "text-black scale-110 transition-all" : ""}>{m.month}</span>
                        ))}
                    </div>
                </div>

                {/* Detailed Transaction Table (Rich Analysis) */}
                <Card className="border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] overflow-hidden">
                    <CardHeader className="bg-zinc-100 px-6 py-4 border-b border-black flex flex-row items-center justify-between">
                        <div>
                            <CardTitle className="uppercase font-black flex items-center gap-2 text-lg">
                                <FileText className="h-5 w-5" /> Transaction Analysis: {selectedMonth} 2024
                            </CardTitle>
                            <CardDescription className="font-bold text-xs mt-1">Detailed breakdown of selected period.</CardDescription>
                        </div>
                        <div className="flex gap-2">
                            <div className="relative">
                                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                                <Input placeholder="Filter trans..." className="pl-9 h-9 border-black bg-white w-64" />
                            </div>
                            <Button variant="outline" size="sm" className="h-9 border-black uppercase font-bold text-xs">
                                <Filter className="mr-2 h-3 w-3" /> Filter
                            </Button>
                        </div>
                    </CardHeader>
                    <div className="p-0">
                        <Table>
                            <TableHeader className="bg-zinc-50/50">
                                <TableRow className="hover:bg-transparent border-black/10">
                                    <TableHead className="font-bold text-xs uppercase text-black w-[120px]">Date / ID</TableHead>
                                    <TableHead className="font-bold text-xs uppercase text-black">Vendor / Partner</TableHead>
                                    <TableHead className="font-bold text-xs uppercase text-black">Bank & Method</TableHead>
                                    <TableHead className="font-bold text-xs uppercase text-black">Reference (INV/PO)</TableHead>
                                    <TableHead className="font-bold text-xs uppercase text-black text-right">Amount</TableHead>
                                    <TableHead className="font-bold text-xs uppercase text-black text-right">Status</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                <AnimatePresence mode="wait">
                                    {currentData.map((trx) => (
                                        <motion.tr
                                            key={trx.id}
                                            initial={{ opacity: 0, y: 5 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            exit={{ opacity: 0, y: -5 }}
                                            className="group hover:bg-zinc-50 border-black/5 transaction-colors"
                                        >
                                            <TableCell className="font-mono text-xs font-medium text-muted-foreground">
                                                <div className="font-bold text-black">{trx.date}</div>
                                                <div>{trx.id}</div>
                                            </TableCell>
                                            <TableCell>
                                                <div className="flex items-center gap-2">
                                                    <div className="h-8 w-8 rounded-full bg-zinc-200 border border-black/10 flex items-center justify-center text-xs font-black text-zinc-500">
                                                        {trx.vendor.substring(0, 2).toUpperCase()}
                                                    </div>
                                                    <div>
                                                        <div className="font-bold text-sm">{trx.vendor}</div>
                                                        <div className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-1 rounded w-fit mt-0.5">Top Supplier</div>
                                                    </div>
                                                </div>
                                            </TableCell>
                                            <TableCell>
                                                <div className="flex items-center gap-2 text-xs font-medium">
                                                    <Building2 className="h-3 w-3 text-zinc-400" /> {trx.bank}
                                                </div>
                                                <div className="text-[10px] text-muted-foreground mt-0.5">Direct Transfer</div>
                                            </TableCell>
                                            <TableCell>
                                                <div className="flex flex-col gap-1">
                                                    <Badge variant="outline" className="w-fit text-[10px] h-5 border-zinc-300 font-mono text-zinc-600">{trx.inv}</Badge>
                                                    <Badge variant="outline" className="w-fit text-[10px] h-5 border-zinc-200 bg-zinc-50 font-mono text-zinc-500">{trx.po}</Badge>
                                                </div>
                                            </TableCell>
                                            <TableCell className="text-right">
                                                <div className="font-mono font-black text-sm">{trx.amount}</div>
                                            </TableCell>
                                            <TableCell className="text-right">
                                                {trx.status === "Completed" ? (
                                                    <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-200 border-emerald-200 uppercase text-[10px] font-bold shadow-none">Paid</Badge>
                                                ) : trx.status === "Processing" ? (
                                                    <Badge className="bg-amber-100 text-amber-700 hover:bg-amber-200 border-amber-200 uppercase text-[10px] font-bold shadow-none">Process</Badge>
                                                ) : (
                                                    <Badge variant="outline" className="border-dashed border-zinc-300 text-zinc-400 uppercase text-[10px] font-bold shadow-none">Pending</Badge>
                                                )}
                                            </TableCell>
                                        </motion.tr>
                                    ))}
                                </AnimatePresence>
                            </TableBody>
                        </Table>
                    </div>
                </Card>

            </div>
        </div>
    )
}
