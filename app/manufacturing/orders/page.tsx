"use client";

import { useEffect, useState } from "react";
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
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Card, CardContent } from "@/components/ui/card";
import {
    Sheet,
    SheetContent,
    SheetHeader,
    SheetTitle,
    SheetDescription,
} from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
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
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { toast } from "sonner";
import { CreateWorkOrderDialog } from "@/components/manufacturing/create-work-order-dialog";

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

export default function ProductionOrdersPage() {
    const [workOrders, setWorkOrders] = useState<WorkOrder[]>([]);
    const [summary, setSummary] = useState<Summary>({ planned: 0, inProgress: 0, completed: 0, onHold: 0 });
    const [loading, setLoading] = useState(true);
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
        setLoading(true);
        setError(null);
        try {
            const params = new URLSearchParams();
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
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchWorkOrders();
    }, [statusFilter]);

    // Debounced search
    useEffect(() => {
        const timer = setTimeout(() => {
            fetchWorkOrders();
        }, 300);
        return () => clearTimeout(timer);
    }, [searchQuery]);

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

    const getStatusBadge = (status: string) => {
        switch (status) {
            case 'PLANNED':
                return <Badge variant="secondary" className="bg-slate-100 text-slate-700 border-black">Planned</Badge>;
            case 'IN_PROGRESS':
                return <Badge className="bg-yellow-100 text-yellow-800 border-black">In Progress</Badge>;
            case 'COMPLETED':
                return <Badge className="bg-emerald-100 text-emerald-800 border-black">Completed</Badge>;
            case 'ON_HOLD':
                return <Badge variant="destructive" className="border-black">On Hold</Badge>;
            case 'CANCELLED':
                return <Badge variant="outline" className="border-black text-muted-foreground">Cancelled</Badge>;
            default:
                return <Badge variant="outline">{status}</Badge>;
        }
    };

    return (
        <div className="mf-page">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="mf-title">Production Orders</h2>
                    <p className="text-muted-foreground">Kelola dan lacak semua order produksi.</p>
                </div>
                <div className="flex gap-2">
                    <Button
                        variant="outline"
                        size="icon"
                        onClick={fetchWorkOrders}
                        disabled={loading}
                        className="border-black"
                    >
                        <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
                    </Button>
                    <Button
                        className="bg-black text-white hover:bg-zinc-800 border border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] uppercase font-bold tracking-wide"
                        onClick={() => setCreateOpen(true)}
                    >
                        <Plus className="mr-2 h-4 w-4" /> New Order
                    </Button>
                </div>
            </div>

            {/* Summary Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <SummaryCard label="Planned" value={summary.planned} color="text-slate-600" />
                <SummaryCard label="In Progress" value={summary.inProgress} color="text-yellow-600" />
                <SummaryCard label="Completed" value={summary.completed} color="text-emerald-600" />
                <SummaryCard label="On Hold" value={summary.onHold} color="text-red-600" />
            </div>

            {/* Filter Bar */}
            <div className="flex items-center gap-4 py-2">
                <div className="relative flex-1 max-w-sm">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                        placeholder="Search by order # or product..."
                        className="pl-9 border-black/20"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                    />
                </div>
                <div className="flex gap-2">
                    {['All', 'PLANNED', 'IN_PROGRESS', 'COMPLETED', 'ON_HOLD'].map((filter) => (
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
                            {filter === 'All' ? 'All' : filter.split('_').map(w => w.charAt(0) + w.slice(1).toLowerCase()).join(' ')}
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
                        <Button variant="outline" size="sm" onClick={fetchWorkOrders} className="ml-auto">
                            Retry
                        </Button>
                    </CardContent>
                </Card>
            )}

            {/* Loading State */}
            {loading && (
                <Card className="border border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
                    <Table>
                        <TableHeader>
                            <TableRow className="border-b-2 border-black">
                                <TableHead>Order #</TableHead>
                                <TableHead>Product</TableHead>
                                <TableHead>Quantity</TableHead>
                                <TableHead>Status</TableHead>
                                <TableHead>Progress</TableHead>
                                <TableHead>Due Date</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {[1, 2, 3, 4, 5].map((i) => (
                                <TableRow key={i}>
                                    <TableCell><Skeleton className="h-5 w-24" /></TableCell>
                                    <TableCell><Skeleton className="h-5 w-40" /></TableCell>
                                    <TableCell><Skeleton className="h-5 w-16" /></TableCell>
                                    <TableCell><Skeleton className="h-5 w-20" /></TableCell>
                                    <TableCell><Skeleton className="h-5 w-32" /></TableCell>
                                    <TableCell><Skeleton className="h-5 w-20" /></TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </Card>
            )}

            {/* Empty State */}
            {!loading && !error && workOrders.length === 0 && (
                <Card className="border-dashed border-2 border-zinc-300">
                    <CardContent className="p-12 flex flex-col items-center justify-center text-center">
                        <Factory className="h-12 w-12 text-zinc-300 mb-4" />
                        <h3 className="text-lg font-bold text-zinc-600">No production orders found</h3>
                        <p className="text-sm text-muted-foreground mt-1">
                            {searchQuery || statusFilter
                                ? 'Try adjusting your search or filter criteria.'
                                : 'Create your first production order to get started.'}
                        </p>
                        <Button className="mt-4 bg-black text-white" onClick={() => setCreateOpen(true)}>
                            <Plus className="mr-2 h-4 w-4" /> New Order
                        </Button>
                    </CardContent>
                </Card>
            )}

            {/* Orders Table */}
            {!loading && !error && workOrders.length > 0 && (
                <Card className="border border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] overflow-hidden">
                    <Table>
                        <TableHeader>
                            <TableRow className="border-b-2 border-black bg-zinc-50">
                                <TableHead className="font-black uppercase text-[11px] tracking-wide">Order #</TableHead>
                                <TableHead className="font-black uppercase text-[11px] tracking-wide">Product</TableHead>
                                <TableHead className="font-black uppercase text-[11px] tracking-wide text-center">Quantity</TableHead>
                                <TableHead className="font-black uppercase text-[11px] tracking-wide">Status</TableHead>
                                <TableHead className="font-black uppercase text-[11px] tracking-wide">Progress</TableHead>
                                <TableHead className="font-black uppercase text-[11px] tracking-wide">Due Date</TableHead>
                                <TableHead className="w-12"></TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {workOrders.map((order) => (
                                <TableRow
                                    key={order.id}
                                    className="cursor-pointer hover:bg-zinc-50 transition-colors border-b border-black/10"
                                    onClick={() => handleRowClick(order)}
                                >
                                    <TableCell className="font-mono font-bold text-sm">{order.number}</TableCell>
                                    <TableCell>
                                        <div>
                                            <div className="font-bold text-sm">{order.product.name}</div>
                                            <div className="text-xs text-muted-foreground font-mono">{order.product.code}</div>
                                        </div>
                                    </TableCell>
                                    <TableCell className="text-center">
                                        <span className="font-bold">{order.actualQty}</span>
                                        <span className="text-muted-foreground">/{order.plannedQty}</span>
                                        <span className="text-xs ml-1 text-muted-foreground">{order.product.unit}</span>
                                    </TableCell>
                                    <TableCell>{getStatusBadge(order.status)}</TableCell>
                                    <TableCell>
                                        <div className="flex items-center gap-2">
                                            <Progress
                                                value={order.progress}
                                                className="h-2 w-20 border border-black/10 bg-zinc-100"
                                                indicatorClassName={order.progress >= 100 ? 'bg-emerald-500' : 'bg-black'}
                                            />
                                            <span className="text-xs font-bold w-8">{order.progress}%</span>
                                        </div>
                                    </TableCell>
                                    <TableCell className="text-sm">
                                        {formatDate(order.dueDate)}
                                    </TableCell>
                                    <TableCell>
                                        <ChevronRight className="h-4 w-4 text-muted-foreground" />
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </Card>
            )}

            {/* Detail Sheet */}
            <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
                <SheetContent className="sm:max-w-lg">
                    <SheetHeader>
                        <SheetTitle className="font-black text-2xl">{selectedOrder?.number}</SheetTitle>
                        <SheetDescription>{selectedOrder?.product.name}</SheetDescription>
                    </SheetHeader>

                    {selectedOrder && (
                        <div className="mt-6 space-y-6">
                            {/* Status & Progress */}
                            <div className="flex items-center justify-between">
                                {getStatusBadge(selectedOrder.status)}
                                <span className="text-2xl font-black">{selectedOrder.progress}%</span>
                            </div>
                            <Progress
                                value={selectedOrder.progress}
                                className="h-4 border border-black bg-zinc-100"
                                indicatorClassName={selectedOrder.progress >= 100 ? 'bg-emerald-500' : 'bg-black'}
                            />

                            {/* Key Info */}
                            <div className="grid grid-cols-2 gap-4">
                                <InfoCard
                                    icon={Package}
                                    label="Quantity"
                                    value={`${selectedOrder.actualQty} / ${selectedOrder.plannedQty} ${selectedOrder.product.unit}`}
                                />
                                <InfoCard
                                    icon={Calendar}
                                    label="Due Date"
                                    value={formatDate(selectedOrder.dueDate)}
                                />
                                <InfoCard
                                    icon={Calendar}
                                    label="Start Date"
                                    value={formatDate(selectedOrder.startDate)}
                                />
                                <InfoCard
                                    icon={User}
                                    label="Workers"
                                    value={selectedOrder.workers.length > 0 ? selectedOrder.workers.join(', ') : 'Not assigned'}
                                />
                            </div>

                            {/* Actions */}
                            <div className="pt-4 border-t flex gap-2">
                                <Dialog open={progressDialogOpen} onOpenChange={setProgressDialogOpen}>
                                    <DialogTrigger asChild>
                                        <Button
                                            className="flex-1 bg-black text-white hover:bg-zinc-800"
                                            disabled={selectedOrder.status !== 'IN_PROGRESS' || updating}
                                        >
                                            Update Progress
                                        </Button>
                                    </DialogTrigger>
                                    <DialogContent>
                                        <DialogHeader>
                                            <DialogTitle>Report Production</DialogTitle>
                                            <DialogDescription>Post produksi aktual untuk order ini dan sinkronkan inventory + finance.</DialogDescription>
                                        </DialogHeader>
                                        <div className="space-y-3">
                                            <div className="space-y-1.5">
                                                <label className="text-sm font-medium">Quantity Produced</label>
                                                <Input
                                                    type="number"
                                                    min={1}
                                                    max={Math.max(1, selectedOrder.plannedQty - selectedOrder.actualQty)}
                                                    value={reportQty}
                                                    onChange={(e) => setReportQty(e.target.value)}
                                                    placeholder="Masukkan qty produksi"
                                                />
                                            </div>
                                            <div className="space-y-1.5">
                                                <label className="text-sm font-medium">Warehouse</label>
                                                <Select value={warehouseId} onValueChange={setWarehouseId}>
                                                    <SelectTrigger>
                                                        <SelectValue placeholder="Select warehouse" />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        {warehouseOptions.map((wh) => (
                                                            <SelectItem key={wh.id} value={wh.id}>{wh.code} - {wh.name}</SelectItem>
                                                        ))}
                                                    </SelectContent>
                                                </Select>
                                            </div>
                                            <div className="space-y-1.5">
                                                <label className="text-sm font-medium">Performed By (optional)</label>
                                                <Input value={performedBy} onChange={(e) => setPerformedBy(e.target.value)} placeholder="Operator name / user id" />
                                            </div>
                                            <Button onClick={reportProduction} disabled={updating} className="w-full">
                                                {updating ? 'Posting...' : 'Post Production'}
                                            </Button>
                                        </div>
                                    </DialogContent>
                                </Dialog>
                                <Button
                                    variant="outline"
                                    className="border-black"
                                    disabled={selectedOrder.status !== 'PLANNED' || updating}
                                    onClick={() => runTransition('IN_PROGRESS')}
                                >
                                    Start
                                </Button>
                                <Button
                                    variant="outline"
                                    className="border-black"
                                    disabled={selectedOrder.status !== 'IN_PROGRESS' || updating}
                                    onClick={() => runTransition('ON_HOLD')}
                                >
                                    Hold
                                </Button>
                                <Button
                                    variant="outline"
                                    className="border-black"
                                    disabled={selectedOrder.status !== 'IN_PROGRESS' || updating}
                                    onClick={() => runTransition('COMPLETED')}
                                >
                                    Complete
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
            />
        </div>
    );
}

function SummaryCard({ label, value, color }: { label: string; value: number; color: string }) {
    return (
        <Card className="border border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
            <CardContent className="p-4">
                <p className="text-xs font-bold text-muted-foreground uppercase tracking-wide">{label}</p>
                <p className={`text-3xl font-black ${color}`}>{value}</p>
            </CardContent>
        </Card>
    );
}

function InfoCard({ icon: Icon, label, value }: { icon: any; label: string; value: string }) {
    return (
        <div className="border border-black/10 rounded-lg p-3">
            <div className="flex items-center gap-2 text-muted-foreground mb-1">
                <Icon className="h-4 w-4" />
                <span className="text-xs font-bold uppercase">{label}</span>
            </div>
            <p className="font-bold truncate">{value}</p>
        </div>
    );
}
