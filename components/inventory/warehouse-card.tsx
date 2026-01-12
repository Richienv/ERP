"use client";

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Users, Truck, PackageCheck, AlertTriangle, Activity, ArrowRight, Route, BarChart3, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";

interface WarehouseCardProps {
    name: string;
    manager: string;
    staffActive: number;
    pickingRate: number; // Items per hour
    targetRate: number;
    packingBacklog: number;
    zoneUsageA: number;
    zoneUsageB: number;
    dockStatus: 'BUSY' | 'IDLE' | 'CONGESTED';
}

export function WarehouseCard({
    name, manager, staffActive,
    pickingRate, targetRate, packingBacklog,
    zoneUsageA, zoneUsageB, dockStatus
}: WarehouseCardProps) {
    const efficiency = Math.round((pickingRate / targetRate) * 100);

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
                                {staffActive} STAFF AKTIF
                            </Badge>
                            <Badge className={`border-black font-black text-[10px] ${dockStatus === 'CONGESTED' ? 'bg-red-100 text-red-700' :
                                    dockStatus === 'BUSY' ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700'
                                }`}>
                                DOCK: {dockStatus}
                            </Badge>
                        </div>
                    </div>
                </div>
            </CardHeader>

            <CardContent className="pt-5 flex-1 space-y-6">

                {/* Real-time Efficiency Gauge */}
                <div className="space-y-2">
                    <div className="flex justify-between items-end">
                        <div className="text-xs font-black uppercase text-muted-foreground flex items-center gap-1">
                            <Activity className="h-3 w-3" /> Picking Rate
                        </div>
                        <div className="text-right">
                            <span className="text-2xl font-black text-black">{pickingRate}</span>
                            <span className="text-xs font-bold text-zinc-400">/{targetRate} uph</span>
                        </div>
                    </div>
                    <div className="h-3 w-full bg-zinc-100 border-2 border-black rounded-full overflow-hidden p-[1px]">
                        <div
                            className={`h-full rounded-full transition-all ${efficiency < 80 ? 'bg-amber-400' : 'bg-blue-600'}`}
                            style={{ width: `${Math.min(efficiency, 100)}%` }}
                        />
                    </div>
                </div>

                {/* Zone Health & Backlog */}
                <div className="grid grid-cols-2 gap-3">
                    <div className="p-3 bg-zinc-50 border-2 border-black rounded-lg">
                        <div className="text-[10px] font-black uppercase text-zinc-500 mb-1">Zone A (Cold)</div>
                        <div className={`text-xl font-black ${zoneUsageA > 90 ? 'text-red-600' : 'text-black'}`}>{zoneUsageA}%</div>
                        <div className="text-[10px] font-bold text-zinc-400">Capacity</div>
                    </div>
                    <div className="p-3 bg-zinc-50 border-2 border-black rounded-lg relative overflow-hidden">
                        {packingBacklog > 20 && <div className="absolute inset-0 bg-pattern-stripes opacity-10" />}
                        <div className="text-[10px] font-black uppercase text-zinc-500 mb-1">Packing Queue</div>
                        <div className={`text-xl font-black ${packingBacklog > 50 ? 'text-red-600' : 'text-black'}`}>{packingBacklog}</div>
                        <div className="text-[10px] font-bold text-zinc-400">Orders</div>
                    </div>
                </div>

                {/* Automation Action */}
                <div className="pt-2 mt-auto">
                    <Button className="w-full h-10 text-xs font-black uppercase bg-black text-white border-2 border-black hover:bg-zinc-800 shadow-[4px_4px_0px_0px_rgba(0,0,0,0.2)] hover:shadow-none hover:translate-y-[2px] transition-all flex items-center justify-center gap-2">
                        <Route className="h-3 w-3 text-cyan-400" /> Optimalkan Rute Picking
                    </Button>
                </div>
            </CardContent>
        </Card>
    );
}
