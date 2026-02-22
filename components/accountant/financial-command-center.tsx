"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { ArrowUpRight, ArrowDownRight, AlertTriangle, CheckCircle2, DollarSign, Wallet, TrendingUp, Calendar, Sparkles, Send, X, Bot } from "lucide-react"
import { toast } from "sonner"
import { useState } from "react"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogClose } from "@/components/ui/dialog"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { ResponsiveContainer, LineChart, Line, BarChart, Bar, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid } from "recharts"

// Mock Data for Charts - Wireframe Style (No Colors)
const dataCash7d = [
    { name: 'Mon', val: 2.1 }, { name: 'Tue', val: 2.2 }, { name: 'Wed', val: 2.3 },
    { name: 'Thu', val: 2.25 }, { name: 'Fri', val: 2.4 }, { name: 'Sat', val: 2.45 }, { name: 'Sun', val: 2.45 }
]

const dataReceivables = [
    { name: 'Current', val: 1.2 },
    { name: '30-60', val: 0.95 },
    { name: '60-90', val: 0.85 },
    { name: '>90', val: 0.8 }
]

const dataPayables = [
    { name: 'Not Due', val: 1.1 },
    { name: 'Due Soon', val: 0.65 },
    { name: 'Overdue', val: 0.35 }
]

const dataProfit = [
    { name: 'Jan', rev: 1.2, exp: 0.9 },
    { name: 'Feb', rev: 1.4, exp: 1.0 },
    { name: 'Mar', rev: 1.3, exp: 1.1 },
    { name: 'Apr', rev: 1.6, exp: 1.2 },
    { name: 'May', rev: 1.85, exp: 1.28 }
]

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

