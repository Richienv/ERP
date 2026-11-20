"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query-keys";
import {
    Plus,
    Search,
    ClipboardList,
    User,
    Calendar,
    Clock,
    AlertTriangle,
    CheckCircle2,
    RefreshCw,
    AlertCircle,
    ChevronRight,
    Factory,
    Loader2
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import {
    Sheet,
    SheetContent,
    SheetDescription,
    SheetHeader,
    SheetTitle,
} from "@/components/ui/sheet";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { CreateWorkOrderDialog } from "@/components/manufacturing/create-work-order-dialog";
import { ProductionReturnDialog } from "@/components/manufacturing/production-return-dialog";
import { ShortageDialog } from "@/components/manufacturing/shortage-dialog";
import { MaterialVarianceSection } from "@/components/manufacturing/material-variance-section";
import { IconAlertTriangle } from "@tabler/icons-react";
import { cn } from "@/lib/utils";

interface WorkOrderTask {
    id: string;
    name: string;
    status: string;
    employee?: {
        firstName: string;
        lastName?: string;
    } | null;
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
    startDate?: string | null;
    dueDate?: string | null;
    status: string;
    priority: string;
    progress: number;
    tasks: WorkOrderTask[];
    workers: string[];
}

interface WarehouseOption {
    id: string;
    code: string;
    name: string;
}

interface Props {
    initialOrders: WorkOrder[];
}

export function WorkOrdersClient({ initialOrders }: Props) {
    const queryClient = useQueryClient();
    const [workOrders, setWorkOrders] = useState<WorkOrder[]>(initialOrders);
    useEffect(() => { setWorkOrders(initialOrders) }, [initialOrders])
    const [refreshing, setRefreshing] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [searchQuery, setSearchQuery] = useState("");
    const [statusFilter, setStatusFilter] = useState<string | null>(null);
    const [selectedSPK, setSelectedSPK] = useState<WorkOrder | null>(null);
    const [sheetOpen, setSheetOpen] = useState(false);
    const [progressDialogOpen, setProgressDialogOpen] = useState(false);
    const [reportQty, setReportQty] = useState("");
    const [warehouseId, setWarehouseId] = useState("");
    const [performedBy, setPerformedBy] = useState("");
    const [warehouseOptions, setWarehouseOptions] = useState<WarehouseOption[]>([]);
    const [updating, setUpdating] = useState(false);
    const [createOpen, setCreateOpen] = useState(false);
    const [shortageDialogOpen, setShortageDialogOpen] = useState(false);

    // Stats Calculation
    const stats = useMemo(() => {
        const total = workOrders.length;
        const inProgress = workOrders.filter(o => o.status === 'IN_PROGRESS').length;
        const planned = workOrders.filter(o => o.status === 'PLANNED').length;
        const completed = workOrders.filter(o => o.status === 'COMPLETED').length;
        return { total, inProgress, planned, completed };
    }, [workOrders]);

    const kpis = [
        {
            label: "Total SPK",
            value: String(stats.total),
            detail: "Semua Perintah Kerja",
            icon: ClipboardList,
            color: "text-zinc-900 dark:text-white"
        },
        {
            label: "Sedang Proses",
            value: String(stats.inProgress),
            detail: "Produksi Berjalan",
            icon: Factory,
            color: "text-blue-600",
            bg: "bg-blue-50 dark:bg-blue-900/20"
        },
        {
            label: "Pending",
            value: String(stats.planned),
            detail: "Menunggu Jadwal",
            icon: Clock,
            color: "text-amber-600",
            bg: "bg-amber-50 dark:bg-amber-900/20"
        },
        {
            label: "Selesai",
            value: String(stats.completed),
            detail: "Produksi Tuntas",
            icon: CheckCircle2,
            color: "text-emerald-600",
            bg: "bg-emerald-50 dark:bg-emerald-900/20"
        }
    ];

    const fetchWorkOrders = async () => {
        setRefreshing(true);
        setError(null);
        try {
            const params = new URLSearchParams();
            params.append('orderType', 'SPK');
            if (searchQuery) params.append('search', searchQuery);
            if (statusFilter) params.append('status', statusFilter);

            const response = await fetch(`/api/manufacturing/work-orders?${params.toString()}`);
            const data = await response.json();

            if (data.success) {
                setWorkOrders(data.data);
            } else {
                setError(data.error || 'Gagal mengambil data SPK');
            }
        } catch (err) {
            setError('Kesalahan jaringan. Silakan coba lagi.');
            console.error('Error fetching work orders:', err);
        } finally {
            setRefreshing(false);
        }
    };

    const handleCardClick = async (spk: WorkOrder) => {
        setSelectedSPK(spk);
        setSheetOpen(true);
        try {
            const response = await fetch(`/api/manufacturing/work-orders/${spk.id}`);
            const payload = await response.json();
            if (payload.success) {
                const options: WarehouseOption[] = payload.data.warehouseOptions || [];
                setWarehouseOptions(options);
                if (options.length > 0) setWarehouseId(options[0].id);
            }
        } catch (err) {
            console.error('Failed to load work order detail', err);
        }
    };

    const refreshSelectedWorkOrder = async () => {
        if (!selectedSPK) return;
        const response = await fetch(`/api/manufacturing/work-orders/${selectedSPK.id}`);
        const payload = await response.json();
        if (payload.success) {
            const latest = payload.data;
            setSelectedSPK((prev) => prev ? {
                ...prev,
                status: latest.status,
                actualQty: latest.actualQty,
                plannedQty: latest.plannedQty,
                progress: latest.progress,
            } : prev);
        }
        await fetchWorkOrders();
    };

    const runTransition = async (toStatus: 'IN_PROGRESS' | 'ON_HOLD' | 'COMPLETED' | 'CANCELLED') => {
        if (!selectedSPK) return;
        setUpdating(true);
        try {
            const response = await fetch(`/api/manufacturing/work-orders/${selectedSPK.id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: 'TRANSITION',
                    toStatus,
                    warehouseId: warehouseId || undefined,
                    performedBy: performedBy || undefined,
                }),
            });
            const payload = await response.json();
            if (!payload.success) {
                toast.error(payload.error || `Gagal mengubah status ke ${toStatus}`, { className: "font-bold border border-border rounded-md" });
                return;
            }
            toast.success(`Status SPK diubah ke ${toStatus}`, { className: "font-bold border border-border rounded-md" });
            queryClient.invalidateQueries({ queryKey: queryKeys.workOrders.all });
            queryClient.invalidateQueries({ queryKey: queryKeys.mfgDashboard.all });
            await refreshSelectedWorkOrder();
        } catch (err) {
            console.error(err);
            toast.error('Kesalahan jaringan saat update SPK', { className: "font-bold border border-border rounded-md" });
        } finally {
            setUpdating(false);
        }
    };

    const reportProduction = async () => {
        if (!selectedSPK) return;
        const qty = Number(reportQty);
        if (!qty || qty <= 0) {
            toast.error('Jumlah produksi harus lebih dari 0', { className: "font-bold border border-border rounded-md" });
            return;
        }
        if (!warehouseId) {
            toast.error('Silakan pilih gudang tujuan', { className: "font-bold border border-border rounded-md" });
            return;
        }

        setUpdating(true);
        try {
            const response = await fetch(`/api/manufacturing/work-orders/${selectedSPK.id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: 'REPORT_PRODUCTION',
                    quantityProduced: qty,
                    warehouseId,
                    performedBy: performedBy || undefined,
                }),
            });
            const payload = await response.json();
            if (!payload.success) {
                toast.error(payload.error || 'Gagal melaporkan produksi', { className: "font-bold border border-border rounded-md" });
                return;
            }
            toast.success('Produksi berhasil dilaporkan. Inventory & Finance terupdate.', { className: "font-bold border border-border rounded-md" })
            queryClient.invalidateQueries({ queryKey: queryKeys.workOrders.all });
            queryClient.invalidateQueries({ queryKey: queryKeys.mfgDashboard.all });
            queryClient.invalidateQueries({ queryKey: queryKeys.inventoryDashboard.all });
            queryClient.invalidateQueries({ queryKey: queryKeys.products.all });
            queryClient.invalidateQueries({ queryKey: queryKeys.stockMovements.all });
            setProgressDialogOpen(false);
            setReportQty("");
            await refreshSelectedWorkOrder();
        } catch (err) {
            console.error(err);
            toast.error('Network error saat posting produksi', { className: "font-bold border border-border rounded-md" });
        } finally {
            setUpdating(false);
        }
    };

    const formatDate = (dateStr: string | null | undefined) => {
        if (!dateStr) return '-';
        const date = new Date(dateStr);
        return date.toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: "2-digit", hour: '2-digit', minute: '2-digit', hour12: false });
    };

    const getPriorityBadge = (priority: string) => {
        switch (priority.toUpperCase()) {
            case 'CRITICAL':
                return <div className="border border-red-500 text-red-600 bg-red-50 px-1.5 py-0.5 text-xs font-semibold animate-pulse">CRITICAL</div>;
            case 'HIGH':
                return <div className="border border-amber-500 text-amber-700 bg-amber-50 px-1.5 py-0.5 text-xs font-semibold  ">HIGH</div>;
            case 'LOW':
                return <div className="border border-zinc-300 text-zinc-500 bg-zinc-50 px-1.5 py-0.5 text-xs font-semibold  ">LOW</div>;
            default:
                return <div className="border border-blue-300 text-blue-600 bg-blue-50 px-1.5 py-0.5 text-xs font-semibold  ">NORMAL</div>;
        }
    };

    const getStatusBadge = (status: string) => {
        switch (status) {
            case 'COMPLETED':
                return (
                    <div className="flex items-center gap-1.5 px-2 py-0.5 bg-emerald-100 border border-emerald-300 text-emerald-800 shadow-sm text-xs font-semibold  ">
                        <CheckCircle2 className="h-3 w-3" /> SELESAI
                    </div>
                );
            case 'IN_PROGRESS':
                return (
                    <div className="flex items-center gap-1.5 px-2 py-0.5 bg-blue-100 border border-blue-300 text-blue-800 shadow-sm text-xs font-semibold  ">
                        <Loader2 className="h-3 w-3 animate-spin" /> PROSES
                    </div>
                );
            case 'ON_HOLD':
                return (
                    <div className="flex items-center gap-1.5 px-2 py-0.5 bg-amber-100 border border-amber-300 text-amber-800 shadow-sm text-xs font-semibold  ">
                        <AlertTriangle className="h-3 w-3" /> DITUNDA
                    </div>
                );
            default:
                return (
                    <div className="flex items-center gap-1.5 px-2 py-0.5 bg-zinc-100 border border-zinc-300 text-zinc-600 text-xs font-semibold  ">
                        <Clock className="h-3 w-3" /> PENDING
                    </div>
                );
        }
    };

    const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const handleSearchChange = (value: string) => {
        setSearchQuery(value);
        if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
        searchTimerRef.current = setTimeout(() => fetchWorkOrders(), 300);
    };

    const handleStatusFilter = (filter: string | null) => {
        setStatusFilter(filter);
        // Use callback to ensure latest filter value is used
        setTimeout(() => fetchWorkOrders(), 0);
    };

    return (
        <div className="w-full bg-zinc-50 dark:bg-slate-900 font-sans min-h-[calc(100svh-theme(spacing.16))]">
            <div className="mf-page">

                {/* Header */}
                <div className="flex-none flex items-center justify-between">
                    <div>
                        <h1 className="text-lg font-semibold text-zinc-900 dark:text-white flex items-center gap-2">
                            <ClipboardList className="h-6 w-6" />
                            Work Orders (SPK)
                        </h1>
                        <p className="text-xs font-bold text-zinc-400 mt-1">
                            Manajemen Surat Perintah Kerja & Tracking Produksi
                        </p>
                    </div>
                    <div className="flex items-center gap-2">
                        <Button aria-label="Muat ulang"
                            variant="outline"
                            size="icon"
                            onClick={fetchWorkOrders}
                            disabled={refreshing}
                            className="h-10 w-10 border border-border shadow-sm hover:shadow-sm hover:bg-zinc-100 transition-all rounded-md"
                        >
                            <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
                        </Button>
                        <Button
                            className="h-10 bg-slate-900 text-white hover:bg-zinc-800 border border-border shadow-sm hover:shadow-sm active:scale-[0.98] transition-all font-semibold text-xs rounded-md px-6"
                            onClick={() => setCreateOpen(true)}
                        >
                            <Plus className="mr-2 h-4 w-4" /> SPK Baru
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

                {/* Filters */}
                <div className="flex flex-col md:flex-row gap-4 items-center justify-between bg-zinc-100/50 p-2 md:p-0">
                    <div className="relative w-full md:w-96">
                        <div className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400">
                            <Search className="h-4 w-4" />
                        </div>
                        <Input
                            placeholder="Cari No SPK, Produk..."
                            className="pl-10 h-10 border border-border shadow-sm focus-visible:ring-0 focus-visible:shadow-sm transition-all bg-white dark:bg-zinc-900 rounded-md font-medium"
                            value={searchQuery}
                            onChange={(e) => handleSearchChange(e.target.value)}
                        />
                    </div>
                    <div className="flex gap-2 w-full md:w-auto overflow-x-auto pb-2 md:pb-0">
                        {['All', 'PLANNED', 'IN_PROGRESS', 'COMPLETED'].map((filter) => (
                            <Button
                                key={filter}
                                variant="outline"
                                size="sm"
                                className={cn(
                                    "border border-border rounded-md font-bold text-xs transition-all h-9 px-4",
                                    (filter === 'All' && !statusFilter) || statusFilter === filter
                                        ? 'bg-primary text-primary-foreground shadow-sm'
                                        : 'bg-white hover:bg-zinc-100 hover:shadow-sm'
                                )}
                                onClick={() => handleStatusFilter(filter === 'All' ? null : filter)}
                            >
                                {filter === 'All' ? 'Semua' : filter === 'IN_PROGRESS' ? 'Proses' : filter === 'PLANNED' ? 'Pending' : 'Selesai'}
                            </Button>
                        ))}
                    </div>
                </div>

                {/* Error State */}
                {error && (
                    <div className="border border-red-500 bg-red-50 p-4 shadow-sm flex items-center justify-between">
                        <div className="flex items-center gap-3 text-red-700 font-bold text-xs">
                            <AlertCircle className="h-5 w-5" />
                            <span>{error}</span>
                        </div>
                        <Button variant="outline" size="sm" onClick={fetchWorkOrders} className="bg-white border border-red-500 text-red-700 hover:bg-red-100 rounded-md font-bold text-xs ">
                            Coba Lagi
                        </Button>
                    </div>
                )}

                {/* Empty State */}
                {workOrders.length === 0 && !error && (
                    <div className="border border-dashed border-zinc-300 min-h-[300px] flex flex-col items-center justify-center text-center bg-zinc-50/50 p-8">
                        <div className="h-16 w-16 bg-zinc-100 border border-zinc-200 flex items-center justify-center mb-4 rounded-full">
                            <ClipboardList className="h-8 w-8 text-zinc-300" />
                        </div>
                        <h3 className="text-lg font-semibold text-zinc-400">Tidak ada SPK ditemukan</h3>
                        <p className="text-xs font-bold text-zinc-400 mt-2 max-w-xs">
                            {searchQuery || statusFilter
                                ? 'Coba sesuaikan kata kunci pencarian atau filter anda.'
                                : 'Mulai dengan membuat Surat Perintah Kerja pertama.'}
                        </p>
                        <Button className="mt-6 bg-slate-900 text-white rounded-md font-semibold text-xs px-6 py-5 border border-border shadow-sm hover:shadow-none transition-all" onClick={() => setCreateOpen(true)}>
                            <Plus className="mr-2 h-4 w-4" /> Buat SPK Baru
                        </Button>
                    </div>
                )}

                {/* Work Order Cards Grid */}
                {workOrders.length > 0 && (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 pb-20">
                        {workOrders.map((spk) => (
                            <Card
                                key={spk.id}
                                className="group relative border border-border shadow-sm hover:shadow-sm transition-all rounded-md bg-white dark:bg-zinc-900 overflow-hidden flex flex-col cursor-pointer"
                                onClick={() => handleCardClick(spk)}
                            >
                                {/* Header Strip */}
                                <div className="flex justify-between items-center p-3 border-b border-border bg-zinc-50 dark:bg-zinc-800">
                                    <span className="text-xs font-semibold text-zinc-500 font-mono">
                                        {spk.number}
                                    </span>
                                    {getPriorityBadge(spk.priority)}
                                </div>

                                {/* Content */}
                                <div className="p-4 flex-1 flex flex-col gap-4">
                                    <div>
                                        <h3 className="text-sm font-semibold leading-tight line-clamp-2 min-h-[40px]">
                                            {spk.product.name}
                                        </h3>
                                        <p className="text-xs font-mono font-bold text-zinc-400 mt-1">{spk.product.code}</p>
                                    </div>

                                    <div className="space-y-2">
                                        <div className="flex justify-between text-xs font-semibold text-zinc-500">
                                            <span>Progress</span>
                                            <span>{Math.round(spk.progress)}%</span>
                                        </div>
                                        <Progress
                                            value={spk.progress}
                                            className="h-2 bg-zinc-100 rounded-md border border-border"
                                            indicatorClassName={cn(
                                                "rounded-md",
                                                spk.status === 'COMPLETED' ? 'bg-emerald-500' :
                                                    spk.progress > 50 ? 'bg-slate-900' : 'bg-amber-500'
                                            )}
                                        />
                                    </div>

                                    <div className="grid grid-cols-2 gap-2 pt-2 border-t border-dashed border-zinc-200 mt-auto">
                                        <div className="flex flex-col">
                                            <span className="text-xs font-bold text-zinc-400">Status</span>
                                            {getStatusBadge(spk.status)}
                                        </div>
                                        <div className="flex flex-col">
                                            <span className="text-xs font-bold text-zinc-400">Due Date</span>
                                            <div className="flex items-center gap-1 font-bold text-xs mt-1">
                                                <Calendar className="h-3 w-3 text-zinc-400" />
                                                {formatDate(spk.dueDate)}
                                            </div>
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-2 mt-1">
                                        {spk.workers.length > 0 ? (
                                            <div className="flex -space-x-2">
                                                {spk.workers.slice(0, 3).map((worker, i) => (
                                                    <div key={i} className="h-6 w-6 rounded-md bg-slate-900 text-white border border-white flex items-center justify-center text-xs font-semibold " title={worker}>
                                                        {worker.substring(0, 1)}
                                                    </div>
                                                ))}
                                                {spk.workers.length > 3 && (
                                                    <div className="h-6 w-6 rounded-md bg-zinc-200 text-zinc-600 border border-white flex items-center justify-center text-xs font-semibold">
                                                        +{spk.workers.length - 3}
                                                    </div>
                                                )}
                                            </div>
                                        ) : (
                                            <span className="text-xs italic text-zinc-400">Belum ada pekerja</span>
                                        )}
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
                                <div className="flex justify-between items-start">
                                    <SheetTitle className="text-lg font-semibold tracking-tight text-white flex items-center gap-3">
                                        <div className="h-8 w-8 bg-white text-black flex items-center justify-center border border-white rounded-md">
                                            <ClipboardList className="h-4 w-4" />
                                        </div>
                                        {selectedSPK?.number}
                                    </SheetTitle>
                                    {selectedSPK && getPriorityBadge(selectedSPK.priority)}
                                </div>
                                <SheetDescription className="text-zinc-400 font-bold block pt-2 text-sm">
                                    {selectedSPK?.product.name}
                                </SheetDescription>
                            </SheetHeader>
                        </div>

                        {selectedSPK && (
                            <div className="flex-1 overflow-y-auto bg-zinc-50/50 dark:bg-black/20">
                                <div className="p-6 space-y-6">

                                    {/* Progress Card */}
                                    <div className="bg-white border border-border p-4 shadow-sm">
                                        <div className="flex items-center justify-between mb-2">
                                            {getStatusBadge(selectedSPK.status)}
                                            <span className="text-2xl font-semibold">{Math.round(selectedSPK.progress)}%</span>
                                        </div>
                                        <Progress
                                            value={selectedSPK.progress}
                                            className="h-4 border border-border bg-zinc-100 rounded-md"
                                            indicatorClassName={cn(
                                                "rounded-md",
                                                selectedSPK.progress >= 100 ? 'bg-emerald-500' : 'bg-slate-900'
                                            )}
                                        />
                                        <div className="flex justify-between text-xs font-bold text-zinc-500 mt-2  ">
                                            <span>Actual: {selectedSPK.actualQty} {selectedSPK.product.unit}</span>
                                            <span>Target: {selectedSPK.plannedQty} {selectedSPK.product.unit}</span>
                                        </div>
                                    </div>

                                    {/* Info Grid */}
                                    <div className="grid grid-cols-2 gap-4">
                                        <InfoItem
                                            icon={User}
                                            label="Assigned To"
                                            value={selectedSPK.workers.length > 0 ? selectedSPK.workers.join(', ') : 'Belum ditugaskan'}
                                        />
                                        <InfoItem
                                            icon={Calendar}
                                            label="Due Date"
                                            value={formatDate(selectedSPK.dueDate)}
                                        />
                                        <InfoItem
                                            icon={Factory}
                                            label="Production Qty"
                                            value={`${selectedSPK.actualQty} / ${selectedSPK.plannedQty} ${selectedSPK.product.unit}`}
                                        />
                                        <InfoItem
                                            icon={AlertTriangle}
                                            label="Priority"
                                            value={selectedSPK.priority || 'Normal'}
                                        />
                                    </div>

                                    {/* Tasks */}
                                    {selectedSPK.tasks.length > 0 && (
                                        <div>
                                            <h4 className="font-semibold text-xs text-zinc-500 mb-3">Tasks ({selectedSPK.tasks.length})</h4>
                                            <div className="space-y-2">
                                                {selectedSPK.tasks.map((task) => (
                                                    <div key={task.id} className="flex items-center justify-between p-3 bg-white border border-black/10 shadow-sm">
                                                        <div className="flex items-center gap-2">
                                                            {task.status === 'COMPLETED' ? (
                                                                <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                                                            ) : (
                                                                <Clock className="h-4 w-4 text-amber-600" />
                                                            )}
                                                            <span className="text-sm font-bold">{task.name}</span>
                                                        </div>
                                                        {task.employee && (
                                                            <span className="text-xs bg-zinc-100 px-2 py-1 font-mono font-bold">
                                                                {task.employee.firstName}
                                                            </span>
                                                        )}
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}

                                    {/* Material Variance */}
                                    {selectedSPK.status === 'IN_PROGRESS' || selectedSPK.status === 'COMPLETED' ? (
                                        <MaterialVarianceSection workOrderId={selectedSPK.id} />
                                    ) : null}

                                    {/* Shortage Check & Production Return */}
                                    {selectedSPK.status === 'IN_PROGRESS' && (
                                        <div className="flex gap-2">
                                            <Button
                                                variant="outline"
                                                className="flex-1 border border-amber-500 text-amber-700 rounded-md font-bold text-xs h-9 hover:bg-amber-50"
                                                onClick={() => setShortageDialogOpen(true)}
                                            >
                                                <IconAlertTriangle className="h-3.5 w-3.5 mr-1.5" /> Cek Kebutuhan Material
                                            </Button>
                                            <ProductionReturnDialog
                                                workOrderId={selectedSPK.id}
                                                workOrderNumber={selectedSPK.number}
                                                productName={selectedSPK.product.name}
                                                productCode={selectedSPK.product.code}
                                                productUnit={selectedSPK.product.unit}
                                                actualQty={selectedSPK.actualQty}
                                                warehouseOptions={warehouseOptions}
                                                defaultWarehouseId={warehouseId}
                                                onSuccess={refreshSelectedWorkOrder}
                                            />
                                        </div>
                                    )}

                                </div>
                            </div>
                        )}

                        {/* Footer Actions */}
                        {selectedSPK && (
                            <div className="p-4 border-t border-border bg-zinc-50 flex flex-col gap-3 shrink-0">
                                <Dialog open={progressDialogOpen} onOpenChange={setProgressDialogOpen}>
                                    <DialogTrigger asChild>
                                        <Button
                                            className="w-full bg-slate-900 text-white hover:bg-zinc-800 border border-border shadow-sm hover:shadow-none transition-all rounded-md font-semibold text-xs h-12"
                                            disabled={selectedSPK.status !== 'IN_PROGRESS' || updating}
                                        >
                                            Update Progress / Report Production
                                        </Button>
                                    </DialogTrigger>
                                    <DialogContent className="border border-border rounded-md shadow-sm p-0 bg-white">
                                        <div className="bg-slate-900 text-white px-6 py-4 border-b border-border">
                                            <DialogTitle className=" font-semibold tracking-tight text-lg">Lapor Produksi</DialogTitle>
                                            <DialogDescription className="text-zinc-400 text-xs">Post produksi aktual dan sinkronkan inventory.</DialogDescription>
                                        </div>
                                        <div className="p-6 space-y-4">
                                            <div className="space-y-1.5">
                                                <label className="text-xs font-semibold text-zinc-500">Qty Produksi</label>
                                                <Input
                                                    type="number"
                                                    min={1}
                                                    max={Math.max(1, selectedSPK.plannedQty - selectedSPK.actualQty)}
                                                    value={reportQty}
                                                    onChange={(e) => setReportQty(e.target.value)}
                                                    placeholder="0"
                                                    className="border border-border rounded-md h-10 font-bold"
                                                />
                                            </div>
                                            <div className="space-y-1.5">
                                                <label className="text-xs font-semibold text-zinc-500">Gudang Tujuan</label>
                                                <Select value={warehouseId} onValueChange={setWarehouseId}>
                                                    <SelectTrigger className="border border-border rounded-md h-10 font-bold">
                                                        <SelectValue placeholder="Pilih Gudang" />
                                                    </SelectTrigger>
                                                    <SelectContent className="rounded-md border border-border">
                                                        {warehouseOptions.map((wh) => (
                                                            <SelectItem key={wh.id} value={wh.id} className="rounded-md font-medium">{wh.code} - {wh.name}</SelectItem>
                                                        ))}
                                                    </SelectContent>
                                                </Select>
                                            </div>
                                            <div className="space-y-1.5">
                                                <label className="text-xs font-semibold text-zinc-500">Dikerjakan Oleh (Opsional)</label>
                                                <Input value={performedBy} onChange={(e) => setPerformedBy(e.target.value)} placeholder="Nama / ID Staff" className="border border-border rounded-md h-10 font-medium" />
                                            </div>
                                            <Button onClick={reportProduction} disabled={updating} className="w-full bg-slate-900 text-white rounded-md border border-border shadow-sm hover:shadow-none transition-all font-semibold h-10">
                                                {updating ? 'Posting...' : 'Simpan Laporan'}
                                            </Button>
                                        </div>
                                    </DialogContent>
                                </Dialog>

                                <div className="grid grid-cols-3 gap-2">
                                    <Button
                                        variant="outline"
                                        className="border border-border rounded-md font-bold text-xs h-10 hover:bg-zinc-100"
                                        disabled={selectedSPK.status !== 'PLANNED' || updating}
                                        onClick={() => runTransition('IN_PROGRESS')}
                                    >
                                        Mulai
                                    </Button>
                                    <Button
                                        variant="outline"
                                        className="border border-border rounded-md font-bold text-xs h-10 hover:bg-zinc-100 text-amber-700"
                                        disabled={selectedSPK.status !== 'IN_PROGRESS' || updating}
                                        onClick={() => runTransition('ON_HOLD')}
                                    >
                                        Tunda
                                    </Button>
                                    <Button
                                        variant="outline"
                                        className="border border-border rounded-md font-bold text-xs h-10 hover:bg-zinc-100 text-emerald-700"
                                        disabled={selectedSPK.status !== 'IN_PROGRESS' || updating}
                                        onClick={() => runTransition('COMPLETED')}
                                    >
                                        Selesai
                                    </Button>
                                </div>
                            </div>
                        )}
                    </SheetContent>
                </Sheet>

                <CreateWorkOrderDialog
                    open={createOpen}
                    onOpenChange={setCreateOpen}
                    onCreated={fetchWorkOrders}
                    orderType="SPK"
                />

                {selectedSPK && (
                    <ShortageDialog
                        workOrderId={selectedSPK.id}
                        open={shortageDialogOpen}
                        onOpenChange={setShortageDialogOpen}
                        onPRCreated={refreshSelectedWorkOrder}
                    />
                )}
            </div>
        </div>
    );
}

function InfoItem({ icon: Icon, label, value }: { icon: any; label: string; value: string }) {
    return (
        <div className="border border-border p-3 bg-white shadow-sm">
            <div className="flex items-center gap-2 text-zinc-400 mb-1">
                <Icon className="h-4 w-4" />
                <span className="text-xs font-semibold  ">{label}</span>
            </div>
            <p className="font-bold truncate text-sm text-zinc-900">{value}</p>
        </div>
    );
}
