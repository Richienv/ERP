"use client"

import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Award, TrendingUp } from "lucide-react"

export interface PerformanceRow {
    id: string
    employeeCode: string
    name: string
    department: string
    position: string
    attendanceDays: number
    workingDays: number
    attendanceRate: number
    lateCount: number
    overtimeHours: number
}

interface DetailedPerformanceTableProps {
    employees?: PerformanceRow[]
}

export function DetailedPerformanceTable({ employees = [] }: DetailedPerformanceTableProps) {
    // Sort by attendance rate descending
    const sorted = [...employees].sort((a, b) => b.attendanceRate - a.attendanceRate)

    return (
        <div className="mt-4 border-2 border-black bg-white shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] dark:bg-zinc-900 overflow-hidden">
            <div className="flex items-center justify-between border-b-2 border-black p-4 bg-zinc-50 dark:bg-zinc-800">
                <div className="flex items-center gap-2">
                    <div className="flex h-7 w-7 items-center justify-center border-2 border-black bg-purple-100">
                        <Award className="h-3.5 w-3.5 text-purple-700" />
                    </div>
                    <div>
                        <span className="text-sm font-black uppercase tracking-widest">Performance & Kehadiran</span>
                        <p className="text-[10px] text-zinc-500">Rekap kehadiran dan lembur bulan berjalan</p>
                    </div>
                </div>
            </div>
            <Table>
                <TableHeader>
                    <TableRow className="border-b-2 border-black bg-zinc-50 dark:bg-zinc-800 hover:bg-zinc-50">
                        <TableHead className="text-[10px] font-black uppercase tracking-widest">Karyawan</TableHead>
                        <TableHead className="text-[10px] font-black uppercase tracking-widest">Posisi</TableHead>
                        <TableHead className="text-[10px] font-black uppercase tracking-widest text-right">Hadir</TableHead>
                        <TableHead className="text-[10px] font-black uppercase tracking-widest text-right">Rate</TableHead>
                        <TableHead className="text-[10px] font-black uppercase tracking-widest text-right">Telat</TableHead>
                        <TableHead className="text-[10px] font-black uppercase tracking-widest text-right">Lembur</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {sorted.length === 0 ? (
                        <TableRow>
                            <TableCell colSpan={6} className="py-12 text-center">
                                <p className="text-sm font-bold text-zinc-400">Belum ada data karyawan</p>
                                <p className="text-[10px] text-zinc-400">Data akan muncul setelah karyawan ditambahkan</p>
                            </TableCell>
                        </TableRow>
                    ) : (
                        sorted.map((emp, i) => (
                            <TableRow key={emp.id} className={`border-b border-zinc-100 hover:bg-zinc-50 dark:hover:bg-zinc-800 ${i % 2 === 0 ? "" : "bg-zinc-50/50 dark:bg-zinc-800/30"}`}>
                                <TableCell>
                                    <div>
                                        <div className="text-sm font-bold">{emp.name}</div>
                                        <div className="text-[10px] text-zinc-500">{emp.employeeCode} &middot; {emp.department}</div>
                                    </div>
                                </TableCell>
                                <TableCell className="text-xs text-zinc-600">{emp.position}</TableCell>
                                <TableCell className="text-right text-sm tabular-nums font-bold">
                                    {emp.attendanceDays}/{emp.workingDays}
                                </TableCell>
                                <TableCell className="text-right">
                                    <Badge
                                        className={`border-2 px-1.5 py-0 text-[10px] font-black ${
                                            emp.attendanceRate >= 95
                                                ? "border-emerald-600 bg-emerald-50 text-emerald-700"
                                                : emp.attendanceRate >= 80
                                                    ? "border-amber-600 bg-amber-50 text-amber-700"
                                                    : "border-rose-600 bg-rose-50 text-rose-700"
                                        }`}
                                    >
                                        {emp.attendanceRate}%
                                    </Badge>
                                </TableCell>
                                <TableCell className="text-right text-sm tabular-nums">
                                    {emp.lateCount > 0 ? (
                                        <span className="text-amber-600 font-bold">{emp.lateCount}x</span>
                                    ) : (
                                        <span className="text-zinc-300">0</span>
                                    )}
                                </TableCell>
                                <TableCell className="text-right text-sm tabular-nums">
                                    {emp.overtimeHours > 0 ? (
                                        <span className="font-bold">{emp.overtimeHours.toFixed(1)} jam</span>
                                    ) : (
                                        <span className="text-zinc-300">-</span>
                                    )}
                                </TableCell>
                            </TableRow>
                        ))
                    )}
                </TableBody>
            </Table>
        </div>
    )
}
