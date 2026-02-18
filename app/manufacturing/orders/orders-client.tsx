"use client";

import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query-keys";
import {
    Plus,
    Search,
    ChevronRight,
    Factory,
    User,
    Calendar,
    Package,
    RefreshCw,
    AlertCircle,
    Clock,
    CheckCircle,
    Pause,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
    Sheet,
    SheetContent,
    SheetHeader,
    SheetTitle,
    SheetDescription,
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
import Link from "next/link";

interface WorkOrder {
    id: string;
    number: string;
    productId: string;
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
    progress: number;
    workers: string[];
    tasks: Array<{
        id: string;
        employee?: {
            firstName: string;
            lastName?: string;
        };
    }>;
}

interface Summary {
    planned: number;
    inProgress: number;
    completed: number;
    onHold: number;
}

interface WarehouseOption {
    id: string;
    code: string;
    name: string;
}

interface Props {
    initialOrders: WorkOrder[];
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

export function OrdersClient({ initialOrders, initialSummary }: Props) {
    const queryClient = useQueryClient();
    const [workOrders, setWorkOrders] = useState<WorkOrder[]>(initialOrders);
    const [summary, setSummary] = useState<Summary>(initialSummary);
    const [refreshing, setRefreshing] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [searchQuery, setSearchQuery] = useState("");
    const [statusFilter, setStatusFilter] = useState<string | null>(null);
    const [selectedOrder, setSelectedOrder] = useState<WorkOrder | null>(null);
    const [sheetOpen, setSheetOpen] = useState(false);
    const [progressDialogOpen, setProgressDialogOpen] = useState(false);
    const [reportQty, setReportQty] = useState("");
    const [warehouseId, setWarehouseId] = useState("");
    const [performedBy, setPerformedBy] = useState("");
    const [warehouseOptions, setWarehouseOptions] = useState<WarehouseOption[]>([]);
    const [updating, setUpdating] = useState(false);
    const [createOpen, setCreateOpen] = useState(false);

    const fetchWorkOrders = async () => {
        setRefreshing(true);
        setError(null);
        try {
            const params = new URLSearchParams();
            params.append('orderType', 'MO');
            if (searchQuery) params.append('search', searchQuery);
            if (statusFilter) params.append('status', statusFilter);

            const response = await fetch(`/api/manufacturing/work-orders?${params.toString()}`);
            const data = await response.json();

            if (data.success) {
                setWorkOrders(data.data);
                setSummary(data.summary);
            } else {
                setError(data.error || 'Failed to fetch work orders');
            }
        } catch (err) {
            setError('Network error. Please try again.');
            console.error('Error fetching work orders:', err);
        } finally {
            setRefreshing(false);
        }
    };

    const handleRowClick = async (order: WorkOrder) => {
        setSelectedOrder(order);
        setSheetOpen(true);
        try {
            const response = await fetch(`/api/manufacturing/work-orders/${order.id}`);
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

    const refreshSelectedOrder = async () => {
        if (!selectedOrder) return;
        const response = await fetch(`/api/manufacturing/work-orders/${selectedOrder.id}`);
        const payload = await response.json();
        if (payload.success) {
            const latest = payload.data;
            setSelectedOrder((prev) => prev ? {
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
        if (!selectedOrder) return;
        setUpdating(true);
        try {
            const response = await fetch(`/api/manufacturing/work-orders/${selectedOrder.id}`, {
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
                toast.error(payload.error || `Failed to transition to ${toStatus}`);
                return;
            }
            toast.success(`Work order moved to ${toStatus}`);
            queryClient.invalidateQueries({ queryKey: queryKeys.workOrders.all });
            queryClient.invalidateQueries({ queryKey: queryKeys.mfgDashboard.all });
            await refreshSelectedOrder();
        } catch (err) {
            console.error(err);
            toast.error('Network error while updating order');
        } finally {
            setUpdating(false);
        }
    };

    const reportProduction = async () => {
        if (!selectedOrder) return;
        const qty = Number(reportQty);
        if (!qty || qty <= 0) {
            toast.error('Quantity produced must be greater than 0');
            return;
        }
        if (!warehouseId) {
            toast.error('Please select a warehouse');
            return;
        }

        setUpdating(true);
        try {
            const response = await fetch(`/api/manufacturing/work-orders/${selectedOrder.id}`, {
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
                toast.error(payload.error || 'Failed to report production');
                return;
            }
            toast.success('Production reported. Inventory and finance entries posted.')
            queryClient.invalidateQueries({ queryKey: queryKeys.workOrders.all });
            queryClient.invalidateQueries({ queryKey: queryKeys.mfgDashboard.all });
            queryClient.invalidateQueries({ queryKey: queryKeys.inventoryDashboard.all });
            queryClient.invalidateQueries({ queryKey: queryKeys.products.all });
            queryClient.invalidateQueries({ queryKey: queryKeys.stockMovements.all });
            setProgressDialogOpen(false);
            setReportQty("");
            await refreshSelectedOrder();
        } catch (err) {
            console.error(err);
            toast.error('Network error while posting production');
        } finally {
            setUpdating(false);
        }
    };

    const formatDate = (dateStr: string | null | undefined) => {
        if (!dateStr) return '-';
        return new Date(dateStr).toLocaleDateString('id-ID', {
            day: '2-digit',
            month: 'short',
            year: '2-digit'
        });
    };

    const handleSearchChange = (value: string) => {
        setSearchQuery(value);
        setTimeout(() => fetchWorkOrders(), 300);
    };

    const handleStatusFilter = (filter: string | null) => {
        setStatusFilter(filter);
        setTimeout(() => fetchWorkOrders(), 0);
    };

    const filterLabels: Record<string, string> = {
        All: 'Semua',
        PLANNED: 'Planned',
        IN_PROGRESS: 'In Progress',
        COMPLETED: 'Selesai',
        ON_HOLD: 'On Hold',
    };

    return (
        <div className="mf-page">

            {/* ── Page Header ─────────────────────────────────────────── */}
            <div className="border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] overflow-hidden bg-white dark:bg-zinc-900">
                <div className="px-6 py-4 flex flex-col md:flex-row md:items-center justify-between gap-3 border-l-[6px] border-l-blue-400">
                    <div className="flex items-center gap-3">
                        <Package className="h-5 w-5 text-blue-500" />
                        <div>
                            <h1 className="text-xl font-black uppercase tracking-tight text-zinc-900 dark:text-white">
                                Order Produksi (MO)
                            </h1>
                            <p className="text-zinc-400 text-xs font-medium mt-0.5">
                                Kelola dan lacak semua order produksi
                            </p>
                        </div>
                    </div>
                    <div className="flex gap-2">
                        <Link href="/manufacturing">
                            <Button variant="outline" className="border-2 border-zinc-300 dark:border-zinc-600 font-bold uppercase text-[10px] tracking-wide h-10 px-4 hover:border-zinc-500 transition-colors">
                                <Factory className="mr-1.5 h-3.5 w-3.5" /> Dashboard
                            </Button>
                        </Link>
                        <Link href="/manufacturing/planning">
                            <Button variant="outline" className="border-2 border-zinc-300 dark:border-zinc-600 font-bold uppercase text-[10px] tracking-wide h-10 px-4 hover:border-zinc-500 transition-colors">
                                <Calendar className="mr-1.5 h-3.5 w-3.5" /> Planning
                            </Button>
                        </Link>
                        <Button
                            variant="outline"
                            onClick={fetchWorkOrders}
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

            {/* ── KPI Cards ───────────────────────────────────────────── */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                <div className="border-2 border-black shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] bg-white dark:bg-zinc-900 overflow-hidden">
                    <div className="p-4">
                        <div className="flex items-center justify-between mb-2">
                            <span className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Planned</span>
                            <Clock className="h-4 w-4 text-zinc-400" />
                        </div>
                        <div className="text-xl font-black text-zinc-900 dark:text-white">{summary.planned}</div>
                        <span className="text-[10px] text-zinc-400 font-medium mt-1 block">
                            Belum dimulai
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
                            <span className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Selesai</span>
                            <CheckCircle className="h-4 w-4 text-emerald-500" />
                        </div>
                        <div className="text-xl font-black text-emerald-600">{summary.completed}</div>
                        <span className="text-[10px] text-zinc-400 font-medium mt-1 block">
                            Bulan ini
                        </span>
                    </div>
                </div>
                <div className={`border-2 border-black shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] overflow-hidden ${summary.onHold > 0 ? 'bg-orange-50 dark:bg-orange-950/20' : 'bg-white dark:bg-zinc-900'}`}>
                    <div className="p-4">
                        <div className="flex items-center justify-between mb-2">
                            <span className="text-[10px] font-black uppercase tracking-widest text-zinc-400">On Hold</span>
                            <Pause className={`h-4 w-4 ${summary.onHold > 0 ? 'text-orange-500' : 'text-zinc-400'}`} />
                        </div>
                        <div className={`text-xl font-black ${summary.onHold > 0 ? 'text-orange-600' : 'text-zinc-900 dark:text-white'}`}>{summary.onHold}</div>
                        <span className="text-[10px] text-zinc-400 font-medium mt-1 block">
                            Ditahan
                        </span>
                    </div>
                </div>
            </div>

            {/* ── Search & Filter ─────────────────────────────────────── */}
            <div className="border-2 border-black shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] bg-white dark:bg-zinc-900 overflow-hidden">
                <div className="px-4 py-3 flex flex-col md:flex-row md:items-center gap-3">
                    <div className="flex items-center gap-3 flex-1">
                        <Search className="h-4 w-4 text-zinc-400 shrink-0" />
                        <Input
                            placeholder="Cari order # atau produk..."
                            className="border-0 shadow-none focus-visible:ring-0 px-0 text-sm font-medium placeholder:text-zinc-400"
                            value={searchQuery}
                            onChange={(e) => handleSearchChange(e.target.value)}
                        />
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                        {['All', 'PLANNED', 'IN_PROGRESS', 'COMPLETED', 'ON_HOLD'].map((filter) => (
                            <button
                                key={filter}
                                className={`text-[10px] font-bold px-2.5 py-1 border-2 transition-colors cursor-pointer ${
                                    (filter === 'All' && !statusFilter) || statusFilter === filter
                                        ? 'border-blue-500 bg-blue-500 text-white'
                                        : 'border-zinc-200 hover:border-blue-400 hover:text-blue-700 text-zinc-500'
                                }`}
                                onClick={() => handleStatusFilter(filter === 'All' ? null : filter)}
                            >
                                {filterLabels[filter]}
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            {/* ── Error State ─────────────────────────────────────────── */}
            {error && (
                <div className="border-2 border-black shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] overflow-hidden bg-red-50 dark:bg-red-950/20 border-l-[5px] border-l-red-500">
                    <div className="px-5 py-3 flex items-center gap-3">
                        <AlertCircle className="h-4 w-4 text-red-600 shrink-0" />
                        <span className="text-xs font-bold text-red-700 flex-1">{error}</span>
                        <Button
                            variant="outline"
                            onClick={fetchWorkOrders}
                            className="border-2 border-zinc-300 font-bold uppercase text-[10px] tracking-wide h-8 px-3"
                        >
                            Retry
                        </Button>
                    </div>
                </div>
            )}

            {/* ── Empty State ─────────────────────────────────────────── */}
            {workOrders.length === 0 && !error && (
                <div className="border-2 border-black border-dashed bg-white dark:bg-zinc-900 overflow-hidden">
                    <div className="py-16 flex flex-col items-center justify-center text-center px-4">
                        <Factory className="h-10 w-10 text-zinc-300 mb-4" />
                        <h3 className="text-sm font-black uppercase tracking-wide text-zinc-600 dark:text-zinc-300">
                            {searchQuery || statusFilter ? 'Tidak ada order ditemukan' : 'Belum ada order produksi'}
                        </h3>
                        <p className="text-[11px] text-zinc-400 mt-1">
                            {searchQuery || statusFilter
                                ? 'Coba ubah kata pencarian atau filter.'
                                : 'Buat order produksi pertama untuk memulai.'}
                        </p>
                        {!searchQuery && !statusFilter && (
                            <Button
                                className="mt-4 bg-blue-500 text-white hover:bg-blue-600 border-2 border-blue-600 font-black uppercase text-[10px] tracking-wide h-10 px-5 shadow-[3px_3px_0px_0px_rgba(0,0,0,0.2)] active:shadow-none active:translate-y-[1px] transition-all"
                                onClick={() => setCreateOpen(true)}
                            >
                                <Plus className="h-3.5 w-3.5 mr-1.5" /> Buat Order
                            </Button>
                        )}
                    </div>
                </div>
            )}

            {/* ── Orders List ─────────────────────────────────────────── */}
            {workOrders.length > 0 && (
                <div className="border-2 border-black shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] bg-white dark:bg-zinc-900 overflow-hidden">
                    <div className="bg-blue-50 dark:bg-blue-950/20 px-5 py-2.5 border-b-2 border-black flex items-center justify-between border-l-[5px] border-l-blue-400">
                        <div className="flex items-center gap-2">
                            <Package className="h-4 w-4 text-blue-600" />
                            <h3 className="text-[11px] font-black uppercase tracking-widest text-zinc-700 dark:text-zinc-200">
                                Daftar Order
                            </h3>
                            <span className="bg-blue-500 text-white text-[10px] font-black px-2 py-0.5 min-w-[20px] text-center">
                                {workOrders.length}
                            </span>
                        </div>
                    </div>

                    {/* Table Header */}
                    <div className="hidden md:grid grid-cols-12 gap-2 px-4 py-2 border-b border-zinc-200 dark:border-zinc-700 bg-zinc-50/50 dark:bg-zinc-800/30">
                        <span className="col-span-2 text-[10px] font-black uppercase tracking-widest text-zinc-400">Order #</span>
                        <span className="col-span-3 text-[10px] font-black uppercase tracking-widest text-zinc-400">Produk</span>
                        <span className="col-span-2 text-[10px] font-black uppercase tracking-widest text-zinc-400 text-center">Qty</span>
                        <span className="col-span-2 text-[10px] font-black uppercase tracking-widest text-zinc-400">Status</span>
                        <span className="col-span-2 text-[10px] font-black uppercase tracking-widest text-zinc-400">Progress</span>
                        <span className="col-span-1 text-[10px] font-black uppercase tracking-widest text-zinc-400">Due</span>
                    </div>

                    {/* Rows */}
                    <div className="divide-y divide-zinc-100 dark:divide-zinc-800">
                        {workOrders.map((order, idx) => {
                            const cfg = statusLabel(order.status);
                            return (
                                <div
                                    key={order.id}
                                    className={`px-4 py-3 cursor-pointer hover:bg-zinc-50/80 dark:hover:bg-zinc-800/30 transition-colors ${idx % 2 === 0 ? '' : 'bg-zinc-50/50 dark:bg-zinc-800/10'}`}
                                    onClick={() => handleRowClick(order)}
                                >
                                    {/* Desktop */}
                                    <div className="hidden md:grid grid-cols-12 gap-2 items-center">
                                        <span className="col-span-2 font-mono text-xs font-bold text-zinc-900 dark:text-zinc-100">
                                            {order.number}
                                        </span>
                                        <div className="col-span-3 min-w-0">
                                            <span className="text-xs font-bold text-zinc-900 dark:text-zinc-100 block truncate">{order.product.name}</span>
                                            <span className="text-[10px] font-mono text-zinc-400">{order.product.code}</span>
                                        </div>
                                        <div className="col-span-2 text-center">
                                            <span className="text-xs font-black text-zinc-900 dark:text-white">{order.actualQty}</span>
                                            <span className="text-[10px] text-zinc-400">/{order.plannedQty} {order.product.unit}</span>
                                        </div>
                                        <div className="col-span-2">
                                            <span className={`inline-flex items-center gap-1 text-[9px] font-black uppercase tracking-wide px-2 py-0.5 border whitespace-nowrap ${cfg.bg} ${cfg.text}`}>
                                                <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
                                                {cfg.label}
                                            </span>
                                        </div>
                                        <div className="col-span-2 flex items-center gap-2">
                                            <div className="w-16 h-1.5 bg-zinc-200 dark:bg-zinc-700">
                                                <div
                                                    className={`h-full ${order.progress >= 100 ? 'bg-emerald-500' : 'bg-blue-500'}`}
                                                    style={{ width: `${Math.min(order.progress, 100)}%` }}
                                                />
                                            </div>
                                            <span className="text-[10px] font-black text-zinc-600 dark:text-zinc-300 w-8">{order.progress}%</span>
                                        </div>
                                        <div className="col-span-1 flex items-center justify-between">
                                            <span className="text-[10px] text-zinc-400">{formatDate(order.dueDate)}</span>
                                            <ChevronRight className="h-3.5 w-3.5 text-zinc-400" />
                                        </div>
                                    </div>

                                    {/* Mobile */}
                                    <div className="md:hidden space-y-2">
                                        <div className="flex items-center justify-between gap-2">
                                            <div className="flex items-center gap-2 min-w-0">
                                                <span className="font-mono text-xs font-bold text-zinc-900 dark:text-zinc-100">{order.number}</span>
                                                <span className={`inline-flex items-center gap-1 text-[9px] font-black uppercase tracking-wide px-2 py-0.5 border whitespace-nowrap ${cfg.bg} ${cfg.text}`}>
                                                    <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
                                                    {cfg.label}
                                                </span>
                                            </div>
                                            <ChevronRight className="h-3.5 w-3.5 text-zinc-400 shrink-0" />
                                        </div>
                                        <span className="text-[11px] text-zinc-400 block truncate">{order.product.name}</span>
                                        <div className="flex items-center gap-2">
                                            <div className="flex-1 h-1.5 bg-zinc-200 dark:bg-zinc-700">
                                                <div
                                                    className={`h-full ${order.progress >= 100 ? 'bg-emerald-500' : 'bg-blue-500'}`}
                                                    style={{ width: `${Math.min(order.progress, 100)}%` }}
                                                />
                                            </div>
                                            <span className="text-[10px] font-black text-zinc-600 dark:text-zinc-300">
                                                {order.actualQty}/{order.plannedQty} ({order.progress}%)
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

            {/* ── Detail Sheet ─────────────────────────────────────────── */}
            <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
                <SheetContent className="sm:max-w-lg overflow-y-auto border-l-2 border-black rounded-none p-0">
                    {selectedOrder && (
                        <>
                            {/* Sheet Header */}
                            <div className="px-6 py-4 border-b-2 border-black border-l-[5px] border-l-blue-400 bg-blue-50 dark:bg-blue-950/20">
                                <SheetHeader className="space-y-0">
                                    <SheetTitle className="flex items-center gap-2 text-sm font-black uppercase tracking-wide">
                                        <Package className="h-4 w-4 text-blue-600" />
                                        {selectedOrder.number}
                                    </SheetTitle>
                                    <SheetDescription className="text-[11px] text-zinc-400 ml-6">
                                        {selectedOrder.product.name}
                                    </SheetDescription>
                                </SheetHeader>
                            </div>

                            <div className="p-6 space-y-5">
                                {/* Status + Progress */}
                                <div className="flex items-center justify-between">
                                    {(() => {
                                        const cfg = statusLabel(selectedOrder.status);
                                        return (
                                            <span className={`inline-flex items-center gap-1 text-[9px] font-black uppercase tracking-wide px-2 py-0.5 border whitespace-nowrap ${cfg.bg} ${cfg.text}`}>
                                                <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
                                                {cfg.label}
                                            </span>
                                        );
                                    })()}
                                    <span className="text-2xl font-black text-zinc-900 dark:text-white">{selectedOrder.progress}%</span>
                                </div>
                                <div className="w-full h-3 bg-zinc-200 dark:bg-zinc-700 border border-black/10">
                                    <div
                                        className={`h-full transition-all ${selectedOrder.progress >= 100 ? 'bg-emerald-500' : 'bg-blue-500'}`}
                                        style={{ width: `${Math.min(selectedOrder.progress, 100)}%` }}
                                    />
                                </div>

                                {/* Info Grid */}
                                <div className="grid grid-cols-2 gap-3">
                                    <div className="border-2 border-zinc-200 bg-zinc-50 dark:bg-zinc-800/50 p-3">
                                        <div className="flex items-center gap-2 mb-1">
                                            <Package className="h-3.5 w-3.5 text-zinc-400" />
                                            <span className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Quantity</span>
                                        </div>
                                        <p className="text-sm font-black text-zinc-900 dark:text-white">
                                            {selectedOrder.actualQty} / {selectedOrder.plannedQty} {selectedOrder.product.unit}
                                        </p>
                                    </div>
                                    <div className="border-2 border-zinc-200 bg-zinc-50 dark:bg-zinc-800/50 p-3">
                                        <div className="flex items-center gap-2 mb-1">
                                            <Calendar className="h-3.5 w-3.5 text-zinc-400" />
                                            <span className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Due Date</span>
                                        </div>
                                        <p className="text-sm font-black text-zinc-900 dark:text-white">{formatDate(selectedOrder.dueDate)}</p>
                                    </div>
                                    <div className="border-2 border-zinc-200 bg-zinc-50 dark:bg-zinc-800/50 p-3">
                                        <div className="flex items-center gap-2 mb-1">
                                            <Calendar className="h-3.5 w-3.5 text-zinc-400" />
                                            <span className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Start Date</span>
                                        </div>
                                        <p className="text-sm font-black text-zinc-900 dark:text-white">{formatDate(selectedOrder.startDate)}</p>
                                    </div>
                                    <div className="border-2 border-zinc-200 bg-zinc-50 dark:bg-zinc-800/50 p-3">
                                        <div className="flex items-center gap-2 mb-1">
                                            <User className="h-3.5 w-3.5 text-zinc-400" />
                                            <span className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Workers</span>
                                        </div>
                                        <p className="text-sm font-bold text-zinc-900 dark:text-white truncate">
                                            {selectedOrder.workers.length > 0 ? selectedOrder.workers.join(', ') : 'Belum ditugaskan'}
                                        </p>
                                    </div>
                                </div>

                                {/* Actions */}
                                <div className="pt-4 border-t-2 border-black/10 space-y-3">
                                    <div className="flex gap-2">
                                        <Dialog open={progressDialogOpen} onOpenChange={setProgressDialogOpen}>
                                            <DialogTrigger asChild>
                                                <Button
                                                    className="flex-1 bg-blue-500 text-white hover:bg-blue-600 border-2 border-blue-600 font-black uppercase text-[10px] tracking-wide h-10 shadow-[3px_3px_0px_0px_rgba(0,0,0,0.2)] active:shadow-none active:translate-y-[1px] transition-all"
                                                    disabled={selectedOrder.status !== 'IN_PROGRESS' || updating}
                                                >
                                                    Update Progress
                                                </Button>
                                            </DialogTrigger>
                                            <DialogContent className="border-2 border-black rounded-none shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
                                                <DialogHeader>
                                                    <DialogTitle className="text-sm font-black uppercase tracking-wide">Report Production</DialogTitle>
                                                    <DialogDescription className="text-[11px] text-zinc-400">
                                                        Post produksi aktual dan sinkronkan inventory + finance.
                                                    </DialogDescription>
                                                </DialogHeader>
                                                <div className="space-y-3 mt-2">
                                                    <div className="space-y-1.5">
                                                        <label className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Quantity Produced</label>
                                                        <Input
                                                            type="number"
                                                            min={1}
                                                            max={Math.max(1, selectedOrder.plannedQty - selectedOrder.actualQty)}
                                                            value={reportQty}
                                                            onChange={(e) => setReportQty(e.target.value)}
                                                            placeholder="Masukkan qty produksi"
                                                            className="border-2 border-black"
                                                        />
                                                    </div>
                                                    <div className="space-y-1.5">
                                                        <label className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Warehouse</label>
                                                        <Select value={warehouseId} onValueChange={setWarehouseId}>
                                                            <SelectTrigger className="border-2 border-black">
                                                                <SelectValue placeholder="Pilih gudang" />
                                                            </SelectTrigger>
                                                            <SelectContent>
                                                                {warehouseOptions.map((wh) => (
                                                                    <SelectItem key={wh.id} value={wh.id}>{wh.code} - {wh.name}</SelectItem>
                                                                ))}
                                                            </SelectContent>
                                                        </Select>
                                                    </div>
                                                    <div className="space-y-1.5">
                                                        <label className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Performed By (opsional)</label>
                                                        <Input
                                                            value={performedBy}
                                                            onChange={(e) => setPerformedBy(e.target.value)}
                                                            placeholder="Nama operator"
                                                            className="border-2 border-black"
                                                        />
                                                    </div>
                                                    <Button
                                                        onClick={reportProduction}
                                                        disabled={updating}
                                                        className="w-full bg-blue-500 text-white hover:bg-blue-600 border-2 border-blue-600 font-black uppercase text-[10px] tracking-wide h-10 shadow-[3px_3px_0px_0px_rgba(0,0,0,0.2)] active:shadow-none active:translate-y-[1px] transition-all"
                                                    >
                                                        {updating ? 'Posting...' : 'Post Production'}
                                                    </Button>
                                                </div>
                                            </DialogContent>
                                        </Dialog>
                                    </div>
                                    <div className="flex gap-2">
                                        <Button
                                            variant="outline"
                                            className="flex-1 border-2 border-zinc-300 font-bold uppercase text-[10px] tracking-wide h-10 hover:border-zinc-500 transition-colors"
                                            disabled={selectedOrder.status !== 'PLANNED' || updating}
                                            onClick={() => runTransition('IN_PROGRESS')}
                                        >
                                            Mulai
                                        </Button>
                                        <Button
                                            variant="outline"
                                            className="flex-1 border-2 border-zinc-300 font-bold uppercase text-[10px] tracking-wide h-10 hover:border-zinc-500 transition-colors"
                                            disabled={selectedOrder.status !== 'IN_PROGRESS' || updating}
                                            onClick={() => runTransition('ON_HOLD')}
                                        >
                                            Hold
                                        </Button>
                                        <Button
                                            variant="outline"
                                            className="flex-1 border-2 border-emerald-300 text-emerald-700 font-bold uppercase text-[10px] tracking-wide h-10 hover:bg-emerald-50 hover:border-emerald-400 transition-colors"
                                            disabled={selectedOrder.status !== 'IN_PROGRESS' || updating}
                                            onClick={() => runTransition('COMPLETED')}
                                        >
                                            Selesai
                                        </Button>
                                    </div>
                                </div>
                            </div>
                        </>
                    )}
                </SheetContent>
            </Sheet>

            <CreateWorkOrderDialog
                open={createOpen}
                onOpenChange={setCreateOpen}
                onCreated={fetchWorkOrders}
                orderType="MO"
            />
        </div>
    );
}
