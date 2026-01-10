"use client"

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Search, Box, Truck, Factory, Layers } from "lucide-react"
import { Input } from "@/components/ui/input"

export function BatchTraceability() {
    return (
        <Card className="col-span-1 md:col-span-2 lg:col-span-1 shadow-sm border-l-4 border-l-purple-500">
            <CardHeader className="pb-2">
                <CardTitle className="text-lg flex items-center gap-2">
                    <Search className="h-5 w-5 text-purple-600" />
                    Traceability Search
                </CardTitle>
                <CardDescription>Track Batch ID End-to-End</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
                <div className="flex gap-2">
                    <Input placeholder="Enter Batch ID (e.g. B2026...)" className="h-9" defaultValue="B20260108-PSU500-L2" />
                </div>

                <div className="relative border-l-2 border-purple-200 dark:border-purple-900 ml-3 space-y-6 pb-2">
                    {/* Step 1: Production */}
                    <div className="relative pl-6">
                        <div className="absolute -left-[9px] top-1 h-4 w-4 rounded-full bg-purple-600 ring-4 ring-white dark:ring-black"></div>
                        <div className="text-sm font-bold text-purple-700 dark:text-purple-400">Production (Jan 8)</div>
                        <div className="text-xs text-muted-foreground mb-1">Qty: 500 Units</div>
                        <Badge variant="outline" className="text-[10px] bg-purple-50">Line 2 • Shift 1</Badge>
                    </div>

                    {/* Step 2: Warehouse */}
                    <div className="relative pl-6">
                        <div className="absolute -left-[9px] top-1 h-4 w-4 rounded-full bg-purple-400 ring-4 ring-white dark:ring-black"></div>
                        <div className="text-sm font-bold">Storage (Jan 9)</div>
                        <div className="text-xs text-muted-foreground p-2 bg-muted rounded mt-1 flex items-start gap-2">
                            <Layers className="h-3 w-3 mt-0.5" />
                            <span>Split: 350 to Ship / 150 to Rack B7</span>
                        </div>
                    </div>

                    {/* Step 3: Shipping */}
                    <div className="relative pl-6">
                        <div className="absolute -left-[9px] top-1 h-4 w-4 rounded-full bg-indigo-500 ring-4 ring-white dark:ring-black"></div>
                        <div className="text-sm font-bold text-indigo-700 dark:text-indigo-400">Shipped (Jan 10)</div>
                        <div className="text-xs space-y-1 mt-1">
                            <div className="flex items-center gap-2">
                                <Truck className="h-3 w-3" /> To: PT Elektronik Jaya
                            </div>
                            <div className="font-mono bg-zinc-100 dark:bg-zinc-800 px-1 rounded w-max">
                                DO-20260110
                            </div>
                        </div>
                    </div>
                </div>
            </CardContent>
        </Card>
    )
}
