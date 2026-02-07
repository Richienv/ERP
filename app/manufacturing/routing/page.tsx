"use client";

import { useEffect, useState } from "react";
import {
    Plus,
    Search,
    RefreshCw,
    AlertCircle,
    Route,
    Clock,
    Settings,
    ChevronRight,
    Box,
    ArrowDown,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
    Sheet,
    SheetContent,
    SheetDescription,
    SheetHeader,
    SheetTitle,
} from "@/components/ui/sheet";

interface RoutingStep {
    id: string;
    sequence: number;
    name: string;
    description?: string | null;
    durationMinutes: number;
    machine?: {
        id: string;
        name: string;
        code: string;
    } | null;
    material?: {
        id: string;
        name: string;
        code: string;
        unit: string;
        quantity: number;
        costPrice?: number;
        lineCost?: number;
    } | null;
}

interface Routing {
    id: string;
    code: string;
    name: string;
    description?: string | null;
    isActive: boolean;
    stepCount: number;
    totalDuration: number;
    totalDurationFormatted: string;
    totalMaterialCost?: number;
    steps: RoutingStep[];
    createdAt: string;
    updatedAt: string;
}

export default function RoutingPage() {
    const [routings, setRoutings] = useState<Routing[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [searchQuery, setSearchQuery] = useState("");
    const [selectedRouting, setSelectedRouting] = useState<Routing | null>(null);
    const [sheetOpen, setSheetOpen] = useState(false);

    const fetchRoutings = async () => {
        setLoading(true);
        setError(null);
        try {
            const params = new URLSearchParams();
            if (searchQuery) params.append('search', searchQuery);

            const response = await fetch(`/api/manufacturing/routing?${params.toString()}`);
            const data = await response.json();

            if (data.success) {
                setRoutings(data.data);
            } else {
                setError(data.error || 'Failed to fetch routings');
            }
        } catch (err) {
            setError('Network error. Please try again.');
            console.error('Error fetching routings:', err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchRoutings();
    }, []);

    // Debounced search
    useEffect(() => {
        const timer = setTimeout(() => {
            fetchRoutings();
        }, 300);
        return () => clearTimeout(timer);
    }, [searchQuery]);

    const handleRoutingClick = async (routing: Routing) => {
        // Fetch full details
        try {
            const response = await fetch(`/api/manufacturing/routing/${routing.id}`);
            const data = await response.json();
            if (data.success) {
                setSelectedRouting(data.data);
            } else {
                setSelectedRouting(routing);
            }
        } catch {
            setSelectedRouting(routing);
        }
        setSheetOpen(true);
    };

    return (
        <div className="flex-1 space-y-4 p-4 md:p-8 pt-6 font-sans">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-3xl font-black font-serif tracking-tight">Routing Definitions</h2>
                    <p className="text-muted-foreground">Define proses produksi dan langkah-langkah manufacturing.</p>
                </div>
                <div className="flex gap-2">
                    <Button
                        variant="outline"
                        size="icon"
                        onClick={fetchRoutings}
                        disabled={loading}
                        className="border-black"
                    >
                        <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
                    </Button>
                    <Button className="bg-black text-white hover:bg-zinc-800 border border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] uppercase font-bold tracking-wide">
                        <Plus className="mr-2 h-4 w-4" /> New Routing
                    </Button>
                </div>
            </div>

            {/* Search */}
            <div className="flex items-center gap-4">
                <div className="relative flex-1 max-w-sm">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                        placeholder="Search routings..."
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
                        <Button variant="outline" size="sm" onClick={fetchRoutings} className="ml-auto">
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
                                <Skeleton className="h-16 w-full" />
                            </CardContent>
                        </Card>
                    ))}
                </div>
            )}

            {/* Empty State */}
            {!loading && !error && routings.length === 0 && (
                <Card className="border-dashed border-2 border-zinc-300">
                    <CardContent className="p-12 flex flex-col items-center justify-center text-center">
                        <Route className="h-12 w-12 text-zinc-300 mb-4" />
                        <h3 className="text-lg font-bold text-zinc-600">No routings defined</h3>
                        <p className="text-sm text-muted-foreground mt-1">
                            {searchQuery ? 'Try adjusting your search.' : 'Create your first routing to define manufacturing processes.'}
                        </p>
                        <Button className="mt-4 bg-black text-white">
                            <Plus className="mr-2 h-4 w-4" /> New Routing
                        </Button>
                    </CardContent>
                </Card>
            )}

            {/* Routing Cards */}
            {!loading && !error && routings.length > 0 && (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {routings.map((routing) => (
                        <Card
                            key={routing.id}
                            className="group border border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] transition-all cursor-pointer"
                            onClick={() => handleRoutingClick(routing)}
                        >
                            <CardHeader className="pb-2">
                                <div className="flex justify-between items-start">
                                    <div>
                                        <CardTitle className="text-lg font-black flex items-center gap-2">
                                            <Route className="h-5 w-5" />
                                            {routing.name}
                                        </CardTitle>
                                        <p className="text-xs font-mono text-muted-foreground">{routing.code}</p>
                                    </div>
                                    <Badge
                                        variant={routing.isActive ? "default" : "secondary"}
                                        className={`text-[10px] ${routing.isActive ? 'bg-emerald-100 text-emerald-800' : 'bg-zinc-100'} border-black`}
                                    >
                                        {routing.isActive ? 'Active' : 'Inactive'}
                                    </Badge>
                                </div>
                            </CardHeader>
                            <CardContent className="pt-2 space-y-4">
                                {routing.description && (
                                    <p className="text-sm text-muted-foreground line-clamp-2">{routing.description}</p>
                                )}

                                {/* Summary */}
                                <div className="grid grid-cols-2 gap-2">
                                    <div className="p-3 bg-zinc-50 rounded border flex items-center gap-2">
                                        <div className="p-2 bg-black rounded">
                                            <Box className="h-4 w-4 text-white" />
                                        </div>
                                        <div>
                                            <p className="text-lg font-black">{routing.stepCount}</p>
                                            <p className="text-[10px] text-muted-foreground uppercase">Steps</p>
                                        </div>
                                    </div>
                                    <div className="p-3 bg-zinc-50 rounded border flex items-center gap-2">
                                        <div className="p-2 bg-black rounded">
                                            <Clock className="h-4 w-4 text-white" />
                                        </div>
                                        <div>
                                            <p className="text-lg font-black">{routing.totalDurationFormatted}</p>
                                            <p className="text-[10px] text-muted-foreground uppercase">Duration</p>
                                        </div>
                                    </div>
                                </div>

                                {/* Steps preview */}
                                {routing.steps.length > 0 && (
                                    <div className="flex items-center gap-1 pt-2 border-t border-dashed overflow-hidden">
                                        {routing.steps.slice(0, 4).map((step, i) => (
                                            <div key={step.id} className="flex items-center">
                                                <div className="px-2 py-1 bg-zinc-100 rounded text-[10px] font-mono truncate max-w-[60px]">
                                                    {step.name}
                                                </div>
                                                {i < Math.min(routing.steps.length, 4) - 1 && (
                                                    <ChevronRight className="h-3 w-3 text-muted-foreground flex-shrink-0" />
                                                )}
                                            </div>
                                        ))}
                                        {routing.steps.length > 4 && (
                                            <span className="text-xs text-muted-foreground ml-1">
                                                +{routing.steps.length - 4}
                                            </span>
                                        )}
                                    </div>
                                )}
                            </CardContent>
                        </Card>
                    ))}
                </div>
            )}

            {/* Detail Sheet */}
            <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
                <SheetContent className="sm:max-w-lg overflow-y-auto">
                    <SheetHeader>
                        <SheetTitle className="flex items-center gap-2">
                            <Route className="h-5 w-5" />
                            {selectedRouting?.name}
                        </SheetTitle>
                        <SheetDescription className="font-mono">{selectedRouting?.code}</SheetDescription>
                    </SheetHeader>

                    {selectedRouting && (
                        <div className="mt-6 space-y-6">
                            {/* Summary */}
                            <div className="grid grid-cols-3 gap-3">
                                <div className="text-center p-3 bg-zinc-50 rounded-lg border">
                                    <p className="text-2xl font-black">{selectedRouting.stepCount}</p>
                                    <p className="text-xs text-muted-foreground uppercase">Steps</p>
                                </div>
                                <div className="text-center p-3 bg-zinc-50 rounded-lg border">
                                    <p className="text-2xl font-black">{selectedRouting.totalDurationFormatted}</p>
                                    <p className="text-xs text-muted-foreground uppercase">Total Time</p>
                                </div>
                                {selectedRouting.totalMaterialCost !== undefined && (
                                    <div className="text-center p-3 bg-emerald-50 rounded-lg border border-emerald-200">
                                        <p className="text-2xl font-black text-emerald-600">
                                            Rp {selectedRouting.totalMaterialCost.toLocaleString()}
                                        </p>
                                        <p className="text-xs text-muted-foreground uppercase">Material Cost</p>
                                    </div>
                                )}
                            </div>

                            {/* Description */}
                            {selectedRouting.description && (
                                <div>
                                    <h4 className="font-bold text-sm uppercase mb-2">Description</h4>
                                    <p className="text-sm text-muted-foreground">{selectedRouting.description}</p>
                                </div>
                            )}

                            {/* Steps Flow */}
                            <div>
                                <h4 className="font-bold text-sm uppercase mb-3">Process Steps</h4>
                                {selectedRouting.steps.length === 0 ? (
                                    <p className="text-sm text-muted-foreground">No steps defined</p>
                                ) : (
                                    <div className="space-y-0">
                                        {selectedRouting.steps.map((step, index) => (
                                            <div key={step.id}>
                                                <div className="p-4 bg-zinc-50 rounded-lg border">
                                                    <div className="flex items-start justify-between mb-2">
                                                        <div className="flex items-center gap-2">
                                                            <div className="w-6 h-6 rounded-full bg-black text-white flex items-center justify-center text-xs font-bold">
                                                                {step.sequence}
                                                            </div>
                                                            <p className="font-bold">{step.name}</p>
                                                        </div>
                                                        <Badge variant="outline" className="text-[10px]">
                                                            <Clock className="h-3 w-3 mr-1" />
                                                            {step.durationMinutes} min
                                                        </Badge>
                                                    </div>

                                                    {step.description && (
                                                        <p className="text-xs text-muted-foreground mb-2 ml-8">
                                                            {step.description}
                                                        </p>
                                                    )}

                                                    <div className="ml-8 flex flex-wrap gap-2">
                                                        {step.machine && (
                                                            <Badge className="text-[10px] bg-blue-100 text-blue-800">
                                                                <Settings className="h-3 w-3 mr-1" />
                                                                {step.machine.name}
                                                            </Badge>
                                                        )}
                                                        {step.material && (
                                                            <Badge className="text-[10px] bg-amber-100 text-amber-800">
                                                                <Box className="h-3 w-3 mr-1" />
                                                                {step.material.quantity} {step.material.unit} {step.material.name}
                                                            </Badge>
                                                        )}
                                                    </div>
                                                </div>

                                                {index < selectedRouting.steps.length - 1 && (
                                                    <div className="flex justify-center py-1">
                                                        <ArrowDown className="h-4 w-4 text-muted-foreground" />
                                                    </div>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>

                            {/* Actions */}
                            <div className="pt-4 border-t flex gap-2">
                                <Button className="flex-1 bg-black text-white hover:bg-zinc-800">
                                    Edit Routing
                                </Button>
                                <Button variant="outline" className="border-black">
                                    Add Step
                                </Button>
                            </div>
                        </div>
                    )}
                </SheetContent>
            </Sheet>
        </div>
    );
}
