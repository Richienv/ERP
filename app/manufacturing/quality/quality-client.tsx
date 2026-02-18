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
                setError(data.error || 'Gagal memuat data inspeksi');
            }
        } catch (err) {
            setError('Gangguan jaringan. Silakan coba lagi.');
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
                return <Badge className="bg-emerald-100 text-emerald-800 border-2 border-black rounded-none text-[10px] font-black uppercase"><CheckCircle className="h-3 w-3 mr-1" /> Lolos</Badge>;
            case 'Fail':
                return <Badge className="bg-red-100 text-red-800 border-2 border-black rounded-none text-[10px] font-black uppercase"><XCircle className="h-3 w-3 mr-1" /> Gagal</Badge>;
            case 'Conditional':
                return <Badge className="bg-amber-100 text-amber-800 border-2 border-black rounded-none text-[10px] font-black uppercase"><AlertTriangle className="h-3 w-3 mr-1" /> Bersyarat</Badge>;
            default:
                return <Badge className="border-2 border-black rounded-none text-[10px] font-black uppercase">{result}</Badge>;
        }
    };

    const getSeverityColor = (severity: string) => {
        switch (severity.toUpperCase()) {
            case 'CRITICAL': return 'bg-red-100 text-red-800 border-2 border-black';
            case 'MAJOR': return 'bg-amber-100 text-amber-800 border-2 border-black';
            case 'MINOR': return 'bg-zinc-100 text-zinc-700 border-2 border-black';
            default: return 'bg-zinc-100 text-zinc-600 border-2 border-black';
        }
    };

    const filterItems = [
        { key: null, label: "Semua" },
        { key: "PASS", label: "Lolos" },
        { key: "FAIL", label: "Gagal" },
        { key: "CONDITIONAL", label: "Bersyarat" },
    ] as const;

    return (
        <div className="space-y-4">
            {/* ═══ COMMAND HEADER ═══ */}
            <div className="border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] overflow-hidden bg-white dark:bg-zinc-900">
                <div className="px-6 py-4 flex items-center justify-between border-l-[6px] border-l-emerald-400">
                    <div className="flex items-center gap-3">
                        <ClipboardCheck className="h-5 w-5 text-emerald-500" />
                        <div>
                            <h1 className="text-xl font-black uppercase tracking-tight text-zinc-900 dark:text-white">
                                Kontrol Kualitas
                            </h1>
                            <p className="text-zinc-400 text-xs font-medium mt-0.5">
                                Monitor inspeksi kualitas & tracking defect
                            </p>
                        </div>
                    </div>
                    <div className="flex gap-2">
                        <button
                            onClick={fetchInspections}
                            disabled={refreshing}
                            className="h-9 w-9 flex items-center justify-center border-2 border-black bg-white hover:bg-zinc-50 shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] active:translate-y-[1px] active:shadow-none transition-all"
                        >
                            <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? 'animate-spin' : ''}`} />
                        </button>
                        <Button
                            className="bg-black text-white hover:bg-zinc-800 border-2 border-black shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] active:translate-y-[1px] active:shadow-none transition-all text-[10px] font-black uppercase tracking-widest h-9 px-4 rounded-none"
                            onClick={() => setCreateOpen(true)}
                        >
                            <Plus className="mr-2 h-3.5 w-3.5" /> Inspeksi Baru
                        </Button>
                    </div>
                </div>
            </div>

            {/* ═══ KPI PULSE STRIP ═══ */}
            <div className="bg-white dark:bg-zinc-900 border-2 border-black shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] overflow-hidden">
                <div className="grid grid-cols-2 md:grid-cols-4">
                    <div className="relative p-4 md:p-5 border-r-2 border-zinc-100 dark:border-zinc-800 border-b-2 md:border-b-0">
                        <div className={`absolute top-0 left-0 right-0 h-1 ${summary.passRate >= 95 ? 'bg-emerald-400' : summary.passRate >= 80 ? 'bg-amber-400' : 'bg-red-400'}`} />
                        <div className="flex items-center gap-2 mb-2">
                            <CheckCircle className="h-4 w-4 text-zinc-400" />
                            <span className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Tingkat Lolos</span>
                        </div>
                        <div className={`text-2xl md:text-3xl font-black tracking-tighter ${summary.passRate >= 95 ? 'text-emerald-600' : summary.passRate >= 80 ? 'text-amber-600' : 'text-red-600'}`}>
                            {summary.passRate}%
                        </div>
                        <div className="text-[10px] font-bold text-zinc-400 mt-1">Pass rate inspeksi</div>
                    </div>
                    <div className="relative p-4 md:p-5 border-r-2 border-zinc-100 dark:border-zinc-800 border-b-2 md:border-b-0">
                        <div className="absolute top-0 left-0 right-0 h-1 bg-red-400" />
                        <div className="flex items-center gap-2 mb-2">
                            <XCircle className="h-4 w-4 text-zinc-400" />
                            <span className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Total Defect</span>
                        </div>
                        <div className="text-2xl md:text-3xl font-black tracking-tighter text-red-600">{summary.defectCount}</div>
                        <div className="text-[10px] font-bold text-red-600 mt-1">Cacat ditemukan</div>
                    </div>
                    <div className="relative p-4 md:p-5 border-r-2 border-zinc-100 dark:border-zinc-800">
                        <div className="absolute top-0 left-0 right-0 h-1 bg-amber-400" />
                        <div className="flex items-center gap-2 mb-2">
                            <ClipboardCheck className="h-4 w-4 text-zinc-400" />
                            <span className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Menunggu</span>
                        </div>
                        <div className="text-2xl md:text-3xl font-black tracking-tighter text-amber-600">{summary.pendingCount}</div>
                        <div className="text-[10px] font-bold text-amber-600 mt-1">Antrian inspeksi</div>
                    </div>
                    <div className="relative p-4 md:p-5">
                        <div className="absolute top-0 left-0 right-0 h-1 bg-blue-400" />
                        <div className="flex items-center gap-2 mb-2">
                            <Microscope className="h-4 w-4 text-zinc-400" />
                            <span className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Hari Ini</span>
                        </div>
                        <div className="text-2xl md:text-3xl font-black tracking-tighter text-blue-600">{summary.todayCount}</div>
                        <div className="text-[10px] font-bold text-blue-600 mt-1">Inspeksi hari ini</div>
                    </div>
                </div>
            </div>

            {/* ═══ SEARCH & FILTER BAR ═══ */}
            <div className="bg-white dark:bg-zinc-900 border-2 border-black shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] overflow-hidden">
                <div className="px-4 py-3 flex items-center gap-3 flex-wrap">
                    <div className="relative flex-1 min-w-[200px] max-w-lg">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400" />
                        <Input
                            placeholder="Cari batch # atau produk..."
                            className="pl-9 border-2 border-black font-bold h-10 placeholder:text-zinc-400 rounded-none"
                            value={searchQuery}
                            onChange={(e) => handleSearchChange(e.target.value)}
                        />
                    </div>
                    <div className="flex border-2 border-black">
                        {filterItems.map((f) => (
                            <button
                                key={f.label}
                                onClick={() => handleStatusFilter(f.key)}
                                className={`px-3 py-2 text-[10px] font-black uppercase tracking-widest transition-all border-r border-black last:border-r-0 ${
                                    statusFilter === f.key
                                        ? "bg-black text-white"
                                        : "bg-white text-zinc-400 hover:bg-zinc-50"
                                }`}
                            >
                                {f.label}
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            {/* ═══ ERROR STATE ═══ */}
            {error && (
                <div className="border-2 border-red-600 bg-red-50 shadow-[3px_3px_0px_0px_rgba(220,38,38,1)] overflow-hidden">
                    <div className="p-4 flex items-center gap-3 text-red-700">
                        <AlertCircle className="h-5 w-5 flex-shrink-0" />
                        <span className="text-sm font-bold flex-1">{error}</span>
                        <button
                            onClick={fetchInspections}
                            className="px-3 py-1.5 border-2 border-red-600 text-[10px] font-black uppercase tracking-widest hover:bg-red-100 transition-colors"
                        >
                            Coba Lagi
                        </button>
                    </div>
                </div>
            )}

            {/* ═══ EMPTY STATE ═══ */}
            {inspections.length === 0 && pendingQueue.length === 0 && !error && (
                <div className="border-2 border-dashed border-black bg-white dark:bg-zinc-900 shadow-[3px_3px_0px_0px_rgba(0,0,0,1)]">
                    <div className="p-12 flex flex-col items-center justify-center text-center">
                        <ClipboardCheck className="h-12 w-12 text-zinc-300 mb-4" />
                        <h3 className="text-sm font-black uppercase tracking-widest text-zinc-600">Belum ada inspeksi</h3>
                        <p className="text-xs text-zinc-400 mt-1 font-medium">
                            {searchQuery || statusFilter
                                ? 'Coba ubah pencarian atau filter.'
                                : 'Buat inspeksi pertama untuk memulai.'}
                        </p>
                        <Button
                            className="mt-4 bg-black text-white hover:bg-zinc-800 border-2 border-black shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] active:translate-y-[1px] active:shadow-none transition-all text-[10px] font-black uppercase tracking-widest rounded-none"
                            onClick={() => setCreateOpen(true)}
                        >
                            <Plus className="mr-2 h-3.5 w-3.5" /> Inspeksi Baru
                        </Button>
                    </div>
                </div>
            )}

            {/* ═══ ANTRIAN INSPEKSI (PENDING QUEUE) ═══ */}
            {pendingQueue.length > 0 && (
                <div className="border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] overflow-hidden bg-white dark:bg-zinc-900">
                    <div className="px-4 py-3 border-b-2 border-black bg-amber-50 dark:bg-amber-950/30 border-l-[6px] border-l-amber-400">
                        <p className="text-[10px] font-black uppercase tracking-widest text-amber-900 dark:text-amber-300">
                            Antrian Inspeksi ({pendingQueue.length})
                        </p>
                        <p className="text-xs text-amber-700 dark:text-amber-400 font-medium mt-0.5">Work order yang belum memiliki hasil inspeksi QC</p>
                    </div>
                    <Table>
                        <TableHeader>
                            <TableRow className="border-b-2 border-black bg-zinc-50 dark:bg-zinc-800">
                                <TableHead className="font-black uppercase text-[10px] tracking-widest text-zinc-500">Work Order</TableHead>
                                <TableHead className="font-black uppercase text-[10px] tracking-widest text-zinc-500">Produk</TableHead>
                                <TableHead className="font-black uppercase text-[10px] tracking-widest text-zinc-500">Status</TableHead>
                                <TableHead className="font-black uppercase text-[10px] tracking-widest text-zinc-500">Prioritas</TableHead>
                                <TableHead className="font-black uppercase text-[10px] tracking-widest text-zinc-500 text-center">Qty Rencana</TableHead>
                                <TableHead className="font-black uppercase text-[10px] tracking-widest text-zinc-500">Mesin</TableHead>
                                <TableHead className="font-black uppercase text-[10px] tracking-widest text-zinc-500">Tenggat</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {pendingQueue.map((wo) => (
                                <TableRow key={wo.id} className="border-b border-zinc-100 dark:border-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors">
                                    <TableCell className="font-mono font-bold text-sm">{wo.number}</TableCell>
                                    <TableCell>
                                        <div>
                                            <div className="font-bold text-sm text-zinc-900 dark:text-white">{wo.product.name}</div>
                                            <div className="text-xs text-zinc-400 font-mono">{wo.product.code}</div>
                                        </div>
                                    </TableCell>
                                    <TableCell>
                                        <Badge className="border-2 border-black rounded-none text-[10px] font-black uppercase bg-zinc-100 text-zinc-900">
                                            {wo.status.replace('_', ' ')}
                                        </Badge>
                                    </TableCell>
                                    <TableCell>
                                        <Badge className="bg-zinc-100 text-zinc-900 border-2 border-black rounded-none text-[10px] font-black uppercase">
                                            {wo.priority}
                                        </Badge>
                                    </TableCell>
                                    <TableCell className="text-center font-mono font-bold">{wo.plannedQty}</TableCell>
                                    <TableCell className="text-sm">
                                        {wo.machine?.name ? (
                                            <div>
                                                <div className="font-bold text-zinc-900 dark:text-white">{wo.machine.name}</div>
                                                <div className="text-xs text-zinc-400 font-mono">{wo.machine.code}</div>
                                            </div>
                                        ) : (
                                            <span className="text-zinc-400">-</span>
                                        )}
                                    </TableCell>
                                    <TableCell className="text-sm text-zinc-500 font-medium">
                                        {wo.dueDate ? formatDate(wo.dueDate) : '-'}
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </div>
            )}

            {/* ═══ TABEL INSPEKSI ═══ */}
            {inspections.length > 0 && (
                <div className="border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] overflow-hidden bg-white dark:bg-zinc-900">
                    <div className="flex items-center justify-between px-4 py-3 border-b-2 border-black bg-zinc-50 dark:bg-zinc-800 text-[10px] font-black uppercase tracking-widest text-zinc-500">
                        <span>Hasil Inspeksi</span>
                        <span>{inspections.length} data</span>
                    </div>
                    <Table>
                        <TableHeader>
                            <TableRow className="border-b-2 border-black bg-zinc-50 dark:bg-zinc-800">
                                <TableHead className="font-black uppercase text-[10px] tracking-widest text-zinc-500">Batch #</TableHead>
                                <TableHead className="font-black uppercase text-[10px] tracking-widest text-zinc-500">Produk</TableHead>
                                <TableHead className="font-black uppercase text-[10px] tracking-widest text-zinc-500">Work Order</TableHead>
                                <TableHead className="font-black uppercase text-[10px] tracking-widest text-zinc-500">Inspektor</TableHead>
                                <TableHead className="font-black uppercase text-[10px] tracking-widest text-zinc-500">Hasil</TableHead>
                                <TableHead className="font-black uppercase text-[10px] tracking-widest text-zinc-500 text-center">Skor</TableHead>
                                <TableHead className="font-black uppercase text-[10px] tracking-widest text-zinc-500 text-center">Defect</TableHead>
                                <TableHead className="font-black uppercase text-[10px] tracking-widest text-zinc-500">Tanggal</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {inspections.map((insp) => (
                                <TableRow
                                    key={insp.id}
                                    className="cursor-pointer hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors border-b border-zinc-100 dark:border-zinc-800"
                                    onClick={() => handleRowClick(insp)}
                                >
                                    <TableCell className="font-mono font-bold text-sm">{insp.batchNumber}</TableCell>
                                    <TableCell>
                                        <div>
                                            <div className="font-bold text-sm text-zinc-900 dark:text-white">{insp.material.name}</div>
                                            <div className="text-xs text-zinc-400 font-mono">{insp.material.code}</div>
                                        </div>
                                    </TableCell>
                                    <TableCell className="font-mono text-sm text-zinc-700 dark:text-zinc-300">
                                        {insp.workOrder?.number || '-'}
                                    </TableCell>
                                    <TableCell className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
                                        {insp.inspectorName}
                                    </TableCell>
                                    <TableCell>{getResultBadge(insp.result)}</TableCell>
                                    <TableCell className="text-center">
                                        <span className={`font-black text-sm ${insp.score >= 95 ? 'text-emerald-600' :
                                                insp.score >= 80 ? 'text-amber-600' : 'text-red-600'
                                            }`}>
                                            {insp.score}%
                                        </span>
                                    </TableCell>
                                    <TableCell className="text-center">
                                        {insp.defectCount > 0 ? (
                                            <Badge className="bg-red-100 text-red-800 border-2 border-black rounded-none text-[10px] font-black">
                                                {insp.defectCount}
                                            </Badge>
                                        ) : (
                                            <span className="text-zinc-400 font-mono">0</span>
                                        )}
                                    </TableCell>
                                    <TableCell className="text-sm text-zinc-500 font-medium">
                                        {formatDate(insp.inspectionDate)}
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </div>
            )}

            {/* ═══ DETAIL INSPEKSI (SHEET) ═══ */}
            <Sheet open={detailOpen} onOpenChange={setDetailOpen}>
                <SheetContent className="sm:max-w-lg overflow-y-auto border-l-2 border-black rounded-none">
                    <SheetHeader>
                        <SheetTitle className="flex items-center gap-2 font-black uppercase tracking-tight">
                            <ClipboardCheck className="h-5 w-5" />
                            Detail Inspeksi
                        </SheetTitle>
                        <SheetDescription className="font-mono font-bold">{selectedInspection?.batchNumber}</SheetDescription>
                    </SheetHeader>

                    {selectedInspection && (
                        <div className="mt-6 space-y-6">
                            {/* Result & Score */}
                            <div className="flex items-center justify-between p-4 border-2 border-black bg-zinc-50 dark:bg-zinc-800">
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
                                <div className="border-2 border-black p-3">
                                    <p className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">Produk</p>
                                    <p className="font-bold text-sm mt-1 text-zinc-900 dark:text-white">{selectedInspection.material.name}</p>
                                    <p className="text-xs text-zinc-400 font-mono">{selectedInspection.material.code}</p>
                                </div>
                                <div className="border-2 border-black p-3">
                                    <p className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">Inspektor</p>
                                    <p className="font-bold text-sm mt-1 text-zinc-900 dark:text-white">{selectedInspection.inspectorName}</p>
                                </div>
                                <div className="border-2 border-black p-3">
                                    <p className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">Work Order</p>
                                    <p className="font-bold text-sm mt-1 font-mono text-zinc-900 dark:text-white">{selectedInspection.workOrder?.number || '-'}</p>
                                </div>
                                <div className="border-2 border-black p-3">
                                    <p className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">Tanggal</p>
                                    <p className="font-bold text-sm mt-1 text-zinc-900 dark:text-white">{formatDate(selectedInspection.inspectionDate)}</p>
                                </div>
                            </div>

                            {/* Notes */}
                            {selectedInspection.notes && (
                                <div>
                                    <h4 className="text-[10px] font-black uppercase tracking-widest text-zinc-500 mb-2">Catatan</h4>
                                    <p className="text-sm text-zinc-600 dark:text-zinc-300 bg-zinc-50 dark:bg-zinc-800 p-3 border-2 border-black">{selectedInspection.notes}</p>
                                </div>
                            )}

                            {/* Defects */}
                            <div>
                                <h4 className="text-[10px] font-black uppercase tracking-widest text-zinc-500 mb-3">
                                    Defect ({selectedInspection.defectCount})
                                </h4>
                                {selectedInspection.defectCount === 0 ? (
                                    <div className="text-center py-4 bg-emerald-50 dark:bg-emerald-950/30 border-2 border-black">
                                        <CheckCircle className="h-6 w-6 mx-auto text-emerald-500 mb-1" />
                                        <p className="text-[10px] font-black uppercase tracking-widest text-emerald-700">Tidak ada defect</p>
                                    </div>
                                ) : selectedInspection.defects && selectedInspection.defects.length > 0 ? (
                                    <div className="space-y-2">
                                        {selectedInspection.defects.map((defect) => (
                                            <div key={defect.id} className="p-3 bg-zinc-50 dark:bg-zinc-800 border-2 border-black">
                                                <div className="flex items-center justify-between mb-1">
                                                    <Badge className="text-[10px] font-black uppercase bg-zinc-200 text-zinc-800 border-2 border-black rounded-none">
                                                        {defect.type}
                                                    </Badge>
                                                    <Badge className={`text-[10px] font-black uppercase rounded-none ${getSeverityColor(defect.severity)}`}>
                                                        {defect.severity}
                                                    </Badge>
                                                </div>
                                                {defect.description && (
                                                    <p className="text-xs text-zinc-500 mt-1">{defect.description}</p>
                                                )}
                                                {defect.action && (
                                                    <p className="text-xs font-bold mt-1 text-blue-700">Tindakan: {defect.action}</p>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <p className="text-sm text-zinc-500">
                                        {selectedInspection.defectCount} defect tercatat. Detail tidak tersedia.
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
