"use client";

import { useState, useMemo } from "react";
import {
    Plus,
    Search,
    RefreshCw,
    AlertCircle,
    Package,
    Layers,
    DollarSign,
    ChevronRight,
    Edit,
    Trash2,
    Copy,
    Factory,
    CheckCircle,
    XCircle,
    Component
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { CreateBOMDialog } from "@/components/manufacturing/create-bom-dialog";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface BOMItem {
    id: string;
    materialId: string;
    material: {
        id: string;
        code: string;
        name: string;
        unit: string;
        costPrice: number;
    };
    quantity: number;
    unit?: string | null;
    wastePct: number;
}

interface BOM {
    id: string;
    productId: string;
    product: {
        id: string;
        code: string;
        name: string;
        unit: string;
        costPrice: number;
    };
    version: string;
    isActive: boolean;
    items: BOMItem[];
    totalMaterialCost: number;
    itemCount: number;
    createdAt: string;
    updatedAt: string;
}

interface Props {
    initialBoms: BOM[];
}

export function BOMClient({ initialBoms }: Props) {
    const [boms, setBoms] = useState<BOM[]>(initialBoms);
    const [refreshing, setRefreshing] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [searchQuery, setSearchQuery] = useState("");
    const [selectedBOM, setSelectedBOM] = useState<BOM | null>(null);
    const [detailOpen, setDetailOpen] = useState(false);
    const [createOpen, setCreateOpen] = useState(false);
    const [editOpen, setEditOpen] = useState(false);
    const [actionLoading, setActionLoading] = useState(false);

    // Calc Stats
    const stats = useMemo(() => {
        const total = boms.length;
        const active = boms.filter(b => b.isActive).length;
        const avgCost = total > 0 ? boms.reduce((acc, b) => acc + b.totalMaterialCost, 0) / total : 0;
        const totalItems = boms.reduce((acc, b) => acc + b.itemCount, 0);

        return { total, active, avgCost, totalItems };
    }, [boms]);

    const kpis = [
        {
            label: "Total BOMs",
            value: String(stats.total),
            detail: "Total Resep Produk",
            icon: Layers,
            color: "text-zinc-900 dark:text-white"
        },
        {
            label: "Active BOMs",
            value: String(stats.active),
            detail: "Siap Produksi",
            icon: CheckCircle,
            color: "text-emerald-600",
            bg: "bg-emerald-50 dark:bg-emerald-900/20"
        },
        {
            label: "Avg Material Cost",
            value: new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(stats.avgCost),
            detail: "Rata-rata Cost",
            icon: DollarSign,
            color: "text-blue-600",
            bg: "bg-blue-50 dark:bg-blue-900/20"
        },
        {
            label: "Total Components",
            value: String(stats.totalItems),
            detail: "Items Configured",
            icon: Component,
            color: "text-amber-600",
            bg: "bg-amber-50 dark:bg-amber-900/20"
        }
    ];

    const fetchBOMs = async () => {
        setRefreshing(true);
        setError(null);
        try {
            const params = new URLSearchParams();
            if (searchQuery) params.append('search', searchQuery);

            const response = await fetch(`/api/manufacturing/bom?${params.toString()}`);
            const data = await response.json();

            if (data.success) {
                setBoms(data.data);
            } else {
                setError(data.error || 'Failed to fetch Bill of Materials');
            }
        } catch (err) {
            setError('Network error. Please try again.');
            console.error('Error fetching BOMs:', err);
        } finally {
            setRefreshing(false);
        }
    };

    const handleCardClick = (bom: BOM) => {
        setSelectedBOM(bom);
        setDetailOpen(true);
    };

    const buildNextVersion = (bom: BOM) => {
        const siblings = boms
            .filter((item) => item.productId === bom.productId)
            .map((item) => item.version.toLowerCase());

        const versionMatch = bom.version.match(/^v(\d+)$/i);
        if (versionMatch) {
            let next = parseInt(versionMatch[1], 10) + 1;
            let candidate = `v${next}`;
            while (siblings.includes(candidate.toLowerCase())) {
                next += 1;
                candidate = `v${next}`;
            }
            return candidate;
        }

        let suffix = 1;
        let candidate = `${bom.version}-copy-${suffix}`;
        while (siblings.includes(candidate.toLowerCase())) {
            suffix += 1;
            candidate = `${bom.version}-copy-${suffix}`;
        }
        return candidate;
    };

    const handleDuplicate = async () => {
        if (!selectedBOM) return;
        setActionLoading(true);
        try {
            const response = await fetch('/api/manufacturing/bom', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    productId: selectedBOM.productId,
                    version: buildNextVersion(selectedBOM),
                    items: selectedBOM.items.map((item) => ({
                        materialId: item.materialId,
                        quantity: Number(item.quantity),
                        unit: item.unit || undefined,
                        wastePct: Number(item.wastePct || 0),
                    })),
                }),
            });
            const payload = await response.json();
            if (!payload.success) {
                toast.error(payload.error || 'Failed to duplicate BOM');
                return;
            }
            toast.success('BOM duplicated successfully');
            setDetailOpen(false);
            await fetchBOMs();
        } catch (error) {
            console.error(error);
            toast.error('Network error while duplicating BOM');
        } finally {
            setActionLoading(false);
        }
    };

    const handleDelete = async () => {
        if (!selectedBOM) return;
        const confirmed = window.confirm(`Delete BOM ${selectedBOM.product.code} ${selectedBOM.version}?`);
        if (!confirmed) return;

        setActionLoading(true);
        try {
            const response = await fetch(`/api/manufacturing/bom/${selectedBOM.id}`, {
                method: 'DELETE',
            });
            const payload = await response.json();
            if (!payload.success) {
                toast.error(payload.error || 'Failed to delete BOM');
                return;
            }
            toast.success('BOM deleted successfully');
            setDetailOpen(false);
            setSelectedBOM(null);
            await fetchBOMs();
        } catch (error) {
            console.error(error);
            toast.error('Network error while deleting BOM');
        } finally {
            setActionLoading(false);
        }
    };

    const formatCurrency = (value: number) => {
        return new Intl.NumberFormat('id-ID', {
            style: 'currency',
            currency: 'IDR',
            minimumFractionDigits: 0,
            maximumFractionDigits: 0,
        }).format(value);
    };

    const handleSearchChange = (value: string) => {
        setSearchQuery(value);
        const timer = setTimeout(() => {
            fetchBOMs();
        }, 300);
        return () => clearTimeout(timer);
    };

    return (
        <div className="w-full bg-zinc-50 dark:bg-black font-sans min-h-[calc(100svh-theme(spacing.16))]">
            <div className="flex flex-col gap-6 p-4 md:p-6 max-w-[1600px] mx-auto">

                {/* Header */}
                <div className="flex-none flex items-center justify-between">
                    <div>
                        <h1 className="text-lg font-black uppercase tracking-widest text-zinc-900 dark:text-white flex items-center gap-2">
                            <Layers className="h-6 w-6" />
                            Bill of Materials
                        </h1>
                        <p className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider mt-1">
                            Kelola resep produk, struktur komponen, dan estimasi biaya
                        </p>
                    </div>
                    <div className="flex items-center gap-2">
                        <Button
                            variant="outline"
                            size="icon"
                            onClick={fetchBOMs}
                            disabled={refreshing}
                            className="h-10 w-10 border-2 border-black shadow-[3px_3px_0px_0px_rgba(0,0,0,0.3)] hover:shadow-[1px_1px_0px_0px_rgba(0,0,0,0.3)] hover:translate-x-[1px] hover:translate-y-[1px] hover:bg-zinc-100 transition-all rounded-none"
                        >
                            <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
                        </Button>
                        <Button
                            className="h-10 bg-black text-white hover:bg-zinc-800 border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,0.3)] hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-[2px_2px_0px_0px_rgba(0,0,0,0.3)] active:scale-[0.98] transition-all uppercase font-black tracking-widest text-xs rounded-none px-6"
                            onClick={() => setCreateOpen(true)}
                        >
                            <Plus className="mr-2 h-4 w-4" /> Create BOM
                        </Button>
                    </div>
                </div>

                {/* KPI Strip */}
                <div className="flex-none bg-white dark:bg-zinc-900 border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] overflow-hidden">
                    <div className="grid grid-cols-2 md:grid-cols-4 divide-x-2 divide-black divide-y-2 md:divide-y-0">
                        {kpis.map((kpi, i) => (
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

                {/* Filter & Search Bar */}
                <div className="flex flex-col md:flex-row gap-4 items-center justify-between bg-zinc-100/50 p-2 md:p-0">
                    <div className="relative w-full md:w-96">
                        <div className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400">
                            <Search className="h-4 w-4" />
                        </div>
                        <Input
                            placeholder="Cari BOM, produk, atau kode..."
                            className="pl-10 h-10 border-2 border-black shadow-[3px_3px_0px_0px_rgba(0,0,0,0.3)] focus-visible:ring-0 focus-visible:translate-x-[1px] focus-visible:translate-y-[1px] focus-visible:shadow-[1px_1px_0px_0px_rgba(0,0,0,0.3)] transition-all bg-white dark:bg-zinc-900 rounded-none font-medium"
                            value={searchQuery}
                            onChange={(e) => handleSearchChange(e.target.value)}
                        />
                    </div>
                </div>

                {/* Error State */}
                {error && (
                    <div className="border-2 border-red-500 bg-red-50 p-4 shadow-[4px_4px_0px_0px_rgba(239,68,68,1)] flex items-center justify-between">
                        <div className="flex items-center gap-3 text-red-700 font-bold uppercase tracking-wide text-xs">
                            <AlertCircle className="h-5 w-5" />
                            <span>{error}</span>
                        </div>
                        <Button variant="outline" size="sm" onClick={fetchBOMs} className="bg-white border-2 border-red-500 text-red-700 hover:bg-red-100 rounded-none font-bold text-xs uppercase">
                            Retry
                        </Button>
                    </div>
                )}

                {/* Empty State */}
                {boms.length === 0 && !error && (
                    <div className="border-2 border-dashed border-zinc-300 min-h-[300px] flex flex-col items-center justify-center text-center bg-zinc-50/50 p-8">
                        <div className="h-16 w-16 bg-zinc-100 border-2 border-zinc-200 flex items-center justify-center mb-4 rounded-full">
                            <Layers className="h-8 w-8 text-zinc-300" />
                        </div>
                        <h3 className="text-lg font-black uppercase tracking-widest text-zinc-400">Tidak ada BOM ditemukan</h3>
                        <p className="text-xs font-bold text-zinc-400 mt-2 max-w-xs">
                            {searchQuery
                                ? 'Coba sesuaikan kata kunci pencarian anda.'
                                : 'Mulai dengan membuat BOM pertama anda.'}
                        </p>
                        <Button className="mt-6 bg-black text-white rounded-none font-black uppercase tracking-wider text-xs px-6 py-5 border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:shadow-none hover:translate-x-[1px] hover:translate-y-[1px] transition-all" onClick={() => setCreateOpen(true)}>
                            <Plus className="mr-2 h-4 w-4" /> Buat BOM Baru
                        </Button>
                    </div>
                )}

                {/* BOM Cards Grid */}
                {boms.length > 0 && (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 pb-20">
                        {boms.map((bom) => (
                            <Card
                                key={bom.id}
                                className="group relative border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:translate-x-[2px] hover:translate-y-[2px] transition-all rounded-none bg-white dark:bg-zinc-900 overflow-hidden flex flex-col cursor-pointer"
                                onClick={() => handleCardClick(bom)}
                            >
                                <div className="flex justify-between items-center p-3 border-b-2 border-black bg-zinc-50 dark:bg-zinc-800">
                                    <div className="flex items-center gap-2">
                                        <div className="h-6 px-1.5 bg-zinc-900 text-white flex items-center justify-center font-black text-[10px] border border-black uppercase tracking-widest">
                                            {bom.version}
                                        </div>
                                        <span className="text-[10px] font-black uppercase tracking-widest text-zinc-500 font-mono">
                                            {bom.product.code}
                                        </span>
                                    </div>
                                    <div className={cn(
                                        "flex items-center gap-1.5 px-2 py-1 border text-[9px] font-black uppercase tracking-widest",
                                        bom.isActive
                                            ? "bg-emerald-100 border-emerald-300 text-emerald-800 shadow-[1px_1px_0px_0px_rgba(16,185,129,0.5)]"
                                            : "bg-zinc-100 border-zinc-300 text-zinc-600"
                                    )}>
                                        {bom.isActive ? <CheckCircle className="h-3 w-3" /> : <XCircle className="h-3 w-3" />}
                                        {bom.isActive ? 'ACTIVE' : 'INACTIVE'}
                                    </div>
                                </div>

                                <div className="p-4 flex-1 flex flex-col gap-4">
                                    <h3 className="text-sm font-black uppercase tracking-wide leading-tight line-clamp-2 min-h-[2.5em]">
                                        {bom.product.name}
                                    </h3>

                                    <div className="grid grid-cols-2 gap-2 mt-auto">
                                        <div className="border border-zinc-200 bg-zinc-50/50 p-2">
                                            <p className="text-[9px] font-black uppercase text-zinc-400 tracking-widest mb-0.5">Component</p>
                                            <div className="font-bold text-sm text-zinc-900 flex items-center gap-1.5">
                                                <Component className="h-3.5 w-3.5 text-zinc-400" /> {bom.itemCount} <span className="text-[9px] text-zinc-400">items</span>
                                            </div>
                                        </div>
                                        <div className="border border-zinc-200 bg-zinc-50/50 p-2">
                                            <p className="text-[9px] font-black uppercase text-zinc-400 tracking-widest mb-0.5">Mat. Cost</p>
                                            <div className="font-bold text-sm text-zinc-900 truncate">
                                                {formatCurrency(bom.totalMaterialCost)}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                                <div className="border-t-2 border-black p-2 flex items-center justify-end bg-zinc-50 dark:bg-zinc-800 group-hover:bg-zinc-100 transition-colors">
                                    <span className="text-[10px] font-black uppercase tracking-wider text-black flex items-center gap-1">
                                        View Detail <ChevronRight className="h-3 w-3" />
                                    </span>
                                </div>
                            </Card>
                        ))}
                    </div>
                )}

                {/* Detail Dialog */}
                <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
                    <DialogContent className="max-w-4xl p-0 border-2 border-black shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] rounded-none overflow-hidden gap-0 bg-white dark:bg-zinc-900">
                        <DialogHeader className="bg-black text-white px-6 py-4 flex-none border-b-2 border-black">
                            <DialogTitle className="text-lg font-black uppercase tracking-wider text-white flex items-center gap-2">
                                <Layers className="h-5 w-5" />
                                {selectedBOM?.product.name}
                            </DialogTitle>
                            <DialogDescription className="text-zinc-400 text-[11px] font-bold mt-0.5 font-mono">
                                {selectedBOM?.product.code} • {selectedBOM?.version}
                            </DialogDescription>
                        </DialogHeader>

                        {selectedBOM && (
                            <div className="flex flex-col h-[calc(80vh)]">
                                <div className="flex-1 overflow-y-auto p-6 space-y-6 bg-zinc-50/50 dark:bg-black/20">
                                    {/* Stats Row */}
                                    <div className="grid grid-cols-3 gap-4">
                                        <div className="border-2 border-black bg-white p-4 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
                                            <p className="text-[10px] font-black uppercase tracking-widest text-zinc-500 mb-1">Status</p>
                                            <div className={cn(
                                                "inline-flex items-center gap-1.5 px-2 py-1 text-xs font-black uppercase tracking-widest border-2 border-black",
                                                selectedBOM.isActive ? "bg-emerald-300 text-black" : "bg-zinc-300 text-zinc-600"
                                            )}>
                                                {selectedBOM.isActive ? "ACTIVE" : "INACTIVE"}
                                            </div>
                                        </div>
                                        <div className="border-2 border-black bg-white p-4 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
                                            <p className="text-[10px] font-black uppercase tracking-widest text-zinc-500 mb-1">Components</p>
                                            <p className="text-2xl font-black">{selectedBOM.itemCount}</p>
                                        </div>
                                        <div className="border-2 border-black bg-white p-4 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
                                            <p className="text-[10px] font-black uppercase tracking-widest text-zinc-500 mb-1">Material Cost</p>
                                            <p className="text-2xl font-black text-blue-600">{formatCurrency(selectedBOM.totalMaterialCost)}</p>
                                        </div>
                                    </div>

                                    {/* Table */}
                                    <div className="border-2 border-black bg-white shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] overflow-hidden">
                                        <div className="bg-zinc-100 border-b-2 border-black px-4 py-2 flex items-center justify-between">
                                            <h3 className="text-xs font-black uppercase tracking-widest">Components List</h3>
                                            <Badge variant="outline" className="rounded-none border-black font-mono text-[10px]">{selectedBOM.items.length} Items</Badge>
                                        </div>
                                        <div className="overflow-x-auto">
                                            <Table>
                                                <TableHeader>
                                                    <TableRow className="border-b-2 border-black hover:bg-zinc-50">
                                                        <TableHead className="font-black uppercase text-[10px] text-zinc-500 tracking-wider h-10">Material</TableHead>
                                                        <TableHead className="font-black uppercase text-[10px] text-zinc-500 tracking-wider h-10 text-right">Qty</TableHead>
                                                        <TableHead className="font-black uppercase text-[10px] text-zinc-500 tracking-wider h-10 text-right">Unit Cost</TableHead>
                                                        <TableHead className="font-black uppercase text-[10px] text-zinc-500 tracking-wider h-10 text-right">Waste %</TableHead>
                                                        <TableHead className="font-black uppercase text-[10px] text-zinc-500 tracking-wider h-10 text-right">Subtotal</TableHead>
                                                    </TableRow>
                                                </TableHeader>
                                                <TableBody>
                                                    {selectedBOM.items.length === 0 ? (
                                                        <TableRow>
                                                            <TableCell colSpan={5} className="text-center py-8 text-muted-foreground text-xs font-bold uppercase tracking-wider">
                                                                No components defined yet
                                                            </TableCell>
                                                        </TableRow>
                                                    ) : (
                                                        selectedBOM.items.map((item) => {
                                                            const wasteFactor = 1 + (Number(item.wastePct) / 100);
                                                            const lineTotal = Number(item.quantity) * Number(item.material.costPrice) * wasteFactor;
                                                            return (
                                                                <TableRow key={item.id} className="border-b border-zinc-100 hover:bg-zinc-50 last:border-0">
                                                                    <TableCell>
                                                                        <div>
                                                                            <div className="font-bold text-xs uppercase">{item.material.name}</div>
                                                                            <div className="text-[10px] text-zinc-400 font-mono font-bold">{item.material.code}</div>
                                                                        </div>
                                                                    </TableCell>
                                                                    <TableCell className="text-right font-mono text-xs font-bold">
                                                                        {Number(item.quantity).toFixed(2)} <span className="text-[10px] text-zinc-400 ml-0.5">{item.unit || item.material.unit}</span>
                                                                    </TableCell>
                                                                    <TableCell className="text-right font-mono text-xs font-medium text-zinc-500">
                                                                        {formatCurrency(Number(item.material.costPrice))}
                                                                    </TableCell>
                                                                    <TableCell className="text-right">
                                                                        {Number(item.wastePct) > 0 ? (
                                                                            <span className="text-[10px] font-black text-amber-600 bg-amber-50 px-1.5 py-0.5 border border-amber-200">
                                                                                +{Number(item.wastePct)}%
                                                                            </span>
                                                                        ) : (
                                                                            <span className="text-[10px] text-zinc-300 font-bold">-</span>
                                                                        )}
                                                                    </TableCell>
                                                                    <TableCell className="text-right font-mono text-xs font-black">
                                                                        {formatCurrency(lineTotal)}
                                                                    </TableCell>
                                                                </TableRow>
                                                            );
                                                        })
                                                    )}
                                                </TableBody>
                                            </Table>
                                        </div>
                                    </div>
                                </div>

                                <div className="p-4 border-t-2 border-black bg-zinc-50 flex flex-col sm:flex-row gap-3">
                                    <Button
                                        className="sm:flex-1 bg-black text-white hover:bg-zinc-800 border-2 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] rounded-none font-bold uppercase text-xs"
                                        onClick={() => setEditOpen(true)}
                                        disabled={actionLoading}
                                    >
                                        <Edit className="mr-2 h-3.5 w-3.5" /> Edit BOM
                                    </Button>
                                    <Button
                                        variant="outline"
                                        className="sm:flex-1 border-2 border-black bg-white hover:bg-zinc-100 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] rounded-none font-bold uppercase text-xs"
                                        onClick={handleDuplicate}
                                        disabled={actionLoading}
                                    >
                                        <Copy className="mr-2 h-3.5 w-3.5" /> Duplicate
                                    </Button>
                                    <Button
                                        variant="outline"
                                        className="border-2 border-red-500 text-red-600 hover:bg-red-50 shadow-[2px_2px_0px_0px_rgba(239,68,68,1)] rounded-none font-bold uppercase text-xs sm:w-12 px-0 flex items-center justify-center"
                                        onClick={handleDelete}
                                        disabled={actionLoading}
                                    >
                                        <Trash2 className="h-4 w-4" />
                                    </Button>
                                </div>
                            </div>
                        )}
                    </DialogContent>
                </Dialog>

                <CreateBOMDialog
                    open={createOpen}
                    onOpenChange={setCreateOpen}
                    onCreated={fetchBOMs}
                />
                <CreateBOMDialog
                    open={editOpen}
                    onOpenChange={setEditOpen}
                    onCreated={async () => {
                        await fetchBOMs();
                        setDetailOpen(false);
                    }}
                    mode="edit"
                    initialBOM={selectedBOM ? {
                        id: selectedBOM.id,
                        productId: selectedBOM.productId,
                        version: selectedBOM.version,
                        isActive: selectedBOM.isActive,
                        items: selectedBOM.items.map((item) => ({
                            materialId: item.materialId,
                            quantity: Number(item.quantity),
                            unit: item.unit || null,
                            wastePct: Number(item.wastePct || 0),
                        }))
                    } : null}
                />
            </div>
        </div>
    );
}
