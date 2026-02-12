"use client";

import { useEffect, useState } from "react";
import {
    Plus,
    Search,
    Settings,
    Activity,
    AlertCircle,
    Clock,
    BarChart3,
    RefreshCw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
    Card,
    CardContent,
    CardHeader,
    CardTitle,
    CardFooter
} from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { MachineFormDialog } from "@/components/manufacturing/machine-form-dialog";

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

export default function WorkCentersPage() {
    const [machines, setMachines] = useState<Machine[]>([]);
    const [summary, setSummary] = useState<Summary>({ total: 0, active: 0, down: 0, avgEfficiency: 0 });
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [searchQuery, setSearchQuery] = useState("");
    const [statusFilter, setStatusFilter] = useState<string | null>(null);
    const [machineDialogOpen, setMachineDialogOpen] = useState(false);
    const [selectedMachine, setSelectedMachine] = useState<Machine | null>(null);

    const fetchMachines = async () => {
        setLoading(true);
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
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchMachines();
    }, [statusFilter]);

    // Debounced search
    useEffect(() => {
        const timer = setTimeout(() => {
            fetchMachines();
        }, 300);
        return () => clearTimeout(timer);
    }, [searchQuery]);

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

    return (
        <div className="mf-page">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="mf-title">Pusat Kerja & Routing</h2>
                    <p className="text-muted-foreground">Monitor status mesin dan kapasitas produksi.</p>
                </div>
                <div className="flex gap-2">
                    <Button
                        variant="outline"
                        size="icon"
                        onClick={fetchMachines}
                        disabled={loading}
                        className="border-black"
                    >
                        <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
                    </Button>
                    <Button
                        className="bg-black text-white hover:bg-zinc-800 border border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] uppercase font-bold tracking-wide"
                        onClick={handleCreateMachine}
                    >
                        <Plus className="mr-2 h-4 w-4" /> Tambah Mesin
                    </Button>
                </div>
            </div>

            {/* Overall Status Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <StatusCard label="Total Machines" value={loading ? '-' : String(summary.total)} icon={Settings} />
                <StatusCard label="Active" value={loading ? '-' : String(summary.active)} icon={Activity} color="text-emerald-600" />
                <StatusCard label="Down / Maint" value={loading ? '-' : String(summary.down)} icon={AlertCircle} color="text-red-600" />
                <StatusCard label="Avg Efficiency" value={loading ? '-' : `${summary.avgEfficiency}%`} icon={BarChart3} color="text-blue-600" />
            </div>

            {/* Filter Bar */}
            <div className="flex items-center gap-4 py-2">
                <div className="relative flex-1 max-w-sm">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                        placeholder="Search machines..."
                        className="pl-9 border-black/20"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                    />
                </div>
                <div className="flex gap-2">
                    {['All', 'RUNNING', 'IDLE', 'MAINTENANCE', 'BREAKDOWN'].map((filter) => (
                        <Button
                            key={filter}
                            variant="outline"
                            size="sm"
                            className={`border-black transition-colors ${(filter === 'All' && !statusFilter) || statusFilter === filter
                                    ? 'bg-black text-white'
                                    : 'hover:bg-black hover:text-white'
                                }`}
                            onClick={() => setStatusFilter(filter === 'All' ? null : filter)}
                        >
                            {filter === 'All' ? 'All' : filter.charAt(0) + filter.slice(1).toLowerCase()}
                        </Button>
                    ))}
                </div>
            </div>

            {/* Error State */}
            {error && (
                <Card className="border-red-300 bg-red-50">
                    <CardContent className="p-4 flex items-center gap-3 text-red-700">
                        <AlertCircle className="h-5 w-5" />
                        <span>{error}</span>
                        <Button variant="outline" size="sm" onClick={fetchMachines} className="ml-auto">
                            Retry
                        </Button>
                    </CardContent>
                </Card>
            )}

            {/* Loading State */}
            {loading && (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {[1, 2, 3, 4, 5, 6].map((i) => (
                        <Card key={i} className="border border-black/20">
                            <CardHeader className="pb-2">
                                <Skeleton className="h-6 w-3/4" />
                                <Skeleton className="h-4 w-1/2 mt-2" />
                            </CardHeader>
                            <CardContent className="pt-4 space-y-4">
                                <Skeleton className="h-3 w-full" />
                                <div className="grid grid-cols-2 gap-4">
                                    <Skeleton className="h-16" />
                                    <Skeleton className="h-16" />
                                </div>
                            </CardContent>
                        </Card>
                    ))}
                </div>
            )}

            {/* Empty State */}
            {!loading && !error && machines.length === 0 && (
                <Card className="border-dashed border-2 border-zinc-300">
                    <CardContent className="p-12 flex flex-col items-center justify-center text-center">
                        <Settings className="h-12 w-12 text-zinc-300 mb-4" />
                        <h3 className="text-lg font-bold text-zinc-600">No machines found</h3>
                        <p className="text-sm text-muted-foreground mt-1">
                            {searchQuery || statusFilter
                                ? 'Try adjusting your search or filter criteria.'
                                : 'Add your first machine to get started.'}
                        </p>
                        <Button className="mt-4 bg-black text-white" onClick={handleCreateMachine}>
                            <Plus className="mr-2 h-4 w-4" /> Add Machine
                        </Button>
                    </CardContent>
                </Card>
            )}

            {/* Machine Grid */}
            {!loading && !error && machines.length > 0 && (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {machines.map((mc) => {
                        const statusType = getStatusType(mc);
                        const nextMaint = formatDate(mc.nextMaintenance);

                        return (
                            <Card key={mc.id} className="border border-black shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] transition-all">
                                <CardHeader className="pb-2 border-b border-black/5 bg-zinc-50/50">
                                    <div className="flex justify-between items-start">
                                        <div>
                                            <CardTitle className="text-lg font-black uppercase text-zinc-900">{mc.name}</CardTitle>
                                            <div className="text-xs font-mono text-muted-foreground mt-1 flex items-center gap-2">
                                                <span>{mc.code}</span>
                                                {mc.brand && (
                                                    <>
                                                        <span className="w-1 h-1 bg-zinc-300 rounded-full" />
                                                        <span>{mc.brand}</span>
                                                    </>
                                                )}
                                            </div>
                                        </div>
                                        <StatusBadge status={statusType} />
                                    </div>
                                </CardHeader>
                                <CardContent className="pt-4 space-y-4">
                                    {/* Health Score Meter */}
                                    <div className="space-y-1">
                                        <div className="flex justify-between text-xs font-bold uppercase text-muted-foreground">
                                            <span>Health Score</span>
                                            <span>{mc.healthScore}%</span>
                                        </div>
                                        <Progress
                                            value={mc.healthScore}
                                            className="h-3 border border-black/10 bg-zinc-100"
                                            indicatorClassName={
                                                mc.status === 'BREAKDOWN' ? 'bg-red-500' :
                                                    mc.healthScore < 50 ? 'bg-amber-500' : 'bg-black'
                                            }
                                        />
                                    </div>

                                    {/* Capacity & Model */}
                                    <div className="grid grid-cols-2 gap-4 text-sm">
                                        <div className="border border-black/10 rounded p-2 bg-white">
                                            <span className="text-[10px] text-muted-foreground uppercase font-bold block">Capacity/Hr</span>
                                            <span className="font-bold text-lg">{mc.capacityPerHour || '-'}</span>
                                        </div>
                                        <div className="border border-black/10 rounded p-2 bg-white">
                                            <span className="text-[10px] text-muted-foreground uppercase font-bold block">Model</span>
                                            <span className="font-bold text-lg truncate">{mc.model || '-'}</span>
                                        </div>
                                    </div>

                                    {statusType === 'Down' && (
                                        <div className="bg-red-50 border border-red-200 p-2 rounded text-xs text-red-700 font-bold flex items-center gap-2">
                                            <AlertCircle className="h-4 w-4" />
                                            Status: {mc.status}
                                        </div>
                                    )}
                                </CardContent>
                                <CardFooter className="pt-2 pb-4 flex justify-between items-center text-xs text-muted-foreground border-t border-black/5 bg-zinc-50/50">
                                    <div className="flex items-center gap-1">
                                        <Clock className="h-3 w-3" /> Next Maint: <span className={nextMaint === 'OVERDUE' ? 'text-red-600 font-bold underline' : 'font-bold'}>{nextMaint}</span>
                                    </div>
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        className="h-6 text-[10px] uppercase font-bold hover:bg-black hover:text-white transition-colors"
                                        onClick={() => handleEditMachine(mc)}
                                    >
                                        Details <Settings className="ml-1 h-3 w-3" />
                                    </Button>
                                </CardFooter>
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
    );
}

function StatusCard({ label, value, icon: Icon, color = "text-black" }: any) {
    return (
        <Card className="border border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
            <CardContent className="p-4 flex items-center justify-between">
                <div>
                    <p className="text-xs font-bold text-muted-foreground uppercase tracking-wide">{label}</p>
                    <p className={`text-2xl font-black ${color}`}>{value}</p>
                </div>
                <Icon className={`h-8 w-8 opacity-20 ${color}`} />
            </CardContent>
        </Card>
    )
}

function StatusBadge({ status }: { status: string }) {
    if (status === 'Running') {
        return <Badge className="bg-emerald-100 text-emerald-800 border-black hover:bg-emerald-200">RUNNING</Badge>
    }
    if (status === 'Down') {
        return <Badge variant="destructive" className="border-black shadow-sm animate-pulse">DOWN</Badge>
    }
    return <Badge variant="secondary" className="bg-zinc-100 text-zinc-600 border-black">IDLE</Badge>
}
