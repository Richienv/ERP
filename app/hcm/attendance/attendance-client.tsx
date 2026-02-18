"use client"

import { useState, useMemo, useTransition } from "react"
import { useQueryClient } from "@tanstack/react-query"
import { queryKeys } from "@/lib/query-keys"
import {
    ClipboardList,
    BarChart3,
    Clock,
    CalendarDays,
    Users,
    AlertTriangle,
    TrendingUp,
    RefreshCw,
    UserX,
} from "lucide-react"
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { NB } from "@/lib/dialog-styles"
import { ScrollArea } from "@/components/ui/scroll-area"
import { toast } from "sonner"
import {
    getAttendanceSnapshot,
    recordAttendanceEvent,
    submitLeaveRequest,
    approveLeaveRequest,
    rejectLeaveRequest,
} from "@/app/actions/hcm"

// ==============================================================================
// Types
// ==============================================================================

interface AttendanceRow {
    id: string
    employeeCode: string
    name: string
    department: string
    position: string
    clockIn: string
    clockOut: string
    workingHours: number
    overtimeHours: number
    status: "PRESENT" | "ABSENT" | "LEAVE" | "SICK" | "REMOTE"
    isLate: boolean
}

interface LeaveRow {
    id: string
    employeeId: string
    employeeName: string
    department: string
    startDate: string
    endDate: string
    type: string
    status: "PENDING" | "APPROVED" | "REJECTED" | "CANCELLED"
    reason?: string | null
    approverName?: string
}

interface EmployeeOption {
    id: string
    employeeCode: string
    name: string
    department: string
}

interface AttendanceClientProps {
    initialSnapshot: {
        date: string
        rows: AttendanceRow[]
        departments: string[]
        stats: {
            totalEmployees: number
            presentCount: number
            lateCount: number
            leaveCount: number
            absentCount: number
            attendanceRate: number
        }
    }
    initialEmployees: EmployeeOption[]
    initialLeaveRequests: LeaveRow[]
}

// ==============================================================================
// Constants
// ==============================================================================

const TAB_CONFIG = [
    { key: "today", label: "Hari Ini", icon: ClipboardList, color: "bg-emerald-100 text-emerald-900 border-emerald-400" },
    { key: "monthly", label: "Bulanan", icon: BarChart3, color: "bg-blue-100 text-blue-900 border-blue-400" },
    { key: "overtime", label: "Lembur", icon: Clock, color: "bg-amber-100 text-amber-900 border-amber-400" },
    { key: "leave", label: "Cuti & Izin", icon: CalendarDays, color: "bg-purple-100 text-purple-900 border-purple-400" },
] as const

const STATUS_BADGE: Record<string, string> = {
    PRESENT: "bg-emerald-100 text-emerald-700 border-emerald-300",
    LATE: "bg-red-100 text-red-700 border-red-300",
    LEAVE: "bg-blue-100 text-blue-700 border-blue-300",
    SICK: "bg-amber-100 text-amber-700 border-amber-300",
    REMOTE: "bg-purple-100 text-purple-700 border-purple-300",
    ABSENT: "bg-zinc-100 text-zinc-700 border-zinc-300",
}

const STATUS_LABEL: Record<string, string> = {
    PRESENT: "Hadir",
    LATE: "Terlambat",
    LEAVE: "Cuti",
    SICK: "Sakit",
    REMOTE: "Remote",
    ABSENT: "Absen",
}

const LEAVE_TYPE_LABELS: Record<string, string> = {
    ANNUAL: "Tahunan",
    SICK: "Sakit",
    UNPAID: "Tidak Dibayar",
    MATERNITY: "Melahirkan",
    OTHER: "Lainnya",
}

const todayInput = () => new Date().toISOString().slice(0, 10)

// ==============================================================================
// Component
// ==============================================================================

