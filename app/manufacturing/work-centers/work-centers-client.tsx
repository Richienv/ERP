"use client";

import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query-keys";
import {
    Plus,
    Search,
    Settings,
    Activity,
    AlertCircle,
    Clock,
    BarChart3,
    RefreshCw,
    Trash2,
    Factory,
    Monitor
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
    Card,
} from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { MachineFormDialog } from "@/components/manufacturing/machine-form-dialog";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface Machine {
    id: string;
    code: string;
    name: string;
    brand?: string | null;
    model?: string | null;
    status: string;
    healthScore: number;
    lastMaintenance?: string | null;
    nextMaintenance?: string | null;
    capacityPerHour?: number | null;
    standardHoursPerDay?: number;
    overheadTimePerHour?: number;
    overheadMaterialCostPerHour?: number;
    serialNumber?: string | null;
    groupId?: string | null;
    isActive: boolean;
}

interface Summary {
    total: number;
    active: number;
    down: number;
    avgEfficiency: number;
}

interface Props {
    initialMachines: Machine[];
    initialSummary: Summary;
}

export function WorkCentersClient({ initialMachines, initialSummary }: Props) {
    const queryClient = useQueryClient();
    const [machines, setMachines] = useState<Machine[]>(initialMachines);
    const [summary, setSummary] = useState<Summary>(initialSummary);
    const [refreshing, setRefreshing] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [searchQuery, setSearchQuery] = useState("");
    const [statusFilter, setStatusFilter] = useState<string | null>(null);
    const [machineDialogOpen, setMachineDialogOpen] = useState(false);
    const [selectedMachine, setSelectedMachine] = useState<Machine | null>(null);
    const [deleting, setDeleting] = useState<string | null>(null);

    const fetchMachines = async () => {
        setRefreshing(true);
        setError(null);
        try {
            const params = new URLSearchParams();
            if (searchQuery) params.append('search', searchQuery);
            if (statusFilter) params.append('status', statusFilter);

            const response = await fetch(`/api/manufacturing/machines?${params.toString()}`);
            const data = await response.json();

            if (data.success) {
                setMachines(data.data);
                setSummary(data.summary);
            } else {
                setError(data.error || 'Failed to fetch machines');
            }
        } catch (err) {
            setError('Network error. Please try again.');
            console.error('Error fetching machines:', err);
        } finally {
            setRefreshing(false);
        }
    };

    const handleSearchChange = (value: string) => {
        setSearchQuery(value);
        setTimeout(() => fetchMachines(), 300);
    };

    const handleStatusFilter = (filter: string | null) => {
        setStatusFilter(filter);
        setTimeout(() => fetchMachines(), 0);
    };

    const formatDate = (dateStr: string | null | undefined) => {
        if (!dateStr) return '-';
        const date = new Date(dateStr);
        const now = new Date();
        if (date < now) return 'OVERDUE';
        return date.toLocaleDateString('id-ID', { day: '2-digit', month: '2-digit' });
    };

    const getStatusType = (machine: Machine): string => {
        if (machine.status === 'RUNNING') return 'Running';
        if (machine.status === 'BREAKDOWN' || machine.status === 'MAINTENANCE') return 'Down';
        return 'Idle';
    };

    const handleCreateMachine = () => {
        setSelectedMachine(null);
        setMachineDialogOpen(true);
    };

    const handleEditMachine = (machine: Machine) => {
        setSelectedMachine(machine);
        setMachineDialogOpen(true);
    };

    const handleDeleteMachine = async (e: React.MouseEvent, machine: Machine) => {
        e.stopPropagation();
        const confirmed = window.confirm(`Hapus mesin "${machine.name}" (${machine.code})?\n\nData mesin akan dihapus permanen.`);
        if (!confirmed) return;

        setDeleting(machine.id);
        try {
            const response = await fetch(`/api/manufacturing/machines/${machine.id}`, { method: 'DELETE' });
            const payload = await response.json();
            if (!payload.success) {
                toast.error(payload.error || 'Gagal menghapus mesin');
                return;
            }
            toast.success('Mesin berhasil dihapus');
            queryClient.invalidateQueries({ queryKey: queryKeys.machines.all });
            queryClient.invalidateQueries({ queryKey: queryKeys.mfgDashboard.all });
            await fetchMachines();
        } catch (err) {
            console.error(err);
            toast.error('Network error saat menghapus mesin');
        } finally {
            setDeleting(null);
        }
    };

    // KPI Data for the strip
    const kpis = [
        {
            label: "Total Work Centers",
            value: String(summary.total),
            detail: "Total mesin terdaftar",
            icon: Factory,
            color: "text-zinc-900 dark:text-white"
        },
        {
            label: "Active Running",
            value: String(summary.active),
            detail: "Mesin beroperasi",
            icon: Activity,
            color: "text-emerald-600",
            bg: "bg-emerald-50 dark:bg-emerald-900/20"
        },
        {
            label: "Down / Maint",
            value: String(summary.down),
            detail: "Perlu perhatian",
            icon: AlertCircle,
            color: summary.down > 0 ? "text-red-600" : "text-zinc-400",
            bg: summary.down > 0 ? "bg-red-50 dark:bg-red-900/20" : ""
        },
        {
            label: "Avg Efficiency",
            value: `${summary.avgEfficiency}%`,
            detail: "Rata-rata OEE",
            icon: BarChart3,
            color: "text-blue-600",
            bg: "bg-blue-50 dark:bg-blue-900/20"
        }
    ];

    return (
        <div className="w-full bg-zinc-50 dark:bg-black font-sans min-h-[calc(100svh-theme(spacing.16))]">
            <div className="mf-page">

                {/* Header */}
                <div className="flex-none flex items-center justify-between">
                    <div>
                        <h1 className="text-lg font-black uppercase tracking-widest text-zinc-900 dark:text-white flex items-center gap-2">
                            <Monitor className="h-6 w-6" />
                            Pusat Kerja & Routing
                        </h1>
                        <p className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider mt-1">
                            Monitor status mesin, kapasitas produksi, dan maintenance
                        </p>
                    </div>
                    <div className="flex items-center gap-2">
                        <Button
                            variant="outline"
                            size="icon"
                            onClick={fetchMachines}
                            disabled={refreshing}
                            className="h-10 w-10 border-2 border-black shadow-[3px_3px_0px_0px_rgba(0,0,0,0.3)] hover:shadow-[1px_1px_0px_0px_rgba(0,0,0,0.3)] hover:translate-x-[1px] hover:translate-y-[1px] hover:bg-zinc-100 transition-all rounded-none"
                        >
                            <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
                        </Button>
                        <Button
                            className="h-10 bg-black text-white hover:bg-zinc-800 border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,0.3)] hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-[2px_2px_0px_0px_rgba(0,0,0,0.3)] active:scale-[0.98] transition-all uppercase font-black tracking-widest text-xs rounded-none px-6"
                            onClick={handleCreateMachine}
                        >
                            <Plus className="mr-2 h-4 w-4" /> Tambah Mesin
                        </Button>
                    </div>
                </div>

                {/* KPI Strip */}
                <div className="flex-none bg-white dark:bg-zinc-900 border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] overflow-hidden">
                    <div className="grid grid-cols-2 md:grid-cols-4 divide-x-2 divide-black divide-y-2 md:divide-y-0">
                        {kpis.map((kpi, i) => (
                            <div
                                key={kpi.label}
                                className={cn(
                                    "group relative p-4 transition-all hover:bg-zinc-50 dark:hover:bg-zinc-800/50",
                                    kpi.bg
                                )}
                            >
                                <div className="flex items-center justify-between mb-3">
                                    <div className="flex items-center gap-2">
                                        <span className={cn("text-zinc-400 group-hover:text-black dark:group-hover:text-zinc-200 transition-colors", kpi.color)}>
                                            <kpi.icon className="h-5 w-5" />
                                        </span>
                                        <span className="text-[10px] font-black uppercase tracking-widest text-zinc-500 group-hover:text-black dark:group-hover:text-zinc-300 transition-colors">
                                            {kpi.label}
                                        </span>
                                    </div>
                                </div>
                                <p className={cn("text-2xl font-black tracking-tighter", kpi.color)}>
                                    {kpi.value}
                                </p>
                                <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 mt-1">
                                    {kpi.detail}
                                </p>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Filter & Search Bar */}
                <div className="flex flex-col md:flex-row gap-4 items-center justify-between bg-zinc-100/50 p-2 md:p-0">
                    <div className="relative w-full md:w-96">
                        <div className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400">
                            <Search className="h-4 w-4" />
                        </div>
                        <Input
                            placeholder="Cari mesin, kode, atau brand..."
                            className="pl-10 h-10 border-2 border-black shadow-[3px_3px_0px_0px_rgba(0,0,0,0.3)] focus-visible:ring-0 focus-visible:translate-x-[1px] focus-visible:translate-y-[1px] focus-visible:shadow-[1px_1px_0px_0px_rgba(0,0,0,0.3)] transition-all bg-white dark:bg-zinc-900 rounded-none font-medium"
                            value={searchQuery}
                            onChange={(e) => handleSearchChange(e.target.value)}
                        />
                    </div>
                    <div className="flex flex-wrap gap-2 w-full md:w-auto justify-end">
                        {['All', 'RUNNING', 'IDLE', 'MAINTENANCE', 'BREAKDOWN'].map((filter) => (
                            <Button
                                key={filter}
                                variant="outline"
                                size="sm"
                                className={cn(
                                    "border-2 border-black rounded-none text-[10px] font-black uppercase tracking-widest h-8 transition-all hover:bg-black hover:text-white",
                                    ((filter === 'All' && !statusFilter) || statusFilter === filter)
                                        ? 'bg-black text-white shadow-[2px_2px_0px_0px_rgba(100,100,100,1)]'
                                        : 'bg-white text-zinc-600 shadow-[2px_2px_0px_0px_rgba(0,0,0,0.3)] hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-[1px_1px_0px_0px_rgba(0,0,0,0.3)]'
                                )}
                                onClick={() => handleStatusFilter(filter === 'All' ? null : filter)}
                            >
                                {filter === 'All' ? 'Semua' : filter}
                            </Button>
                        ))}
                    </div>
                </div>

                {/* Error State */}
                {error && (
                    <div className="border-2 border-red-500 bg-red-50 p-4 shadow-[4px_4px_0px_0px_rgba(239,68,68,1)] flex items-center justify-between">
                        <div className="flex items-center gap-3 text-red-700 font-bold uppercase tracking-wide text-xs">
                            <AlertCircle className="h-5 w-5" />
                            <span>{error}</span>
                        </div>
                        <Button variant="outline" size="sm" onClick={fetchMachines} className="bg-white border-2 border-red-500 text-red-700 hover:bg-red-100 rounded-none font-bold text-xs uppercase">
                            Retry
                        </Button>
                    </div>
                )}

                {/* Empty State */}
                {machines.length === 0 && !error && (
                    <div className="border-2 border-dashed border-zinc-300 min-h-[300px] flex flex-col items-center justify-center text-center bg-zinc-50/50 p-8">
                        <div className="h-16 w-16 bg-zinc-100 border-2 border-zinc-200 flex items-center justify-center mb-4 rounded-full">
                            <Factory className="h-8 w-8 text-zinc-300" />
                        </div>
                        <h3 className="text-lg font-black uppercase tracking-widest text-zinc-400">Tidak ada mesin ditemukan</h3>
                        <p className="text-xs font-bold text-zinc-400 mt-2 max-w-xs">
                            {searchQuery || statusFilter
                                ? 'Coba sesuaikan kata kunci pencarian atau filter status anda.'
                                : 'Mulai dengan menambahkan mesin baru ke dalam sistem.'}
                        </p>
                        <Button className="mt-6 bg-black text-white rounded-none font-black uppercase tracking-wider text-xs px-6 py-5 border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:shadow-none hover:translate-x-[1px] hover:translate-y-[1px] transition-all" onClick={handleCreateMachine}>
                            <Plus className="mr-2 h-4 w-4" /> Add Machine
                        </Button>
                    </div>
                )}

                {/* Machine Grid */}
                {machines.length > 0 && (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 pb-20">
                        {machines.map((mc) => {
                            const statusType = getStatusType(mc);
                            const nextMaint = formatDate(mc.nextMaintenance);

                            return (
                                <Card
                                    key={mc.id}
                                    className="group relative border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:translate-x-[2px] hover:translate-y-[2px] transition-all rounded-none bg-white dark:bg-zinc-900 overflow-hidden flex flex-col"
                                >
                                    {/* Card Header Strip */}
                                    <div className="flex justify-between items-center p-3 border-b-2 border-black bg-zinc-50 dark:bg-zinc-800">
                                        <div className="flex items-center gap-2">
                                            <div className="h-6 w-6 bg-zinc-900 text-white flex items-center justify-center font-black text-[10px] border border-black">
                                                {mc.code.substring(0, 2)}
                                            </div>
                                            <span className="text-[10px] font-black uppercase tracking-widest text-zinc-500">
                                                {mc.code}
                                            </span>
                                        </div>
                                        <StatusBadge status={statusType} rawStatus={mc.status} />
                                    </div>

                                    {/* Main Content */}
                                    <div className="p-4 flex-1 flex flex-col gap-4">
                                        <div>
                                            <h3 className="text-sm font-black uppercase tracking-wide leading-tight line-clamp-2 min-h-[2.5em]">
                                                {mc.name}
                                            </h3>
                                            <div className="flex items-center gap-2 mt-1 text-[10px] font-bold text-zinc-400 uppercase tracking-wider">
                                                {mc.brand && <span>{mc.brand}</span>}
                                                {mc.brand && mc.model && <span>•</span>}
                                                {mc.model && <span>{mc.model}</span>}
                                            </div>
                                        </div>

                                        <div className="grid grid-cols-2 gap-2 mt-auto">
                                            <div className="border border-zinc-200 bg-zinc-50/50 p-2">
                                                <p className="text-[9px] font-black uppercase text-zinc-400 tracking-widest mb-0.5">Capacity</p>
                                                <div className="font-bold text-sm text-zinc-900">
                                                    {mc.capacityPerHour || 0} <span className="text-[9px] text-zinc-400">/hr</span>
                                                </div>
                                            </div>
                                            <div className="border border-zinc-200 bg-zinc-50/50 p-2">
                                                <p className="text-[9px] font-black uppercase text-zinc-400 tracking-widest mb-0.5">Health</p>
                                                <div className="flex items-center gap-2">
                                                    <span className={cn(
                                                        "font-bold text-sm",
                                                        mc.healthScore > 80 ? "text-emerald-600" : mc.healthScore > 50 ? "text-amber-600" : "text-red-600"
                                                    )}>
                                                        {mc.healthScore}%
                                                    </span>
                                                    <Progress
                                                        value={mc.healthScore}
                                                        className="h-1.5 flex-1 border border-black/10 bg-zinc-100 rounded-none"
                                                        indicatorClassName={
                                                            mc.healthScore > 80 ? 'bg-emerald-500' :
                                                                mc.healthScore > 50 ? 'bg-amber-500' : 'bg-red-500'
                                                        }
                                                    />
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Footer / Actions */}
                                    <div className="border-t-2 border-black p-2 flex items-center justify-between bg-zinc-50 dark:bg-zinc-800">
                                        <div className="flex items-center gap-1.5 px-2 text-[10px] font-black uppercase text-zinc-500 tracking-wider">
                                            <Clock className="h-3 w-3" />
                                            <span>Maint: <span className={nextMaint === 'OVERDUE' ? 'text-red-600 underline' : ''}>{nextMaint}</span></span>
                                        </div>

                                        <div className="flex gap-1">
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                className="h-7 w-7 rounded-none hover:bg-black hover:text-white border border-transparent hover:border-black transition-all"
                                                onClick={() => handleEditMachine(mc)}
                                                title="Edit Machine"
                                            >
                                                <Settings className="h-3.5 w-3.5" />
                                            </Button>
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                className="h-7 w-7 rounded-none text-red-500 hover:bg-red-50 hover:text-red-600 hover:border-red-200 border border-transparent transition-all"
                                                onClick={(e) => handleDeleteMachine(e, mc)}
                                                disabled={deleting === mc.id}
                                                title="Delete Machine"
                                            >
                                                <Trash2 className="h-3.5 w-3.5" />
                                            </Button>
                                        </div>
                                    </div>
                                </Card>
                            );
                        })}
                    </div>
                )}

                <MachineFormDialog
                    open={machineDialogOpen}
                    onOpenChange={setMachineDialogOpen}
                    initialData={selectedMachine}
                    onSaved={fetchMachines}
                />
            </div>
        </div>
    );
}

function StatusBadge({ status, rawStatus }: { status: string, rawStatus: string }) {
    if (status === 'Running') {
        return (
            <div className="flex items-center gap-1.5 px-2 py-1 bg-emerald-100 border border-emerald-300 text-emerald-800 text-[9px] font-black uppercase tracking-widest shadow-[1px_1px_0px_0px_rgba(16,185,129,0.5)]">
                <Activity className="h-3 w-3 animate-pulse" /> RUNNING
            </div>
        );
    }
    if (status === 'Down') {
        const isMaint = rawStatus === 'MAINTENANCE';
        return (
            <div className={cn(
                "flex items-center gap-1.5 px-2 py-1 border text-[9px] font-black uppercase tracking-widest shadow-[1px_1px_0px_0px_rgba(0,0,0,0.2)]",
                isMaint
                    ? "bg-amber-100 border-amber-300 text-amber-800"
                    : "bg-red-100 border-red-300 text-red-800"
            )}>
                <AlertCircle className="h-3 w-3" /> {isMaint ? 'MAINTENANCE' : 'DOWN'}
            </div>
        );
    }
    return (
        <div className="flex items-center gap-1.5 px-2 py-1 bg-zinc-100 border border-zinc-300 text-zinc-600 text-[9px] font-black uppercase tracking-widest">
            <Clock className="h-3 w-3" /> IDLE
        </div>
    );
}
