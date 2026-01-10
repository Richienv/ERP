"use client";

import { useState } from "react";
import {
    ArrowRight,
    Plus,
    Save,
    Settings,
    Scissors,
    Shirt,
    Package,
    AlertCircle,
    MoreVertical,
    Trash2
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Input } from "@/components/ui/input";
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from "@/components/ui/tooltip";

// Mock Data for a "Classic Blue Jeans" BOM
const INITIAL_NODES = [
    { id: "mat-1", type: "material", label: "Denim Fabric 13oz", cost: 125000, unit: "2.5m" },
    { id: "proc-1", type: "process", label: "Cutting Station", cost: 15000, time: "20m", icon: Scissors, status: "ok" },
    { id: "mat-2", type: "material", label: "Thread & Zippers", cost: 5000, unit: "1 set" },
    { id: "proc-2", type: "process", label: "Sewing Station", cost: 35000, time: "45m", icon: Shirt, status: "ok" },
    { id: "proc-3", type: "process", label: "Finishing & QC", cost: 10000, time: "15m", icon: Package, status: "warning", message: "Quality check bottleneck" },
];

export default function BOMPage() {
    const [nodes, setNodes] = useState(INITIAL_NODES);

    return (
        <div className="flex-1 flex flex-col h-[calc(100vh-80px)] p-4 md:p-8 pt-6 gap-6 transition-colors duration-300">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <div className="flex items-center gap-2 mb-1">
                        <h2 className="text-3xl font-medium tracking-tight text-foreground font-serif">Bill of Materials (BOM)</h2>
                        <Badge variant="outline" className="text-xs bg-muted/50 text-muted-foreground border-border">Visual Editor</Badge>
                    </div>
                    <p className="text-muted-foreground">Manage production recipes and cost structures.</p>
                </div>
                <div className="flex items-center gap-2">
                    <Button variant="outline" className="h-9">
                        <Settings className="mr-2 h-4 w-4" /> Config
                    </Button>
                    <Button className="h-9">
                        <Save className="mr-2 h-4 w-4" /> Save BOM
                    </Button>
                </div>
            </div>

            {/* Main Visual Editor Area */}
            <div className="flex-1 bg-background rounded-xl border border-border shadow-sm relative overflow-hidden flex flex-col">

                {/* Toolbar */}
                <div className="p-3 border-b border-border bg-muted/20 flex gap-2 items-center">
                    <div className="flex gap-2">
                        <Button variant="ghost" size="sm" className="h-8 text-muted-foreground hover:text-foreground">
                            <Plus className="mr-2 h-3.5 w-3.5" /> Add Node
                        </Button>
                        <Separator orientation="vertical" className="h-4 my-auto" />
                        <Button variant="ghost" size="sm" className="h-8 text-muted-foreground hover:text-foreground">
                            <Package className="mr-2 h-3.5 w-3.5" /> Material
                        </Button>
                        <Button variant="ghost" size="sm" className="h-8 text-muted-foreground hover:text-foreground">
                            <Scissors className="mr-2 h-3.5 w-3.5" /> Process
                        </Button>
                    </div>
                    <div className="ml-auto flex items-center gap-3 text-sm px-3 py-1.5 bg-card rounded-md border border-border shadow-sm">
                        <span className="text-muted-foreground font-medium text-xs uppercase tracking-wider">Est. Cost</span>
                        <span className="font-semibold font-mono text-foreground">Rp 190.000</span>
                    </div>
                </div>

                {/* Canvas Area */}
                <div className="flex-1 p-10 overflow-auto flex items-center justify-center bg-[radial-gradient(#000000_1px,transparent_1px)] dark:bg-[radial-gradient(#ffffff_1px,transparent_1px)] [background-size:24px_24px] [mask-image:radial-gradient(ellipse_at_center,black_70%,transparent_100%)] opacity-100">
                    <div className="flex items-center gap-8 relative z-10">

                        {/* Node 1: Material */}
                        <Card className="w-64 border-border bg-card shadow-sm hover:shadow-md transition-all group relative">
                            <div className="absolute left-0 top-0 bottom-0 w-1 bg-emerald-500 rounded-l-xl" />
                            <div className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer">
                                <MoreVertical className="h-4 w-4 text-muted-foreground" />
                            </div>
                            <CardContent className="p-5 flex items-start gap-4">
                                <div className="h-10 w-10 rounded-lg bg-emerald-500/10 flex items-center justify-center shrink-0">
                                    <Package className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
                                </div>
                                <div className="flex-1 space-y-1">
                                    <div className="flex justify-between items-start">
                                        <h4 className="font-semibold text-sm text-foreground leading-none">Denim Fabric</h4>
                                    </div>
                                    <p className="text-xs text-muted-foreground">13oz • 2.5m</p>
                                    <div className="pt-2">
                                        <Badge variant="secondary" className="h-5 text-[10px] font-mono font-medium">Rp 125.000</Badge>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>

                        {/* Connector */}
                        <div className="h-px w-12 bg-border relative">
                            <ArrowRight className="absolute -right-3 -top-3 h-6 w-6 text-muted-foreground/50" />
                        </div>

                        {/* Node 2: Process */}
                        <Card className="w-64 border-border bg-card shadow-sm hover:shadow-md transition-all group relative">
                            <div className="absolute left-0 top-0 bottom-0 w-1 bg-blue-500 rounded-l-xl" />
                            <div className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer">
                                <MoreVertical className="h-4 w-4 text-muted-foreground" />
                            </div>
                            <CardContent className="p-5 flex items-start gap-4">
                                <div className="h-10 w-10 rounded-lg bg-blue-500/10 flex items-center justify-center shrink-0">
                                    <Scissors className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                                </div>
                                <div className="flex-1 space-y-1">
                                    <h4 className="font-semibold text-sm text-foreground leading-none">Cutting Station</h4>
                                    <p className="text-xs text-muted-foreground">20 mins duration</p>
                                    <div className="pt-2">
                                        <Badge variant="secondary" className="h-5 text-[10px] font-mono font-medium">Rp 15.000</Badge>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>

                        {/* Connector */}
                        <div className="h-px w-12 bg-border relative">
                            <ArrowRight className="absolute -right-3 -top-3 h-6 w-6 text-muted-foreground/50" />
                        </div>

                        {/* Node 3: Process + Input */}
                        <div className="relative">
                            {/* Input Node (Attached Top) */}
                            <div className="absolute -top-16 left-6 z-0">
                                <div className="flex flex-col items-center">
                                    <div className="bg-card border border-border px-3 py-1.5 rounded-full shadow-sm flex items-center gap-2 mb-2">
                                        <span className="w-2 h-2 rounded-full bg-emerald-500" />
                                        <span className="text-xs font-medium">Threads & Zippers</span>
                                        <span className="text-[10px] text-muted-foreground border-l pl-2 ml-1">Rp 5k</span>
                                    </div>
                                    <div className="w-px h-6 bg-border" />
                                    <div className="w-1.5 h-1.5 rounded-full bg-border" />
                                </div>
                            </div>

                            <Card className="w-64 border-border bg-card shadow-sm hover:shadow-md transition-all group relative z-10">
                                <div className="absolute left-0 top-0 bottom-0 w-1 bg-blue-500 rounded-l-xl" />
                                <div className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer">
                                    <MoreVertical className="h-4 w-4 text-muted-foreground" />
                                </div>
                                <CardContent className="p-5 flex items-start gap-4">
                                    <div className="h-10 w-10 rounded-lg bg-blue-500/10 flex items-center justify-center shrink-0">
                                        <Shirt className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                                    </div>
                                    <div className="flex-1 space-y-1">
                                        <h4 className="font-semibold text-sm text-foreground leading-none">Sewing Station</h4>
                                        <p className="text-xs text-muted-foreground">45 mins duration</p>
                                        <div className="pt-2">
                                            <Badge variant="secondary" className="h-5 text-[10px] font-mono font-medium">Rp 35.000</Badge>
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>
                        </div>

                        {/* Connector */}
                        <div className="h-px w-12 bg-border relative">
                            <ArrowRight className="absolute -right-3 -top-3 h-6 w-6 text-muted-foreground/50" />
                        </div>

                        {/* Node 4: Finishing */}
                        <TooltipProvider>
                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <Card className="w-64 border-amber-500/50 bg-amber-50/5 dark:bg-amber-950/10 shadow-sm hover:shadow-md transition-all group relative cursor-pointer ring-1 ring-amber-500/20">
                                        <div className="absolute left-0 top-0 bottom-0 w-1 bg-amber-500 rounded-l-xl" />
                                        <div className="absolute -top-2 -right-2">
                                            <div className="bg-background rounded-full p-0.5 border border-amber-200 dark:border-amber-900 shadow-sm">
                                                <AlertCircle className="h-5 w-5 text-amber-500" />
                                            </div>
                                        </div>
                                        <CardContent className="p-5 flex items-start gap-4">
                                            <div className="h-10 w-10 rounded-lg bg-amber-500/10 flex items-center justify-center shrink-0">
                                                <Package className="h-5 w-5 text-amber-600 dark:text-amber-400" />
                                            </div>
                                            <div className="flex-1 space-y-1">
                                                <h4 className="font-semibold text-sm text-foreground leading-none">Finishing & QC</h4>
                                                <p className="text-xs text-muted-foreground">15 mins duration</p>
                                                <div className="pt-2">
                                                    <Badge variant="secondary" className="h-5 text-[10px] font-mono font-medium">Rp 10.000</Badge>
                                                </div>
                                            </div>
                                        </CardContent>
                                    </Card>
                                </TooltipTrigger>
                                <TooltipContent className="bg-destructive text-destructive-foreground border-destructive/20">
                                    <p>Warning: Missing pattern file input!</p>
                                </TooltipContent>
                            </Tooltip>
                        </TooltipProvider>

                    </div>

                    {/* Background enhancement */}
                    <div className="absolute inset-0 bg-background/50 pointer-events-none" />
                </div>

                {/* Legend / Footer */}
                <div className="p-3 border-t border-border bg-muted/20 text-xs text-muted-foreground flex gap-6">
                    <div className="flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-emerald-500" /> Material Input</div>
                    <div className="flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-blue-500" /> Work Process</div>
                    <div className="flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-amber-500" /> Warning / Issue</div>
                </div>

            </div>

        </div >
    );
}
