"use client"

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { ArrowLeftRight, Clock, FileText, TrendingUp, AlertCircle } from "lucide-react"

export function BomVersionControl() {
    return (
        <Card className="col-span-1 shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between pb-2 bg-gradient-to-r from-zinc-50 to-white dark:from-zinc-900 border-b">
                <div>
                    <CardTitle className="flex items-center gap-2 text-lg">
                        <FileText className="h-5 w-5 text-indigo-500" />
                        BOM Version Control: Electronic Control Board
                    </CardTitle>
                    <CardDescription>
                        Compare v3.2 (Active) vs v3.1 (Previous)
                    </CardDescription>
                </div>
                <div className="flex items-center gap-2">
                    <Badge variant="outline" className="bg-zinc-100 text-zinc-600">v3.1</Badge>
                    <ArrowLeftRight className="h-4 w-4 text-muted-foreground" />
                    <Badge className="bg-green-100 text-green-700 hover:bg-green-100 border-none">v3.2 (Active)</Badge>
                    <Badge variant="outline" className="border-dashed ml-2">v3.3 (Draft)</Badge>
                </div>
            </CardHeader>
            <CardContent className="p-0">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead className="w-[200px]">Component</TableHead>
                            <TableHead>Change Detail</TableHead>
                            <TableHead className="text-right">Cost Impact</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {/* Changed Item */}
                        <TableRow className="bg-yellow-50/50 dark:bg-yellow-900/10">
                            <TableCell className="font-medium">
                                <div>Resistor 10kΩ</div>
                                <div className="text-xs text-muted-foreground">MAT-5023</div>
                            </TableCell>
                            <TableCell>
                                <div className="text-sm font-medium text-yellow-700 dark:text-yellow-400 flex items-center gap-2">
                                    <AlertCircle className="h-3 w-3" /> Supplier Changed
                                </div>
                                <div className="text-xs text-muted-foreground">TDK → Vishay (Lead time 3d → 5d)</div>
                            </TableCell>
                            <TableCell className="text-right text-red-600 text-sm font-medium">
                                +$0.005 /unit
                            </TableCell>
                        </TableRow>

                        {/* Removed Item */}
                        <TableRow className="bg-red-50/50 dark:bg-red-900/10 opacity-75">
                            <TableCell className="font-medium">
                                <div className="line-through decoration-red-500">Capacitor 100μF</div>
                                <div className="text-xs text-muted-foreground">MAT-6012</div>
                            </TableCell>
                            <TableCell>
                                <div className="text-sm font-medium text-red-700 dark:text-red-400">🔴 REMOVED</div>
                                <div className="text-xs text-muted-foreground">Obsolete component</div>
                            </TableCell>
                            <TableCell className="text-right text-green-600 text-sm font-medium">
                                -$0.12 /unit
                            </TableCell>
                        </TableRow>

                        {/* Added Item */}
                        <TableRow className="bg-green-50/50 dark:bg-green-900/10">
                            <TableCell className="font-medium">
                                <div>Capacitor 220μF</div>
                                <div className="text-xs text-muted-foreground">MAT-6089</div>
                            </TableCell>
                            <TableCell>
                                <div className="text-sm font-medium text-green-700 dark:text-green-400">✅ ADDED</div>
                                <div className="text-xs text-muted-foreground">Replacement for MAT-6012</div>
                            </TableCell>
                            <TableCell className="text-right text-red-600 text-sm font-medium">
                                +$0.15 /unit
                            </TableCell>
                        </TableRow>
                    </TableBody>
                </Table>

                {/* Summary Footer */}
                <div className="p-4 bg-zinc-50 dark:bg-black border-t flex justify-between items-center">
                    <div className="flex gap-4 text-sm">
                        <div className="flex flex-col">
                            <span className="text-muted-foreground text-xs uppercase font-bold">Total Cost Impact</span>
                            <span className="text-red-600 font-bold flex items-center gap-1">
                                <TrendingUp className="h-3 w-3" /> +8% Increase
                            </span>
                        </div>
                        <div className="h-8 w-px bg-border" />
                        <div className="flex flex-col">
                            <span className="text-muted-foreground text-xs uppercase font-bold">Affected WIP</span>
                            <span className="font-medium">347 Units</span>
                        </div>
                    </div>
                    <div className="flex gap-2">
                        <Button variant="outline" size="sm">Transition Plan</Button>
                        <Button size="sm">Download PDF Report</Button>
                    </div>
                </div>
            </CardContent>
        </Card>
    )
}
