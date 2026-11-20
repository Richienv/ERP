"use client"

import { Badge } from "@/components/ui/badge"
import { Trophy } from "lucide-react"

export interface PerformanceEmployee {
    name: string
    department: string
    attendanceRate: number
}

interface PerformanceWidgetProps {
    employees?: PerformanceEmployee[]
    totalActive?: number
    totalPresent?: number
}

export function PerformanceWidget({ employees = [], totalActive = 0, totalPresent = 0 }: PerformanceWidgetProps) {
    const attendanceRate = totalActive > 0 ? Math.round((totalPresent / totalActive) * 100) : 0

    // Top 3 by attendance rate
    const topPerformers = [...employees]
        .sort((a, b) => b.attendanceRate - a.attendanceRate)
        .slice(0, 3)

    return (
        <div className="col-span-1 md:col-span-2 border border-border bg-white shadow-sm dark:bg-zinc-900">
            <div className="border-b border-border p-4">
                <div className="flex items-center gap-2">
                    <div className="flex h-7 w-7 items-center justify-center border border-border bg-amber-100">
                        <Trophy className="h-3.5 w-3.5 text-amber-700" />
                    </div>
                    <span className="text-xs font-semibold text-zinc-600">Performa & Top Talent</span>
                </div>
            </div>
            <div className="p-4 space-y-4">
                <div className="grid grid-cols-2 gap-3">
                    <div className="border border-zinc-200 p-3">
                        <p className="text-xs font-bold text-zinc-400">Tingkat Kehadiran</p>
                        <div className="flex items-end gap-2 mt-1">
                            <span className="text-2xl font-semibold tracking-tighter">
                                {totalActive > 0 ? `${attendanceRate}%` : <span className="text-lg text-zinc-300">-</span>}
                            </span>
                        </div>
                        <div className="mt-2 h-1.5 w-full bg-zinc-200 overflow-hidden">
                            <div className="h-full bg-emerald-500 transition-all" style={{ width: `${attendanceRate}%` }} />
                        </div>
                    </div>
                    <div className="border border-zinc-200 p-3">
                        <p className="text-xs font-bold text-zinc-400">Karyawan Aktif</p>
                        <div className="flex items-end gap-2 mt-1">
                            <span className="text-2xl font-semibold tracking-tighter">
                                {totalActive > 0 ? totalActive : <span className="text-lg text-zinc-300">-</span>}
                            </span>
                            <span className="text-xs font-bold text-zinc-400 mb-1">{totalPresent} hadir hari ini</span>
                        </div>
                    </div>
                </div>

                {topPerformers.length > 0 && (
                    <div>
                        <h4 className="text-xs font-semibold text-zinc-500 mb-2">
                            Top Kehadiran (Departemen)
                        </h4>
                        <div className="space-y-2">
                            {topPerformers.map((emp, i) => (
                                <div key={i} className="flex items-center justify-between text-sm">
                                    <span className="text-zinc-500 text-xs">{emp.department || "Umum"}</span>
                                    <div className="flex items-center gap-2">
                                        <span className="font-bold text-sm">{emp.name}</span>
                                        <Badge className="border border-emerald-600 bg-emerald-50 text-emerald-700 text-xs font-semibold px-1.5 py-0">
                                            {emp.attendanceRate}%
                                        </Badge>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {topPerformers.length === 0 && (
                    <div className="py-4 text-center">
                        <p className="text-xs font-bold text-zinc-400">Belum ada data kehadiran</p>
                    </div>
                )}
            </div>
        </div>
    )
}
