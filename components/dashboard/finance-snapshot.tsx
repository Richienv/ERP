"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { ArrowUpRight, ArrowDownRight, AlertTriangle, CheckCircle2, DollarSign, Wallet, TrendingUp, Calendar, Sparkles, Send, X, Bot } from "lucide-react"
import Link from "next/link"
import { Skeleton } from "@/components/ui/skeleton"
import { useState } from "react"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogClose } from "@/components/ui/dialog"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { ResponsiveContainer, LineChart, Line, BarChart, Bar, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid } from "recharts"

import { formatCompactNumber, formatIDR } from "@/lib/utils"

// Custom Tooltip for that "Ritchie Minimal" look (Black Border, Sharp Shadow)
const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
        return (
            <div className="bg-white dark:bg-zinc-950 border border-black p-3 rounded-lg shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
                <p className="text-sm font-bold mb-1">{label}</p>
                <p className="text-sm font-mono">
                    {payload[0].value} M
                </p>
            </div>
        )
    }
    return null
}

// Custom 3D Bar Shape (Black Shadow Offset + White Pill)
const ThreeDBarShape = (props: any) => {
    const { x, y, width, height } = props;
    const radius = 12;

    return (
        <g>
            {/* Shadow Layer (Offset) */}
            <rect
                x={x + 4}
                y={y + 4}
                width={width}
                height={height}
                fill="#000000"
                rx={radius}
                ry={radius}
            />
            {/* Foreground Layer (Main Bar) */}
            <rect
                x={x}
                y={y}
                width={width}
                height={height}
                stroke="#000000"
                strokeWidth={2.5}
                fill="#ffffff"
                rx={radius}
                ry={radius}
            />
        </g>
    );
};

interface FinanceSnapshotProps {
    data?: {
        cashBalance: number
        burnRate: number
        accountsReceivable: number
        accountsPayable: number
        netProfit: number
        totalRevenue: number
        overdueInvoices?: any[]
        upcomingPayables?: any[]
    } | null
    chartData?: {
        dataCash7d: Array<{ name: string; val: number }>
        dataReceivables: Array<{ name: string; val: number }>
        dataPayables: Array<{ name: string; val: number }>
        dataProfit: Array<{ name: string; rev: number; exp: number }>
    } | null
}

