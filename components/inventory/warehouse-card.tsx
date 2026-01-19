"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Activity, Route, ArrowRight } from "lucide-react";
import Link from "next/link";

interface WarehouseCardProps {
    id: string;
    name: string;
    manager: string;
    staffActive: number;
    inventoryValue: number;
    activePOs: number;
    activeTasks: number;
    depreciationValue: number;
    dockStatus: 'BUSY' | 'IDLE' | 'CONGESTED';
}

export function WarehouseCard({
    id,
    name, manager, staffActive,
    inventoryValue, activePOs, activeTasks, depreciationValue,
    dockStatus
}: WarehouseCardProps) {
    const formatCurrency = (val: number) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(val);

    return (
        <Card className="bg-white border-2 border-black shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] transition-all flex flex-col group h-full">
            {/* Header with Status Indicator */}
            <CardHeader className="border-b-2 border-black bg-zinc-50 pb-4 relative overflow-hidden">
                <div className={`absolute top-0 right-0 w-24 h-24 rounded-bl-full -mr-12 -mt-12 transition-colors ${dockStatus === 'CONGESTED' ? 'bg-red-500' : dockStatus === 'BUSY' ? 'bg-amber-400' : 'bg-emerald-400'
                    }`} />
                <div className="flex justify-between items-start relative z-10">
                    <div>
                        <CardTitle className="text-lg font-black uppercase leading-tight text-black pr-8">{name}</CardTitle>
                        <div className="flex items-center gap-2 mt-2">
                            <Badge variant="outline" className="border-black font-bold text-[10px] bg-white text-zinc-600">
                                {manager}
                            </Badge>
                            <Badge className={`border-black font-black text-[10px] ${dockStatus === 'CONGESTED' ? 'bg-red-100 text-red-700' :
                                dockStatus === 'BUSY' ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700'
                                }`}>
                                {dockStatus}
                            </Badge>
                        </div>
                    </div>
                </div>
            </CardHeader>

            <CardContent className="pt-5 flex-1 space-y-6">

                {/* Primary Metric: Inventory Value */}
                <div className="space-y-1">
                    <div className="text-xs font-black uppercase text-muted-foreground flex items-center gap-1">
                        <Activity className="h-3 w-3" /> Total Inventory Value
                    </div>
                    <div className="text-2xl font-black text-black">
                        {formatCurrency(inventoryValue)}
                    </div>
                    <div className="text-[10px] font-bold text-red-600 flex items-center gap-1">
                        Potential Depreciation: {formatCurrency(depreciationValue)}
                    </div>
                </div>

                {/* Operational Counts Grid */}
                <div className="grid grid-cols-3 gap-2">
                    <div className="p-2 bg-zinc-50 border-2 border-black rounded-lg text-center">
                        <div className="text-xl font-black text-black">{staffActive}</div>
                        <div className="text-[9px] font-black uppercase text-zinc-500">Staff</div>
                    </div>
                    <div className="p-2 bg-zinc-50 border-2 border-black rounded-lg text-center">
                        <div className="text-xl font-black text-blue-600">{activePOs}</div>
                        <div className="text-[9px] font-black uppercase text-zinc-500">Active POs</div>
                    </div>
                    <div className="p-2 bg-zinc-50 border-2 border-black rounded-lg text-center">
                        <div className="text-xl font-black text-emerald-600">{activeTasks}</div>
                        <div className="text-[9px] font-black uppercase text-zinc-500">Tasks</div>
                    </div>
                </div>

                {/* Automation Action */}
                <div className="pt-2 mt-auto">
                    <Link href={`/inventory/warehouses/${id}`} className="w-full">
                        <Button className="w-full h-10 text-xs font-black uppercase bg-white text-black border-2 border-black hover:bg-zinc-100 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:shadow-none hover:translate-y-[2px] transition-all flex items-center justify-center gap-2">
                            <ArrowRight className="h-4 w-4" /> Lihat Detail Gudang
                        </Button>
                    </Link>
                </div>
            </CardContent>
        </Card>
    );
}
