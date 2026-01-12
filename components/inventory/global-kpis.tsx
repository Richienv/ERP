"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertTriangle, TrendingDown, DollarSign, Truck, AlertOctagon, Zap, Ban } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";

export function GlobalKPIs() {
    return (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">

            {/* 1. FINANCIAL RISK: Dead Stock */}
            <Card className="bg-white border-2 border-black shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] relative overflow-hidden group">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 bg-red-50 border-b-2 border-black">
                    <CardTitle className="text-sm font-black uppercase tracking-wider text-black flex items-center gap-2">
                        <Ban className="h-4 w-4 text-red-600" />
                        Dead Stock Risk
                    </CardTitle>
                </CardHeader>
                <CardContent className="pt-4">
                    <div className="text-3xl font-black text-black">Rp 1.2M</div>
                    <p className="text-xs font-bold text-muted-foreground mt-1 mb-4">
                        Barang tidak bergerak {">"} 90 hari.
                    </p>
                    <div className="space-y-3">
                        <div className="h-2 w-full bg-zinc-100 border border-black rounded-full overflow-hidden">
                            <div className="h-full bg-red-500 w-[65%]" />
                        </div>
                        <Button className="w-full h-8 text-xs font-black uppercase bg-white text-red-600 border-2 border-red-200 hover:bg-red-50 hover:border-red-600 shadow-sm transition-all">
                            <Zap className="mr-2 h-3 w-3" /> Auto-Liquidation
                        </Button>
                    </div>
                </CardContent>
            </Card>

            {/* 2. OPERATIONAL BOTTLENECK: Inbound Congestion */}
            <Card className="bg-white border-2 border-black shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] relative overflow-hidden group">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 bg-amber-50 border-b-2 border-black">
                    <CardTitle className="text-sm font-black uppercase tracking-wider text-black flex items-center gap-2">
                        <Truck className="h-4 w-4 text-amber-600" />
                        Antrian Inbound
                    </CardTitle>
                </CardHeader>
                <CardContent className="pt-4">
                    <div className="text-3xl font-black text-black">4 Truk</div>
                    <p className="text-xs font-bold text-muted-foreground mt-1 mb-4">
                        Waktu tunggu rata-rata: <span className="text-red-600">45 menit</span> (Kritis).
                    </p>
                    <Button className="w-full h-8 text-xs font-black uppercase bg-black text-white border-2 border-black hover:bg-zinc-800 shadow-sm transition-all">
                        Buka Dock C (Emergency)
                    </Button>
                </CardContent>
            </Card>

            {/* 3. WORKER QUALITY: Picking Errors */}
            <Card className="bg-white border-2 border-black shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] relative overflow-hidden group">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 bg-zinc-50 border-b-2 border-black">
                    <CardTitle className="text-sm font-black uppercase tracking-wider text-black flex items-center gap-2">
                        <AlertOctagon className="h-4 w-4 text-purple-600" />
                        Akurasi Picking
                    </CardTitle>
                </CardHeader>
                <CardContent className="pt-4">
                    <div className="text-3xl font-black text-black">94.2%</div>
                    <p className="text-xs font-bold text-muted-foreground mt-1 mb-4">
                        <span className="text-red-600 font-black">12 Salah Pick</span> hari ini.
                    </p>
                    <div className="flex gap-2">
                        <Button variant="outline" className="flex-1 h-8 text-[10px] font-black uppercase border-2 border-black hover:bg-zinc-100">
                            Lihat Log
                        </Button>
                        <Button className="flex-1 h-8 text-[10px] font-black uppercase bg-purple-100 text-purple-700 border-2 border-purple-200 hover:border-purple-600 hover:bg-purple-200">
                            Mode Validasi
                        </Button>
                    </div>
                </CardContent>
            </Card>

            {/* 4. FORECASTING: Stockout Risk */}
            <Card className="bg-white border-2 border-black shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] relative overflow-hidden group">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 bg-blue-50 border-b-2 border-black">
                    <CardTitle className="text-sm font-black uppercase tracking-wider text-black flex items-center gap-2">
                        <TrendingDown className="h-4 w-4 text-blue-600" />
                        Stockout Alert
                    </CardTitle>
                </CardHeader>
                <CardContent className="pt-4">
                    <div className="text-3xl font-black text-black">8 SKU</div>
                    <p className="text-xs font-bold text-muted-foreground mt-1 mb-4">
                        Akan habis dalam <span className="text-red-600 font-black">48 Jam</span> berdasarkan tren.
                    </p>
                    <Button className="w-full h-8 text-xs font-black uppercase bg-blue-600 text-white border-2 border-black hover:translate-y-[1px] hover:shadow-none shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] transition-all">
                        <Zap className="mr-2 h-3 w-3 text-yellow-300" /> Auto-Reorder (Pre-Approve)
                    </Button>
                </CardContent>
            </Card>
        </div>
    );
}
