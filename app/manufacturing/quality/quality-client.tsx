"use client";

import { useState } from "react";
import {
    Plus,
    Search,
    RefreshCw,
    AlertCircle,
    CheckCircle,
    XCircle,
    AlertTriangle,
    ClipboardCheck,
    Microscope,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import {
    Sheet,
    SheetContent,
    SheetDescription,
    SheetHeader,
    SheetTitle,
} from "@/components/ui/sheet";
import { CreateInspectionDialog } from "@/components/manufacturing/create-inspection-dialog";

interface Inspection {
    id: string;
    batchNumber: string;
    material: {
        id: string;
        code: string;
        name: string;
    };
    inspector: {
        id: string;
        firstName: string;
        lastName?: string;
    };
    workOrder?: {
        id: string;
        number: string;
    } | null;
    inspectionDate: string;
    status: string;
    score: number;
    notes?: string | null;
    defectCount: number;
    inspectorName: string;
    result: string;
    defects?: Array<{
        id: string;
        type: string;
        severity: string;
        description?: string | null;
        action?: string | null;
    }>;
}

interface Summary {
    passRate: number;
    defectCount: number;
    pendingCount: number;
    todayCount: number;
}

interface PendingInspection {
    id: string;
    number: string;
    status: string;
    priority: string;
    plannedQty: number;
    startDate?: string | null;
    dueDate?: string | null;
    createdAt: string;
    product: {
        id: string;
        code: string;
        name: string;
    };
    machine?: {
        id: string;
        code: string;
        name: string;
    } | null;
}

interface Props {
    initialInspections: Inspection[];
    initialPendingQueue: PendingInspection[];
    initialSummary: Summary;
}

export function QualityClient({ initialInspections, initialPendingQueue, initialSummary }: Props) {
    const [inspections, setInspections] = useState<Inspection[]>(initialInspections);
    const [pendingQueue, setPendingQueue] = useState<PendingInspection[]>(initialPendingQueue);
    const [summary, setSummary] = useState<Summary>(initialSummary);
    const [refreshing, setRefreshing] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [searchQuery, setSearchQuery] = useState("");
    const [statusFilter, setStatusFilter] = useState<string | null>(null);
    const [createOpen, setCreateOpen] = useState(false);
    const [selectedInspection, setSelectedInspection] = useState<Inspection | null>(null);
    const [detailOpen, setDetailOpen] = useState(false);

    const fetchInspections = async () => {
        setRefreshing(true);
        setError(null);
        try {
            const params = new URLSearchParams();
            if (searchQuery) params.append('search', searchQuery);
            if (statusFilter) params.append('status', statusFilter);

            const response = await fetch(`/api/manufacturing/quality?${params.toString()}`);
            const data = await response.json();

            if (data.success) {
                setInspections(data.data);
                setPendingQueue(data.pendingQueue || []);
                setSummary(data.summary);
            } else {
                setError(data.error || 'Failed to fetch inspections');
            }
        } catch (err) {
            setError('Network error. Please try again.');
            console.error('Error fetching inspections:', err);
        } finally {
            setRefreshing(false);
        }
    };

    const handleSearchChange = (value: string) => {
        setSearchQuery(value);
        setTimeout(() => fetchInspections(), 300);
    };

    const handleStatusFilter = (filter: string | null) => {
        setStatusFilter(filter);
        setTimeout(() => fetchInspections(), 0);
    };

    const handleRowClick = (insp: Inspection) => {
        setSelectedInspection(insp);
        setDetailOpen(true);
    };

    const formatDate = (dateStr: string) => {
        return new Date(dateStr).toLocaleDateString('id-ID', {
            day: '2-digit',
            month: 'short',
            year: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
        });
    };

    const getResultBadge = (result: string) => {
        switch (result) {
            case 'Pass':
                return <Badge className="bg-emerald-100 text-emerald-800 border-black"><CheckCircle className="h-3 w-3 mr-1" /> Pass</Badge>;
            case 'Fail':
                return <Badge variant="destructive" className="border-black"><XCircle className="h-3 w-3 mr-1" /> Fail</Badge>;
            case 'Conditional':
                return <Badge className="bg-amber-100 text-amber-800 border-black"><AlertTriangle className="h-3 w-3 mr-1" /> Conditional</Badge>;
            default:
                return <Badge variant="outline">{result}</Badge>;
        }
    };

    const getSeverityColor = (severity: string) => {
        switch (severity.toUpperCase()) {
            case 'CRITICAL': return 'bg-red-100 text-red-800 border-red-300';
            case 'MAJOR': return 'bg-amber-100 text-amber-800 border-amber-300';
            case 'MINOR': return 'bg-zinc-100 text-zinc-700 border-zinc-300';
            default: return 'bg-zinc-100 text-zinc-600 border-zinc-300';
        }
    };

    return (
        <div className="mf-page">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="mf-title">Quality Control</h2>
                    <p className="text-muted-foreground">Monitor inspeksi kualitas dan tracking defect.</p>
                </div>
                <div className="flex gap-2">
                    <Button
                        variant="outline"
                        size="icon"
                        onClick={fetchInspections}
                        disabled={refreshing}
                        className="border-black"
                    >
                        <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
                    </Button>
                    <Button
                        className="bg-black text-white hover:bg-zinc-800 border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] uppercase font-bold tracking-wide"
                        onClick={() => setCreateOpen(true)}
                    >
                        <Plus className="mr-2 h-4 w-4" /> New Inspection
                    </Button>
                </div>
            </div>

            {/* Summary Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <SummaryCard
                    label="Pass Rate"
                    value={`${summary.passRate}%`}
                    icon={CheckCircle}
                    color={summary.passRate >= 95 ? 'text-emerald-600' : summary.passRate >= 80 ? 'text-amber-600' : 'text-red-600'}
                />
                <SummaryCard label="Total Defects" value={String(summary.defectCount)} icon={XCircle} color="text-red-600" />
                <SummaryCard label="Pending" value={String(summary.pendingCount)} icon={ClipboardCheck} color="text-amber-600" />
                <SummaryCard label="Today" value={String(summary.todayCount)} icon={Microscope} color="text-blue-600" />
            </div>

            {/* Filter Bar */}
            <div className="flex items-center gap-4 py-2">
                <div className="relative flex-1 max-w-sm">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                        placeholder="Search by batch # or product..."
                        className="pl-9 border-2 border-black"
                        value={searchQuery}
                        onChange={(e) => handleSearchChange(e.target.value)}
                    />
                </div>
                <div className="flex gap-2">
                    {['All', 'PASS', 'FAIL', 'CONDITIONAL'].map((filter) => (
                        <Button
                            key={filter}
                            variant="outline"
                            size="sm"
                            className={`border-black transition-colors ${(filter === 'All' && !statusFilter) || statusFilter === filter
                                    ? 'bg-black text-white'
                                    : 'hover:bg-black hover:text-white'
                                }`}
                            onClick={() => handleStatusFilter(filter === 'All' ? null : filter)}
                        >
                            {filter === 'All' ? 'All Results' : filter.charAt(0) + filter.slice(1).toLowerCase()}
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
                        <Button variant="outline" size="sm" onClick={fetchInspections} className="ml-auto">
                            Retry
                        </Button>
                    </CardContent>
                </Card>
            )}

            {/* Empty State */}
            {inspections.length === 0 && pendingQueue.length === 0 && !error && (
                <Card className="border-dashed border-2 border-zinc-300">
                    <CardContent className="p-12 flex flex-col items-center justify-center text-center">
                        <ClipboardCheck className="h-12 w-12 text-zinc-300 mb-4" />
                        <h3 className="text-lg font-bold text-zinc-600">No inspections found</h3>
                        <p className="text-sm text-muted-foreground mt-1">
                            {searchQuery || statusFilter
                                ? 'Try adjusting your search or filter criteria.'
                                : 'Create your first inspection to get started.'}
                        </p>
                        <Button className="mt-4 bg-black text-white" onClick={() => setCreateOpen(true)}>
                            <Plus className="mr-2 h-4 w-4" /> New Inspection
                        </Button>
                    </CardContent>
                </Card>
            )}

            {/* Pending Inspection Queue */}
            {pendingQueue.length > 0 && (
                <Card className="border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] overflow-hidden">
                    <div className="px-4 py-3 border-b-2 border-black bg-amber-50">
                        <p className="text-sm font-black uppercase tracking-wide text-amber-900">
                            Pending Inspection Queue ({pendingQueue.length})
                        </p>
                        <p className="text-xs text-amber-800">Work orders yang belum memiliki hasil inspeksi QC.</p>
                    </div>
                    <Table>
                        <TableHeader>
                            <TableRow className="border-b-2 border-black bg-zinc-50">
                                <TableHead className="font-black uppercase text-[11px] tracking-wide">Work Order</TableHead>
                                <TableHead className="font-black uppercase text-[11px] tracking-wide">Product</TableHead>
                                <TableHead className="font-black uppercase text-[11px] tracking-wide">Status</TableHead>
                                <TableHead className="font-black uppercase text-[11px] tracking-wide">Priority</TableHead>
                                <TableHead className="font-black uppercase text-[11px] tracking-wide text-center">Planned Qty</TableHead>
                                <TableHead className="font-black uppercase text-[11px] tracking-wide">Machine</TableHead>
                                <TableHead className="font-black uppercase text-[11px] tracking-wide">Due Date</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {pendingQueue.map((wo) => (
                                <TableRow key={wo.id} className="border-b border-black/10">
                                    <TableCell className="font-mono font-bold">{wo.number}</TableCell>
                                    <TableCell>
                                        <div>
                                            <div className="font-bold text-sm">{wo.product.name}</div>
                                            <div className="text-xs text-muted-foreground font-mono">{wo.product.code}</div>
                                        </div>
                                    </TableCell>
                                    <TableCell>
                                        <Badge variant="outline" className="border-black">
                                            {wo.status.replace('_', ' ')}
                                        </Badge>
                                    </TableCell>
                                    <TableCell>
                                        <Badge className="bg-zinc-100 text-zinc-900 border-black">
                                            {wo.priority}
                                        </Badge>
                                    </TableCell>
                                    <TableCell className="text-center font-mono">{wo.plannedQty}</TableCell>
                                    <TableCell className="text-sm">
                                        {wo.machine?.name ? (
                                            <div>
                                                <div className="font-medium">{wo.machine.name}</div>
                                                <div className="text-xs text-muted-foreground font-mono">{wo.machine.code}</div>
                                            </div>
                                        ) : (
                                            <span className="text-muted-foreground">-</span>
                                        )}
                                    </TableCell>
                                    <TableCell className="text-sm text-muted-foreground">
                                        {wo.dueDate ? formatDate(wo.dueDate) : '-'}
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </Card>
            )}

            {/* Inspections Table */}
            {inspections.length > 0 && (
                <Card className="border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] overflow-hidden">
                    <Table>
                        <TableHeader>
                            <TableRow className="border-b-2 border-black bg-zinc-50">
                                <TableHead className="font-black uppercase text-[11px] tracking-wide">Batch #</TableHead>
                                <TableHead className="font-black uppercase text-[11px] tracking-wide">Product</TableHead>
                                <TableHead className="font-black uppercase text-[11px] tracking-wide">Work Order</TableHead>
                                <TableHead className="font-black uppercase text-[11px] tracking-wide">Inspector</TableHead>
                                <TableHead className="font-black uppercase text-[11px] tracking-wide">Result</TableHead>
                                <TableHead className="font-black uppercase text-[11px] tracking-wide text-center">Score</TableHead>
                                <TableHead className="font-black uppercase text-[11px] tracking-wide text-center">Defects</TableHead>
                                <TableHead className="font-black uppercase text-[11px] tracking-wide">Date</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {inspections.map((insp) => (
                                <TableRow
                                    key={insp.id}
                                    className="cursor-pointer hover:bg-zinc-50 transition-colors border-b border-black/10"
                                    onClick={() => handleRowClick(insp)}
                                >
                                    <TableCell className="font-mono font-bold text-sm">{insp.batchNumber}</TableCell>
                                    <TableCell>
                                        <div>
                                            <div className="font-bold text-sm">{insp.material.name}</div>
                                            <div className="text-xs text-muted-foreground font-mono">{insp.material.code}</div>
                                        </div>
                                    </TableCell>
                                    <TableCell className="font-mono text-sm">
                                        {insp.workOrder?.number || '-'}
                                    </TableCell>
                                    <TableCell className="text-sm">
                                        {insp.inspectorName}
                                    </TableCell>
                                    <TableCell>{getResultBadge(insp.result)}</TableCell>
                                    <TableCell className="text-center">
                                        <span className={`font-bold ${insp.score >= 95 ? 'text-emerald-600' :
                                                insp.score >= 80 ? 'text-amber-600' : 'text-red-600'
                                            }`}>
                                            {insp.score}%
                                        </span>
                                    </TableCell>
                                    <TableCell className="text-center">
                                        {insp.defectCount > 0 ? (
                                            <Badge variant="destructive" className="border-black text-xs">
                                                {insp.defectCount}
                                            </Badge>
                                        ) : (
                                            <span className="text-muted-foreground">0</span>
                                        )}
                                    </TableCell>
                                    <TableCell className="text-sm text-muted-foreground">
                                        {formatDate(insp.inspectionDate)}
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </Card>
            )}

            {/* Inspection Detail Sheet */}
            <Sheet open={detailOpen} onOpenChange={setDetailOpen}>
                <SheetContent className="sm:max-w-lg overflow-y-auto border-l-2 border-black rounded-none">
                    <SheetHeader>
                        <SheetTitle className="flex items-center gap-2">
                            <ClipboardCheck className="h-5 w-5" />
                            Inspection Detail
                        </SheetTitle>
                        <SheetDescription className="font-mono">{selectedInspection?.batchNumber}</SheetDescription>
                    </SheetHeader>

                    {selectedInspection && (
                        <div className="mt-6 space-y-6">
                            {/* Result & Score */}
                            <div className="flex items-center justify-between">
                                {getResultBadge(selectedInspection.result)}
                                <span className={`text-3xl font-black ${
                                    selectedInspection.score >= 95 ? 'text-emerald-600' :
                                    selectedInspection.score >= 80 ? 'text-amber-600' : 'text-red-600'
                                }`}>
                                    {selectedInspection.score}%
                                </span>
                            </div>

                            {/* Info Grid */}
                            <div className="grid grid-cols-2 gap-3">
                                <div className="border-2 border-black/10 p-3">
                                    <p className="text-[10px] font-bold text-muted-foreground uppercase">Product</p>
                                    <p className="font-bold text-sm mt-1">{selectedInspection.material.name}</p>
                                    <p className="text-xs text-muted-foreground font-mono">{selectedInspection.material.code}</p>
                                </div>
                                <div className="border-2 border-black/10 p-3">
                                    <p className="text-[10px] font-bold text-muted-foreground uppercase">Inspector</p>
                                    <p className="font-bold text-sm mt-1">{selectedInspection.inspectorName}</p>
                                </div>
                                <div className="border-2 border-black/10 p-3">
                                    <p className="text-[10px] font-bold text-muted-foreground uppercase">Work Order</p>
                                    <p className="font-bold text-sm mt-1 font-mono">{selectedInspection.workOrder?.number || '-'}</p>
                                </div>
                                <div className="border-2 border-black/10 p-3">
                                    <p className="text-[10px] font-bold text-muted-foreground uppercase">Date</p>
                                    <p className="font-bold text-sm mt-1">{formatDate(selectedInspection.inspectionDate)}</p>
                                </div>
                            </div>

                            {/* Notes */}
                            {selectedInspection.notes && (
                                <div>
                                    <h4 className="font-bold text-sm uppercase mb-2">Notes</h4>
                                    <p className="text-sm text-muted-foreground bg-zinc-50 p-3 border-2 border-black/10">{selectedInspection.notes}</p>
                                </div>
                            )}

                            {/* Defects */}
                            <div>
                                <h4 className="font-bold text-sm uppercase mb-3">
                                    Defects ({selectedInspection.defectCount})
                                </h4>
                                {selectedInspection.defectCount === 0 ? (
                                    <div className="text-center py-4 text-muted-foreground bg-emerald-50 border-2 border-emerald-300">
                                        <CheckCircle className="h-6 w-6 mx-auto text-emerald-500 mb-1" />
                                        <p className="text-xs font-bold">No defects found</p>
                                    </div>
                                ) : selectedInspection.defects && selectedInspection.defects.length > 0 ? (
                                    <div className="space-y-2">
                                        {selectedInspection.defects.map((defect) => (
                                            <div key={defect.id} className="p-3 bg-zinc-50 border-2 border-black/10">
                                                <div className="flex items-center justify-between mb-1">
                                                    <Badge className="text-[10px] bg-zinc-200 text-zinc-800 border-zinc-400">
                                                        {defect.type}
                                                    </Badge>
                                                    <Badge className={`text-[10px] ${getSeverityColor(defect.severity)}`}>
                                                        {defect.severity}
                                                    </Badge>
                                                </div>
                                                {defect.description && (
                                                    <p className="text-xs text-muted-foreground mt-1">{defect.description}</p>
                                                )}
                                                {defect.action && (
                                                    <p className="text-xs font-bold mt-1 text-blue-700">Action: {defect.action}</p>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <p className="text-sm text-muted-foreground">
                                        {selectedInspection.defectCount} defect(s) recorded. Detail tidak tersedia.
                                    </p>
                                )}
                            </div>
                        </div>
                    )}
                </SheetContent>
            </Sheet>

            <CreateInspectionDialog
                open={createOpen}
                onOpenChange={setCreateOpen}
                onCreated={fetchInspections}
            />
        </div>
    );
}

function SummaryCard({ label, value, icon: Icon, color }: { label: string; value: string; icon: any; color: string }) {
    return (
        <Card className="border-2 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
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
