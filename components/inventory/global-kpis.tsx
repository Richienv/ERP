import { getInventoryKPIs } from "@/app/actions/inventory";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Wallet, ArrowRightLeft, Hourglass, Activity, TrendingUp, ArrowUpRight, ArrowDownLeft } from "lucide-react";

export async function GlobalKPIs() {
    const kpiData = await getInventoryKPIs()

    // Helper for formatting
    const formatCurrency = (val: number) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(val)

    return (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">

            {/* 1. TOTAL INVENTORY VALUE (Consolidated) */}
            <Card className="bg-white border-2 border-black shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] relative overflow-hidden group">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 border-b-2 border-black">
                    <CardTitle className="text-xs font-black uppercase tracking-widest text-zinc-500 flex items-center gap-2">
                        <Wallet className="h-4 w-4 text-black" />
                        Total Inventory Value
                    </CardTitle>
                </CardHeader>
                <CardContent className="pt-6">
                    <div className="text-3xl font-black text-black tracking-tighter truncate" title={formatCurrency(kpiData.totalValue)}>
                        {new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', notation: 'compact', maximumFractionDigits: 1 }).format(kpiData.totalValue)}
                    </div>
                    <div className="mt-4 space-y-2">
                        <div className="flex justify-between items-center text-xs font-bold border-b border-zinc-100 pb-1">
                            <span className="text-zinc-500">Total SKUs</span>
                            <span className="font-mono">{kpiData.totalProducts} Items</span>
                        </div>
                        <div className="flex justify-between items-center text-xs font-bold border-b border-zinc-100 pb-1">
                            <span className="text-zinc-500">Low Stock SKUs</span>
                            <span className="font-mono text-red-600">{kpiData.lowStock} Items</span>
                        </div>
                        <div className="flex justify-between items-center text-xs font-bold">
                            <span className="text-zinc-500">Accuracy</span>
                            <span className="font-mono">{kpiData.inventoryAccuracy}%</span>
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* 2. TRAFFIC: Inbound vs Outbound (Mocked for Demo - Requires Transaction Log) */}
            <Card className="bg-white border-2 border-black shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] relative overflow-hidden group">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 border-b-2 border-black">
                    <CardTitle className="text-xs font-black uppercase tracking-widest text-zinc-500 flex items-center gap-2">
                        <ArrowRightLeft className="h-4 w-4 text-black" />
                        Inbound vs Outbound
                    </CardTitle>
                </CardHeader>
                <CardContent className="pt-6">
                    <div className="grid grid-cols-2 gap-0 divide-x-2 divide-zinc-100">
                        <div className="pr-4">
                            <div className="text-3xl font-black text-black flex items-center gap-1 tracking-tighter">
                                <ArrowDownLeft className="h-5 w-5 text-zinc-400" /> 12
                            </div>
                            <p className="text-[10px] font-bold uppercase text-zinc-400 mt-1">Incoming Today</p>
                        </div>
                        <div className="pl-4">
                            <div className="text-3xl font-black text-black flex items-center gap-1 tracking-tighter">
                                <ArrowUpRight className="h-5 w-5 text-zinc-400" /> 45
                            </div>
                            <p className="text-[10px] font-bold uppercase text-zinc-400 mt-1">Outgoing Today</p>
                        </div>
                    </div>
                    <div className="mt-6 pt-4 border-t-2 border-black/5 flex justify-between items-center">
                        <span className="text-[10px] font-black uppercase text-zinc-400">Weekly Volume</span>
                        <span className="text-xs font-bold font-mono bg-zinc-100 px-2 py-1 rounded">340 Pallets</span>
                    </div>
                </CardContent>
            </Card>

            {/* 3. HEALTH: Slow Moving Stock (Mocked) */}
            <Card className="bg-white border-2 border-black shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] relative overflow-hidden group">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 border-b-2 border-black">
                    <CardTitle className="text-xs font-black uppercase tracking-widest text-zinc-500 flex items-center gap-2">
                        <Hourglass className="h-4 w-4 text-black" />
                        Dead/Slow Moving
                    </CardTitle>
                </CardHeader>
                <CardContent className="pt-6">
                    <div className="text-4xl font-black text-black tracking-tighter">Rp 1.2M</div>
                    <p className="text-xs font-bold text-zinc-400 mt-1 mb-6">
                        Stok tidak bergerak {">"} 90 hari.
                    </p>
                    <div className="space-y-2">
                        <div className="flex justify-between text-[10px] font-black uppercase">
                            <span className="text-zinc-400">Risk Level</span>
                            <span className="text-red-600 bg-red-50 px-2 rounded">High (8.6%)</span>
                        </div>
                        <div className="h-2 w-full bg-zinc-100 rounded-none overflow-hidden border border-zinc-200">
                            <div className="h-full bg-black w-[8.6%] pattern-diagonal-lines" />
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* 4. PERFORMANCE: Inventory Turnover (Mocked) */}
            <Card className="bg-white border-2 border-black shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] relative overflow-hidden group">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 border-b-2 border-black">
                    <CardTitle className="text-xs font-black uppercase tracking-widest text-zinc-500 flex items-center gap-2">
                        <Activity className="h-4 w-4 text-black" />
                        Inventory Turnover
                    </CardTitle>
                </CardHeader>
                <CardContent className="pt-6">
                    <div className="flex items-baseline gap-2">
                        <div className="text-4xl font-black text-black tracking-tighter">4.2x</div>
                        <span className="text-xs font-bold text-zinc-400 uppercase">/ Year</span>
                    </div>

                    <div className="mt-6 pt-4 border-t-2 border-black/5 grid grid-cols-2 gap-4">
                        <div>
                            <div className="text-xl font-black text-black">45d</div>
                            <p className="text-[9px] font-bold uppercase text-zinc-400">DSI</p>
                        </div>
                        <div className="text-right">
                            <div className="text-xl font-black text-emerald-600 flex items-center justify-end gap-1">
                                <TrendingUp className="h-4 w-4" /> +12%
                            </div>
                            <p className="text-[9px] font-bold uppercase text-zinc-400">vs Last Month</p>
                        </div>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
