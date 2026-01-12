"use client"

import { useState } from "react"
import {
    Card,
    CardContent,
    CardDescription,
    CardFooter,
    CardHeader,
    CardTitle
} from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table"
import {
    Search,
    Filter,
    MoreHorizontal,
    Eye,
    FileText,
    DollarSign,
    Calendar,
    CheckCircle,
    AlertCircle,
    Download,
    Printer,
    CreditCard,
    TrendingUp,
    Store,
    ArrowUpRight,
    ArrowDownRight,
    SearchCode,
    Receipt
} from "lucide-react"
import Link from "next/link"
import { IconTrendingUp, IconTrendingDown } from "@tabler/icons-react"
import { cn } from "@/lib/utils"
import { motion } from "framer-motion"

// --- Mock Data ---

const RECENT_WINS = [
    { customer: "PT. Garment Indah", value: 150000000, time: "10:45 AM", type: "Big Win" },
    { customer: "Boutique A", value: 25000000, time: "11:00 AM", type: "Regular" },
    { customer: "CV. Tekstil Jaya", value: 85000000, time: "11:15 AM", type: "Win" },
    { customer: "Fashion Nova", value: 12000000, time: "11:30 AM", type: "Walk-in" },
    { customer: "Sport Wear ID", value: 200000000, time: "11:45 AM", type: "Mega Win" },
]

const INVOICES = [
    { id: '1', number: 'INV-2411-001', customer: 'PT. Garment Indah Jaya', date: '2024-11-20', due: '2024-12-20', total: 166500000, status: 'UNPAID' },
    { id: '2', number: 'INV-2411-002', customer: 'CV. Tekstil Makmur', date: '2024-11-18', due: '2024-12-03', total: 94350000, status: 'PAID' },
    { id: '3', number: 'INV-2411-003', customer: 'Boutique Fashion A', date: '2024-11-15', due: '2024-11-15', total: 57720000, status: 'PAID' },
    { id: '4', number: 'INV-2411-004', customer: 'PT. Mode Nusantara', date: '2024-10-25', due: '2024-11-25', total: 133200000, status: 'OVERDUE' },
    { id: '5', number: 'INV-2411-005', customer: 'UD. Kain Sejahtera', date: '2024-11-21', due: '2024-12-21', total: 49950000, status: 'UNPAID' },
]