export function AttendanceClient({
    initialSnapshot,
    initialEmployees,
    initialLeaveRequests,
}: AttendanceClientProps) {
    const queryClient = useQueryClient()
    const [isPending, startTransition] = useTransition()

    // State
    const [activeTab, setActiveTab] = useState("today")
    const [selectedDate, setSelectedDate] = useState(initialSnapshot.date || todayInput())
    const [selectedDepartment, setSelectedDepartment] = useState("all")
    const [rows, setRows] = useState<AttendanceRow[]>(initialSnapshot.rows || [])
    const [departments] = useState<string[]>(initialSnapshot.departments || [])
    const [stats, setStats] = useState(initialSnapshot.stats)
    const [leaveRequests, setLeaveRequests] = useState<LeaveRow[]>(initialLeaveRequests)
    const [loadingFilter, setLoadingFilter] = useState(false)

    // Clock dialog
    const [clockOpen, setClockOpen] = useState(false)
    const [clockForm, setClockForm] = useState({ employeeId: "", mode: "CLOCK_IN" as "CLOCK_IN" | "CLOCK_OUT" })
    const [clockSubmitting, setClockSubmitting] = useState(false)

    // Leave form
    const [leaveSubmitting, setLeaveSubmitting] = useState(false)
    const [leaveForm, setLeaveForm] = useState({
        employeeId: "",
        type: "ANNUAL",
        startDate: todayInput(),
        endDate: todayInput(),
        reason: "",
    })

    // Derived
    const overtimeRows = useMemo(
        () => rows.filter((r) => r.overtimeHours > 0).sort((a, b) => b.overtimeHours - a.overtimeHours),
        [rows]
    )
    const pendingLeaves = useMemo(
        () => leaveRequests.filter((l) => l.status === "PENDING"),
        [leaveRequests]
    )
    const tabCounts: Record<string, number> = {
        today: stats.totalEmployees,
        monthly: 0,
        overtime: overtimeRows.length,
        leave: pendingLeaves.length,
    }

    // Handlers
    const handleFilter = async () => {
        setLoadingFilter(true)
        try {
            const snap = await getAttendanceSnapshot({
                date: selectedDate,
                department: selectedDepartment === "all" ? undefined : selectedDepartment,
            })
            setRows(snap.rows as AttendanceRow[])
            setStats(snap.stats)
        } catch {
            toast.error("Gagal memuat data absensi")
        } finally {
            setLoadingFilter(false)
        }
    }

    const handleRefresh = () => {
        queryClient.invalidateQueries({ queryKey: queryKeys.hcmAttendance.all })
    }

    const handleClockSubmit = async () => {
        if (!clockForm.employeeId) {
            toast.error("Pilih karyawan terlebih dahulu")
            return
        }
        setClockSubmitting(true)
        try {
            const result = await recordAttendanceEvent({
                employeeId: clockForm.employeeId,
                mode: clockForm.mode,
            })
            if (!result.success) {
                toast.error("error" in result ? String(result.error) : "Gagal mencatat absensi")
                return
            }
            toast.success("message" in result ? result.message : "Absensi berhasil dicatat")
            setClockOpen(false)
            setClockForm({ employeeId: "", mode: "CLOCK_IN" })
            handleFilter()
        } catch {
            toast.error("Terjadi kesalahan")
        } finally {
            setClockSubmitting(false)
        }
    }

    const handleSubmitLeave = async () => {
        if (!leaveForm.employeeId || !leaveForm.startDate || !leaveForm.endDate) {
            toast.error("Lengkapi karyawan, tanggal mulai & selesai")
            return
        }
        setLeaveSubmitting(true)
        try {
            const result = await submitLeaveRequest({
                employeeId: leaveForm.employeeId,
                type: leaveForm.type,
                startDate: leaveForm.startDate,
                endDate: leaveForm.endDate,
                reason: leaveForm.reason,
            })
            if (!result.success) {
                toast.error("error" in result ? String(result.error) : "Gagal mengajukan cuti")
                return
            }
            toast.success("Pengajuan cuti berhasil dibuat")
            setLeaveForm({ employeeId: "", type: "ANNUAL", startDate: todayInput(), endDate: todayInput(), reason: "" })
            queryClient.invalidateQueries({ queryKey: queryKeys.hcmAttendance.all })
        } catch {
            toast.error("Terjadi kesalahan")
        } finally {
            setLeaveSubmitting(false)
        }
    }

    const handleApprove = async (id: string) => {
        const result = await approveLeaveRequest(id)
        if (!result.success) {
            toast.error("error" in result ? String(result.error) : "Gagal menyetujui cuti")
            return
        }
        toast.success("Pengajuan cuti disetujui")
        queryClient.invalidateQueries({ queryKey: queryKeys.hcmAttendance.all })
    }

    const handleReject = async (id: string) => {
        const result = await rejectLeaveRequest(id, "Ditolak dari modul Absensi")
        if (!result.success) {
            toast.error("error" in result ? String(result.error) : "Gagal menolak cuti")
            return
        }
        toast.success("Pengajuan cuti ditolak")
        queryClient.invalidateQueries({ queryKey: queryKeys.hcmAttendance.all })
    }

    const getStatusKey = (status: string, isLate: boolean) => {
        if (status === "PRESENT" && isLate) return "LATE"
        return status
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-black uppercase tracking-wider">
                        Pelacakan Absensi
                    </h1>
                    <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider">
                        Monitor kehadiran, jam kerja, lembur & cuti
                    </p>
                </div>
                <div className="flex gap-2">
                    <button
                        onClick={handleRefresh}
                        disabled={isPending}
                        className="flex items-center gap-1.5 px-4 py-2.5 border-2 border-black text-[10px] font-black uppercase tracking-wider bg-white hover:bg-zinc-50 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] active:shadow-none active:translate-x-[2px] active:translate-y-[2px] transition-all"
                    >
                        <RefreshCw className={`h-3.5 w-3.5 ${isPending ? "animate-spin" : ""}`} />
                        Muat Ulang
                    </button>
                    <button
                        onClick={() => setClockOpen(true)}
                        className="flex items-center gap-1.5 px-4 py-2.5 border-2 border-black text-[10px] font-black uppercase tracking-wider bg-black text-white shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] active:shadow-none active:translate-x-[2px] active:translate-y-[2px] transition-all"
                    >
                        <Clock className="h-3.5 w-3.5" />
                        Clock In/Out
                    </button>
                </div>
            </div>

            {/* Tabs */}
            <div className="flex gap-2 overflow-x-auto pb-1">
                {TAB_CONFIG.map((tab) => {
                    const Icon = tab.icon
                    const isActive = activeTab === tab.key
                    const count = tabCounts[tab.key]
                    return (
                        <button
                            key={tab.key}
                            onClick={() => setActiveTab(tab.key)}
                            className={`flex items-center gap-1.5 px-4 py-2.5 border-2 border-black text-[10px] font-black uppercase tracking-wider transition-all shrink-0 ${
                                isActive
                                    ? `${tab.color} shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]`
                                    : "bg-white hover:bg-zinc-50"
                            }`}
                        >
                            <Icon className="h-3.5 w-3.5" />
                            {tab.label}
                            {count > 0 && (
                                <span className={`ml-1 px-1.5 py-0.5 text-[8px] font-black border border-black ${
                                    isActive ? "bg-white text-black" : "bg-black text-white"
                                }`}>
                                    {count}
                                </span>
                            )}
                        </button>
                    )
                })}
            </div>

            {/* ================================================================ */}
            {/* Tab: Hari Ini */}
            {/* ================================================================ */}
            {activeTab === "today" && (
                <div className="space-y-6">
                    {/* Filter */}
                    <div className="border-2 border-black bg-white p-4 flex flex-col md:flex-row gap-3 items-start md:items-end">
                        <div>
                            <label className="text-[10px] font-black uppercase tracking-wider text-zinc-500 mb-1 block">Tanggal</label>
                            <input
                                type="date"
                                value={selectedDate}
                                onChange={(e) => setSelectedDate(e.target.value)}
                                className="border-2 border-black font-bold h-10 px-3 w-[180px]"
                            />
                        </div>
                        <div>
                            <label className="text-[10px] font-black uppercase tracking-wider text-zinc-500 mb-1 block">Departemen</label>
                            <select
                                value={selectedDepartment}
                                onChange={(e) => setSelectedDepartment(e.target.value)}
                                className="border-2 border-black font-bold h-10 px-3 w-[200px] bg-white"
                            >
                                <option value="all">Semua Departemen</option>
                                {departments.map((d) => (
                                    <option key={d} value={d}>{d}</option>
                                ))}
                            </select>
                        </div>
                        <button
                            onClick={handleFilter}
                            disabled={loadingFilter}
                            className="px-4 h-10 border-2 border-black text-[10px] font-black uppercase tracking-wider bg-black text-white shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] active:shadow-none active:translate-x-[1px] active:translate-y-[1px] transition-all"
                        >
                            {loadingFilter ? "Memuat..." : "Terapkan"}
                        </button>
                    </div>

                    {/* KPI Cards */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <div className="border-2 border-black bg-white shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] p-4">
                            <div className="flex items-center justify-between mb-2">
                                <span className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Hadir</span>
                                <Users className="h-4 w-4 text-emerald-600" />
                            </div>
                            <div className="text-3xl font-black text-emerald-600">{stats.presentCount}</div>
                            <p className="text-[10px] font-bold text-zinc-400 mt-1">dari {stats.totalEmployees} karyawan</p>
                        </div>
                        <div className="border-2 border-black bg-white shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] p-4">
                            <div className="flex items-center justify-between mb-2">
                                <span className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Terlambat</span>
                                <AlertTriangle className="h-4 w-4 text-amber-600" />
                            </div>
                            <div className="text-3xl font-black text-amber-600">{stats.lateCount}</div>
                            <p className="text-[10px] font-bold text-zinc-400 mt-1">telat clock-in</p>
                        </div>
                        <div className="border-2 border-black bg-white shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] p-4">
                            <div className="flex items-center justify-between mb-2">
                                <span className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Tidak Hadir</span>
                                <UserX className="h-4 w-4 text-red-600" />
                            </div>
                            <div className="text-3xl font-black text-red-600">{stats.absentCount}</div>
                            <p className="text-[10px] font-bold text-zinc-400 mt-1">absen tanpa catatan</p>
                        </div>
                        <div className="border-2 border-black bg-white shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] p-4">
                            <div className="flex items-center justify-between mb-2">
                                <span className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Kehadiran</span>
                                <TrendingUp className="h-4 w-4" />
                            </div>
                            <div className="text-3xl font-black">{stats.attendanceRate}%</div>
                            <p className="text-[10px] font-bold text-zinc-400 mt-1">termasuk cuti</p>
                        </div>
                    </div>

                    {/* Attendance Table */}
                    <div className="border-2 border-black bg-white overflow-hidden">
                        <div className="bg-black text-white px-4 py-3 flex items-center justify-between">
                            <span className="text-xs font-black uppercase tracking-widest">
                                Absensi — {new Date(selectedDate).toLocaleDateString("id-ID", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
                            </span>
                            <span className="text-[9px] font-black px-2 py-0.5 bg-white text-black">{rows.length}</span>
                        </div>
                        <div className="overflow-x-auto">
                            <table className="w-full">
                                <thead>
                                    <tr className="bg-zinc-100 border-b-2 border-black">
                                        <th className="text-left text-[10px] font-black uppercase tracking-widest text-zinc-500 px-4 py-2.5">Karyawan</th>
                                        <th className="text-left text-[10px] font-black uppercase tracking-widest text-zinc-500 px-4 py-2.5">Masuk</th>
                                        <th className="text-left text-[10px] font-black uppercase tracking-widest text-zinc-500 px-4 py-2.5">Keluar</th>
                                        <th className="text-left text-[10px] font-black uppercase tracking-widest text-zinc-500 px-4 py-2.5">Jam Kerja</th>
                                        <th className="text-left text-[10px] font-black uppercase tracking-widest text-zinc-500 px-4 py-2.5">Lembur</th>
                                        <th className="text-left text-[10px] font-black uppercase tracking-widest text-zinc-500 px-4 py-2.5">Status</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {rows.length === 0 ? (
                                        <tr>
                                            <td colSpan={6} className="px-4 py-8 text-center">
                                                <ClipboardList className="h-8 w-8 mx-auto text-zinc-200 mb-2" />
                                                <span className="text-[10px] font-black uppercase tracking-widest text-zinc-400">
                                                    Tidak ada data absensi
                                                </span>
                                            </td>
                                        </tr>
                                    ) : (
                                        rows.map((r) => {
                                            const sk = getStatusKey(r.status, r.isLate)
                                            return (
                                                <tr key={r.id} className="border-b border-zinc-200 hover:bg-zinc-50 transition-colors">
                                                    <td className="px-4 py-3">
                                                        <div className="font-bold text-sm">{r.name}</div>
                                                        <div className="text-[10px] text-zinc-500 font-medium">{r.employeeCode} · {r.department}</div>
                                                    </td>
                                                    <td className="px-4 py-3 font-mono text-sm font-bold">{r.clockIn || "—"}</td>
                                                    <td className="px-4 py-3 font-mono text-sm font-bold">{r.clockOut || "—"}</td>
                                                    <td className="px-4 py-3 text-sm font-bold">{r.workingHours.toFixed(1)} jam</td>
                                                    <td className="px-4 py-3 text-sm font-bold">
                                                        {r.overtimeHours > 0 ? (
                                                            <span className="text-amber-600">{r.overtimeHours.toFixed(1)} jam</span>
                                                        ) : (
                                                            <span className="text-zinc-300">—</span>
                                                        )}
                                                    </td>
                                                    <td className="px-4 py-3">
                                                        <span className={`inline-block px-2 py-0.5 text-[10px] font-black uppercase border ${STATUS_BADGE[sk] || STATUS_BADGE.ABSENT}`}>
                                                            {STATUS_LABEL[sk] || "Absen"}
                                                        </span>
                                                    </td>
                                                </tr>
                                            )
                                        })
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            )}

            {/* ================================================================ */}
            {/* Tab: Laporan Bulanan */}
            {/* ================================================================ */}
            {activeTab === "monthly" && (
                <div className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div className="border-2 border-black bg-white shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] p-5">
                            <span className="text-[10px] font-black uppercase tracking-widest text-zinc-500 block mb-2">Rata-rata Jam Kerja</span>
                            <div className="text-3xl font-black">
                                {rows.length > 0
                                    ? (rows.reduce((s, r) => s + r.workingHours, 0) / rows.length).toFixed(1)
                                    : "0.0"}{" "}
                                <span className="text-sm text-zinc-400">jam</span>
                            </div>
                        </div>
                        <div className="border-2 border-black bg-white shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] p-5">
                            <span className="text-[10px] font-black uppercase tracking-widest text-zinc-500 block mb-2">Total Lembur</span>
                            <div className="text-3xl font-black text-amber-600">
                                {rows.reduce((s, r) => s + r.overtimeHours, 0).toFixed(1)}{" "}
                                <span className="text-sm text-zinc-400">jam</span>
                            </div>
                        </div>
                        <div className="border-2 border-black bg-white shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] p-5">
                            <span className="text-[10px] font-black uppercase tracking-widest text-zinc-500 block mb-2">Ketepatan Waktu</span>
                            <div className="text-3xl font-black text-emerald-600">
                                {stats.totalEmployees > 0
                                    ? Math.round(((stats.presentCount - stats.lateCount) / stats.totalEmployees) * 100)
                                    : 0}%
                            </div>
                        </div>
                    </div>
                    <div className="border-2 border-black bg-white p-6 text-center">
                        <BarChart3 className="h-8 w-8 mx-auto text-zinc-200 mb-2" />
                        <span className="text-[10px] font-black uppercase tracking-widest text-zinc-400">
                            Gunakan filter tanggal di tab "Hari Ini" untuk memilih periode
                        </span>
                    </div>
                </div>
            )}

            {/* ================================================================ */}
            {/* Tab: Lembur */}
            {/* ================================================================ */}
            {activeTab === "overtime" && (
                <div className="border-2 border-black bg-white overflow-hidden">
                    <div className="bg-black text-white px-4 py-3 flex items-center justify-between">
                        <span className="text-xs font-black uppercase tracking-widest">Manajemen Lembur</span>
                        <span className="text-[9px] font-black px-2 py-0.5 bg-amber-400 text-black">{overtimeRows.length}</span>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead>
                                <tr className="bg-zinc-100 border-b-2 border-black">
                                    <th className="text-left text-[10px] font-black uppercase tracking-widest text-zinc-500 px-4 py-2.5">Karyawan</th>
                                    <th className="text-left text-[10px] font-black uppercase tracking-widest text-zinc-500 px-4 py-2.5">Departemen</th>
                                    <th className="text-left text-[10px] font-black uppercase tracking-widest text-zinc-500 px-4 py-2.5">Jam Kerja</th>
                                    <th className="text-left text-[10px] font-black uppercase tracking-widest text-zinc-500 px-4 py-2.5">Lembur</th>
                                </tr>
                            </thead>
                            <tbody>
                                {overtimeRows.length === 0 ? (
                                    <tr>
                                        <td colSpan={4} className="px-4 py-8 text-center">
                                            <Clock className="h-8 w-8 mx-auto text-zinc-200 mb-2" />
                                            <span className="text-[10px] font-black uppercase tracking-widest text-zinc-400">
                                                Belum ada data lembur
                                            </span>
                                        </td>
                                    </tr>
                                ) : (
                                    overtimeRows.map((r) => (
                                        <tr key={r.id} className="border-b border-zinc-200 hover:bg-zinc-50 transition-colors">
                                            <td className="px-4 py-3">
                                                <div className="font-bold text-sm">{r.name}</div>
                                                <div className="text-[10px] text-zinc-500 font-medium">{r.employeeCode}</div>
                                            </td>
                                            <td className="px-4 py-3 text-sm font-medium">{r.department}</td>
                                            <td className="px-4 py-3 text-sm font-bold">{r.workingHours.toFixed(1)} jam</td>
                                            <td className="px-4 py-3">
                                                <span className="inline-block px-2 py-0.5 text-[10px] font-black uppercase bg-amber-100 text-amber-700 border border-amber-300">
                                                    {r.overtimeHours.toFixed(1)} jam
                                                </span>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* ================================================================ */}
            {/* Tab: Cuti & Izin */}
            {/* ================================================================ */}
            {activeTab === "leave" && (
                <div className="space-y-6">
                    {/* Leave Form */}
                    <div className="border-2 border-black bg-white overflow-hidden">
                        <div className="bg-black text-white px-4 py-3">
                            <span className="text-xs font-black uppercase tracking-widest">Pengajuan Cuti Baru</span>
                        </div>
                        <div className="p-5 grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label className="text-[10px] font-black uppercase tracking-wider text-zinc-500 mb-1 block">Karyawan</label>
                                <select
                                    value={leaveForm.employeeId}
                                    onChange={(e) => setLeaveForm((p) => ({ ...p, employeeId: e.target.value }))}
                                    className="border-2 border-black font-bold h-10 px-3 w-full bg-white"
                                >
                                    <option value="">Pilih karyawan</option>
                                    {initialEmployees.map((emp) => (
                                        <option key={emp.id} value={emp.id}>{emp.name} ({emp.employeeCode})</option>
                                    ))}
                                </select>
                            </div>
                            <div>
                                <label className="text-[10px] font-black uppercase tracking-wider text-zinc-500 mb-1 block">Jenis Cuti</label>
                                <select
                                    value={leaveForm.type}
                                    onChange={(e) => setLeaveForm((p) => ({ ...p, type: e.target.value }))}
                                    className="border-2 border-black font-bold h-10 px-3 w-full bg-white"
                                >
                                    <option value="ANNUAL">Tahunan</option>
                                    <option value="SICK">Sakit</option>
                                    <option value="UNPAID">Tidak Dibayar</option>
                                    <option value="MATERNITY">Melahirkan</option>
                                    <option value="OTHER">Lainnya</option>
                                </select>
                            </div>
                            <div>
                                <label className="text-[10px] font-black uppercase tracking-wider text-zinc-500 mb-1 block">Tanggal Mulai</label>
                                <input
                                    type="date"
                                    value={leaveForm.startDate}
                                    onChange={(e) => setLeaveForm((p) => ({ ...p, startDate: e.target.value }))}
                                    className="border-2 border-black font-bold h-10 px-3 w-full"
                                />
                            </div>
                            <div>
                                <label className="text-[10px] font-black uppercase tracking-wider text-zinc-500 mb-1 block">Tanggal Selesai</label>
                                <input
                                    type="date"
                                    value={leaveForm.endDate}
                                    onChange={(e) => setLeaveForm((p) => ({ ...p, endDate: e.target.value }))}
                                    className="border-2 border-black font-bold h-10 px-3 w-full"
                                />
                            </div>
                            <div className="md:col-span-2">
                                <label className="text-[10px] font-black uppercase tracking-wider text-zinc-500 mb-1 block">Alasan</label>
                                <input
                                    value={leaveForm.reason}
                                    onChange={(e) => setLeaveForm((p) => ({ ...p, reason: e.target.value }))}
                                    placeholder="Alasan pengajuan cuti"
                                    className="border-2 border-black font-bold h-10 px-3 w-full"
                                />
                            </div>
                            <div className="md:col-span-2">
                                <button
                                    onClick={handleSubmitLeave}
                                    disabled={leaveSubmitting}
                                    className="px-6 h-10 border-2 border-black text-[10px] font-black uppercase tracking-wider bg-black text-white shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] active:shadow-none active:translate-x-[2px] active:translate-y-[2px] transition-all"
                                >
                                    {leaveSubmitting ? "Mengajukan..." : "Ajukan Cuti"}
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* Pending Approvals */}
                    <div className="border-2 border-black bg-white overflow-hidden">
                        <div className="bg-black text-white px-4 py-3 flex items-center justify-between">
                            <span className="text-xs font-black uppercase tracking-widest">Approval Cuti Pending</span>
                            <span className="text-[9px] font-black px-2 py-0.5 bg-purple-400 text-black">{pendingLeaves.length}</span>
                        </div>
                        <div className="overflow-x-auto">
                            <table className="w-full">
                                <thead>
                                    <tr className="bg-zinc-100 border-b-2 border-black">
                                        <th className="text-left text-[10px] font-black uppercase tracking-widest text-zinc-500 px-4 py-2.5">Karyawan</th>
                                        <th className="text-left text-[10px] font-black uppercase tracking-widest text-zinc-500 px-4 py-2.5">Jenis</th>
                                        <th className="text-left text-[10px] font-black uppercase tracking-widest text-zinc-500 px-4 py-2.5">Periode</th>
                                        <th className="text-left text-[10px] font-black uppercase tracking-widest text-zinc-500 px-4 py-2.5">Approver</th>
                                        <th className="text-left text-[10px] font-black uppercase tracking-widest text-zinc-500 px-4 py-2.5">Aksi</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {pendingLeaves.length === 0 ? (
                                        <tr>
                                            <td colSpan={5} className="px-4 py-8 text-center">
                                                <CalendarDays className="h-8 w-8 mx-auto text-zinc-200 mb-2" />
                                                <span className="text-[10px] font-black uppercase tracking-widest text-zinc-400">
                                                    Tidak ada pengajuan cuti pending
                                                </span>
                                            </td>
                                        </tr>
                                    ) : (
                                        pendingLeaves.map((l) => (
                                            <tr key={l.id} className="border-b border-zinc-200 hover:bg-zinc-50 transition-colors">
                                                <td className="px-4 py-3">
                                                    <div className="font-bold text-sm">{l.employeeName}</div>
                                                    <div className="text-[10px] text-zinc-500 font-medium">{l.department}</div>
                                                </td>
                                                <td className="px-4 py-3">
                                                    <span className="inline-block px-2 py-0.5 text-[10px] font-black uppercase bg-purple-100 text-purple-700 border border-purple-300">
                                                        {LEAVE_TYPE_LABELS[l.type] || l.type}
                                                    </span>
                                                </td>
                                                <td className="px-4 py-3 text-sm font-medium">
                                                    {new Date(l.startDate).toLocaleDateString("id-ID", { day: "numeric", month: "short" })} — {new Date(l.endDate).toLocaleDateString("id-ID", { day: "numeric", month: "short" })}
                                                </td>
                                                <td className="px-4 py-3 text-sm font-medium">{l.approverName || "—"}</td>
                                                <td className="px-4 py-3">
                                                    <div className="flex gap-2">
                                                        <button
                                                            onClick={() => handleApprove(l.id)}
                                                            className="px-3 h-8 text-[10px] font-black uppercase border-2 border-black bg-black text-white shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] active:shadow-none active:translate-x-[1px] active:translate-y-[1px] transition-all"
                                                        >
                                                            Setujui
                                                        </button>
                                                        <button
                                                            onClick={() => handleReject(l.id)}
                                                            className="px-3 h-8 text-[10px] font-black uppercase border-2 border-black bg-white text-red-600 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] active:shadow-none active:translate-x-[1px] active:translate-y-[1px] transition-all hover:bg-red-50"
                                                        >
                                                            Tolak
                                                        </button>
                                                    </div>
                                                </td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            )}

            {/* ================================================================ */}
            {/* Clock In/Out Dialog */}
            {/* ================================================================ */}
            <Dialog open={clockOpen} onOpenChange={setClockOpen}>
                <DialogContent className={NB.contentNarrow}>
                    <DialogHeader className={NB.header}>
                        <DialogTitle className={NB.title}>
                            <Clock className="h-5 w-5" />
                            Clock In / Clock Out
                        </DialogTitle>
                        <p className={NB.subtitle}>Pilih karyawan dan jenis aksi absensi</p>
                    </DialogHeader>

                    <ScrollArea className={NB.scroll}>
                        <div className="p-6 space-y-5">
                            <div>
                                <label className={NB.label}>Karyawan</label>
                                <select
                                    value={clockForm.employeeId}
                                    onChange={(e) => setClockForm((p) => ({ ...p, employeeId: e.target.value }))}
                                    className={NB.select}
                                >
                                    <option value="">Pilih karyawan</option>
                                    {initialEmployees.map((emp) => (
                                        <option key={emp.id} value={emp.id}>{emp.name} ({emp.employeeCode})</option>
                                    ))}
                                </select>
                            </div>
                            <div>
                                <label className={NB.label}>Mode</label>
                                <select
                                    value={clockForm.mode}
                                    onChange={(e) => setClockForm((p) => ({ ...p, mode: e.target.value as "CLOCK_IN" | "CLOCK_OUT" }))}
                                    className={NB.select}
                                >
                                    <option value="CLOCK_IN">Clock In (Masuk)</option>
                                    <option value="CLOCK_OUT">Clock Out (Pulang)</option>
                                </select>
                            </div>
                        </div>
                    </ScrollArea>

                    <DialogFooter className="p-4 border-t-2 border-black bg-zinc-50 flex gap-2">
                        <button className={NB.cancelBtn} onClick={() => setClockOpen(false)}>Batal</button>
                        <button className={NB.submitBtn} onClick={handleClockSubmit} disabled={clockSubmitting}>
                            {clockSubmitting ? "Menyimpan..." : "Simpan Absensi"}
                        </button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    )
}
