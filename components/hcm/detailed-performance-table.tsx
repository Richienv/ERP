"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Star, TrendingUp, TrendingDown, Award } from "lucide-react"

export function DetailedPerformanceTable() {
    const employees = [
        { id: "EMP-001", name: "Asep Sunandar", role: "Operator Line 1", rating: 4.8, trend: "up", pieces: 1250, defects: 2, attendance: "100%" },
        { id: "EMP-003", name: "Siti Aminah", role: "QC Inspector", rating: 4.9, trend: "up", pieces: 4500, defects: 0, attendance: "100%" },
        { id: "EMP-005", name: "Rina Wati", role: "Operator Line 2", rating: 4.5, trend: "stable", pieces: 1100, defects: 5, attendance: "98%" },
        { id: "EMP-009", name: "Budi Santoso", role: "Maintenance", rating: 4.2, trend: "down", pieces: 15, defects: 1, attendance: "95%" },
        { id: "EMP-012", name: "Agus Setiawan", role: "Warehouse", rating: 4.7, trend: "up", pieces: 890, defects: 0, attendance: "99%" },
    ]

    return (
        <Card className="border border-black shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] rounded-xl overflow-hidden bg-white dark:bg-black mt-6">
            <CardHeader className="p-6 border-b border-black bg-zinc-50 dark:bg-zinc-900">
                <CardTitle className="text-xl font-black uppercase tracking-wider flex items-center gap-2">
                    <Award className="h-5 w-5 text-purple-600" />
                    Performance & Quality Ratings (KPI)
                </CardTitle>
                <p className="text-sm text-muted-foreground font-medium mt-1">Detailed breakdown of individual staff performance metrics.</p>
            </CardHeader>
            <CardContent className="p-0">
                <Table>
                    <TableHeader className="bg-zinc-100 dark:bg-zinc-900 border-b border-black/10">
                        <TableRow className="border-b border-black/5 hover:bg-transparent">
                            <TableHead className="font-bold text-black dark:text-white">Employee</TableHead>
                            <TableHead className="font-bold text-black dark:text-white">Role</TableHead>
                            <TableHead className="font-bold text-black dark:text-white">Quality Rating (5.0)</TableHead>
                            <TableHead className="font-bold text-black dark:text-white">Output (Qty)</TableHead>
                            <TableHead className="font-bold text-black dark:text-white">Defects</TableHead>
                            <TableHead className="font-bold text-black dark:text-white text-right">Att.</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {employees.map((emp) => (
                            <TableRow key={emp.id} className="hover:bg-muted/50 transition-colors border-b border-black/5 last:border-0">
                                <TableCell className="font-bold">{emp.name}</TableCell>
                                <TableCell className="text-xs text-muted-foreground">{emp.role}</TableCell>
                                <TableCell>
                                    <div className="flex items-center gap-2">
                                        <div className="flex text-amber-500">
                                            {[...Array(5)].map((_, i) => (
                                                <Star key={i} className={`h-3 w-3 ${i < Math.floor(emp.rating) ? "fill-current" : "text-zinc-300"}`} />
                                            ))}
                                        </div>
                                        <span className="font-bold text-sm">{emp.rating}</span>
                                        {emp.trend === "up" && <TrendingUp className="h-3 w-3 text-emerald-600" />}
                                        {emp.trend === "down" && <TrendingDown className="h-3 w-3 text-red-600" />}
                                    </div>
                                </TableCell>
                                <TableCell className="font-mono text-sm">{emp.pieces}</TableCell>
                                <TableCell>
                                    <Badge variant="outline" className={`${emp.defects === 0 ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-red-50 text-red-700 border-red-200"}`}>
                                        {emp.defects} Defects
                                    </Badge>
                                </TableCell>
                                <TableCell className="text-right font-mono text-sm">{emp.attendance}</TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </CardContent>
        </Card>
    )
}
