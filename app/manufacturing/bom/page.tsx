"use client";

import { useEffect, useState } from "react";
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
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
    Sheet,
    SheetContent,
    SheetHeader,
    SheetTitle,
    SheetDescription,
} from "@/components/ui/sheet";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { CreateBOMDialog } from "@/components/manufacturing/create-bom-dialog";

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
        sellingPrice: number;
    };
    version: string;
    isActive: boolean;
    items: BOMItem[];
    totalMaterialCost: number;
    itemCount: number;
    createdAt: string;
    updatedAt: string;
}

export default function BOMPage() {
    const [boms, setBoms] = useState<BOM[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [searchQuery, setSearchQuery] = useState("");
    const [selectedBOM, setSelectedBOM] = useState<BOM | null>(null);
    const [sheetOpen, setSheetOpen] = useState(false);
    const [createOpen, setCreateOpen] = useState(false);

    const fetchBOMs = async () => {
        setLoading(true);
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
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchBOMs();
    }, []);

    // Debounced search
    useEffect(() => {
        const timer = setTimeout(() => {
            fetchBOMs();
        }, 300);
        return () => clearTimeout(timer);
    }, [searchQuery]);

    const handleCardClick = (bom: BOM) => {
        setSelectedBOM(bom);
        setSheetOpen(true);
    };

    const formatCurrency = (value: number) => {
        return new Intl.NumberFormat('id-ID', {
            style: 'currency',
            currency: 'IDR',
            minimumFractionDigits: 0,
            maximumFractionDigits: 0,
        }).format(value);
    };

    return (
        <div className="mf-page">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="mf-title">Bill of Materials</h2>
                    <p className="text-muted-foreground">Kelola BOM dan struktur komponen produk.</p>
                </div>
                <div className="flex gap-2">
                    <Button
                        variant="outline"
                        size="icon"
                        onClick={fetchBOMs}
                        disabled={loading}
                        className="border-black"
                    >
                        <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
                    </Button>
                    <Button
                        className="bg-black text-white hover:bg-zinc-800 border border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] uppercase font-bold tracking-wide"
                        onClick={() => setCreateOpen(true)}
                    >
                        <Plus className="mr-2 h-4 w-4" /> Create BOM
                    </Button>
                </div>
            </div>

            {/* Filter Bar */}
            <div className="flex items-center gap-4 py-2">
                <div className="relative flex-1 max-w-sm">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                        placeholder="Search by product name or code..."
                        className="pl-9 border-black/20"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                    />
                </div>
            </div>

            {/* Error State */}
            {error && (
                <Card className="border-red-300 bg-red-50">
                    <CardContent className="p-4 flex items-center gap-3 text-red-700">
                        <AlertCircle className="h-5 w-5" />
                        <span>{error}</span>
                        <Button variant="outline" size="sm" onClick={fetchBOMs} className="ml-auto">
                            Retry
                        </Button>
                    </CardContent>
                </Card>
            )}

            {/* Loading State */}
            {loading && (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {[1, 2, 3, 4, 5, 6].map((i) => (
                        <Card key={i} className="border border-black/20">
                            <CardHeader className="pb-2">
                                <Skeleton className="h-6 w-3/4" />
                                <Skeleton className="h-4 w-1/2 mt-2" />
                            </CardHeader>
                            <CardContent className="pt-4 space-y-4">
                                <div className="grid grid-cols-2 gap-4">
                                    <Skeleton className="h-16" />
                                    <Skeleton className="h-16" />
                                </div>
                            </CardContent>
                        </Card>
                    ))}
                </div>
            )}

            {/* Empty State */}
            {!loading && !error && boms.length === 0 && (
                <Card className="border-dashed border-2 border-zinc-300">
                    <CardContent className="p-12 flex flex-col items-center justify-center text-center">
                        <Layers className="h-12 w-12 text-zinc-300 mb-4" />
                        <h3 className="text-lg font-bold text-zinc-600">No Bill of Materials found</h3>
                        <p className="text-sm text-muted-foreground mt-1">
                            {searchQuery
                                ? 'Try adjusting your search criteria.'
                                : 'Create your first BOM to define product components.'}
                        </p>
                        <Button className="mt-4 bg-black text-white" onClick={() => setCreateOpen(true)}>
                            <Plus className="mr-2 h-4 w-4" /> Create BOM
                        </Button>
                    </CardContent>
                </Card>
            )}

            {/* BOM Cards */}
            {!loading && !error && boms.length > 0 && (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {boms.map((bom) => (
                        <Card
                            key={bom.id}
                            className="border border-black shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] transition-all cursor-pointer"
                            onClick={() => handleCardClick(bom)}
                        >
                            <CardHeader className="pb-2 border-b border-black/5 bg-zinc-50/50">
                                <div className="flex justify-between items-start">
                                    <div>
                                        <CardTitle className="text-lg font-black text-zinc-900">{bom.product.name}</CardTitle>
                                        <div className="text-xs font-mono text-muted-foreground mt-1 flex items-center gap-2">
                                            <span>{bom.product.code}</span>
                                            <span className="w-1 h-1 bg-zinc-300 rounded-full" />
                                            <span>{bom.version}</span>
                                        </div>
                                    </div>
                                    {bom.isActive ? (
                                        <Badge className="bg-emerald-100 text-emerald-800 border-black">Active</Badge>
                                    ) : (
                                        <Badge variant="secondary" className="border-black">Inactive</Badge>
                                    )}
                                </div>
                            </CardHeader>
                            <CardContent className="pt-4">
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="border border-black/10 rounded p-3 bg-white">
                                        <div className="flex items-center gap-2 text-muted-foreground mb-1">
                                            <Package className="h-4 w-4" />
                                            <span className="text-[10px] font-bold uppercase">Components</span>
                                        </div>
                                        <span className="font-black text-2xl">{bom.itemCount}</span>
                                    </div>
                                    <div className="border border-black/10 rounded p-3 bg-white">
                                        <div className="flex items-center gap-2 text-muted-foreground mb-1">
                                            <DollarSign className="h-4 w-4" />
                                            <span className="text-[10px] font-bold uppercase">Material Cost</span>
                                        </div>
                                        <span className="font-black text-lg">{formatCurrency(bom.totalMaterialCost)}</span>
                                    </div>
                                </div>
                            </CardContent>
                            <CardFooter className="pt-2 pb-4 flex justify-end border-t border-black/5 bg-zinc-50/50">
                                <Button variant="ghost" size="sm" className="h-6 text-[10px] uppercase font-bold hover:bg-black hover:text-white transition-colors">
                                    View Details <ChevronRight className="ml-1 h-3 w-3" />
                                </Button>
                            </CardFooter>
                        </Card>
                    ))}
                </div>
            )}

            {/* Detail Sheet */}
            <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
                <SheetContent className="sm:max-w-2xl overflow-y-auto">
                    <SheetHeader>
                        <SheetTitle className="font-black text-2xl">{selectedBOM?.product.name}</SheetTitle>
                        <SheetDescription>
                            {selectedBOM?.product.code} • {selectedBOM?.version}
                        </SheetDescription>
                    </SheetHeader>

                    {selectedBOM && (
                        <div className="mt-6 space-y-6">
                            {/* Summary */}
                            <div className="grid grid-cols-3 gap-4">
                                <div className="border border-black/10 rounded-lg p-3 text-center">
                                    <p className="text-xs font-bold text-muted-foreground uppercase">Components</p>
                                    <p className="text-2xl font-black">{selectedBOM.itemCount}</p>
                                </div>
                                <div className="border border-black/10 rounded-lg p-3 text-center">
                                    <p className="text-xs font-bold text-muted-foreground uppercase">Material Cost</p>
                                    <p className="text-xl font-black">{formatCurrency(selectedBOM.totalMaterialCost)}</p>
                                </div>
                                <div className="border border-black/10 rounded-lg p-3 text-center">
                                    <p className="text-xs font-bold text-muted-foreground uppercase">Status</p>
                                    <p className="text-xl font-black">{selectedBOM.isActive ? 'Active' : 'Inactive'}</p>
                                </div>
                            </div>

                            {/* Components Table */}
                            <div>
                                <h4 className="font-black text-sm uppercase mb-3">Components / Materials</h4>
                                <Card className="border border-black">
                                    <Table>
                                        <TableHeader>
                                            <TableRow className="border-b-2 border-black bg-zinc-50">
                                                <TableHead className="font-black uppercase text-[11px]">Material</TableHead>
                                                <TableHead className="font-black uppercase text-[11px] text-right">Qty</TableHead>
                                                <TableHead className="font-black uppercase text-[11px] text-right">Unit Cost</TableHead>
                                                <TableHead className="font-black uppercase text-[11px] text-right">Waste %</TableHead>
                                                <TableHead className="font-black uppercase text-[11px] text-right">Line Total</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {selectedBOM.items.length === 0 ? (
                                                <TableRow>
                                                    <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                                                        No components defined yet
                                                    </TableCell>
                                                </TableRow>
                                            ) : (
                                                selectedBOM.items.map((item) => {
                                                    const wasteFactor = 1 + (Number(item.wastePct) / 100);
                                                    const lineTotal = Number(item.quantity) * Number(item.material.costPrice) * wasteFactor;
                                                    return (
                                                        <TableRow key={item.id} className="border-b border-black/10">
                                                            <TableCell>
                                                                <div>
                                                                    <div className="font-bold text-sm">{item.material.name}</div>
                                                                    <div className="text-xs text-muted-foreground font-mono">{item.material.code}</div>
                                                                </div>
                                                            </TableCell>
                                                            <TableCell className="text-right font-mono">
                                                                {Number(item.quantity).toFixed(2)} <span className="text-xs text-muted-foreground">{item.unit || item.material.unit}</span>
                                                            </TableCell>
                                                            <TableCell className="text-right font-mono">
                                                                {formatCurrency(Number(item.material.costPrice))}
                                                            </TableCell>
                                                            <TableCell className="text-right">
                                                                {Number(item.wastePct) > 0 ? (
                                                                    <span className="text-amber-600 font-bold">{Number(item.wastePct)}%</span>
                                                                ) : (
                                                                    <span className="text-muted-foreground">0%</span>
                                                                )}
                                                            </TableCell>
                                                            <TableCell className="text-right font-mono font-bold">
                                                                {formatCurrency(lineTotal)}
                                                            </TableCell>
                                                        </TableRow>
                                                    );
                                                })
                                            )}
                                        </TableBody>
                                    </Table>
                                </Card>
                            </div>

                            {/* Actions */}
                            <div className="pt-4 border-t flex gap-2">
                                <Button className="flex-1 bg-black text-white hover:bg-zinc-800">
                                    <Edit className="mr-2 h-4 w-4" /> Edit BOM
                                </Button>
                                <Button variant="outline" className="border-black">
                                    <Copy className="mr-2 h-4 w-4" /> Duplicate
                                </Button>
                                <Button variant="outline" className="border-red-300 text-red-600 hover:bg-red-50">
                                    <Trash2 className="h-4 w-4" />
                                </Button>
                            </div>
                        </div>
                    )}
                </SheetContent>
            </Sheet>

            <CreateBOMDialog
                open={createOpen}
                onOpenChange={setCreateOpen}
                onCreated={fetchBOMs}
            />
        </div>
    );
}
