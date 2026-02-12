"use client";

import { useEffect, useState } from "react";
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
import { Skeleton } from "@/components/ui/skeleton";
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

export default function WorkOrdersPage() {
    const [workOrders, setWorkOrders] = useState<WorkOrder[]>([]);
    const [loading, setLoading] = useState(true);
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
                toast.error(payload.error || `Failed to transition to ${toStatus}`);
                return;
            }
            toast.success(`Work order moved to ${toStatus}`);
            await refreshSelectedWorkOrder();
        } catch (err) {
            console.error(err);
            toast.error('Network error while updating work order');
        } finally {
            setUpdating(false);
        }
    };

    const reportProduction = async () => {
        if (!selectedSPK) return;
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
                toast.error(payload.error || 'Failed to report production');
                return;
            }
            toast.success('Production reported. Inventory and finance entries posted.')
            setProgressDialogOpen(false);
            setReportQty("");
            await refreshSelectedWorkOrder();
        } catch (err) {
            console.error(err);
            toast.error('Network error while posting production');
        } finally {
            setUpdating(false);
        }
    };

    const formatDate = (dateStr: string | null | undefined) => {
        if (!dateStr) return '-';
        const date = new Date(dateStr);
        const today = new Date();
        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);

        if (date.toDateString() === today.toDateString()) {
            return `Today, ${date.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}`;
        }
        if (date.toDateString() === tomorrow.toDateString()) {
            return `Tomorrow, ${date.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}`;
        }
        return date.toLocaleDateString('id-ID', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
    };

    const getPriorityBadge = (priority: string) => {
        switch (priority.toUpperCase()) {
            case 'CRITICAL':
                return <Badge variant="destructive" className="border-black text-[10px] animate-pulse">CRITICAL</Badge>;
            case 'HIGH':
                return <Badge className="bg-amber-100 text-amber-800 border-black text-[10px]">HIGH</Badge>;
            case 'LOW':
                return <Badge variant="secondary" className="border-black text-[10px]">LOW</Badge>;
            default:
                return <Badge variant="outline" className="border-black text-[10px]">NORMAL</Badge>;
        }
    };

    const getStatusBadge = (status: string) => {
        switch (status) {
            case 'COMPLETED':
                return <Badge className="bg-emerald-100 text-emerald-800 border-black text-[10px]"><CheckCircle2 className="h-3 w-3 mr-1" />Done</Badge>;
            case 'IN_PROGRESS':
                return <Badge className="bg-yellow-100 text-yellow-800 border-black text-[10px]"><Clock className="h-3 w-3 mr-1" />In Progress</Badge>;
            case 'ON_HOLD':
                return <Badge variant="secondary" className="border-black text-[10px]"><AlertTriangle className="h-3 w-3 mr-1" />On Hold</Badge>;
            default:
                return <Badge variant="outline" className="border-black text-[10px]">Pending</Badge>;
        }
    };

    return (
        <div className="mf-page">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="mf-title">Work Orders (SPK)</h2>
                    <p className="text-muted-foreground">Tugas individu dan tracking progress per work order.</p>
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
                        <Plus className="mr-2 h-4 w-4" /> New SPK
                    </Button>
                </div>
            </div>

            {/* Filters */}
            <div className="flex items-center gap-4">
                <div className="relative flex-1 max-w-sm">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                        placeholder="Search work orders..."
                        className="pl-9 border-black/20"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                    />
                </div>
                <div className="flex gap-2">
                    {['All', 'PLANNED', 'IN_PROGRESS', 'COMPLETED'].map((filter) => (
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
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {[1, 2, 3, 4, 5, 6].map((i) => (
                        <Card key={i} className="border border-black/20">
                            <CardHeader className="pb-2">
                                <Skeleton className="h-5 w-24" />
                                <Skeleton className="h-4 w-full mt-2" />
                            </CardHeader>
                            <CardContent className="pt-2">
                                <Skeleton className="h-3 w-full mb-3" />
                                <div className="flex justify-between">
                                    <Skeleton className="h-8 w-8 rounded-full" />
                                    <Skeleton className="h-5 w-16" />
                                </div>
                            </CardContent>
                        </Card>
                    ))}
                </div>
            )}

            {/* Empty State */}
            {!loading && !error && workOrders.length === 0 && (
                <Card className="border-dashed border-2 border-zinc-300">
                    <CardContent className="p-12 flex flex-col items-center justify-center text-center">
                        <ClipboardList className="h-12 w-12 text-zinc-300 mb-4" />
                        <h3 className="text-lg font-bold text-zinc-600">No work orders found</h3>
                        <p className="text-sm text-muted-foreground mt-1">
                            {searchQuery || statusFilter
                                ? 'Try adjusting your search or filter criteria.'
                                : 'Create your first work order to get started.'}
                        </p>
                        <Button className="mt-4 bg-black text-white" onClick={() => setCreateOpen(true)}>
                            <Plus className="mr-2 h-4 w-4" /> New SPK
                        </Button>
                    </CardContent>
                </Card>
            )}

            {/* Work Order Cards */}
            {!loading && !error && workOrders.length > 0 && (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {workOrders.map((spk) => (
                        <Card
                            key={spk.id}
                            className="group border border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] transition-all cursor-pointer"
                            onClick={() => handleCardClick(spk)}
                        >
                            <CardHeader className="pb-2">
                                <div className="flex justify-between items-start">
                                    <CardTitle className="text-sm font-mono font-bold">{spk.number}</CardTitle>
                                    {getPriorityBadge(spk.priority)}
                                </div>
                                <CardDescription className="font-bold text-black truncate">{spk.product.name}</CardDescription>
                            </CardHeader>
                            <CardContent className="pt-2 space-y-3">
                                {/* Progress */}
                                <div>
                                    <div className="flex justify-between text-xs mb-1">
                                        <span className="text-muted-foreground">Progress</span>
                                        <span className="font-bold">{spk.progress}%</span>
                                    </div>
                                    <Progress
                                        value={spk.progress}
                                        className="h-2 bg-zinc-100"
                                        indicatorClassName={
                                            spk.status === 'COMPLETED' ? 'bg-emerald-500' :
                                                spk.progress > 50 ? 'bg-black' : 'bg-amber-500'
                                        }
                                    />
                                </div>

                                {/* Assignee & Status */}
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        {spk.workers.length > 0 ? (
                                            <>
                                                <Avatar className="h-7 w-7 border border-black">
                                                    <AvatarFallback className="text-[10px] font-bold bg-zinc-100">
                                                        {spk.workers[0].split(' ').map(n => n[0]).join('')}
                                                    </AvatarFallback>
                                                </Avatar>
                                                <div className="text-xs">
                                                    <p className="font-bold truncate max-w-[100px]">{spk.workers[0]}</p>
                                                    {spk.workers.length > 1 && (
                                                        <p className="text-muted-foreground">+{spk.workers.length - 1} more</p>
                                                    )}
                                                </div>
                                            </>
                                        ) : (
                                            <span className="text-xs text-muted-foreground">Unassigned</span>
                                        )}
                                    </div>
                                    {getStatusBadge(spk.status)}
                                </div>

                                {/* Deadline */}
                                <div className="flex items-center gap-1 text-xs text-muted-foreground pt-2 border-t border-dashed">
                                    <Calendar className="h-3 w-3" />
                                    <span>Due: {formatDate(spk.dueDate)}</span>
                                </div>
                            </CardContent>
                        </Card>
                    ))}
                </div>
            )}

            {/* Detail Sheet */}
            <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
                <SheetContent className="sm:max-w-lg">
                    <SheetHeader>
                        <SheetTitle className="font-mono">{selectedSPK?.number}</SheetTitle>
                        <SheetDescription className="font-bold text-black text-lg">{selectedSPK?.product.name}</SheetDescription>
                    </SheetHeader>

                    {selectedSPK && (
                        <div className="mt-6 space-y-6">
                            {/* Status & Progress */}
                            <div className="flex items-center justify-between">
                                {getStatusBadge(selectedSPK.status)}
                                <span className="text-2xl font-black">{selectedSPK.progress}%</span>
                            </div>
                            <Progress
                                value={selectedSPK.progress}
                                className="h-4 border border-black bg-zinc-100"
                                indicatorClassName={selectedSPK.progress >= 100 ? 'bg-emerald-500' : 'bg-black'}
                            />

                            {/* Info Grid */}
                            <div className="grid grid-cols-2 gap-4">
                                <InfoItem
                                    icon={User}
                                    label="Assigned To"
                                    value={selectedSPK.workers.length > 0 ? selectedSPK.workers.join(', ') : 'Unassigned'}
                                />
                                <InfoItem
                                    icon={Calendar}
                                    label="Due Date"
                                    value={formatDate(selectedSPK.dueDate)}
                                />
                                <InfoItem
                                    icon={ClipboardList}
                                    label="Quantity"
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
                                    <h4 className="font-black text-sm uppercase mb-3">Tasks ({selectedSPK.tasks.length})</h4>
                                    <div className="space-y-2">
                                        {selectedSPK.tasks.map((task) => (
                                            <div key={task.id} className="flex items-center justify-between p-2 bg-zinc-50 rounded border">
                                                <div className="flex items-center gap-2">
                                                    {task.status === 'COMPLETED' ? (
                                                        <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                                                    ) : (
                                                        <Clock className="h-4 w-4 text-amber-600" />
                                                    )}
                                                    <span className="text-sm">{task.name}</span>
                                                </div>
                                                {task.employee && (
                                                    <span className="text-xs text-muted-foreground">
                                                        {task.employee.firstName}
                                                    </span>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Actions */}
                            <div className="pt-4 border-t flex gap-2">
                                <Dialog open={progressDialogOpen} onOpenChange={setProgressDialogOpen}>
                                    <DialogTrigger asChild>
                                        <Button
                                            className="flex-1 bg-black text-white hover:bg-zinc-800"
                                            disabled={selectedSPK.status !== 'IN_PROGRESS' || updating}
                                        >
                                            Update Progress
                                        </Button>
                                    </DialogTrigger>
                                    <DialogContent>
                                        <DialogHeader>
                                            <DialogTitle>Report Production</DialogTitle>
                                            <DialogDescription>Post produksi aktual untuk WO ini dan sinkronkan inventory + finance.</DialogDescription>
                                        </DialogHeader>
                                        <div className="space-y-3">
                                            <div className="space-y-1.5">
                                                <label className="text-sm font-medium">Quantity Produced</label>
                                                <Input
                                                    type="number"
                                                    min={1}
                                                    max={Math.max(1, selectedSPK.plannedQty - selectedSPK.actualQty)}
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
                                    disabled={selectedSPK.status !== 'PLANNED' || updating}
                                    onClick={() => runTransition('IN_PROGRESS')}
                                >
                                    Start
                                </Button>
                                <Button
                                    variant="outline"
                                    className="border-black"
                                    disabled={selectedSPK.status !== 'IN_PROGRESS' || updating}
                                    onClick={() => runTransition('ON_HOLD')}
                                >
                                    Hold
                                </Button>
                                <Button
                                    variant="outline"
                                    className="border-black"
                                    disabled={selectedSPK.status !== 'IN_PROGRESS' || updating}
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

function InfoItem({ icon: Icon, label, value }: { icon: any; label: string; value: string }) {
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
