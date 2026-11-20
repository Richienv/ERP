"use client";

import { useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query-keys";
import {
    Plus,
    Search,
    RefreshCw,
    AlertCircle,
    Route,
    Clock,
    Settings,
    ChevronRight,
    Box,
    Trash2,
    CheckCircle,
    XCircle,
    Activity,
    Layers
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import {
    Sheet,
    SheetContent,
    SheetDescription,
    SheetHeader,
    SheetTitle,
} from "@/components/ui/sheet";
import { RoutingFormDialog } from "@/components/manufacturing/routing-form-dialog";
import { AddRoutingStepDialog } from "@/components/manufacturing/add-routing-step-dialog";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { confirmAction } from "@/components/ui/confirm-action-host"

interface RoutingStep {
    id: string;
    sequence: number;
    name: string;
    description?: string | null;
    durationMinutes: number;
    machine?: {
        id: string;
        name: string;
        code: string;
    } | null;
    material?: {
        id: string;
        name: string;
        code: string;
        unit: string;
        quantity: number;
        costPrice?: number;
        lineCost?: number;
    } | null;
}

interface Routing {
    id: string;
    code: string;
    name: string;
    description?: string | null;
    isActive: boolean;
    stepCount: number;
    totalDuration: number;
    totalDurationFormatted: string;
    totalMaterialCost?: number;
    steps: RoutingStep[];
    createdAt: string;
    updatedAt: string;
}

interface Props {
    initialRoutings: Routing[];
}

export function RoutingClient({ initialRoutings }: Props) {
    const queryClient = useQueryClient();
    const [routings, setRoutings] = useState<Routing[]>(initialRoutings);
    const [refreshing, setRefreshing] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [searchQuery, setSearchQuery] = useState("");
    const [selectedRouting, setSelectedRouting] = useState<Routing | null>(null);
    const [sheetOpen, setSheetOpen] = useState(false);
    const [routingFormOpen, setRoutingFormOpen] = useState(false);
    const [editingRouting, setEditingRouting] = useState<Routing | null>(null);
    const [addStepOpen, setAddStepOpen] = useState(false);
    const [deleting, setDeleting] = useState(false);

    // Stats Calculation
    const stats = useMemo(() => {
        const total = routings.length;
        const active = routings.filter(r => r.isActive).length;
        const totalSteps = routings.reduce((acc, r) => acc + r.stepCount, 0);
        const avgDuration = total > 0
            ? Math.round(routings.reduce((acc, r) => acc + r.totalDuration, 0) / total)
            : 0;

        return { total, active, totalSteps, avgDuration };
    }, [routings]);

    const kpis = [
        {
            label: "Total Routings",
            value: String(stats.total),
            detail: "Definisi Proses",
            icon: Route,
            color: "text-zinc-900 dark:text-white"
        },
        {
            label: "Active Running",
            value: String(stats.active),
            detail: "Siap Digunakan",
            icon: CheckCircle,
            color: "text-emerald-600",
            bg: "bg-emerald-50 dark:bg-emerald-900/20"
        },
        {
            label: "Total Steps",
            value: String(stats.totalSteps),
            detail: "Langkah Produksi",
            icon: Layers,
            color: "text-blue-600",
            bg: "bg-blue-50 dark:bg-blue-900/20"
        },
        {
            label: "Avg Duration",
            value: `${stats.avgDuration}m`,
            detail: "Rata-rata Waktu",
            icon: Clock,
            color: "text-amber-600",
            bg: "bg-amber-50 dark:bg-amber-900/20"
        }
    ];

    const fetchRoutings = async () => {
        setRefreshing(true);
        setError(null);
        try {
            const params = new URLSearchParams();
            if (searchQuery) params.append('search', searchQuery);

            const response = await fetch(`/api/manufacturing/routing?${params.toString()}`);
            const data = await response.json();

            if (data.success) {
                setRoutings(data.data);
            } else {
                setError(data.error || 'Gagal mengambil data routing');
            }
        } catch (err) {
            setError('Kesalahan jaringan. Silakan coba lagi.');
            console.error('Error fetching routings:', err);
        } finally {
            setRefreshing(false);
        }
    };

    const handleSearchChange = (value: string) => {
        setSearchQuery(value);
        setTimeout(() => fetchRoutings(), 300);
    };

    const handleRoutingClick = async (routing: Routing) => {
        try {
            const response = await fetch(`/api/manufacturing/routing/${routing.id}`);
            const data = await response.json();
            if (data.success) {
                setSelectedRouting(data.data);
            } else {
                setSelectedRouting(routing);
            }
        } catch {
            setSelectedRouting(routing);
        }
        setSheetOpen(true);
    };

    const handleCreateRouting = () => {
        setEditingRouting(null);
        setRoutingFormOpen(true);
    };

    const handleEditRouting = () => {
        if (!selectedRouting) return;
        setEditingRouting(selectedRouting);
        setRoutingFormOpen(true);
    };

    const handleDeleteRouting = async () => {
        if (!selectedRouting) return;
        const confirmed = await confirmAction({ title: `Hapus routing ${selectedRouting.name} (${selectedRouting.code})?`, description: "Semua langkah proses di routing ini ikut terhapus.", confirmLabel: "Hapus routing", destructive: true });
        if (!confirmed) return;

        setDeleting(true);
        try {
            const response = await fetch(`/api/manufacturing/routing/${selectedRouting.id}`, { method: 'DELETE' });
            const payload = await response.json();
            if (!payload.success) {
                toast.error(payload.error || 'Gagal menghapus routing');
                return;
            }
            toast.success('Routing berhasil dihapus');
            queryClient.invalidateQueries({ queryKey: queryKeys.mfgRouting.all });
            setSheetOpen(false);
            setSelectedRouting(null);
            await fetchRoutings();
        } catch (err) {
            console.error(err);
            toast.error('Kesalahan jaringan saat menghapus routing');
        } finally {
            setDeleting(false);
        }
    };

    const refreshRoutingsAndSelection = async () => {
        await fetchRoutings();
        if (selectedRouting?.id) {
            try {
                const response = await fetch(`/api/manufacturing/routing/${selectedRouting.id}`);
                const payload = await response.json();
                if (payload.success) {
                    setSelectedRouting(payload.data);
                }
            } catch (error) {
                console.error("Error refreshing selected routing:", error);
            }
        }
    };

    return (
        <div className="w-full bg-zinc-50 dark:bg-slate-900 font-sans min-h-[calc(100svh-theme(spacing.16))]">
            <div className="mf-page">

                {/* Header */}
                <div className="flex-none flex items-center justify-between">
                    <div>
                        <h1 className="text-lg font-semibold text-zinc-900 dark:text-white flex items-center gap-2">
                            <Route className="h-6 w-6" />
                            Routing Process
                        </h1>
                        <p className="text-xs font-bold text-zinc-400 mt-1">
                            Definisi langkah produksi & alur kerja manufaktur
                        </p>
                    </div>
                    <div className="flex items-center gap-2">
                        <Button aria-label="Muat ulang"
                            variant="outline"
                            size="icon"
                            onClick={fetchRoutings}
                            disabled={refreshing}
                            className="h-10 w-10 border border-border shadow-sm hover:shadow-sm hover:bg-zinc-100 transition-all rounded-md"
                        >
                            <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
                        </Button>
                        <Button
                            className="h-10 bg-slate-900 text-white hover:bg-zinc-800 border border-border shadow-sm hover:shadow-sm active:scale-[0.98] transition-all font-semibold text-xs rounded-md px-6"
                            onClick={handleCreateRouting}
                        >
                            <Plus className="mr-2 h-4 w-4" /> Routing Baru
                        </Button>
                    </div>
                </div>

                {/* KPI Strip */}
                <div className="flex-none bg-white dark:bg-zinc-900 border border-border shadow-sm overflow-hidden">
                    <div className="grid grid-cols-2 md:grid-cols-4 divide-x-2 divide-border divide-y-2 md:divide-y-0">
                        {kpis.map((kpi) => (
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
                                        <span className="text-xs font-semibold text-zinc-500 group-hover:text-black dark:group-hover:text-zinc-300 transition-colors">
                                            {kpi.label}
                                        </span>
                                    </div>
                                </div>
                                <p className={cn("text-2xl font-semibold tracking-tighter", kpi.color)}>
                                    {kpi.value}
                                </p>
                                <p className="text-xs font-bold text-zinc-400 mt-1">
                                    {kpi.detail}
                                </p>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Filter & Search */}
                <div className="flex flex-col md:flex-row gap-4 items-center justify-between bg-zinc-100/50 p-2 md:p-0">
                    <div className="relative w-full md:w-96">
                        <div className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400">
                            <Search className="h-4 w-4" />
                        </div>
                        <Input
                            placeholder="Cari routing, kode, atau nama..."
                            className="pl-10 h-10 border border-border shadow-sm focus-visible:ring-0 focus-visible:shadow-sm transition-all bg-white dark:bg-zinc-900 rounded-md font-medium"
                            value={searchQuery}
                            onChange={(e) => handleSearchChange(e.target.value)}
                        />
                    </div>
                </div>

                {/* Error State */}
                {error && (
                    <div className="border border-red-500 bg-red-50 p-4 shadow-sm flex items-center justify-between">
                        <div className="flex items-center gap-3 text-red-700 font-bold text-xs">
                            <AlertCircle className="h-5 w-5" />
                            <span>{error}</span>
                        </div>
                        <Button variant="outline" size="sm" onClick={fetchRoutings} className="bg-white border border-red-500 text-red-700 hover:bg-red-100 rounded-md font-bold text-xs ">
                            Coba Lagi
                        </Button>
                    </div>
                )}

                {/* Empty State */}
                {routings.length === 0 && !error && (
                    <div className="border border-dashed border-zinc-300 min-h-[300px] flex flex-col items-center justify-center text-center bg-zinc-50/50 p-8">
                        <div className="h-16 w-16 bg-zinc-100 border border-zinc-200 flex items-center justify-center mb-4 rounded-full">
                            <Route className="h-8 w-8 text-zinc-300" />
                        </div>
                        <h3 className="text-lg font-semibold text-zinc-400">Tidak ada routing ditemukan</h3>
                        <p className="text-xs font-bold text-zinc-400 mt-2 max-w-xs">
                            {searchQuery
                                ? 'Coba sesuaikan kata kunci pencarian anda.'
                                : 'Mulai dengan membuat routing proses pertama anda.'}
                        </p>
                        <Button className="mt-6 bg-slate-900 text-white rounded-md font-semibold text-xs px-6 py-5 border border-border shadow-sm hover:shadow-none transition-all" onClick={handleCreateRouting}>
                            <Plus className="mr-2 h-4 w-4" /> Routing Baru
                        </Button>
                    </div>
                )}

                {/* Routing Cards Grid */}
                {routings.length > 0 && (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 pb-20">
                        {routings.map((routing) => (
                            <Card
                                key={routing.id}
                                className="group relative border border-border shadow-sm hover:shadow-sm transition-all rounded-md bg-white dark:bg-zinc-900 overflow-hidden flex flex-col cursor-pointer"
                                onClick={() => handleRoutingClick(routing)}
                            >
                                {/* Header Strip */}
                                <div className="flex justify-between items-center p-3 border-b border-border bg-zinc-50 dark:bg-zinc-800">
                                    <span className="text-xs font-semibold text-zinc-500 font-mono">
                                        {routing.code}
                                    </span>
                                    <div className={cn(
                                        "flex items-center gap-1.5 px-2 py-1 border text-xs font-semibold  ",
                                        routing.isActive
                                            ? "bg-emerald-100 border-emerald-300 text-emerald-800 shadow-sm"
                                            : "bg-zinc-100 border-zinc-300 text-zinc-600"
                                    )}>
                                        {routing.isActive ? <CheckCircle className="h-3 w-3" /> : <XCircle className="h-3 w-3" />}
                                        {routing.isActive ? 'ACTIVE' : 'INACTIVE'}
                                    </div>
                                </div>

                                {/* Content */}
                                <div className="p-4 flex-1 flex flex-col gap-4">
                                    <div className="flex items-start justify-between gap-4">
                                        <h3 className="text-sm font-semibold leading-tight line-clamp-2">
                                            {routing.name}
                                        </h3>
                                        <div className="h-8 w-8 shrink-0 bg-slate-900 text-white flex items-center justify-center border border-border">
                                            <Route className="h-4 w-4" />
                                        </div>
                                    </div>

                                    {routing.description && (
                                        <p className="text-xs text-zinc-500 line-clamp-2 font-medium">
                                            {routing.description}
                                        </p>
                                    )}

                                    <div className="grid grid-cols-2 gap-2 mt-auto pt-2">
                                        <div className="border border-zinc-200 bg-zinc-50/50 p-2">
                                            <p className="text-xs font-semibold text-zinc-400 mb-0.5">Steps</p>
                                            <div className="font-bold text-sm text-zinc-900 flex items-center gap-1.5">
                                                <Layers className="h-3.5 w-3.5 text-zinc-400" /> {routing.stepCount}
                                            </div>
                                        </div>
                                        <div className="border border-zinc-200 bg-zinc-50/50 p-2">
                                            <p className="text-xs font-semibold text-zinc-400 mb-0.5">Total Time</p>
                                            <div className="font-bold text-sm text-zinc-900 flex items-center gap-1.5">
                                                <Clock className="h-3.5 w-3.5 text-zinc-400" /> {routing.totalDurationFormatted}
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* Footer Action */}
                                <div className="border-t border-border p-2 flex items-center justify-end bg-zinc-50 dark:bg-zinc-800 group-hover:bg-zinc-100 transition-colors">
                                    <span className="text-xs font-semibold text-black flex items-center gap-1">
                                        Lihat Detail <ChevronRight className="h-3 w-3" />
                                    </span>
                                </div>
                            </Card>
                        ))}
                    </div>
                )}

                {/* Detail Sheet */}
                <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
                    <SheetContent className="w-full sm:max-w-xl p-0 border-l border-border shadow-sm rounded-md bg-white dark:bg-zinc-900 overflow-hidden flex flex-col gap-0">
                        {/* Sheet Header */}
                        <div className="bg-slate-900 text-white px-6 py-5 shrink-0 border-b border-border">
                            <SheetHeader className="text-left space-y-1">
                                <SheetTitle className="text-xl font-semibold tracking-tight text-white flex items-center gap-3">
                                    <div className="h-8 w-8 bg-white text-black flex items-center justify-center border border-white rounded-md">
                                        <Route className="h-4 w-4" />
                                    </div>
                                    {selectedRouting?.name}
                                </SheetTitle>
                                <SheetDescription className="text-zinc-400 font-mono text-xs font-bold  ">
                                    {selectedRouting?.code}
                                </SheetDescription>
                            </SheetHeader>
                        </div>

                        {selectedRouting && (
                            <div className="flex-1 overflow-y-auto bg-zinc-50/50 dark:bg-black/20">
                                <div className="p-6 space-y-6">
                                    {/* Stats Grid */}
                                    <div className="grid grid-cols-2 gap-3">
                                        <div className="bg-white border border-border p-3 shadow-sm">
                                            <p className="text-xs font-semibold text-zinc-400 mb-1">Total Steps</p>
                                            <p className="text-2xl font-semibold">{selectedRouting.stepCount}</p>
                                        </div>
                                        <div className="bg-white border border-border p-3 shadow-sm">
                                            <p className="text-xs font-semibold text-zinc-400 mb-1">Total Time</p>
                                            <p className="text-2xl font-semibold">{selectedRouting.totalDurationFormatted}</p>
                                        </div>
                                    </div>

                                    {/* Description */}
                                    {selectedRouting.description && (
                                        <div className="bg-white border border-border p-4 shadow-sm">
                                            <h4 className="font-semibold text-xs mb-2 text-zinc-500">Keterangan</h4>
                                            <p className="text-sm font-medium text-zinc-900">{selectedRouting.description}</p>
                                        </div>
                                    )}

                                    {/* Process Steps */}
                                    <div>
                                        <div className="flex items-center justify-between mb-3">
                                            <h4 className="font-semibold text-xs text-zinc-500">Langkah Proses</h4>
                                            <Badge variant="outline" className="rounded-md border-border font-mono text-xs">{selectedRouting.steps.length} Steps</Badge>
                                        </div>

                                        {selectedRouting.steps.length === 0 ? (
                                            <div className="border border-dashed border-zinc-300 p-8 text-center">
                                                <p className="text-xs font-bold text-zinc-400  ">Belum ada langkah proses</p>
                                            </div>
                                        ) : (
                                            <div className="space-y-3 relative">
                                                {/* Connecting Line */}
                                                <div className="absolute left-[19px] top-4 bottom-4 w-0.5 bg-black/20 -z-10" />

                                                {selectedRouting.steps.map((step, index) => (
                                                    <div key={step.id} className="relative group">
                                                        <div className="flex gap-4">
                                                            {/* Sequence Circle */}
                                                            <div className="shrink-0 h-10 w-10 bg-slate-900 text-white border border-border flex items-center justify-center font-semibold text-sm z-10 shadow-sm">
                                                                {step.sequence}
                                                            </div>

                                                            {/* Step Card */}
                                                            <div className="flex-1 bg-white border border-border shadow-sm p-3 hover:shadow-sm transition-all">
                                                                <div className="flex justify-between items-start mb-2">
                                                                    <p className="font-semibold text-sm tracking-tight">{step.name}</p>
                                                                    <div className="flex items-center gap-1 bg-zinc-100 border border-zinc-300 px-1.5 py-0.5">
                                                                        <Clock className="h-3 w-3 text-zinc-500" />
                                                                        <span className="text-xs font-bold font-mono">{step.durationMinutes}m</span>
                                                                    </div>
                                                                </div>

                                                                {step.description && (
                                                                    <p className="text-xs text-zinc-500 mb-3 border-l border-zinc-200 pl-2">
                                                                        {step.description}
                                                                    </p>
                                                                )}

                                                                <div className="flex flex-wrap gap-2">
                                                                    {step.machine && (
                                                                        <div className="flex items-center gap-1.5 bg-blue-50 border border-blue-200 px-2 py-1">
                                                                            <Settings className="h-3 w-3 text-blue-600" />
                                                                            <span className="text-xs font-bold text-blue-800">{step.machine.name}</span>
                                                                        </div>
                                                                    )}
                                                                    {step.material && (
                                                                        <div className="flex items-center gap-1.5 bg-amber-50 border border-amber-200 px-2 py-1">
                                                                            <Box className="h-3 w-3 text-amber-600" />
                                                                            <span className="text-xs font-bold text-amber-800">
                                                                                {step.material.quantity} {step.material.unit} {step.material.name}
                                                                            </span>
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            </div>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Footer Actions */}
                        {selectedRouting && (
                            <div className="p-4 border-t border-border bg-zinc-50 flex flex-col sm:flex-row gap-3 shrink-0">
                                <Button
                                    className="flex-1 bg-slate-900 text-white hover:bg-zinc-800 border border-border shadow-sm rounded-md font-bold text-xs h-10"
                                    onClick={handleEditRouting}
                                >
                                    Edit Routing
                                </Button>
                                <Button
                                    variant="outline"
                                    className="flex-1 border border-border bg-white hover:bg-zinc-100 shadow-sm rounded-md font-bold text-xs h-10"
                                    onClick={() => setAddStepOpen(true)}
                                >
                                    Tambah Step
                                </Button>
                                <Button
                                    variant="outline"
                                    className="border border-red-500 text-red-600 hover:bg-red-50 shadow-sm rounded-md font-bold text-xs h-10 w-12 px-0 flex items-center justify-center"
                                    onClick={handleDeleteRouting}
                                    disabled={deleting}
                                >
                                    <Trash2 className="h-4 w-4" />
                                </Button>
                            </div>
                        )}
                    </SheetContent>
                </Sheet>

                <RoutingFormDialog
                    open={routingFormOpen}
                    onOpenChange={setRoutingFormOpen}
                    initialData={editingRouting}
                    onSaved={refreshRoutingsAndSelection}
                />

                {selectedRouting && (
                    <AddRoutingStepDialog
                        open={addStepOpen}
                        onOpenChange={setAddStepOpen}
                        routingId={selectedRouting.id}
                        routingName={selectedRouting.name}
                        nextSequence={selectedRouting.steps.length + 1}
                        onSaved={refreshRoutingsAndSelection}
                    />
                )}
            </div>
        </div>
    );
}
