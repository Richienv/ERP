"use client"

import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Search, Filter, Activity } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useState, useMemo } from "react"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

export interface StaffActivityRow {
    id: string
    employeeCode: string
    name: string
    department: string
    position: string
    status: string
    clockIn: string | null
    clockOut: string | null
    workingHours: number
    overtimeHours: number
    isLate: boolean
}

interface DetailedStaffActivityProps {
    staff?: StaffActivityRow[]
    departments?: string[]
}

function getStatusColor(status: string) {
    switch (status) {
        case "PRESENT":
        case "REMOTE":
            return "border-emerald-600 bg-emerald-50 text-emerald-700"
        case "LEAVE":
        case "SICK":
            return "border-blue-600 bg-blue-50 text-blue-700"
        case "ABSENT":
            return "border-rose-600 bg-rose-50 text-rose-700"
        default:
            return "border-zinc-300 bg-zinc-50 text-zinc-500"
    }
}

function getStatusLabel(status: string) {
    switch (status) {
        case "PRESENT": return "Hadir"
        case "REMOTE": return "Remote"
        case "LEAVE": return "Cuti"
        case "SICK": return "Sakit"
        case "ABSENT": return "Tidak Hadir"
        default: return status
    }
}

export function DetailedStaffActivity({ staff = [], departments = [] }: DetailedStaffActivityProps) {
    const [search, setSearch] = useState("")
    const [filterDept, setFilterDept] = useState("all")
    const [filterStatus, setFilterStatus] = useState("all")

    const filtered = useMemo(() => {
        return staff.filter((emp) => {
            const matchesSearch = search === "" ||
                emp.name.toLowerCase().includes(search.toLowerCase()) ||
                emp.employeeCode.toLowerCase().includes(search.toLowerCase()) ||
                emp.position.toLowerCase().includes(search.toLowerCase())

            const matchesDept = filterDept === "all" || emp.department === filterDept

            const matchesStatus = filterStatus === "all" || emp.status === filterStatus

            return matchesSearch && matchesDept && matchesStatus
        })
    }, [staff, search, filterDept, filterStatus])

    const hasFilters = search !== "" || filterDept !== "all" || filterStatus !== "all"

    return (
        <div className="border-2 border-black bg-white shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] dark:bg-zinc-900 overflow-hidden">
            <div className="flex flex-col gap-3 border-b-2 border-black bg-zinc-50 p-4 dark:bg-zinc-800 md:flex-row md:items-center md:justify-between">
                <div className="flex items-center gap-2">
                    <div className="flex h-7 w-7 items-center justify-center border-2 border-black bg-blue-100">
                        <Activity className="h-3.5 w-3.5 text-blue-700" />
                    </div>
                    <div>
                        <span className="text-sm font-black uppercase tracking-widest">Aktivitas Karyawan Hari Ini</span>
                        <p className="text-[10px] text-zinc-500">Status kehadiran dan jam kerja real-time</p>
                    </div>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                    <div className="relative">
                        <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-zinc-400" />
                        <input
                            className="h-9 w-52 border-2 border-black bg-white pl-8 pr-3 text-xs font-medium shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] placeholder:text-zinc-400 focus:outline-none focus:ring-1 focus:ring-black"
                            placeholder="Cari nama / kode..."
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                        />
                    </div>
                    <Select value={filterDept} onValueChange={setFilterDept}>
                        <SelectTrigger className="h-9 w-40 border-2 border-black text-xs font-bold shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
                            <SelectValue placeholder="Departemen" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">Semua Dept</SelectItem>
                            {departments.map((dept) => (
                                <SelectItem key={dept} value={dept}>{dept}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                    <Select value={filterStatus} onValueChange={setFilterStatus}>
                        <SelectTrigger className="h-9 w-32 border-2 border-black text-xs font-bold shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
                            <SelectValue placeholder="Status" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">Semua</SelectItem>
                            <SelectItem value="PRESENT">Hadir</SelectItem>
                            <SelectItem value="REMOTE">Remote</SelectItem>
                            <SelectItem value="LEAVE">Cuti</SelectItem>
                            <SelectItem value="ABSENT">Tidak Hadir</SelectItem>
                        </SelectContent>
                    </Select>
                    {hasFilters && (
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => { setSearch(""); setFilterDept("all"); setFilterStatus("all") }}
                            className="h-9 border-2 border-black text-[10px] font-bold uppercase shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:shadow-none hover:translate-x-[2px] hover:translate-y-[2px] transition-all"
                        >
                            Reset
                        </Button>
                    )}
                </div>
            </div>
            <Table>
                <TableHeader>
                    <TableRow className="border-b-2 border-black bg-zinc-50 dark:bg-zinc-800 hover:bg-zinc-50">
                        <TableHead className="text-[10px] font-black uppercase tracking-widest">Karyawan</TableHead>
                        <TableHead className="text-[10px] font-black uppercase tracking-widest">Departemen</TableHead>
                        <TableHead className="text-[10px] font-black uppercase tracking-widest">Status</TableHead>
                        <TableHead className="text-[10px] font-black uppercase tracking-widest text-right">Clock In</TableHead>
                        <TableHead className="text-[10px] font-black uppercase tracking-widest text-right">Clock Out</TableHead>
                        <TableHead className="text-[10px] font-black uppercase tracking-widest text-right">Jam Kerja</TableHead>
                        <TableHead className="text-[10px] font-black uppercase tracking-widest text-right">Lembur</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {filtered.length === 0 ? (
                        <TableRow>
                            <TableCell colSpan={7} className="py-12 text-center">
                                <div className="flex flex-col items-center gap-2">
                                    <Activity className="h-8 w-8 text-zinc-200" />
                                    <p className="text-sm font-bold text-zinc-400">
                                        {staff.length === 0 ? "Belum ada data karyawan" : "Tidak ada hasil untuk filter ini"}
                                    </p>
                                </div>
                            </TableCell>
                        </TableRow>
                    ) : (
                        filtered.map((emp, i) => (
                            <TableRow key={emp.id} className={`border-b border-zinc-100 hover:bg-zinc-50 dark:hover:bg-zinc-800 ${i % 2 === 0 ? "" : "bg-zinc-50/50 dark:bg-zinc-800/30"}`}>
                                <TableCell>
                                    <div className="flex items-center gap-2.5">
                                        <Avatar className="h-7 w-7 border-2 border-black">
                                            <AvatarFallback className="text-[10px] font-black bg-zinc-100">{emp.name.substring(0, 2).toUpperCase()}</AvatarFallback>
                                        </Avatar>
                                        <div>
                                            <div className="text-sm font-bold">{emp.name}</div>
                                            <div className="text-[10px] text-zinc-500">{emp.employeeCode} &middot; {emp.position}</div>
                                        </div>
                                    </div>
                                </TableCell>
                                <TableCell className="text-xs font-medium text-zinc-600">{emp.department}</TableCell>
                                <TableCell>
                                    <Badge className={`border-2 px-1.5 py-0 text-[10px] font-black ${getStatusColor(emp.status)}`}>
                                        {emp.isLate && emp.status === "PRESENT" ? (
                                            <span>Hadir (Telat)</span>
                                        ) : (
                                            getStatusLabel(emp.status)
                                        )}
                                    </Badge>
                                </TableCell>
                                <TableCell className="text-right text-xs tabular-nums font-mono text-zinc-600">
                                    {emp.clockIn || "-"}
                                </TableCell>
                                <TableCell className="text-right text-xs tabular-nums font-mono text-zinc-600">
                                    {emp.clockOut || "-"}
                                </TableCell>
                                <TableCell className="text-right text-sm tabular-nums font-bold">
                                    {emp.workingHours > 0 ? `${emp.workingHours.toFixed(1)}` : "-"}
                                </TableCell>
                                <TableCell className="text-right text-sm tabular-nums">
                                    {emp.overtimeHours > 0 ? (
                                        <span className="font-bold text-amber-600">{emp.overtimeHours.toFixed(1)}</span>
                                    ) : (
                                        <span className="text-zinc-300">-</span>
                                    )}
                                </TableCell>
                            </TableRow>
                        ))
                    )}
                </TableBody>
            </Table>
            {/* Footer with count */}
            {filtered.length > 0 && (
                <div className="border-t-2 border-black bg-zinc-50 px-4 py-2 dark:bg-zinc-800">
                    <span className="text-[10px] font-bold text-zinc-500">
                        Menampilkan {filtered.length} dari {staff.length} karyawan
                    </span>
                </div>
            )}
        </div>
    )
}