export function FinanceSnapshot({ data, chartData }: FinanceSnapshotProps) {
    const [selectedMetric, setSelectedMetric] = useState<string | null>(null)

    // Formatted Values (or defaults if loading/null)
    // Formatted Values (or defaults if loading/null)
    const cashDisplay = data ? formatCompactNumber(data.cashBalance) : null
    const burnDisplay = data ? formatCompactNumber(data.burnRate) : null
    const arDisplay = data ? formatCompactNumber(data.accountsReceivable) : null
    const apDisplay = data ? formatCompactNumber(data.accountsPayable) : null
    // Calculate Margin % if data exists
    const marginPercent = data && data.totalRevenue > 0
        ? ((data.netProfit / data.totalRevenue) * 100).toFixed(1)
        : null


    const renderMetricDetail = () => {
        if (!selectedMetric) return null

        return (
            <div className="space-y-6">

                {/* KEY TAKEAWAY SECTION */}
                <div>
                    <h4 className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-3">Key Takeaway</h4>
                    <p className="text-sm font-medium leading-relaxed max-w-[90%]">
                        {selectedMetric === "cash" && "Posisi kas stabil di atas ambang batas aman, namun Burn Rate harian perlu dipantau karena tren pengeluaran meningkat 15% minggu ini."}
                        {selectedMetric === "receivables" && "Penagihan piutang melambat di kategori 60-90 hari. Disarankan untuk segera menghubungi 3 klien prioritas utama."}
                        {selectedMetric === "payables" && "Hutang jangka pendek aman, namun ada 2 supplier bahan baku utama yang akan jatuh tempo minggu depan."}
                        {selectedMetric === "profitability" && "Margin laba bersih (10%) sedikit di bawah target (12%) karena kenaikan biaya logistik yang tidak terduga akhir bulan lalu."}
                    </p>
                </div>

                {/* CHART CONTAINER - EXACT MATCH TO IMAGE (No Shadow on Container now, just Border) */}
                <div className="rounded-3xl border border-black p-6 bg-white dark:bg-black relative mt-4">
                    {/* Floating Labels inside Chart Area logic could go here, for now using pure Recharts */}

                    <div className="h-[250px] w-full">
                        {selectedMetric === "cash" && (
                            chartData?.dataCash7d && chartData.dataCash7d.length > 0 ? (
                                <ResponsiveContainer width="100%" height="100%">
                                    <LineChart data={chartData.dataCash7d}>
                                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e5e5" />
                                        <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#000', fontWeight: 600 }} dy={10} />
                                        <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#000', fontWeight: 600 }} />
                                        <Tooltip content={<CustomTooltip />} cursor={{ stroke: '#000', strokeWidth: 1, strokeDasharray: '4 4' }} />
                                        <Line type="monotone" dataKey="val" stroke="#000000" strokeWidth={4} dot={false} activeDot={{ r: 6, fill: "#000", stroke: "#fff", strokeWidth: 2 }} />
                                    </LineChart>
                                </ResponsiveContainer>
                            ) : (
                                <div className="flex items-center justify-center h-full">
                                    <Skeleton className="h-40 w-full" />
                                </div>
                            )
                        )}

                        {selectedMetric === "receivables" && (
                            chartData?.dataReceivables && chartData.dataReceivables.length > 0 ? (
                                <ResponsiveContainer width="100%" height="100%">
                                    <BarChart data={chartData.dataReceivables}>
                                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e5e5" />
                                        <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#000', fontWeight: 600 }} dy={10} />
                                        <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#000', fontWeight: 600 }} />
                                        <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(0,0,0,0.05)' }} />
                                        <Bar dataKey="val" shape={<ThreeDBarShape />} barSize={60} />
                                    </BarChart>
                                </ResponsiveContainer>
                            ) : (
                                <div className="flex items-center justify-center h-full">
                                    <Skeleton className="h-40 w-full" />
                                </div>
                            )
                        )}

                        {selectedMetric === "payables" && (
                            chartData?.dataPayables && chartData.dataPayables.length > 0 ? (
                                <ResponsiveContainer width="100%" height="100%">
                                    <BarChart data={chartData.dataPayables} layout="vertical" barSize={40}>
                                        <CartesianGrid strokeDasharray="3 3" horizontal={true} stroke="#e5e5e5" />
                                        <XAxis type="number" hide />
                                        <YAxis dataKey="name" type="category" width={80} axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#000', fontWeight: 600 }} />
                                        <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(0,0,0,0.05)' }} />
                                        <Bar dataKey="val" shape={<ThreeDBarShape />} />
                                    </BarChart>
                                </ResponsiveContainer>
                            ) : (
                                <div className="flex items-center justify-center h-full">
                                    <Skeleton className="h-40 w-full" />
                                </div>
                            )
                        )}

                        {selectedMetric === "profitability" && (
                            chartData?.dataProfit && chartData.dataProfit.length > 0 ? (
                                <ResponsiveContainer width="100%" height="100%">
                                    <AreaChart data={chartData.dataProfit}>
                                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e5e5" />
                                        <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#000', fontWeight: 600 }} dy={10} />
                                        <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#000', fontWeight: 600 }} />
                                        <Tooltip content={<CustomTooltip />} />
                                        <Area type="monotone" dataKey="rev" stroke="#000000" strokeWidth={3} fill="transparent" />
                                        <Area type="monotone" dataKey="exp" stroke="#000" strokeWidth={2} fill="transparent" strokeDasharray="4 4" />
                                    </AreaChart>
                                </ResponsiveContainer>
                            ) : (
                                <div className="flex items-center justify-center h-full">
                                    <Skeleton className="h-40 w-full" />
                                </div>
                            )
                        )}
                    </div>
                </div>

            </div>
        )
    }

    const getDialogTitle = (metric: string) => {
        switch (metric) {
            case "cash": return "Cash Flow Breakdown"
            case "receivables": return "Accounts Receivable Aging"
            case "payables": return "Accounts Payable Schedule"
            case "profitability": return "Profit & Loss Statement (Live)"
            default: return "Details"
        }
    }

    return (
        <>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                {/* 1. CASH POSITION */}
                <Link href="/finance">
                    <Card
                        className="border-2 border-black shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] hover:translate-y-[2px] hover:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] transition-all cursor-pointer bg-white group"
                    >
                        <CardHeader className="pb-2 border-b-2 border-dashed border-zinc-200">
                            <CardTitle className="text-xs font-black uppercase tracking-widest text-zinc-500 flex items-center justify-between">
                                <span className="flex items-center gap-2"><Wallet className="h-4 w-4 text-black" /> Posisi Kas</span>
                                <Badge className="bg-red-100 text-red-700 hover:bg-red-100 border-none px-1.5 py-0 text-[10px] uppercase font-black tracking-wider">
                                    High Burn
                                </Badge>
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="pt-4">
                            <div className="text-3xl font-black tracking-tight">{cashDisplay ? `Rp ${cashDisplay}` : <Skeleton className="h-9 w-32" />}</div>
                            <div className="text-xs font-bold text-zinc-400 mt-1 mb-4 flex items-center gap-1">
                                {burnDisplay ? (
                                    <>
                                        <ArrowDownRight className="h-3 w-3 text-red-500" />
                                        Burn Rate: <span className="text-red-500">Rp {burnDisplay} / hari</span>
                                    </>
                                ) : <Skeleton className="h-4 w-24" />}
                            </div>

                            <div className="flex gap-2">
                                <Button size="sm" className="w-full text-xs font-black uppercase tracking-wider h-8 bg-black text-white hover:bg-zinc-800 border-2 border-transparent shadow-none">
                                    View Finance
                                </Button>
                            </div>
                        </CardContent>
                    </Card>
                </Link>

                {/* 2. RECEIVABLES (Detailed List) */}
                <Link href="/finance/invoices">
                    <Card
                        className="border-2 border-black shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] hover:translate-y-[2px] hover:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] transition-all cursor-pointer bg-white group"
                    >
                        <CardHeader className="pb-2 border-b-2 border-dashed border-zinc-200">
                            <CardTitle className="text-xs font-black uppercase tracking-widest text-zinc-500 flex items-center justify-between">
                                <span className="flex items-center gap-2"><ArrowDownRight className="h-4 w-4 text-black" /> Piutang</span>
                                <Badge className="bg-zinc-100 text-zinc-900 hover:bg-zinc-100 border-none px-1.5 py-0 text-[10px] uppercase font-black tracking-wider">
                                    3 Overdue
                                </Badge>
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="pt-4">
                            <div className="text-3xl font-black tracking-tight">{arDisplay ? `Rp ${arDisplay}` : <Skeleton className="h-9 w-28" />}</div>

                            <div className="mt-3 mb-4">
                                <p className="text-[10px] font-bold text-zinc-400 mb-1 uppercase tracking-wider">Overdue Details</p>
                                <ul className="space-y-1">
                                    {data?.overdueInvoices && data.overdueInvoices.length > 0 ? (
                                        data.overdueInvoices.map((inv: any) => {
                                            // Calculate days overdue
                                            const days = Math.floor((new Date().getTime() - new Date(inv.dueDate).getTime()) / (1000 * 3600 * 24))
                                            return (
                                                <li key={inv.id} className="flex justify-between text-xs font-bold text-zinc-600">
                                                    <span>• {inv.customer?.name} ({days}d)</span>
                                                    <span className="text-red-600">Rp {formatCompactNumber(Number(inv.balanceDue))}</span>
                                                </li>
                                            )
                                        })
                                    ) : (
                                        // Show Skeleton or Empty State
                                        data?.overdueInvoices ? (
                                            <li className="text-xs text-zinc-400 italic">No overdue invoices</li>
                                        ) : (
                                            <>
                                                <li className="flex justify-between"><Skeleton className="h-3 w-28" /><Skeleton className="h-3 w-12" /></li>
                                                <li className="flex justify-between"><Skeleton className="h-3 w-20" /><Skeleton className="h-3 w-10" /></li>
                                            </>
                                        )
                                    )}
                                </ul>
                            </div>

                            <div className="flex gap-2">
                                <Button size="sm" variant="outline" className="w-full text-xs font-black uppercase tracking-wider h-8 border-2 border-black hover:bg-zinc-50">
                                    View Invoices
                                </Button>
                            </div>
                        </CardContent>
                    </Card>
                </Link>

                {/* 3. PAYABLES (Detailed List) */}
                <Link href="/finance/bills">
                    <Card
                        className="border-2 border-black shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] hover:translate-y-[2px] hover:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] transition-all cursor-pointer bg-white group"
                    >
                        <CardHeader className="pb-2 border-b-2 border-dashed border-zinc-200">
                            <CardTitle className="text-xs font-black uppercase tracking-widest text-zinc-500 flex items-center justify-between">
                                <span className="flex items-center gap-2"><ArrowUpRight className="h-4 w-4 text-black" /> Hutang</span>
                                <Badge className="bg-zinc-100 text-zinc-900 hover:bg-zinc-100 border-none px-1.5 py-0 text-[10px] uppercase font-black tracking-wider">
                                    Due This Week
                                </Badge>
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="pt-4">
                            <div className="text-3xl font-black tracking-tight">{apDisplay ? `Rp ${apDisplay}` : <Skeleton className="h-9 w-28" />}</div>

                            <div className="mt-3 mb-4">
                                <p className="text-[10px] font-bold text-zinc-400 mb-1 uppercase tracking-wider">Upcoming Payments</p>
                                <ul className="space-y-1">
                                    {data?.upcomingPayables && data.upcomingPayables.length > 0 ? (
                                        data.upcomingPayables.map((inv: any) => (
                                            <li key={inv.id} className="flex justify-between text-xs font-bold">
                                                <span>• {inv.supplier?.name || 'Unknown'}</span>
                                                <span className="text-black">Rp {formatCompactNumber(Number(inv.balanceDue))}</span>
                                            </li>
                                        ))
                                    ) : (
                                        // Show Skeleton or Empty State
                                        data?.upcomingPayables ? (
                                            <li className="text-xs text-zinc-400 italic">No upcoming payments</li>
                                        ) : (
                                            <>
                                                <li className="flex justify-between"><Skeleton className="h-3 w-24" /><Skeleton className="h-3 w-12" /></li>
                                                <li className="flex justify-between"><Skeleton className="h-3 w-20" /><Skeleton className="h-3 w-10" /></li>
                                            </>
                                        )
                                    )}
                                </ul>
                            </div>

                            <div className="flex gap-2">
                                <Button size="sm" variant="secondary" className="w-full text-xs font-black uppercase tracking-wider h-8 bg-zinc-100 hover:bg-zinc-200 border-2 border-transparent text-zinc-900">
                                    View Bills
                                </Button>
                            </div>
                        </CardContent>
                    </Card>
                </Link>

                {/* 4. NET MARGIN */}
                <Link href="/finance/reports">
                    <Card
                        className="border-2 border-black shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] hover:translate-y-[2px] hover:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] transition-all cursor-pointer bg-white group"
                    >
                        <CardHeader className="pb-2 border-b-2 border-dashed border-zinc-200">
                            <CardTitle className="text-xs font-black uppercase tracking-widest text-zinc-500 flex items-center justify-between">
                                <span className="flex items-center gap-2"><TrendingUp className="h-4 w-4 text-black" /> Net Margin</span>
                                <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100 border-none px-1.5 py-0 text-[10px] uppercase font-black tracking-wider">
                                    Healthy
                                </Badge>
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="pt-4">
                            <div className="text-3xl font-black tracking-tight">{marginPercent ? `${marginPercent}%` : <Skeleton className="h-9 w-24" />}</div>
                            <div className="text-xs font-bold text-zinc-400 mt-1 mb-4 flex items-center gap-1">
                                {marginPercent ? (
                                    <>
                                        <ArrowUpRight className="h-3 w-3 text-emerald-500" />
                                        +1.2% vs Last Month
                                    </>
                                ) : <Skeleton className="h-4 w-32" />}
                            </div>

                            <div className="flex gap-2">
                                <Button size="sm" variant="ghost" className="w-full text-xs font-black uppercase tracking-wider h-8 hover:bg-emerald-50 text-emerald-700">
                                    View Reports
                                </Button>
                            </div>
                        </CardContent>
                    </Card>
                </Link>
            </div>

            <Dialog open={!!selectedMetric} onOpenChange={() => setSelectedMetric(null)}>
                <DialogContent showCloseButton={false} className="max-w-4xl border-none shadow-none bg-transparent p-0 overflow-visible">
                    {/* CUSTOM AI POPUP STYLE CONTAINER */}
                    <div className="bg-white dark:bg-zinc-900 border border-black/10 rounded-2xl shadow-2xl overflow-hidden flex flex-col w-full">

                        {/* HEADER */}
                        <div className="px-6 py-4 flex items-center justify-between border-b border-black/5">
                            <div className="flex items-center gap-3">
                                <div className="h-10 w-10 bg-black rounded-xl flex items-center justify-center text-white shadow-lg">
                                    <Sparkles className="h-5 w-5" />
                                </div>
                                <div>
                                    <h3 className="font-serif text-xl font-bold text-foreground">{selectedMetric ? getDialogTitle(selectedMetric) : "Analysis"}</h3>
                                    <p className="text-xs text-muted-foreground">Analisis mendalam menggunakan data perusahaan real-time.</p>
                                </div>
                            </div>
                            <Button variant="ghost" size="icon" onClick={() => setSelectedMetric(null)} className="rounded-full hover:bg-black/5">
                                <X className="h-5 w-5" />
                            </Button>
                        </div>

                        {/* BODY */}
                        <div className="p-6">
                            {renderMetricDetail()}
                        </div>

                        {/* FOOTER INPUT */}
                        <div className="p-4 border-t border-black/5 bg-zinc-50/50 dark:bg-zinc-900/50">
                            <div className="flex flex-col gap-2">
                                <span className="text-[10px] font-bold uppercase text-muted-foreground tracking-wider ml-1">Tindak Lanjut</span>
                                <div className="relative">
                                    <Input
                                        placeholder="Tanyakan detail lebih lanjut (contoh: bandingkan dengan Q2)..."
                                        className="pr-40 rounded-full border-black/10 bg-white py-6 shadow-sm focus-visible:ring-black focus-visible:ring-offset-0"
                                    />
                                    <div className="absolute right-1.5 top-1.5 flex gap-1">
                                        <Button className="rounded-full px-4 h-9 bg-white text-black border border-black/10 hover:bg-zinc-50 shadow-sm" variant="ghost">
                                            <Send className="h-4 w-4" />
                                        </Button>
                                        <Button className="rounded-full px-6 h-9 bg-black text-white hover:bg-zinc-800 shadow-md">
                                            Selesai
                                        </Button>
                                    </div>
                                </div>
                            </div>
                        </div>

                    </div>
                </DialogContent>
            </Dialog>
        </>
    )
}
