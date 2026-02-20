"use client"

import Link from "next/link"
import { Users, ArrowRight, Clock, UserCheck, UserX, Coffee } from "lucide-react"

interface StaffTodayProps {
    totalStaff: number
    presentCount: number
    lateCount: number
    attendanceRate: number
    topEmployees: Array<{
        id: string
        name: string
        position: string
        department: string
        attendance: string
        currentTask: string
        checkIn: string
    }>
}

const statusConfig: Record<string, { label: string; color: string; icon: typeof UserCheck }> = {
    Present: { label: "Hadir", color: "bg-emerald-100 text-emerald-700 border-emerald-300", icon: UserCheck },
    Late: { label: "Terlambat", color: "bg-amber-100 text-amber-700 border-amber-300", icon: Clock },
    Absent: { label: "Absen", color: "bg-red-100 text-red-700 border-red-300", icon: UserX },
    "On Leave": { label: "Cuti", color: "bg-blue-100 text-blue-700 border-blue-300", icon: Coffee },
}

export function StaffToday({ totalStaff, presentCount, lateCount, attendanceRate, topEmployees }: StaffTodayProps) {
    const absentCount = totalStaff - presentCount

    return (
        <div className="bg-white dark:bg-zinc-900 border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b-2 border-black">
                <div className="flex items-center gap-2">
                    <Users className="h-5 w-5" />
                    <h3 className="text-sm font-black uppercase tracking-widest">Tim Hari Ini</h3>
                    {attendanceRate > 0 && (
                        <span className="text-[10px] font-black bg-emerald-100 text-emerald-700 border border-emerald-300 px-2 py-0.5 rounded-full">
                            {attendanceRate}% hadir
                        </span>
                    )}
                </div>
                <Link
                    href="/hcm/employee-master"
                    className="text-xs font-bold text-zinc-500 hover:text-black dark:hover:text-white flex items-center gap-1 transition-colors"
                >
                    Lihat Semua <ArrowRight className="h-3 w-3" />
                </Link>
            </div>

            {/* Stats Row */}
            <div className="grid grid-cols-4 border-b-2 border-black">
                {[
                    { label: "Total Staf", value: totalStaff, color: "text-zinc-900" },
                    { label: "Hadir", value: presentCount, color: "text-emerald-600" },
                    { label: "Terlambat", value: lateCount, color: "text-amber-600" },
                    { label: "Absen", value: absentCount, color: "text-red-600" },
                ].map((stat, i) => (
                    <div key={stat.label} className={`p-3 text-center ${i < 3 ? "border-r-2 border-black" : ""}`}>
                        <div className={`text-xl font-black ${stat.color} dark:text-white`}>{stat.value}</div>
                        <div className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">{stat.label}</div>
                    </div>
                ))}
            </div>

            {/* Employee Table */}
            {topEmployees.length > 0 ? (
                <div className="overflow-x-auto">
                    <table className="w-full">
                        <thead>
                            <tr className="border-b border-zinc-200 dark:border-zinc-800">
                                <th className="text-left text-[10px] font-black uppercase tracking-widest text-zinc-500 p-3">Nama</th>
                                <th className="text-left text-[10px] font-black uppercase tracking-widest text-zinc-500 p-3 hidden md:table-cell">Posisi</th>
                                <th className="text-left text-[10px] font-black uppercase tracking-widest text-zinc-500 p-3 hidden lg:table-cell">Departemen</th>
                                <th className="text-center text-[10px] font-black uppercase tracking-widest text-zinc-500 p-3">Status</th>
                                <th className="text-center text-[10px] font-black uppercase tracking-widest text-zinc-500 p-3 hidden md:table-cell">Check-in</th>
                                <th className="text-left text-[10px] font-black uppercase tracking-widest text-zinc-500 p-3 hidden lg:table-cell">Tugas</th>
                            </tr>
                        </thead>
                        <tbody>
                            {topEmployees.map((emp) => {
                                const config = statusConfig[emp.attendance] || statusConfig.Absent
                                return (
                                    <tr key={emp.id} className="border-b border-zinc-100 dark:border-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors">
                                        <td className="p-3">
                                            <div className="font-bold text-sm">{emp.name}</div>
                                        </td>
                                        <td className="p-3 text-sm text-zinc-600 dark:text-zinc-400 hidden md:table-cell">{emp.position || "-"}</td>
                                        <td className="p-3 text-sm text-zinc-600 dark:text-zinc-400 hidden lg:table-cell">{emp.department || "-"}</td>
                                        <td className="p-3 text-center">
                                            <span className={`inline-flex items-center gap-1 text-[10px] font-black px-2 py-0.5 rounded-full border ${config.color}`}>
                                                {config.label}
                                            </span>
                                        </td>
                                        <td className="p-3 text-center text-sm font-mono text-zinc-600 dark:text-zinc-400 hidden md:table-cell">{emp.checkIn}</td>
                                        <td className="p-3 text-sm text-zinc-500 hidden lg:table-cell truncate max-w-[200px]">{emp.currentTask}</td>
                                    </tr>
                                )
                            })}
                        </tbody>
                    </table>
                </div>
            ) : (
                <div className="p-6 text-center text-zinc-400 text-sm">
                    Belum ada data kehadiran hari ini
                </div>
            )}
        </div>
    )
}
