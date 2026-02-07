"use client";

import { useEffect, useState } from "react";
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
import { Skeleton } from "@/components/ui/skeleton";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";

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
}

interface Summary {
    passRate: number;
    defectCount: number;
    pendingCount: number;
    todayCount: number;
}

export default function QualityControlPage() {
    const [inspections, setInspections] = useState<Inspection[]>([]);
    const [summary, setSummary] = useState<Summary>({ passRate: 100, defectCount: 0, pendingCount: 0, todayCount: 0 });
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [searchQuery, setSearchQuery] = useState("");
    const [statusFilter, setStatusFilter] = useState<string | null>(null);

    const fetchInspections = async () => {
        setLoading(true);
        setError(null);
        try {
            const params = new URLSearchParams();
            if (searchQuery) params.append('search', searchQuery);
            if (statusFilter) params.append('status', statusFilter);

            const response = await fetch(`/api/manufacturing/quality?${params.toString()}`);
            const data = await response.json();

            if (data.success) {
                setInspections(data.data);
                setSummary(data.summary);
            } else {
                setError(data.error || 'Failed to fetch inspections');
            }
        } catch (err) {
            setError('Network error. Please try again.');
            console.error('Error fetching inspections:', err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchInspections();
    }, [statusFilter]);

    // Debounced search
    useEffect(() => {
        const timer = setTimeout(() => {
            fetchInspections();
        }, 300);
        return () => clearTimeout(timer);
    }, [searchQuery]);

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

    return (
        <div className="flex-1 space-y-4 p-4 md:p-8 pt-6 font-sans">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-3xl font-black font-serif tracking-tight">Quality Control</h2>
                    <p className="text-muted-foreground">Monitor inspeksi kualitas dan tracking defect.</p>
                </div>
                <div className="flex gap-2">
                    <Button
                        variant="outline"
                        size="icon"
                        onClick={fetchInspections}
                        disabled={loading}
                        className="border-black"
                    >
                        <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
                    </Button>
                    <Button className="bg-black text-white hover:bg-zinc-800 border border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] uppercase font-bold tracking-wide">
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
                        className="pl-9 border-black/20"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
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
                            onClick={() => setStatusFilter(filter === 'All' ? null : filter)}
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

            {/* Loading State */}
            {loading && (
                <Card className="border border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
                    <Table>
                        <TableHeader>
                            <TableRow className="border-b-2 border-black">
                                <TableHead>Batch #</TableHead>
                                <TableHead>Product</TableHead>
                                <TableHead>Inspector</TableHead>
                                <TableHead>Result</TableHead>
                                <TableHead>Defects</TableHead>
                                <TableHead>Date</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {[1, 2, 3, 4, 5].map((i) => (
                                <TableRow key={i}>
                                    <TableCell><Skeleton className="h-5 w-24" /></TableCell>
                                    <TableCell><Skeleton className="h-5 w-40" /></TableCell>
                                    <TableCell><Skeleton className="h-5 w-28" /></TableCell>
                                    <TableCell><Skeleton className="h-5 w-16" /></TableCell>
                                    <TableCell><Skeleton className="h-5 w-12" /></TableCell>
                                    <TableCell><Skeleton className="h-5 w-28" /></TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </Card>
            )}

            {/* Empty State */}
            {!loading && !error && inspections.length === 0 && (
                <Card className="border-dashed border-2 border-zinc-300">
                    <CardContent className="p-12 flex flex-col items-center justify-center text-center">
                        <ClipboardCheck className="h-12 w-12 text-zinc-300 mb-4" />
                        <h3 className="text-lg font-bold text-zinc-600">No inspections found</h3>
                        <p className="text-sm text-muted-foreground mt-1">
                            {searchQuery || statusFilter
                                ? 'Try adjusting your search or filter criteria.'
                                : 'Create your first inspection to get started.'}
                        </p>
                        <Button className="mt-4 bg-black text-white">
                            <Plus className="mr-2 h-4 w-4" /> New Inspection
                        </Button>
                    </CardContent>
                </Card>
            )}

            {/* Inspections Table */}
            {!loading && !error && inspections.length > 0 && (
                <Card className="border border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] overflow-hidden">
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
        </div>
    );
}

function SummaryCard({ label, value, icon: Icon, color }: { label: string; value: string; icon: any; color: string }) {
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
