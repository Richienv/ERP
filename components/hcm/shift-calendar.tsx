"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
import { ChevronLeft, ChevronRight, Calendar, Sun, Moon, Sunset, Users } from "lucide-react"
import { toast } from "sonner"
import { useQueryClient } from "@tanstack/react-query"
import { queryKeys } from "@/lib/query-keys"
import { assignEmployeeShift } from "@/lib/actions/hcm-shifts"
import type { ShiftScheduleDay, EmployeeShiftSummary } from "@/lib/actions/hcm-shifts"
import type { ShiftType } from "@prisma/client"

// ==============================================================================
// Types & Constants
// ==============================================================================

const DAY_NAMES = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab']

const SHIFT_CONFIG = {
    MORNING: { label: 'Pagi', icon: Sun, color: 'bg-amber-100 text-amber-700 border-amber-300', time: '07:00-15:00' },
    AFTERNOON: { label: 'Siang', icon: Sunset, color: 'bg-orange-100 text-orange-700 border-orange-300', time: '15:00-23:00' },
    NIGHT: { label: 'Malam', icon: Moon, color: 'bg-indigo-100 text-indigo-700 border-indigo-300', time: '23:00-07:00' },
} as const

interface ShiftCalendarProps {
    schedule: ShiftScheduleDay[]
    employees: EmployeeShiftSummary[]
    currentWeekStart: string
}

// ==============================================================================
// Component
// ==============================================================================

