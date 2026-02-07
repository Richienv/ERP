"use client";

import { useEffect, useState } from "react";
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
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";

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

export default function PlanningPage() {
    const [weeklySchedule, setWeeklySchedule] = useState<WeekSchedule[]>([]);
    const [workOrders, setWorkOrders] = useState<WorkOrder[]>([]);
    const [machines, setMachines] = useState<Machine[]>([]);
    const [summary, setSummary] = useState<Summary | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const fetchPlanningData = async () => {
        setLoading(true);
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
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchPlanningData();
    }, []);

    const formatDate = (dateStr: string) => {
        return new Date(dateStr).toLocaleDateString('id-ID', {
            day: '2-digit',
            month: 'short',
        });
    };

    const getStatusBadge = (status: string) => {
        switch (status) {
            case 'PLANNED':
                return <Badge variant="secondary" className="text-[10px] border-black">Planned</Badge>;
            case 'IN_PROGRESS':
                return <Badge className="bg-yellow-100 text-yellow-800 text-[10px] border-black">In Progress</Badge>;
            case 'COMPLETED':
                return <Badge className="bg-emerald-100 text-emerald-800 text-[10px] border-black">Done</Badge>;
            default:
                return <Badge variant="outline" className="text-[10px]">{status}</Badge>;
        }
    };

    return (
        <div className="flex-1 space-y-4 p-4 md:p-8 pt-6 font-sans">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-3xl font-black font-serif tracking-tight">Production Planning</h2>
                    <p className="text-muted-foreground">Master Production Schedule (MPS) dan kapasitas.</p>
                </div>
                <Button
                    variant="outline"
                    size="icon"
                    onClick={fetchPlanningData}
                    disabled={loading}
                    className="border-black"
                >
                    <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
                </Button>
            </div>

            {/* Error State */}
            {error && (
                <Card className="border-red-300 bg-red-50">
                    <CardContent className="p-4 flex items-center gap-3 text-red-700">
                        <AlertCircle className="h-5 w-5" />
                        <span>{error}</span>
                        <Button variant="outline" size="sm" onClick={fetchPlanningData} className="ml-auto">
                            Retry
                        </Button>
                    </CardContent>
                </Card>
            )}

            {/* Summary Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {loading ? (
                    <>
                        {[1, 2, 3, 4].map(i => (
                            <Card key={i} className="border border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
                                <CardContent className="p-4">
                                    <Skeleton className="h-4 w-20 mb-2" />
                                    <Skeleton className="h-8 w-16" />
                                </CardContent>
                            </Card>
                        ))}
                    </>
                ) : (
                    <>
                        <SummaryCard
                            label="Planned Orders"
                            value={summary?.totalPlanned || 0}
                            icon={Calendar}
                            color="text-blue-600"
                        />
                        <SummaryCard
                            label="In Progress"
                            value={summary?.inProgress || 0}
                            icon={Factory}
                            color="text-yellow-600"
                        />
                        <SummaryCard
                            label="Avg Utilization"
                            value={`${summary?.avgUtilization || 0}%`}
                            icon={TrendingUp}
                            color={
                                (summary?.avgUtilization || 0) > 100 ? 'text-red-600' :
                                    (summary?.avgUtilization || 0) > 80 ? 'text-amber-600' : 'text-emerald-600'
                            }
                        />
                        <SummaryCard
                            label="Active Machines"
                            value={`${summary?.activeMachines || 0}/${summary?.machineCount || 0}`}
                            icon={Settings}
                            color="text-zinc-600"
                        />
                    </>
                )}
            </div>

            {/* Weekly Schedule */}
            <Card className="border border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
                <CardHeader className="border-b border-black/10 bg-zinc-50">
                    <CardTitle className="text-lg font-black uppercase">Weekly Production Schedule</CardTitle>
                </CardHeader>
                <CardContent className="p-4">
                    {loading ? (
                        <div className="grid grid-cols-4 gap-4">
                            {[1, 2, 3, 4].map(i => (
                                <div key={i} className="border rounded-lg p-4">
                                    <Skeleton className="h-5 w-16 mb-2" />
                                    <Skeleton className="h-8 w-full mb-2" />
                                    <Skeleton className="h-3 w-full" />
                                </div>
                            ))}
                        </div>
                    ) : weeklySchedule.length === 0 ? (
                        <div className="text-center py-8 text-muted-foreground">
                            <Calendar className="h-12 w-12 mx-auto mb-4 opacity-30" />
                            <p>No scheduled production for the next 4 weeks</p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                            {weeklySchedule.map((week) => (
                                <div
                                    key={week.weekNumber}
                                    className={`border-2 rounded-lg p-4 transition-all ${week.status === 'overload'
                                            ? 'border-red-500 bg-red-50'
                                            : week.status === 'high'
                                                ? 'border-amber-500 bg-amber-50'
                                                : 'border-black/20 bg-white'
                                        }`}
                                >
                                    <div className="flex justify-between items-start mb-3">
                                        <div>
                                            <p className="font-black text-lg">{week.label}</p>
                                            <p className="text-xs text-muted-foreground">
                                                {formatDate(week.weekStart)} - {formatDate(week.weekEnd)}
                                            </p>
                                        </div>
                                        {week.status === 'overload' && (
                                            <AlertTriangle className="h-5 w-5 text-red-500" />
                                        )}
                                    </div>

                                    <div className="space-y-2">
                                        <div className="flex justify-between text-sm">
                                            <span className="text-muted-foreground">Orders</span>
                                            <span className="font-bold">{week.orders}</span>
                                        </div>
                                        <div className="flex justify-between text-sm">
                                            <span className="text-muted-foreground">Planned</span>
                                            <span className="font-bold">{week.plannedQty.toLocaleString()}</span>
                                        </div>
                                        <div className="pt-2">
                                            <div className="flex justify-between text-xs mb-1">
                                                <span>Capacity</span>
                                                <span className={`font-bold ${week.utilizationPct > 100 ? 'text-red-600' :
                                                        week.utilizationPct > 80 ? 'text-amber-600' : 'text-emerald-600'
                                                    }`}>
                                                    {week.utilizationPct}%
                                                </span>
                                            </div>
                                            <Progress
                                                value={Math.min(week.utilizationPct, 100)}
                                                className="h-2 bg-zinc-100"
                                                indicatorClassName={
                                                    week.utilizationPct > 100 ? 'bg-red-500' :
                                                        week.utilizationPct > 80 ? 'bg-amber-500' : 'bg-emerald-500'
                                                }
                                            />
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* Two Column Layout: Upcoming Orders & Machine Status */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Upcoming Orders */}
                <Card className="border border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
                    <CardHeader className="border-b border-black/10 bg-zinc-50">
                        <CardTitle className="text-lg font-black uppercase flex items-center gap-2">
                            <Package className="h-5 w-5" /> Upcoming Orders
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="p-0">
                        {loading ? (
                            <div className="p-4 space-y-3">
                                {[1, 2, 3].map(i => (
                                    <Skeleton key={i} className="h-16 w-full" />
                                ))}
                            </div>
                        ) : workOrders.length === 0 ? (
                            <div className="p-8 text-center text-muted-foreground">
                                <Factory className="h-10 w-10 mx-auto mb-2 opacity-30" />
                                <p>No upcoming orders</p>
                            </div>
                        ) : (
                            <div className="divide-y divide-black/10">
                                {workOrders.slice(0, 5).map((order) => (
                                    <div key={order.id} className="p-4 hover:bg-zinc-50 transition-colors">
                                        <div className="flex justify-between items-start mb-2">
                                            <div>
                                                <p className="font-bold font-mono text-sm">{order.number}</p>
                                                <p className="text-sm text-muted-foreground">{order.product.name}</p>
                                            </div>
                                            {getStatusBadge(order.status)}
                                        </div>
                                        <div className="flex items-center gap-4 text-xs text-muted-foreground">
                                            <span>
                                                <strong className="text-black">{order.actualQty}</strong>
                                                /{order.plannedQty} {order.product.unit}
                                            </span>
                                            {order.dueDate && (
                                                <span className="flex items-center gap-1">
                                                    <Clock className="h-3 w-3" />
                                                    Due: {formatDate(order.dueDate)}
                                                </span>
                                            )}
                                        </div>
                                        <Progress
                                            value={order.progress}
                                            className="h-1.5 mt-2 bg-zinc-100"
                                            indicatorClassName={order.progress >= 100 ? 'bg-emerald-500' : 'bg-black'}
                                        />
                                    </div>
                                ))}
                            </div>
                        )}
                    </CardContent>
                </Card>

                {/* Machine Status */}
                <Card className="border border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
                    <CardHeader className="border-b border-black/10 bg-zinc-50">
                        <CardTitle className="text-lg font-black uppercase flex items-center gap-2">
                            <Settings className="h-5 w-5" /> Machine Status
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="p-0">
                        {loading ? (
                            <div className="p-4 space-y-3">
                                {[1, 2, 3].map(i => (
                                    <Skeleton key={i} className="h-12 w-full" />
                                ))}
                            </div>
                        ) : machines.length === 0 ? (
                            <div className="p-8 text-center text-muted-foreground">
                                <Settings className="h-10 w-10 mx-auto mb-2 opacity-30" />
                                <p>No machines configured</p>
                            </div>
                        ) : (
                            <div className="divide-y divide-black/10">
                                {machines.map((machine) => (
                                    <div key={machine.id} className="p-4 flex items-center justify-between hover:bg-zinc-50 transition-colors">
                                        <div className="flex items-center gap-3">
                                            <div className={`w-3 h-3 rounded-full ${machine.status === 'RUNNING' ? 'bg-emerald-500 animate-pulse' :
                                                    machine.status === 'BREAKDOWN' ? 'bg-red-500' :
                                                        machine.status === 'MAINTENANCE' ? 'bg-amber-500' :
                                                            'bg-zinc-300'
                                                }`} />
                                            <div>
                                                <p className="font-bold text-sm">{machine.name}</p>
                                                <p className="text-xs text-muted-foreground">
                                                    {machine.capacityPerHour} units/hr
                                                </p>
                                            </div>
                                        </div>
                                        <div className="text-right">
                                            <Badge
                                                variant={machine.status === 'RUNNING' ? 'default' : 'secondary'}
                                                className={`text-[10px] ${machine.status === 'RUNNING' ? 'bg-emerald-100 text-emerald-800' :
                                                        machine.status === 'BREAKDOWN' ? 'bg-red-100 text-red-800' :
                                                            'bg-zinc-100 text-zinc-600'
                                                    } border-black`}
                                            >
                                                {machine.status}
                                            </Badge>
                                            <p className="text-xs text-muted-foreground mt-1">
                                                Health: {machine.healthScore}%
                                            </p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>

            {/* Material Readiness (Summary) */}
            {!loading && summary && (
                <Card className="border border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
                    <CardHeader className="border-b border-black/10 bg-zinc-50">
                        <CardTitle className="text-lg font-black uppercase">Material Readiness</CardTitle>
                    </CardHeader>
                    <CardContent className="p-4">
                        <div className="grid grid-cols-3 gap-4">
                            <div className="text-center p-4 border rounded-lg bg-emerald-50 border-emerald-200">
                                <CheckCircle className="h-8 w-8 mx-auto text-emerald-600 mb-2" />
                                <p className="text-2xl font-black text-emerald-600">{summary.materialStatus.ready}</p>
                                <p className="text-xs text-muted-foreground uppercase font-bold">Ready</p>
                            </div>
                            <div className="text-center p-4 border rounded-lg bg-amber-50 border-amber-200">
                                <AlertTriangle className="h-8 w-8 mx-auto text-amber-600 mb-2" />
                                <p className="text-2xl font-black text-amber-600">{summary.materialStatus.partial}</p>
                                <p className="text-xs text-muted-foreground uppercase font-bold">Partial</p>
                            </div>
                            <div className="text-center p-4 border rounded-lg bg-red-50 border-red-200">
                                <AlertCircle className="h-8 w-8 mx-auto text-red-600 mb-2" />
                                <p className="text-2xl font-black text-red-600">{summary.materialStatus.notReady}</p>
                                <p className="text-xs text-muted-foreground uppercase font-bold">Not Ready</p>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            )}
        </div>
    );
}

function SummaryCard({ label, value, icon: Icon, color }: { label: string; value: string | number; icon: any; color: string }) {
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
    );
}
