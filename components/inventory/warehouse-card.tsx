"use client";

import { Badge } from "@/components/ui/badge";
import { Activity, ArrowRight } from "lucide-react";
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
    capacityPercent?: number;
}

export function WarehouseCard({
    id,
    name, manager, staffActive,
    inventoryValue, activePOs, activeTasks, depreciationValue,
    dockStatus, capacityPercent
}: WarehouseCardProps) {
    const formatCurrency = (val: number) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', notation: 'compact', maximumFractionDigits: 1 }).format(val);

    const statusColors = {
        CONGESTED: { dot: "bg-red-500", bg: "bg-red-50 text-red-700" },
        BUSY: { dot: "bg-amber-500", bg: "bg-amber-50 text-amber-700" },
        IDLE: { dot: "bg-emerald-500", bg: "bg-emerald-50 text-emerald-700" },
    }
    const sc = statusColors[dockStatus]

    return (
        <div className="bg-white dark:bg-zinc-900 border-2 border-black shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-[1px_1px_0px_0px_rgba(0,0,0,1)] transition-all overflow-hidden">
            {/* Header */}
            <div className="px-3 py-2.5 border-b-2 border-black bg-zinc-50 dark:bg-zinc-800 flex items-center justify-between">
                <div className="min-w-0 flex-1">
                    <div className="text-xs font-black uppercase tracking-tight text-zinc-900 dark:text-white truncate leading-tight">
                        {name}
                    </div>
                    <div className="text-[9px] font-bold text-zinc-400 truncate mt-0.5">{manager}</div>
                </div>
                <Badge className={`text-[8px] font-black uppercase px-1.5 py-0.5 border-0 shrink-0 ml-2 ${sc.bg}`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${sc.dot} mr-1 inline-block`} />
                    {dockStatus}
                </Badge>
            </div>

            {/* Body */}
            <div className="px-3 py-2.5 space-y-2">
                {/* Value */}
                <div>
                    <div className="text-[9px] font-black uppercase text-zinc-400 flex items-center gap-1">
                        <Activity className="h-2.5 w-2.5" /> Value
                    </div>
                    <div className="text-lg font-black text-zinc-900 dark:text-white tracking-tighter leading-tight">
                        {formatCurrency(inventoryValue)}
                    </div>
                </div>

                {/* Mini stats row */}
                <div className="grid grid-cols-3 gap-1.5">
                    <div className="bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 p-1.5 text-center">
                        <div className="text-sm font-black text-zinc-900 dark:text-white">{staffActive}</div>
                        <div className="text-[8px] font-bold uppercase text-zinc-400">Staff</div>
                    </div>
                    <div className="bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 p-1.5 text-center">
                        <div className="text-sm font-black text-blue-600">{activePOs}</div>
                        <div className="text-[8px] font-bold uppercase text-zinc-400">PO</div>
                    </div>
                    <div className="bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 p-1.5 text-center">
                        <div className="text-sm font-black text-emerald-600">{activeTasks}</div>
                        <div className="text-[8px] font-bold uppercase text-zinc-400">Task</div>
                    </div>
                </div>

                {/* Capacity */}
                {capacityPercent !== undefined && (
                    <div>
                        <div className="flex items-center justify-between mb-1">
                            <span className="text-[8px] font-bold uppercase text-zinc-400">Kapasitas</span>
                            <span className="text-[9px] font-black text-zinc-700">{capacityPercent}%</span>
                        </div>
                        <div className="w-full bg-zinc-200 h-1.5">
                            <div
                                className={`h-1.5 transition-all ${capacityPercent >= 90 ? 'bg-red-500' : capacityPercent >= 60 ? 'bg-amber-500' : 'bg-emerald-500'}`}
                                style={{ width: `${Math.min(capacityPercent, 100)}%` }}
                            />
                        </div>
                    </div>
                )}

                {/* Action */}
                <Link href={`/inventory/warehouses/${id}`} className="block">
                    <div className="w-full h-7 text-[9px] font-black uppercase bg-white dark:bg-zinc-900 text-zinc-600 border-2 border-black hover:bg-zinc-100 dark:hover:bg-zinc-800 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:shadow-none hover:translate-y-[1px] transition-all flex items-center justify-center gap-1">
                        Detail <ArrowRight className="h-3 w-3" />
                    </div>
                </Link>
            </div>
        </div>
    );
}