export function ShiftCalendar({
    schedule,
    employees,
    currentWeekStart,
}: ShiftCalendarProps) {
    const queryClient = useQueryClient()
    const [loading, setLoading] = useState<string | null>(null)

    const handleShiftChange = async (employeeId: string, shiftType: string) => {
        setLoading(employeeId)
        const result = await assignEmployeeShift(employeeId, shiftType as ShiftType)
        setLoading(null)
        if (result.success) {
            toast.success("Shift berhasil diubah")
            queryClient.invalidateQueries({ queryKey: queryKeys.hcmShifts.all })
        } else {
            toast.error(result.error || "Gagal mengubah shift")
        }
    }

    const navigateWeek = (direction: number) => {
        const d = new Date(currentWeekStart)
        d.setDate(d.getDate() + direction * 7)
        // Navigate by updating URL or refreshing — no callback needed
        queryClient.invalidateQueries({ queryKey: queryKeys.hcmShifts.all })
    }

    const formatDate = (dateStr: string) => {
        const d = new Date(dateStr)
        return `${d.getDate()}/${d.getMonth() + 1}`
    }

    // Group employees by department
    const departments = [...new Set(employees.map((e) => e.department))].sort()

    return (
        <div className="space-y-4">
            {/* Header with week navigation */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <Calendar className="h-5 w-5" />
                    <h2 className="text-sm font-black uppercase tracking-widest">Jadwal Shift</h2>
                </div>
                <div className="flex items-center gap-2">
                    <Button
                        variant="outline"
                        size="sm"
                        className="h-8 w-8 p-0 border-2 border-black rounded-none"
                        onClick={() => navigateWeek(-1)}
                    >
                        <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <span className="text-xs font-bold font-mono px-3">
                        {schedule.length > 0 ? `${formatDate(schedule[0].date)} — ${formatDate(schedule[schedule.length - 1].date)}` : '-'}
                    </span>
                    <Button
                        variant="outline"
                        size="sm"
                        className="h-8 w-8 p-0 border-2 border-black rounded-none"
                        onClick={() => navigateWeek(1)}
                    >
                        <ChevronRight className="h-4 w-4" />
                    </Button>
                </div>
            </div>

            {/* Weekly overview grid */}
            <div className="bg-white border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
                <div className="px-4 py-2.5 border-b-2 border-black bg-zinc-50">
                    <span className="text-[10px] font-black uppercase tracking-widest text-zinc-500">
                        Ringkasan Mingguan
                    </span>
                </div>
                <div className="grid grid-cols-7 divide-x divide-zinc-200">
                    {schedule.map((day) => {
                        const isWeekend = day.dayOfWeek === 0 || day.dayOfWeek === 6
                        return (
                            <div key={day.date} className={`p-2.5 ${isWeekend ? 'bg-zinc-50' : ''}`}>
                                <div className="text-center mb-2">
                                    <div className="text-[9px] font-black uppercase text-zinc-400">
                                        {DAY_NAMES[day.dayOfWeek]}
                                    </div>
                                    <div className="text-xs font-bold font-mono">{formatDate(day.date)}</div>
                                </div>
                                {(Object.entries(SHIFT_CONFIG) as [keyof typeof SHIFT_CONFIG, typeof SHIFT_CONFIG[keyof typeof SHIFT_CONFIG]][]).map(([key, config]) => {
                                    const ShiftIcon = config.icon
                                    const count = day.shifts[key].length
                                    return (
                                        <div key={key} className={`flex items-center gap-1 mb-1 text-[8px] font-bold px-1.5 py-0.5 border ${config.color}`}>
                                            <ShiftIcon className="h-2.5 w-2.5" />
                                            <span>{count}</span>
                                        </div>
                                    )
                                })}
                            </div>
                        )
                    })}
                </div>
            </div>

            {/* Employee shift assignments by department */}
            <div className="bg-white border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
                <div className="px-4 py-2.5 border-b-2 border-black bg-zinc-50 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <Users className="h-4 w-4 text-zinc-500" />
                        <span className="text-[10px] font-black uppercase tracking-widest text-zinc-500">
                            Assignment Karyawan
                        </span>
                    </div>
                    <span className="text-[10px] font-bold text-zinc-400">{employees.length} karyawan</span>
                </div>

                {departments.map((dept) => (
                    <div key={dept}>
                        <div className="px-4 py-1.5 bg-zinc-100 border-b border-zinc-200">
                            <span className="text-[9px] font-black uppercase tracking-widest text-zinc-500">
                                {dept}
                            </span>
                        </div>
                        <div className="divide-y divide-zinc-100">
                            {employees
                                .filter((e) => e.department === dept)
                                .map((emp) => (
                                    <div key={emp.employeeId} className="px-4 py-2 flex items-center justify-between">
                                        <div>
                                            <span className="text-xs font-bold">{emp.employeeName}</span>
                                            <span className="text-[9px] text-zinc-400 font-mono ml-2">({emp.employeeCode})</span>
                                        </div>
                                        <Select
                                            value={emp.defaultShift || 'MORNING'}
                                            onValueChange={(v) => handleShiftChange(emp.employeeId, v)}
                                            disabled={loading === emp.employeeId}
                                        >
                                            <SelectTrigger className="w-32 h-7 text-[10px] font-bold border-2 border-black rounded-none">
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="MORNING">
                                                    <span className="flex items-center gap-1">
                                                        <Sun className="h-3 w-3" /> Pagi
                                                    </span>
                                                </SelectItem>
                                                <SelectItem value="AFTERNOON">
                                                    <span className="flex items-center gap-1">
                                                        <Sunset className="h-3 w-3" /> Siang
                                                    </span>
                                                </SelectItem>
                                                <SelectItem value="NIGHT">
                                                    <span className="flex items-center gap-1">
                                                        <Moon className="h-3 w-3" /> Malam
                                                    </span>
                                                </SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>
                                ))}
                        </div>
                    </div>
                ))}
            </div>

            {/* Legend */}
            <div className="flex items-center gap-4 text-[9px] font-bold text-zinc-400">
                {(Object.entries(SHIFT_CONFIG) as [string, { label: string; time: string }][]).map(([key, config]) => (
                    <span key={key}>{config.label}: {config.time}</span>
                ))}
            </div>
        </div>
    )
}
