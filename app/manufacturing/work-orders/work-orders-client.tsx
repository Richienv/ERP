"use client";

import { useMemo, useState } from "react";
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
    Briefcase,
    Loader2
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
    Card,
    CardContent,
    CardHeader,
    CardTitle,
    CardDescription
} from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
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
    DialogHeader,
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
    const [workOrders, setWorkOrders] = useState<WorkOrder[]>(initialOrders);
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
                toast.error(payload.error || `Gagal mengubah status ke ${toStatus}`, { className: "font-bold border-2 border-black rounded-none" });
                return;
            }
            toast.success(`Status SPK diubah ke ${toStatus}`, { className: "font-bold border-2 border-black rounded-none" });
            await refreshSelectedWorkOrder();
        } catch (err) {
            console.error(err);
            toast.error('Kesalahan jaringan saat update SPK', { className: "font-bold border-2 border-black rounded-none" });
        } finally {
            setUpdating(false);
        }
    };

    const reportProduction = async () => {
        if (!selectedSPK) return;
        const qty = Number(reportQty);
        if (!qty || qty <= 0) {
            toast.error('Jumlah produksi harus lebih dari 0', { className: "font-bold border-2 border-black rounded-none" });
            return;
        }
        if (!warehouseId) {
            toast.error('Silakan pilih gudang tujuan', { className: "font-bold border-2 border-black rounded-none" });
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
                toast.error(payload.error || 'Gagal melaporkan produksi', { className: "font-bold border-2 border-black rounded-none" });
                return;
            }
            toast.success('Produksi berhasil dilaporkan. Inventory & Finance terupdate.', { className: "font-bold border-2 border-black rounded-none" })
            setProgressDialogOpen(false);
            setReportQty("");
            await refreshSelectedWorkOrder();
        } catch (err) {
            console.error(err);
            toast.error('Network error saat posting produksi', { className: "font-bold border-2 border-black rounded-none" });
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
                return <div className="border border-red-500 text-red-600 bg-red-50 px-1.5 py-0.5 text-[9px] font-black uppercase tracking-wider animate-pulse">CRITICAL</div>;
            case 'HIGH':
                return <div className="border border-amber-500 text-amber-700 bg-amber-50 px-1.5 py-0.5 text-[9px] font-black uppercase tracking-wider">HIGH</div>;
            case 'LOW':
                return <div className="border border-zinc-300 text-zinc-500 bg-zinc-50 px-1.5 py-0.5 text-[9px] font-black uppercase tracking-wider">LOW</div>;
            default:
                return <div className="border border-blue-300 text-blue-600 bg-blue-50 px-1.5 py-0.5 text-[9px] font-black uppercase tracking-wider">NORMAL</div>;
        }
    };

    const getStatusBadge = (status: string) => {
        switch (status) {
            case 'COMPLETED':
                return (
                    <div className="flex items-center gap-1.5 px-2 py-0.5 bg-emerald-100 border border-emerald-300 text-emerald-800 shadow-[1px_1px_0px_0px_rgba(16,185,129,0.5)] text-[9px] font-black uppercase tracking-widest">
                        <CheckCircle2 className="h-3 w-3" /> SELESAI
                    </div>
                );
            case 'IN_PROGRESS':
                return (
                    <div className="flex items-center gap-1.5 px-2 py-0.5 bg-blue-100 border border-blue-300 text-blue-800 shadow-[1px_1px_0px_0px_rgba(59,130,246,0.5)] text-[9px] font-black uppercase tracking-widest">
                        <Loader2 className="h-3 w-3 animate-spin" /> PROSES
                    </div>
                );
            case 'ON_HOLD':
                return (
                    <div className="flex items-center gap-1.5 px-2 py-0.5 bg-amber-100 border border-amber-300 text-amber-800 shadow-[1px_1px_0px_0px_rgba(245,158,11,0.5)] text-[9px] font-black uppercase tracking-widest">
                        <AlertTriangle className="h-3 w-3" /> DITUNDA
                    </div>
                );
            default:
                return (
                    <div className="flex items-center gap-1.5 px-2 py-0.5 bg-zinc-100 border border-zinc-300 text-zinc-600 text-[9px] font-black uppercase tracking-widest">
                        <Clock className="h-3 w-3" /> PENDING
                    </div>
                );
        }
    };

    const handleSearchChange = (value: string) => {
        setSearchQuery(value);
        setTimeout(() => fetchWorkOrders(), 300);
    };

    const handleStatusFilter = (filter: string | null) => {
        setStatusFilter(filter);
        setTimeout(() => fetchWorkOrders(), 0);
    };

    return (
        <div className="w-full bg-zinc-50 dark:bg-black font-sans min-h-[calc(100svh-theme(spacing.16))]">
            <div className="mf-page">

                {/* Header */}
                <div className="flex-none flex items-center justify-between">
                    <div>
                        <h1 className="text-lg font-black uppercase tracking-widest text-zinc-900 dark:text-white flex items-center gap-2">
                            <ClipboardList className="h-6 w-6" />
                            Work Orders (SPK)
                        </h1>
                        <p className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider mt-1">
                            Manajemen Surat Perintah Kerja & Tracking Produksi
                        </p>
                    </div>
                    <div className="flex items-center gap-2">
                        <Button
                            variant="outline"
                            size="icon"
                            onClick={fetchWorkOrders}
                            disabled={refreshing}
                            className="h-10 w-10 border-2 border-black shadow-[3px_3px_0px_0px_rgba(0,0,0,0.3)] hover:shadow-[1px_1px_0px_0px_rgba(0,0,0,0.3)] hover:translate-x-[1px] hover:translate-y-[1px] hover:bg-zinc-100 transition-all rounded-none"
                        >
                            <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
                        </Button>
                        <Button
                            className="h-10 bg-black text-white hover:bg-zinc-800 border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,0.3)] hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-[2px_2px_0px_0px_rgba(0,0,0,0.3)] active:scale-[0.98] transition-all uppercase font-black tracking-widest text-xs rounded-none px-6"
                            onClick={() => setCreateOpen(true)}
                        >
                            <Plus className="mr-2 h-4 w-4" /> SPK Baru
                        </Button>
                    </div>
                </div>

                {/* KPI Strip */}
                <div className="flex-none bg-white dark:bg-zinc-900 border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] overflow-hidden">
                    <div className="grid grid-cols-2 md:grid-cols-4 divide-x-2 divide-black divide-y-2 md:divide-y-0">
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

                {/* Filters */}
                <div className="flex flex-col md:flex-row gap-4 items-center justify-between bg-zinc-100/50 p-2 md:p-0">
                    <div className="relative w-full md:w-96">
                        <div className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400">
                            <Search className="h-4 w-4" />
                        </div>
                        <Input
                            placeholder="Cari No SPK, Produk..."
                            className="pl-10 h-10 border-2 border-black shadow-[3px_3px_0px_0px_rgba(0,0,0,0.3)] focus-visible:ring-0 focus-visible:translate-x-[1px] focus-visible:translate-y-[1px] focus-visible:shadow-[1px_1px_0px_0px_rgba(0,0,0,0.3)] transition-all bg-white dark:bg-zinc-900 rounded-none font-medium"
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
                                    "border-2 border-black rounded-none font-bold uppercase text-[10px] tracking-wider transition-all h-9 px-4",
                                    (filter === 'All' && !statusFilter) || statusFilter === filter
                                        ? 'bg-black text-white shadow-[2px_2px_0px_0px_rgba(0,0,0,0.3)]'
                                        : 'bg-white hover:bg-zinc-100 hover:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]'
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
                    <div className="border-2 border-red-500 bg-red-50 p-4 shadow-[4px_4px_0px_0px_rgba(239,68,68,1)] flex items-center justify-between">
                        <div className="flex items-center gap-3 text-red-700 font-bold uppercase tracking-wide text-xs">
                            <AlertCircle className="h-5 w-5" />
                            <span>{error}</span>
                        </div>
                        <Button variant="outline" size="sm" onClick={fetchWorkOrders} className="bg-white border-2 border-red-500 text-red-700 hover:bg-red-100 rounded-none font-bold text-xs uppercase">
                            Coba Lagi
                        </Button>
                    </div>
                )}

                {/* Empty State */}
                {workOrders.length === 0 && !error && (
                    <div className="border-2 border-dashed border-zinc-300 min-h-[300px] flex flex-col items-center justify-center text-center bg-zinc-50/50 p-8">
                        <div className="h-16 w-16 bg-zinc-100 border-2 border-zinc-200 flex items-center justify-center mb-4 rounded-full">
                            <ClipboardList className="h-8 w-8 text-zinc-300" />
                        </div>
                        <h3 className="text-lg font-black uppercase tracking-widest text-zinc-400">Tidak ada SPK ditemukan</h3>
                        <p className="text-xs font-bold text-zinc-400 mt-2 max-w-xs">
                            {searchQuery || statusFilter
                                ? 'Coba sesuaikan kata kunci pencarian atau filter anda.'
                                : 'Mulai dengan membuat Surat Perintah Kerja pertama.'}
                        </p>
                        <Button className="mt-6 bg-black text-white rounded-none font-black uppercase tracking-wider text-xs px-6 py-5 border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:shadow-none hover:translate-x-[1px] hover:translate-y-[1px] transition-all" onClick={() => setCreateOpen(true)}>
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
                                className="group relative border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:translate-x-[2px] hover:translate-y-[2px] transition-all rounded-none bg-white dark:bg-zinc-900 overflow-hidden flex flex-col cursor-pointer"
                                onClick={() => handleCardClick(spk)}
                            >
                                {/* Header Strip */}
                                <div className="flex justify-between items-center p-3 border-b-2 border-black bg-zinc-50 dark:bg-zinc-800">
                                    <span className="text-[10px] font-black uppercase tracking-widest text-zinc-500 font-mono">
                                        {spk.number}
                                    </span>
                                    {getPriorityBadge(spk.priority)}
                                </div>

                                {/* Content */}
                                <div className="p-4 flex-1 flex flex-col gap-4">
                                    <div>
                                        <h3 className="text-sm font-black uppercase tracking-wide leading-tight line-clamp-2 min-h-[40px]">
                                            {spk.product.name}
                                        </h3>
                                        <p className="text-[10px] font-mono font-bold text-zinc-400 mt-1">{spk.product.code}</p>
                                    </div>

                                    <div className="space-y-2">
                                        <div className="flex justify-between text-[10px] font-black uppercase tracking-wider text-zinc-500">
                                            <span>Progress</span>
                                            <span>{Math.round(spk.progress)}%</span>
                                        </div>
                                        <Progress
                                            value={spk.progress}
                                            className="h-2 bg-zinc-100 rounded-none border border-black"
                                            indicatorClassName={cn(
                                                "rounded-none",
                                                spk.status === 'COMPLETED' ? 'bg-emerald-500' :
                                                    spk.progress > 50 ? 'bg-black' : 'bg-amber-500'
                                            )}
                                        />
                                    </div>

                                    <div className="grid grid-cols-2 gap-2 pt-2 border-t border-dashed border-zinc-200 mt-auto">
                                        <div className="flex flex-col">
                                            <span className="text-[9px] font-bold uppercase text-zinc-400">Status</span>
                                            {getStatusBadge(spk.status)}
                                        </div>
                                        <div className="flex flex-col">
                                            <span className="text-[9px] font-bold uppercase text-zinc-400">Due Date</span>
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
                                                    <div key={i} className="h-6 w-6 rounded-none bg-black text-white border border-white flex items-center justify-center text-[9px] font-black uppercase" title={worker}>
                                                        {worker.substring(0, 1)}
                                                    </div>
                                                ))}
                                                {spk.workers.length > 3 && (
                                                    <div className="h-6 w-6 rounded-none bg-zinc-200 text-zinc-600 border border-white flex items-center justify-center text-[9px] font-black">
                                                        +{spk.workers.length - 3}
                                                    </div>
                                                )}
                                            </div>
                                        ) : (
                                            <span className="text-[10px] italic text-zinc-400">Belum ada pekerja</span>
                                        )}
                                    </div>
                                </div>

                                {/* Footer Action */}
                                <div className="border-t-2 border-black p-2 flex items-center justify-end bg-zinc-50 dark:bg-zinc-800 group-hover:bg-zinc-100 transition-colors">
                                    <span className="text-[10px] font-black uppercase tracking-wider text-black flex items-center gap-1">
                                        Lihat Detail <ChevronRight className="h-3 w-3" />
                                    </span>
                                </div>
                            </Card>
                        ))}
                    </div>
                )}

                {/* Detail Sheet */}
                <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
                    <SheetContent className="w-full sm:max-w-xl p-0 border-l-2 border-black shadow-[-8px_0px_0px_0px_rgba(0,0,0,0.2)] rounded-none bg-white dark:bg-zinc-900 overflow-hidden flex flex-col gap-0">
                        {/* Sheet Header */}
                        <div className="bg-black text-white px-6 py-5 shrink-0 border-b-2 border-black">
                            <SheetHeader className="text-left space-y-1">
                                <div className="flex justify-between items-start">
                                    <SheetTitle className="text-lg font-black uppercase tracking-tight text-white flex items-center gap-3">
                                        <div className="h-8 w-8 bg-white text-black flex items-center justify-center border-2 border-white rounded-none">
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
                                    <div className="bg-white border-2 border-black p-4 shadow-[3px_3px_0px_0px_rgba(0,0,0,1)]">
                                        <div className="flex items-center justify-between mb-2">
                                            {getStatusBadge(selectedSPK.status)}
                                            <span className="text-2xl font-black">{Math.round(selectedSPK.progress)}%</span>
                                        </div>
                                        <Progress
                                            value={selectedSPK.progress}
                                            className="h-4 border-2 border-black bg-zinc-100 rounded-none"
                                            indicatorClassName={cn(
                                                "rounded-none",
                                                selectedSPK.progress >= 100 ? 'bg-emerald-500' : 'bg-black'
                                            )}
                                        />
                                        <div className="flex justify-between text-[10px] font-bold text-zinc-500 mt-2 uppercase tracking-wide">
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
                                            <h4 className="font-black text-xs uppercase tracking-widest text-zinc-500 mb-3">Tasks ({selectedSPK.tasks.length})</h4>
                                            <div className="space-y-2">
                                                {selectedSPK.tasks.map((task) => (
                                                    <div key={task.id} className="flex items-center justify-between p-3 bg-white border-2 border-black/10 shadow-sm">
                                                        <div className="flex items-center gap-2">
                                                            {task.status === 'COMPLETED' ? (
                                                                <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                                                            ) : (
                                                                <Clock className="h-4 w-4 text-amber-600" />
                                                            )}
                                                            <span className="text-sm font-bold">{task.name}</span>
                                                        </div>
                                                        {task.employee && (
                                                            <span className="text-[10px] bg-zinc-100 px-2 py-1 font-mono font-bold">
                                                                {task.employee.firstName}
                                                            </span>
                                                        )}
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}

                                </div>
                            </div>
                        )}

                        {/* Footer Actions */}
                        {selectedSPK && (
                            <div className="p-4 border-t-2 border-black bg-zinc-50 flex flex-col gap-3 shrink-0">
                                <Dialog open={progressDialogOpen} onOpenChange={setProgressDialogOpen}>
                                    <DialogTrigger asChild>
                                        <Button
                                            className="w-full bg-black text-white hover:bg-zinc-800 border-2 border-black shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] hover:shadow-none hover:translate-x-[2px] hover:translate-y-[2px] transition-all rounded-none font-black uppercase text-xs h-12"
                                            disabled={selectedSPK.status !== 'IN_PROGRESS' || updating}
                                        >
                                            Update Progress / Report Production
                                        </Button>
                                    </DialogTrigger>
                                    <DialogContent className="border-2 border-black rounded-none shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] p-0 bg-white">
                                        <div className="bg-black text-white px-6 py-4 border-b-2 border-black">
                                            <DialogTitle className="uppercase font-black tracking-tight text-lg">Lapor Produksi</DialogTitle>
                                            <DialogDescription className="text-zinc-400 text-xs">Post produksi aktual dan sinkronkan inventory.</DialogDescription>
                                        </div>
                                        <div className="p-6 space-y-4">
                                            <div className="space-y-1.5">
                                                <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Qty Produksi</label>
                                                <Input
                                                    type="number"
                                                    min={1}
                                                    max={Math.max(1, selectedSPK.plannedQty - selectedSPK.actualQty)}
                                                    value={reportQty}
                                                    onChange={(e) => setReportQty(e.target.value)}
                                                    placeholder="0"
                                                    className="border-2 border-black rounded-none h-10 font-bold"
                                                />
                                            </div>
                                            <div className="space-y-1.5">
                                                <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Gudang Tujuan</label>
                                                <Select value={warehouseId} onValueChange={setWarehouseId}>
                                                    <SelectTrigger className="border-2 border-black rounded-none h-10 font-bold">
                                                        <SelectValue placeholder="Pilih Gudang" />
                                                    </SelectTrigger>
                                                    <SelectContent className="rounded-none border-2 border-black">
                                                        {warehouseOptions.map((wh) => (
                                                            <SelectItem key={wh.id} value={wh.id} className="rounded-none font-medium">{wh.code} - {wh.name}</SelectItem>
                                                        ))}
                                                    </SelectContent>
                                                </Select>
                                            </div>
                                            <div className="space-y-1.5">
                                                <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Dikerjakan Oleh (Opsional)</label>
                                                <Input value={performedBy} onChange={(e) => setPerformedBy(e.target.value)} placeholder="Nama / ID Staff" className="border-2 border-black rounded-none h-10 font-medium" />
                                            </div>
                                            <Button onClick={reportProduction} disabled={updating} className="w-full bg-black text-white rounded-none border-2 border-black shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-none transition-all font-black uppercase h-10">
                                                {updating ? 'Posting...' : 'Simpan Laporan'}
                                            </Button>
                                        </div>
                                    </DialogContent>
                                </Dialog>

                                <div className="grid grid-cols-3 gap-2">
                                    <Button
                                        variant="outline"
                                        className="border-2 border-black rounded-none font-bold uppercase text-[10px] h-10 hover:bg-zinc-100"
                                        disabled={selectedSPK.status !== 'PLANNED' || updating}
                                        onClick={() => runTransition('IN_PROGRESS')}
                                    >
                                        Mulai
                                    </Button>
                                    <Button
                                        variant="outline"
                                        className="border-2 border-black rounded-none font-bold uppercase text-[10px] h-10 hover:bg-zinc-100 text-amber-700"
                                        disabled={selectedSPK.status !== 'IN_PROGRESS' || updating}
                                        onClick={() => runTransition('ON_HOLD')}
                                    >
                                        Tunda
                                    </Button>
                                    <Button
                                        variant="outline"
                                        className="border-2 border-black rounded-none font-bold uppercase text-[10px] h-10 hover:bg-zinc-100 text-emerald-700"
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
            </div>
        </div>
    );
}

function InfoItem({ icon: Icon, label, value }: { icon: any; label: string; value: string }) {
    return (
        <div className="border-2 border-black p-3 bg-white shadow-[2px_2px_0px_0px_rgba(0,0,0,0.1)]">
            <div className="flex items-center gap-2 text-zinc-400 mb-1">
                <Icon className="h-4 w-4" />
                <span className="text-[10px] font-black uppercase tracking-widest">{label}</span>
            </div>
            <p className="font-bold truncate text-sm text-zinc-900">{value}</p>
        </div>
    );
}