export default function SalesStreamPage() {
    const [searchTerm, setSearchTerm] = useState("")

    const formatRupiah = (num: number) => {
        return new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(num);
    };

    return (
        <div className="flex flex-col min-h-[calc(100vh-4rem)] bg-zinc-50 dark:bg-zinc-950">

            {/* === TICKER TAPE === */}
            <div className="h-10 bg-black text-white overflow-hidden flex items-center relative z-10 shadow-md">
                <div className="font-black bg-red-600 px-4 h-full flex items-center z-20 shadow-[4px_0px_10px_rgba(0,0,0,0.5)] uppercase tracking-wide text-xs">
                    Live Stream
                </div>
                <div className="flex animate-marquee whitespace-nowrap ml-4">
                    {/* Duplicate specifically for marquee effect (usually handle via CSS) */}
                    {[...RECENT_WINS, ...RECENT_WINS, ...RECENT_WINS].map((win, i) => (
                        <div key={i} className="flex items-center gap-2 mx-6 text-sm">
                            <span className="font-mono text-zinc-400">{win.time}</span>
                            <span className="font-bold text-green-400">+{formatRupiah(win.value).replace(",00", "")}</span>
                            <span className="font-medium text-zinc-300">from {win.customer}</span>
                            {win.value > 100000000 && <span className="px-1.5 py-0.5 bg-yellow-500 text-black text-[10px] font-black rounded-sm uppercase">Big Win</span>}
                        </div>
                    ))}
                </div>
            </div>

            <div className="flex-1 p-4 md:p-8 pt-6 space-y-6">

                {/* Header Section */}
                <div className="flex justify-between items-start">
                    <div>
                        <h2 className="text-4xl font-black tracking-tight uppercase">Revenue Stream</h2>
                        <p className="text-muted-foreground font-medium mt-1">Real-time financial performance & closing metrics.</p>
                    </div>
                    <div className="flex gap-2">
                        <Button variant="outline" className="border-2 border-black font-bold shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:translate-y-[2px] hover:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] transition-all">
                            <Download className="mr-2 h-4 w-4" /> Export
                        </Button>
                        <Button className="bg-black text-white hover:bg-zinc-800 border-2 border-transparent font-bold shadow-lg">
                            <Receipt className="mr-2 h-4 w-4" /> Buat Invoice
                        </Button>
                    </div>
                </div>

                {/* === METRIC GRID (Bank Statement Style) === */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {/* Daily Closing Card - The "Cash Register" */}
                    <Card className="border-2 border-black shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] relative overflow-hidden bg-white dark:bg-zinc-900 group">
                        <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                            <Store className="h-24 w-24" />
                        </div>
                        <CardHeader className="pb-2">
                            <CardDescription className="text-xs font-bold uppercase tracking-widest text-zinc-500">Daily Closing</CardDescription>
                            <CardTitle className="text-3xl font-black tracking-tighter">
                                {formatRupiah(255000000).replace(",00", "")}
                            </CardTitle>
                        </CardHeader>
                        <CardFooter className="pt-0">
                            <div className="flex items-center gap-2 text-green-600 font-bold bg-green-50 px-2 py-1 rounded-md border border-green-200">
                                <ArrowUpRight className="h-4 w-4" /> +12.5% vs Yesterday
                            </div>
                        </CardFooter>
                        <div className="h-1.5 w-full bg-zinc-100 mt-4">
                            <div className="h-full bg-black w-[75%]" /> {/* Progress toward daily target */}
                        </div>
                    </Card>

                    {/* Pending AR Card */}
                    <Card className="border-2 border-black shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] bg-zinc-50 dark:bg-zinc-900">
                        <CardHeader className="pb-2">
                            <CardDescription className="text-xs font-bold uppercase tracking-widest text-zinc-500">Unpaid Invoices (AR)</CardDescription>
                            <CardTitle className="text-3xl font-black tracking-tighter text-orange-600">
                                {formatRupiah(133000000).replace(",00", "")}
                            </CardTitle>
                        </CardHeader>
                        <CardFooter className="pt-0 justify-between items-end">
                            <div className="text-sm text-muted-foreground font-medium">5 Invoices Open</div>
                            <Button size="sm" variant="ghost" className="text-orange-600 hover:text-orange-700 hover:bg-orange-50 -mr-2">Nagih Sekarang <ArrowUpRight className="ml-1 h-3 w-3" /></Button>
                        </CardFooter>
                    </Card>

                    {/* Cash In Hand */}
                    <Card className="border-2 border-black shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] bg-zinc-900 text-white dark:bg-zinc-800">
                        <CardHeader className="pb-2">
                            <CardDescription className="text-xs font-bold uppercase tracking-widest text-zinc-400">Net Cash In</CardDescription>
                            <CardTitle className="text-3xl font-black tracking-tighter text-green-400">
                                {formatRupiah(57720000).replace(",00", "")}
                            </CardTitle>
                        </CardHeader>
                        <CardFooter className="pt-0">
                            <div className="text-zinc-400 text-sm">Realized revenue this month.</div>
                        </CardFooter>
                    </Card>
                </div>


                {/* === INVOICE STREAM (Ticker Style List) === */}
                <div className="border-2 border-black rounded-xl shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] bg-white dark:bg-zinc-900 overflow-hidden">
                    <div className="p-4 border-b-2 border-black flex justify-between items-center bg-zinc-50 dark:bg-zinc-800">
                        <h3 className="font-black text-lg uppercase flex items-center gap-2">
                            <Filter className="h-5 w-5" /> Transaction Log
                        </h3>
                        <div className="relative w-64">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                            <Input
                                placeholder="Search ref or customer..."
                                className="pl-9 bg-white border-2 border-zinc-200 focus-visible:border-black focus-visible:ring-0 rounded-lg font-medium"
                            />
                        </div>
                    </div>

                    <div className="divide-y divide-zinc-200 dark:divide-zinc-800">
                        {INVOICES.map((inv) => (
                            <div key={inv.id} className="p-4 flex items-center justify-between hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors group cursor-pointer">
                                <div className="flex items-center gap-4">
                                    <div className={cn(
                                        "h-12 w-12 rounded-lg border-2 border-black flex items-center justify-center font-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]",
                                        inv.status === 'PAID' ? "bg-green-100 text-green-700" :
                                            inv.status === 'OVERDUE' ? "bg-red-100 text-red-700" : "bg-white text-zinc-700"
                                    )}>
                                        {inv.status === 'PAID' ? 'PD' : inv.status === 'OVERDUE' ? 'OD' : 'OP'}
                                    </div>
                                    <div>
                                        <div className="font-bold text-lg leading-none">{inv.customer}</div>
                                        <div className="text-sm text-muted-foreground font-mono mt-1">{inv.number} • {inv.date}</div>
                                    </div>
                                </div>

                                <div className="text-right">
                                    <div className="font-black text-lg">{formatRupiah(inv.total).replace(",00", "")}</div>
                                    <div className={cn("text-xs font-bold uppercase",
                                        inv.status === 'PAID' ? "text-green-600" :
                                            inv.status === 'OVERDUE' ? "text-red-600" : "text-yellow-600"
                                    )}>
                                        {inv.status}
                                    </div>
                                </div>

                                <Button variant="ghost" size="icon" className="opacity-0 group-hover:opacity-100 transition-opacity">
                                    <ArrowUpRight className="h-5 w-5" />
                                </Button>
                            </div>
                        ))}
                    </div>

                    <div className="p-4 bg-zinc-50 dark:bg-zinc-800 border-t-2 border-black text-center">
                        <Button variant="link" className="text-muted-foreground hover:text-black">View All Transactions</Button>
                    </div>
                </div>

            </div>
        </div>
    )
}