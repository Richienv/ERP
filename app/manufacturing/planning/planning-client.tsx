"use client";

import { useState } from "react";
import Link from "next/link";
import {
    Calendar,
    Factory,
    AlertTriangle,
    CheckCircle,
    Clock,
    RefreshCw,
    AlertCircle,
    TrendingUp,
    Package,
    Settings,
    Plus,
    Layers,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { CreateWorkOrderDialog } from "@/components/manufacturing/create-work-order-dialog";

interface WeekSchedule {
    weekNumber: number;
    weekStart: string;
    weekEnd: string;
    label: string;
    orders: number;
    plannedQty: number;
    completedQty: number;
    capacity: number;
    utilizationPct: number;
    status: 'normal' | 'high' | 'overload';
}

interface WorkOrder {
    id: string;
    number: string;
    product: {
        id: string;
        code: string;
        name: string;
        unit: string;
    };
    plannedQty: number;
    actualQty: number;
    progress: number;
    status: string;
    startDate?: string | null;
    dueDate?: string | null;
}

interface Machine {
    id: string;
    name: string;
    status: string;
    capacityPerHour: number;
    healthScore: number;
}

interface Summary {
    totalPlanned: number;
    inProgress: number;
    totalCapacity: number;
    avgUtilization: number;
    materialStatus: {
        ready: number;
        partial: number;
        notReady: number;
    };
    machineCount: number;
    activeMachines: number;
}

interface PlanningData {
    weeklySchedule: WeekSchedule[];
    workOrders: WorkOrder[];
    machines: Machine[];
}

interface Props {
    initialData: PlanningData;
    initialSummary: Summary;
}

function statusLabel(status: string) {
    const map: Record<string, { label: string; dot: string; bg: string; text: string }> = {
        PLANNED: { label: 'Planned', dot: 'bg-zinc-400', bg: 'bg-zinc-100 border-zinc-300', text: 'text-zinc-700' },
        IN_PROGRESS: { label: 'In Progress', dot: 'bg-amber-500', bg: 'bg-amber-50 border-amber-300', text: 'text-amber-700' },
        COMPLETED: { label: 'Selesai', dot: 'bg-emerald-500', bg: 'bg-emerald-50 border-emerald-300', text: 'text-emerald-700' },
        ON_HOLD: { label: 'On Hold', dot: 'bg-orange-500', bg: 'bg-orange-50 border-orange-300', text: 'text-orange-700' },
        CANCELLED: { label: 'Batal', dot: 'bg-zinc-400', bg: 'bg-zinc-100 border-zinc-300', text: 'text-zinc-500' },
    };
    return map[status] || { label: status, dot: 'bg-zinc-400', bg: 'bg-zinc-100 border-zinc-300', text: 'text-zinc-700' };
}

function machineStatusBadge(status: string) {
    const map: Record<string, { label: string; dot: string; bg: string; text: string }> = {
        RUNNING: { label: 'Running', dot: 'bg-emerald-500', bg: 'bg-emerald-50 border-emerald-300', text: 'text-emerald-700' },
        IDLE: { label: 'Idle', dot: 'bg-zinc-400', bg: 'bg-zinc-100 border-zinc-300', text: 'text-zinc-600' },
        MAINTENANCE: { label: 'Maint.', dot: 'bg-amber-500', bg: 'bg-amber-50 border-amber-300', text: 'text-amber-700' },
        BREAKDOWN: { label: 'Down', dot: 'bg-red-500', bg: 'bg-red-50 border-red-300', text: 'text-red-700' },
        OFFLINE: { label: 'Offline', dot: 'bg-zinc-400', bg: 'bg-zinc-100 border-zinc-300', text: 'text-zinc-500' },
    };
    return map[status] || { label: status, dot: 'bg-zinc-400', bg: 'bg-zinc-100 border-zinc-300', text: 'text-zinc-600' };
}

function getStatusDotColor(status: string) {
    switch (status) {
        case 'RUNNING': return 'bg-emerald-500';
        case 'IDLE': return 'bg-zinc-400';
        case 'MAINTENANCE': return 'bg-amber-500';
        case 'BREAKDOWN': return 'bg-red-500';
        default: return 'bg-zinc-300';
    }
}

export function PlanningClient({ initialData, initialSummary }: Props) {
    const [weeklySchedule, setWeeklySchedule] = useState<WeekSchedule[]>(initialData.weeklySchedule);
    const [workOrders, setWorkOrders] = useState<WorkOrder[]>(initialData.workOrders);
    const [machines, setMachines] = useState<Machine[]>(initialData.machines);
    const [summary, setSummary] = useState<Summary>(initialSummary);
    const [refreshing, setRefreshing] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [createOpen, setCreateOpen] = useState(false);

    const fetchPlanningData = async () => {
        setRefreshing(true);
        setError(null);
        try {
            const response = await fetch('/api/manufacturing/planning?weeks=4');
            const data = await response.json();

            if (data.success) {
                setWeeklySchedule(data.data.weeklySchedule);
                setWorkOrders(data.data.workOrders);
                setMachines(data.data.machines);
                setSummary(data.summary);
            } else {
                setError(data.error || 'Failed to fetch planning data');
            }
        } catch (err) {
            setError('Network error. Please try again.');
            console.error('Error fetching planning data:', err);
        } finally {
            setRefreshing(false);
        }
    };

    const formatDate = (dateStr: string) => {
        return new Date(dateStr).toLocaleDateString('id-ID', {
            day: '2-digit',
            month: 'short',
        });
    };

    return (
        <div className="flex-1 p-4 md:p-8 pt-6 max-w-7xl mx-auto space-y-4">

            {/* ── Page Header ─────────────────────────────────────────── */}
            <div className="border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] overflow-hidden bg-white dark:bg-zinc-900">
                <div className="px-6 py-4 flex flex-col md:flex-row md:items-center justify-between gap-3 border-l-[6px] border-l-blue-400">
                    <div className="flex items-center gap-3">
                        <Calendar className="h-5 w-5 text-blue-500" />
                        <div>
                            <h1 className="text-xl font-black uppercase tracking-tight text-zinc-900 dark:text-white">
                                Perencanaan (MPS)
                            </h1>
                            <p className="text-zinc-400 text-xs font-medium mt-0.5">
                                Master Production Schedule & kapasitas produksi
                            </p>
                        </div>
                    </div>
                    <div className="flex gap-2">
                        <Link href="/manufacturing">
                            <Button variant="outline" className="border-2 border-zinc-300 dark:border-zinc-600 font-bold uppercase text-[10px] tracking-wide h-10 px-4 hover:border-zinc-500 transition-colors">
                                <Factory className="mr-1.5 h-3.5 w-3.5" /> Dashboard
                            </Button>
                        </Link>
                        <Link href="/manufacturing/orders">
                            <Button variant="outline" className="border-2 border-zinc-300 dark:border-zinc-600 font-bold uppercase text-[10px] tracking-wide h-10 px-4 hover:border-zinc-500 transition-colors">
                                <Package className="mr-1.5 h-3.5 w-3.5" /> Work Orders
                            </Button>
                        </Link>
                        <Button
                            variant="outline"
                            onClick={fetchPlanningData}
                            disabled={refreshing}
                            className="border-2 border-zinc-300 dark:border-zinc-600 font-bold uppercase text-[10px] tracking-wide h-10 px-4 hover:border-zinc-500 transition-colors"
                        >
                            <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? 'animate-spin' : ''}`} />
                        </Button>
                        <Button
                            className="bg-blue-500 text-white hover:bg-blue-600 border-2 border-blue-600 font-black uppercase text-[10px] tracking-wide h-10 px-5 shadow-[3px_3px_0px_0px_rgba(0,0,0,0.2)] active:shadow-none active:translate-y-[1px] transition-all"
                            onClick={() => setCreateOpen(true)}
                        >
                            <Plus className="h-3.5 w-3.5 mr-1.5" /> Buat Order
                        </Button>
                    </div>
                </div>
            </div>

            {/* ── Error ───────────────────────────────────────────────── */}
            {error && (
                <div className="border-2 border-black shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] overflow-hidden bg-red-50 dark:bg-red-950/20 border-l-[5px] border-l-red-500">
                    <div className="px-5 py-3 flex items-center gap-3">
                        <AlertCircle className="h-4 w-4 text-red-600 shrink-0" />
                        <span className="text-xs font-bold text-red-700 flex-1">{error}</span>
                        <Button
                            variant="outline"
                            onClick={fetchPlanningData}
                            className="border-2 border-zinc-300 font-bold uppercase text-[10px] tracking-wide h-8 px-3"
                        >
                            Retry
                        </Button>
                    </div>
                </div>
            )}

            {/* ── KPI Cards ───────────────────────────────────────────── */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                <div className="border-2 border-black shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] bg-white dark:bg-zinc-900 overflow-hidden">
                    <div className="p-4">
                        <div className="flex items-center justify-between mb-2">
                            <span className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Planned Orders</span>
                            <Calendar className="h-4 w-4 text-blue-500" />
                        </div>
                        <div className="text-xl font-black text-zinc-900 dark:text-white">{summary.totalPlanned}</div>
                        <span className="text-[10px] text-zinc-400 font-medium mt-1 block">
                            Order terjadwal
                        </span>
                    </div>
                </div>
                <div className="border-2 border-black shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] bg-white dark:bg-zinc-900 overflow-hidden">
                    <div className="p-4">
                        <div className="flex items-center justify-between mb-2">
                            <span className="text-[10px] font-black uppercase tracking-widest text-zinc-400">In Progress</span>
                            <Factory className="h-4 w-4 text-amber-500" />
                        </div>
                        <div className="text-xl font-black text-amber-600">{summary.inProgress}</div>
                        <span className="text-[10px] text-zinc-400 font-medium mt-1 block">
                            Sedang diproduksi
                        </span>
                    </div>
                </div>
                <div className="border-2 border-black shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] bg-white dark:bg-zinc-900 overflow-hidden">
                    <div className="p-4">
                        <div className="flex items-center justify-between mb-2">
                            <span className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Utilisasi</span>
                            <TrendingUp className="h-4 w-4 text-emerald-500" />
                        </div>
                        <div className={`text-xl font-black ${
                            summary.avgUtilization > 100 ? 'text-red-600' :
                            summary.avgUtilization > 80 ? 'text-amber-600' : 'text-emerald-600'
                        }`}>
                            {summary.avgUtilization}%
                        </div>
                        <span className="text-[10px] text-zinc-400 font-medium mt-1 block">
                            Rata-rata kapasitas
                        </span>
                    </div>
                </div>
                <div className="border-2 border-black shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] bg-white dark:bg-zinc-900 overflow-hidden">
                    <div className="p-4">
                        <div className="flex items-center justify-between mb-2">
                            <span className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Mesin Aktif</span>
                            <Settings className="h-4 w-4 text-zinc-400" />
                        </div>
                        <div className="text-xl font-black text-zinc-900 dark:text-white">
                            {summary.activeMachines}<span className="text-zinc-400 text-sm">/{summary.machineCount}</span>
                        </div>
                        <span className="text-[10px] text-zinc-400 font-medium mt-1 block">
                            Mesin tersedia
                        </span>
                    </div>
                </div>
            </div>

            {/* ── Weekly Production Schedule ──────────────────────────── */}
            <div className="border-2 border-black shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] bg-white dark:bg-zinc-900 overflow-hidden">
                <div className="bg-blue-50 dark:bg-blue-950/20 px-5 py-2.5 border-b-2 border-black flex items-center gap-2 border-l-[5px] border-l-blue-400">
                    <Calendar className="h-4 w-4 text-blue-600" />
                    <h3 className="text-[11px] font-black uppercase tracking-widest text-zinc-700 dark:text-zinc-200">
                        Jadwal Produksi Mingguan
                    </h3>
                </div>
                <div className="p-4">
                    {weeklySchedule.length === 0 ? (
                        <div className="text-center py-10 text-zinc-400 text-xs font-bold uppercase tracking-widest">
                            Tidak ada produksi terjadwal 4 minggu ke depan
                        </div>
                    ) : (
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                            {weeklySchedule.map((week) => (
                                <div
                                    key={week.weekNumber}
                                    className={`border-2 overflow-hidden ${
                                        week.status === 'overload'
                                            ? 'border-red-400 bg-red-50 dark:bg-red-950/20'
                                            : week.status === 'high'
                                                ? 'border-amber-400 bg-amber-50 dark:bg-amber-950/20'
                                                : 'border-zinc-200 bg-white dark:bg-zinc-800/50'
                                    }`}
                                >
                                    <div className="p-3">
                                        <div className="flex justify-between items-start mb-3">
                                            <div>
                                                <p className="text-sm font-black text-zinc-900 dark:text-white">{week.label}</p>
                                                <p className="text-[10px] text-zinc-400 font-medium">
                                                    {formatDate(week.weekStart)} - {formatDate(week.weekEnd)}
                                                </p>
                                            </div>
                                            {week.status === 'overload' && (
                                                <AlertTriangle className="h-4 w-4 text-red-500 shrink-0" />
                                            )}
                                        </div>

                                        <div className="space-y-1.5">
                                            <div className="flex justify-between">
                                                <span className="text-[10px] font-bold text-zinc-400 uppercase">Orders</span>
                                                <span className="text-xs font-black text-zinc-900 dark:text-white">{week.orders}</span>
                                            </div>
                                            <div className="flex justify-between">
                                                <span className="text-[10px] font-bold text-zinc-400 uppercase">Planned</span>
                                                <span className="text-xs font-black text-zinc-900 dark:text-white">{week.plannedQty.toLocaleString()}</span>
                                            </div>
                                            <div className="pt-2 border-t border-zinc-100 dark:border-zinc-700">
                                                <div className="flex justify-between mb-1">
                                                    <span className="text-[10px] font-bold text-zinc-400 uppercase">Kapasitas</span>
                                                    <span className={`text-[10px] font-black ${
                                                        week.utilizationPct > 100 ? 'text-red-600' :
                                                        week.utilizationPct > 80 ? 'text-amber-600' : 'text-emerald-600'
                                                    }`}>
                                                        {week.utilizationPct}%
                                                    </span>
                                                </div>
                                                <div className="w-full h-1.5 bg-zinc-200 dark:bg-zinc-700">
                                                    <div
                                                        className={`h-full transition-all ${
                                                            week.utilizationPct > 100 ? 'bg-red-500' :
                                                            week.utilizationPct > 80 ? 'bg-amber-500' : 'bg-emerald-500'
                                                        }`}
                                                        style={{ width: `${Math.min(week.utilizationPct, 100)}%` }}
                                                    />
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            {/* ── Two Column: Orders + Machines ──────────────────────── */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

                {/* Upcoming Orders */}
                <div className="border-2 border-black shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] bg-white dark:bg-zinc-900 overflow-hidden">
                    <div className="bg-blue-50 dark:bg-blue-950/20 px-5 py-2.5 border-b-2 border-black flex items-center justify-between border-l-[5px] border-l-blue-400">
                        <div className="flex items-center gap-2">
                            <Package className="h-4 w-4 text-blue-600" />
                            <h3 className="text-[11px] font-black uppercase tracking-widest text-zinc-700 dark:text-zinc-200">
                                Order Mendatang
                            </h3>
                        </div>
                        <Link href="/manufacturing/orders">
                            <Button variant="outline" className="border-2 border-zinc-300 font-bold uppercase text-[10px] tracking-wide h-8 px-3 hover:border-zinc-500 transition-colors">
                                Lihat Semua
                            </Button>
                        </Link>
                    </div>
                    {workOrders.length === 0 ? (
                        <div className="text-center py-10 text-zinc-400 text-xs font-bold uppercase tracking-widest">
                            Tidak ada order mendatang
                        </div>
                    ) : (
                        <div className="divide-y divide-zinc-100 dark:divide-zinc-800">
                            {workOrders.slice(0, 5).map((order, idx) => {
                                const cfg = statusLabel(order.status);
                                return (
                                    <Link
                                        key={order.id}
                                        href="/manufacturing/orders"
                                        className={`block px-4 py-3 hover:bg-zinc-50/80 dark:hover:bg-zinc-800/30 transition-colors ${idx % 2 === 0 ? '' : 'bg-zinc-50/50 dark:bg-zinc-800/10'}`}
                                    >
                                        <div className="flex items-center justify-between gap-2 mb-1.5">
                                            <div className="flex items-center gap-2 min-w-0">
                                                <span className="font-mono text-xs font-bold text-zinc-900 dark:text-zinc-100">{order.number}</span>
                                                <span className={`inline-flex items-center gap-1 text-[9px] font-black uppercase tracking-wide px-2 py-0.5 border whitespace-nowrap ${cfg.bg} ${cfg.text}`}>
                                                    <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
                                                    {cfg.label}
                                                </span>
                                            </div>
                                            {order.dueDate && (
                                                <span className="text-[10px] text-zinc-400 flex items-center gap-1 shrink-0">
                                                    <Clock className="h-3 w-3" />
                                                    {formatDate(order.dueDate)}
                                                </span>
                                            )}
                                        </div>
                                        <span className="block text-[11px] text-zinc-400 truncate mb-2">{order.product.name}</span>
                                        <div className="flex items-center gap-2">
                                            <div className="flex-1 h-1.5 bg-zinc-200 dark:bg-zinc-700">
                                                <div
                                                    className={`h-full ${order.progress >= 100 ? 'bg-emerald-500' : 'bg-blue-500'}`}
                                                    style={{ width: `${Math.min(order.progress, 100)}%` }}
                                                />
                                            </div>
                                            <span className="text-[10px] font-black w-16 text-right text-zinc-600 dark:text-zinc-300">
                                                {order.actualQty}/{order.plannedQty}
                                            </span>
                                        </div>
                                    </Link>
                                );
                            })}
                        </div>
                    )}
                </div>

                {/* Machine Status */}
                <div className="border-2 border-black shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] bg-white dark:bg-zinc-900 overflow-hidden">
                    <div className="bg-blue-50 dark:bg-blue-950/20 px-5 py-2.5 border-b-2 border-black flex items-center justify-between border-l-[5px] border-l-blue-400">
                        <div className="flex items-center gap-2">
                            <Settings className="h-4 w-4 text-blue-600" />
                            <h3 className="text-[11px] font-black uppercase tracking-widest text-zinc-700 dark:text-zinc-200">
                                Status Mesin
                            </h3>
                        </div>
                        <Link href="/manufacturing/work-centers">
                            <Button variant="outline" className="border-2 border-zinc-300 font-bold uppercase text-[10px] tracking-wide h-8 px-3 hover:border-zinc-500 transition-colors">
                                Lihat Semua
                            </Button>
                        </Link>
                    </div>
                    {machines.length === 0 ? (
                        <div className="text-center py-10 text-zinc-400 text-xs font-bold uppercase tracking-widest">
                            Tidak ada mesin terkonfigurasi
                        </div>
                    ) : (
                        <div className="divide-y divide-zinc-100 dark:divide-zinc-800">
                            {machines.map((machine, idx) => {
                                const cfg = machineStatusBadge(machine.status);
                                return (
                                    <Link
                                        key={machine.id}
                                        href="/manufacturing/work-centers"
                                        className={`block px-4 py-2.5 flex items-center justify-between gap-2 hover:bg-zinc-50/80 dark:hover:bg-zinc-800/30 transition-colors ${idx % 2 === 0 ? '' : 'bg-zinc-50/50 dark:bg-zinc-800/10'}`}
                                    >
                                        <div className="flex items-center gap-3 min-w-0">
                                            <div className={`w-2.5 h-2.5 rounded-full shrink-0 ${getStatusDotColor(machine.status)} ${machine.status === 'RUNNING' ? 'animate-pulse' : ''}`} />
                                            <div className="min-w-0">
                                                <span className="text-xs font-bold text-zinc-900 dark:text-zinc-100 block">{machine.name}</span>
                                                <span className="text-[10px] text-zinc-400">{machine.capacityPerHour} unit/jam</span>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-2 shrink-0">
                                            <span className="text-[10px] font-bold text-zinc-500">
                                                {machine.healthScore}%
                                            </span>
                                            <span className={`inline-flex items-center gap-1 text-[9px] font-black uppercase tracking-wide px-2 py-0.5 border whitespace-nowrap ${cfg.bg} ${cfg.text}`}>
                                                <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
                                                {cfg.label}
                                            </span>
                                        </div>
                                    </Link>
                                );
                            })}
                        </div>
                    )}
                </div>
            </div>

            {/* ── Material Readiness ──────────────────────────────────── */}
            <div className="border-2 border-black shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] bg-white dark:bg-zinc-900 overflow-hidden">
                <div className="bg-blue-50 dark:bg-blue-950/20 px-5 py-2.5 border-b-2 border-black flex items-center gap-2 border-l-[5px] border-l-blue-400">
                    <Layers className="h-4 w-4 text-blue-600" />
                    <h3 className="text-[11px] font-black uppercase tracking-widest text-zinc-700 dark:text-zinc-200">
                        Kesiapan Material
                    </h3>
                </div>
                <div className="p-4">
                    <div className="grid grid-cols-3 gap-3">
                        <div className="text-center p-4 border-2 border-emerald-300 bg-emerald-50 dark:bg-emerald-950/20">
                            <CheckCircle className="h-6 w-6 mx-auto text-emerald-500 mb-2" />
                            <p className="text-3xl font-black text-emerald-600">{summary.materialStatus.ready}</p>
                            <p className="text-[10px] font-black text-zinc-500 uppercase tracking-wide mt-1">Siap</p>
                        </div>
                        <div className="text-center p-4 border-2 border-amber-300 bg-amber-50 dark:bg-amber-950/20">
                            <AlertTriangle className="h-6 w-6 mx-auto text-amber-500 mb-2" />
                            <p className="text-3xl font-black text-amber-600">{summary.materialStatus.partial}</p>
                            <p className="text-[10px] font-black text-zinc-500 uppercase tracking-wide mt-1">Sebagian</p>
                        </div>
                        <div className={`text-center p-4 border-2 ${
                            summary.materialStatus.notReady > 0
                                ? 'border-red-400 bg-red-50 dark:bg-red-950/20'
                                : 'border-red-300 bg-red-50 dark:bg-red-950/10'
                        }`}>
                            <AlertCircle className={`h-6 w-6 mx-auto mb-2 ${summary.materialStatus.notReady > 0 ? 'text-red-500' : 'text-red-300'}`} />
                            <p className={`text-3xl font-black ${summary.materialStatus.notReady > 0 ? 'text-red-600' : 'text-red-400'}`}>
                                {summary.materialStatus.notReady}
                            </p>
                            <p className="text-[10px] font-black text-zinc-500 uppercase tracking-wide mt-1">Belum Siap</p>
                        </div>
                    </div>
                </div>
            </div>

            <CreateWorkOrderDialog
                open={createOpen}
                onOpenChange={setCreateOpen}
                onCreated={fetchPlanningData}
                orderType="MO"
            />
        </div>
    );
}
