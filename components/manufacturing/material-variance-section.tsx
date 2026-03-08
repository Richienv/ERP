"use client"

import { useMaterialVariance } from "@/hooks/use-material-variance"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { formatCurrency } from "@/lib/utils"
import { IconChartBar, IconLoader2 } from "@tabler/icons-react"

function StatusBadge({ status }: { status: "HEMAT" | "SESUAI" | "BOROS" }) {
    const config = {
        HEMAT: { label: "Hemat", className: "bg-green-100 text-green-800 border-green-300" },
        SESUAI: { label: "Sesuai", className: "bg-blue-100 text-blue-800 border-blue-300" },
        BOROS: { label: "Boros", className: "bg-red-100 text-red-800 border-red-300" },
    }
    const { label, className } = config[status]
    return <Badge variant="outline" className={className}>{label}</Badge>
}

function formatPct(value: number): string {
    const sign = value > 0 ? "+" : ""
    return `${sign}${value.toFixed(1)}%`
}

interface MaterialVarianceSectionProps {
    workOrderId: string
}

export function MaterialVarianceSection({ workOrderId }: MaterialVarianceSectionProps) {
    const { data, isLoading } = useMaterialVariance(workOrderId)

    if (isLoading) {
        return (
            <Card className="border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
                <CardContent className="flex items-center justify-center py-12">
                    <IconLoader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                    <span className="ml-2 text-muted-foreground">Memuat data biaya material...</span>
                </CardContent>
            </Card>
        )
    }

    if (!data || data.lines.length === 0) {
        return (
            <Card className="border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
                <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-base">
                        <IconChartBar className="h-5 w-5" />
                        Biaya Material
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <p className="text-sm text-muted-foreground">Belum ada data konsumsi material untuk work order ini.</p>
                </CardContent>
            </Card>
        )
    }

    return (
        <Card className="border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
            <CardHeader>
                <div className="flex items-center justify-between">
                    <CardTitle className="flex items-center gap-2 text-base">
                        <IconChartBar className="h-5 w-5" />
                        Biaya Material
                    </CardTitle>
                    <div className="flex items-center gap-3">
                        <div className="text-right">
                            <p className="text-xs text-muted-foreground">Total Variance</p>
                            <p className={`text-sm font-bold ${data.totalCostVariance > 0 ? "text-red-600" : data.totalCostVariance < 0 ? "text-green-600" : ""}`}>
                                {formatCurrency(data.totalCostVariance)} ({formatPct(data.totalVariancePct)})
                            </p>
                        </div>
                        <StatusBadge status={data.woStatus} />
                    </div>
                </div>
            </CardHeader>
            <CardContent>
                {/* Summary KPIs */}
                <div className="grid grid-cols-3 gap-3 mb-4">
                    <div className="rounded-lg border-2 border-black p-3 bg-blue-50">
                        <p className="text-xs text-muted-foreground">Biaya Rencana</p>
                        <p className="text-sm font-bold">{formatCurrency(data.totalPlannedCost)}</p>
                    </div>
                    <div className="rounded-lg border-2 border-black p-3 bg-amber-50">
                        <p className="text-xs text-muted-foreground">Biaya Aktual</p>
                        <p className="text-sm font-bold">{formatCurrency(data.totalActualCost)}</p>
                    </div>
                    <div className={`rounded-lg border-2 border-black p-3 ${data.totalCostVariance > 0 ? "bg-red-50" : "bg-green-50"}`}>
                        <p className="text-xs text-muted-foreground">Selisih</p>
                        <p className="text-sm font-bold">{formatCurrency(data.totalCostVariance)}</p>
                    </div>
                </div>

                {/* Detail Table */}
                <div className="overflow-x-auto">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Material</TableHead>
                                <TableHead className="text-right">Rencana</TableHead>
                                <TableHead className="text-right">Aktual</TableHead>
                                <TableHead className="text-right">Selisih Qty</TableHead>
                                <TableHead className="text-right">Biaya Rencana</TableHead>
                                <TableHead className="text-right">Biaya Aktual</TableHead>
                                <TableHead className="text-right">Selisih</TableHead>
                                <TableHead>Status</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {data.lines.map((line) => (
                                <TableRow key={line.materialId}>
                                    <TableCell>
                                        <div>
                                            <p className="font-medium">{line.materialName}</p>
                                            <p className="text-xs text-muted-foreground">{line.materialCode} · {line.unit}</p>
                                        </div>
                                    </TableCell>
                                    <TableCell className="text-right">{line.plannedQty}</TableCell>
                                    <TableCell className="text-right">{line.actualQty}</TableCell>
                                    <TableCell className={`text-right ${line.qtyVariance > 0 ? "text-red-600" : line.qtyVariance < 0 ? "text-green-600" : ""}`}>
                                        {line.qtyVariance > 0 ? "+" : ""}{line.qtyVariance} ({formatPct(line.qtyVariancePct)})
                                    </TableCell>
                                    <TableCell className="text-right">{formatCurrency(line.plannedCost)}</TableCell>
                                    <TableCell className="text-right">{formatCurrency(line.actualCost)}</TableCell>
                                    <TableCell className={`text-right ${line.costVariance > 0 ? "text-red-600" : line.costVariance < 0 ? "text-green-600" : ""}`}>
                                        {formatCurrency(line.costVariance)}
                                    </TableCell>
                                    <TableCell>
                                        <StatusBadge status={line.status} />
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </div>
            </CardContent>
        </Card>
    )
}
