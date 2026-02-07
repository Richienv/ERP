"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { Button } from "@/components/ui/button"
import { Factory, AlertCircle, CheckCircle2, MoreHorizontal, Settings, Clock } from "lucide-react"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"

export function DetailedLineStatus() {
    const lines = [
        { id: "L01", name: "Weaving A", job: "SO-2026-0256", desc: "5000m Cotton", progress: 78, status: "On Schedule", color: "text-emerald-600", supervisor: "Pak Budi", operator: "Ahmad", efficiency: "94%", oee: "88%" },
        { id: "L02", name: "Knitting B", job: "SO-2026-0245", desc: "3000 pcs T-shirt", progress: 45, status: "Delayed 4hrs", color: "text-amber-600", supervisor: "Ibu Siti", operator: "Rudi", efficiency: "72%", oee: "65%" },
        { id: "L03", name: "Dyeing Wet", job: "MAINTENANCE", desc: "Repair in progress", progress: 0, status: "Down since 2PM", color: "text-red-600", supervisor: "Pak Joko", operator: "Technician", efficiency: "0%", oee: "0%" },
        { id: "L04", name: "Dyeing Dry", job: "SO-2026-0234", desc: "Navy fabric Rework", progress: 0, status: "Quality Hold", color: "text-red-600", supervisor: "Ibu Dewi", operator: "Sari", efficiency: "45%", oee: "50%" },
        { id: "L05", name: "Finishing A", job: "SO-2026-0267", desc: "2000m Ready", progress: 92, status: "Finishing", color: "text-emerald-600", supervisor: "Pak Bambang", operator: "Dedi", efficiency: "98%", oee: "95%" },
        { id: "L06", name: "Finishing B", job: "SO-2026-0299", desc: "Packaging", progress: 15, status: "Just Started", color: "text-blue-600", supervisor: "Pak Bambang", operator: "Eko", efficiency: "100%", oee: "98%" },
        { id: "L07", name: "Cutting", job: "SO-2026-0300", desc: "Pattern Cutting", progress: 60, status: "On Schedule", color: "text-emerald-600", supervisor: "Ibu Rina", operator: "Maya", efficiency: "92%", oee: "90%" },
        { id: "L08", name: "Sewing Line 1", job: "SO-2026-0305", desc: "Sleeve Assembly", progress: 34, status: "On Schedule", color: "text-emerald-600", supervisor: "Ibu Tini", operator: "Wati", efficiency: "89%", oee: "85%" },
        { id: "L09", name: "Sewing Line 2", job: "SO-2026-0312", desc: "Collar Stitching", progress: 88, status: "Finishing", color: "text-emerald-600", supervisor: "Ibu Tini", operator: "Susi", efficiency: "95%", oee: "92%" },
        { id: "L10", name: "Inspection A", job: "SO-2026-0288", desc: "Final QC", progress: 45, status: "Backlog", color: "text-amber-600", supervisor: "Pak Hasan", operator: "Budi", efficiency: "78%", oee: "75%" },
        { id: "L11", name: "Packing", job: "SO-2026-0290", desc: "Export Cartons", progress: 10, status: "Waiting Material", color: "text-red-600", supervisor: "Pak Udin", operator: "Joko", efficiency: "0%", oee: "0%" },
    ]

    return (
        <Card className="h-full flex flex-col border border-black shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] rounded-xl overflow-hidden bg-white dark:bg-black">
            <CardHeader className="p-6 border-b border-black bg-zinc-50 dark:bg-zinc-900 flex flex-row items-center justify-between">
                <div>
                    <CardTitle className="text-xl font-black uppercase tracking-wider flex items-center gap-2">
                        <Factory className="h-5 w-5" />
                        Status Stasiun Fisik (Detail)
                    </CardTitle>
                    <p className="text-sm text-muted-foreground mt-1">Live metrics across all 7 production lines.</p>
                </div>
                <div className="flex gap-2">
                    <Button variant="outline" size="sm" className="border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] bg-white h-8">
                        View All
                    </Button>
                    <Button variant="outline" size="sm" className="border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] bg-white h-8">
                        Report Issue
                    </Button>
                </div>
            </CardHeader>
            <CardContent className="p-0">
                <Table>
                    <TableHeader className="bg-zinc-100 dark:bg-zinc-900 border-b border-black/10">
                        <TableRow className="border-b border-black/5 hover:bg-transparent">
                            <TableHead className="font-bold text-black dark:text-white">ID</TableHead>
                            <TableHead className="font-bold text-black dark:text-white">Station / Line</TableHead>
                            <TableHead className="font-bold text-black dark:text-white">Active Job</TableHead>
                            <TableHead className="font-bold text-black dark:text-white">Progress</TableHead>
                            <TableHead className="font-bold text-black dark:text-white">Status</TableHead>
                            <TableHead className="font-bold text-black dark:text-white text-right">OEE</TableHead>
                            <TableHead className="font-bold text-black dark:text-white text-right">Actions</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {lines.map((line) => (
                            <TableRow key={line.id} className="hover:bg-zinc-50 dark:hover:bg-zinc-900/50 border-b border-black/5">
                                <TableCell className="font-mono font-medium">{line.id}</TableCell>
                                <TableCell>
                                    <div className="font-bold text-sm">{line.name}</div>
                                    <div className="text-xs text-muted-foreground">{line.supervisor} • {line.operator}</div>
                                </TableCell>
                                <TableCell>
                                    <Badge variant="secondary" className="font-mono font-bold text-[10px] bg-white border border-black/20 text-black shadow-sm mb-1">{line.job}</Badge>
                                    <div className="text-xs font-medium">{line.desc}</div>
                                </TableCell>
                                <TableCell className="w-[20%]">
                                    <div className="flex items-center gap-2 mb-1">
                                        <Progress value={line.progress} className={`h-2 border border-black/10 rounded-full flex-1 ${line.progress === 0 ? "bg-red-100" : "bg-zinc-100"}`} />
                                        <span className="text-xs font-bold">{line.progress}%</span>
                                    </div>
                                </TableCell>
                                <TableCell>
                                    <div className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-md text-xs font-bold border ${line.status.includes("Down") || line.status.includes("Hold") ? "bg-red-50 text-red-700 border-red-200" : line.status.includes("Delayed") ? "bg-amber-50 text-amber-700 border-amber-200" : "bg-emerald-50 text-emerald-700 border-emerald-200"}`}>
                                        {line.status.includes("Down") ? <AlertCircle className="h-3 w-3" /> : <Clock className="h-3 w-3" />}
                                        {line.status}
                                    </div>
                                </TableCell>
                                <TableCell className="text-right font-mono font-bold">{line.oee}</TableCell>
                                <TableCell className="text-right">
                                    <Button variant="ghost" size="icon" className="h-8 w-8">
                                        <MoreHorizontal className="h-4 w-4" />
                                    </Button>
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </CardContent>
        </Card>
    )
}