export function FinancialCommandCenter() {
    const [selectedMetric, setSelectedMetric] = useState<string | null>(null)

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
                            <ResponsiveContainer width="100%" height="100%">
                                <LineChart data={dataCash7d}>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e5e5" />
                                    <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#000', fontWeight: 600 }} dy={10} />
                                    <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#000', fontWeight: 600 }} domain={[1.5, 3]} />
                                    <Tooltip content={<CustomTooltip />} cursor={{ stroke: '#000', strokeWidth: 1, strokeDasharray: '4 4' }} />
                                    <Line type="monotone" dataKey="val" stroke="#000000" strokeWidth={4} dot={false} activeDot={{ r: 6, fill: "#000", stroke: "#fff", strokeWidth: 2 }} />
                                </LineChart>
                            </ResponsiveContainer>
                        )}

                        {selectedMetric === "receivables" && (
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={dataReceivables}>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e5e5" />
                                    <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#000', fontWeight: 600 }} dy={10} />
                                    <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#000', fontWeight: 600 }} />
                                    <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(0,0,0,0.05)' }} />
                                    <Bar dataKey="val" shape={<ThreeDBarShape />} barSize={60} />
                                </BarChart>
                            </ResponsiveContainer>
                        )}

                        {selectedMetric === "payables" && (
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={dataPayables} layout="vertical" barSize={40}>
                                    <CartesianGrid strokeDasharray="3 3" horizontal={true} stroke="#e5e5e5" />
                                    <XAxis type="number" hide />
                                    <YAxis dataKey="name" type="category" width={80} axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#000', fontWeight: 600 }} />
                                    <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(0,0,0,0.05)' }} />
                                    <Bar dataKey="val" shape={<ThreeDBarShape />} />
                                </BarChart>
                            </ResponsiveContainer>
                        )}

                        {selectedMetric === "profitability" && (
                            <ResponsiveContainer width="100%" height="100%">
                                <AreaChart data={dataProfit}>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e5e5" />
                                    <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#000', fontWeight: 600 }} dy={10} />
                                    <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#000', fontWeight: 600 }} />
                                    <Tooltip content={<CustomTooltip />} />
                                    <Area type="monotone" dataKey="rev" stroke="#000000" strokeWidth={3} fill="transparent" />
                                    <Area type="monotone" dataKey="exp" stroke="#000" strokeWidth={2} fill="transparent" strokeDasharray="4 4" />
                                </AreaChart>
                            </ResponsiveContainer>
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
            <div className="flex items-center gap-2 mb-2">
                <span className="text-[9px] font-black uppercase tracking-widest bg-amber-100 text-amber-700 border border-amber-300 px-2 py-0.5">Data Demo</span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                {/* 1. CASH POSITION */}
                <Card
                    className="border-l-4 border-l-emerald-500 shadow-sm cursor-pointer hover:shadow-md transition-all hover:bg-zinc-50 dark:hover:bg-zinc-900/20 group"
                    onClick={() => setSelectedMetric("cash")}
                >
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2 group-hover:text-emerald-600 transition-colors">
                            <Wallet className="h-4 w-4" />
                            POSISI KAS
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">Rp 2.45 Miliar <span className="text-emerald-500 text-lg">●</span></div>
                        <div className="mt-4 space-y-2 text-sm">
                            <div className="flex justify-between">
                                <span className="text-muted-foreground">Bank BCA (****1234)</span>
                                <span className="font-medium text-emerald-600">+Rp 450jt</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-muted-foreground">Bank Mandiri</span>
                                <span className="font-medium text-muted-foreground">-</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-muted-foreground">Bank BNI</span>
                                <span className="font-medium text-red-500">-Rp 200jt</span>
                            </div>
                        </div>

                        <div className="mt-4 pt-4 border-t border-border/50">
                            <div className="flex items-center gap-2 text-amber-600 bg-amber-50 dark:bg-amber-900/20 p-2 rounded-lg text-xs font-medium">
                                <AlertTriangle className="h-4 w-4 flex-shrink-0" />
                                <span>Defisit Rp 240jt per 16 Jan</span>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                {/* 2. RECEIVABLES */}
                <Card
                    className="border-l-4 border-l-amber-500 shadow-sm cursor-pointer hover:shadow-md transition-all hover:bg-zinc-50 dark:hover:bg-zinc-900/20 group"
                    onClick={() => setSelectedMetric("receivables")}
                >
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2 group-hover:text-amber-600 transition-colors">
                            <ArrowDownRight className="h-4 w-4" />
                            PIUTANG EST
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">Rp 3.8 Miliar</div>
                        <div className="mt-4 space-y-3">
                            <div className="flex items-center justify-between text-sm">
                                <span className="text-muted-foreground">Lancar (0-30 hari)</span>
                                <span className="text-emerald-600 font-medium">Rp 1.2M</span>
                            </div>
                            <div className="flex items-center justify-between text-sm">
                                <span className="text-muted-foreground">Segera (31-60)</span>
                                <span className="text-amber-600 font-medium">Rp 950jt</span>
                            </div>
                            <div className="flex items-center justify-between text-sm">
                                <span className="text-muted-foreground">Macet (&gt;60 hari)</span>
                                <span className="text-red-600 font-bold">Rp 1.65M</span>
                            </div>
                        </div>
                        <div className="mt-4 pt-2">
                            <div className="text-xs font-medium text-red-500">Prioritas: CV Garmen (112 hari)</div>
                        </div>
                    </CardContent>
                </Card>

                {/* 3. PAYABLES */}
                <Card
                    className="border-l-4 border-l-red-500 shadow-sm cursor-pointer hover:shadow-md transition-all hover:bg-zinc-50 dark:hover:bg-zinc-900/20 group"
                    onClick={() => setSelectedMetric("payables")}
                >
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2 group-hover:text-red-600 transition-colors">
                            <ArrowUpRight className="h-4 w-4" />
                            HUTANG (Vendor)
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">Rp 2.1 Miliar</div>
                        <div className="mt-4 space-y-3">
                            <div className="flex items-center justify-between text-sm">
                                <span className="text-muted-foreground">Belum Jatuh Tempo</span>
                                <span className="text-emerald-600 font-medium">Rp 1.1M</span>
                            </div>
                            <div className="flex items-center justify-between text-sm">
                                <span className="text-muted-foreground">Minggu Ini</span>
                                <span className="text-amber-600 font-medium">Rp 650jt</span>
                            </div>
                            <div className="flex items-center justify-between text-sm">
                                <span className="text-muted-foreground">Terlambat</span>
                                <span className="text-red-600 font-bold">Rp 350jt</span>
                            </div>
                        </div>
                        <div className="mt-4 pt-4 border-t border-border/50">
                            <div className="text-xs text-muted-foreground">3 pemasok marah / menagih</div>
                        </div>
                    </CardContent>
                </Card>

                {/* 4. PROFITABILITY */}
                <Card
                    className="border-l-4 border-l-indigo-500 shadow-sm cursor-pointer hover:shadow-md transition-all hover:bg-zinc-50 dark:hover:bg-zinc-900/20 group"
                    onClick={() => setSelectedMetric("profitability")}
                >
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2 group-hover:text-indigo-600 transition-colors">
                            <TrendingUp className="h-4 w-4" />
                            NET MARGIN
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">10%</div>
                        <div className="mt-2 text-xs text-muted-foreground flex items-center justify-between">
                            <span>Laba Bersih</span>
                            <span className="text-emerald-600 font-medium">Rp 185jt</span>
                        </div>
                        <div className="mt-4 flex gap-2">
                            <span className="inline-flex items-center px-2 py-1 rounded bg-emerald-100 text-emerald-700 text-xs font-medium dark:bg-emerald-900/30 dark:text-emerald-400">
                                On Track
                            </span>
                        </div>
                    </CardContent>
                </Card>
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
                                        <Button className="rounded-full px-4 h-9 bg-white text-black border border-black/10 hover:bg-zinc-50 shadow-sm" variant="ghost" onClick={() => toast.info("Fitur belum tersedia")}>
                                            <Send className="h-4 w-4" />
                                        </Button>
                                        <Button className="rounded-full px-6 h-9 bg-black text-white hover:bg-zinc-800 shadow-md" onClick={() => setSelectedMetric(null)}>
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
