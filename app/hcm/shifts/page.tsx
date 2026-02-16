import { Suspense } from "react"
import { getWeeklyShiftSchedule, getEmployeeShifts } from "@/lib/actions/hcm-shifts"
import { ShiftCalendar } from "@/components/hcm/shift-calendar"
import { Calendar } from "lucide-react"

export const dynamic = "force-dynamic"

async function ShiftContent() {
    const today = new Date()
    const dayOfWeek = today.getDay()
    const monday = new Date(today)
    monday.setDate(today.getDate() - ((dayOfWeek + 6) % 7))
    const weekStart = monday.toISOString().split('T')[0]

    const schedule = await getWeeklyShiftSchedule(weekStart)
    const employees = await getEmployeeShifts()

    return (
        <ShiftCalendar
            schedule={schedule}
            employees={employees}
            currentWeekStart={weekStart}
        />
    )
}

export default function ShiftsPage() {
    return (
        <div className="p-6 space-y-6">
            <Suspense
                fallback={
                    <div className="flex items-center gap-2 text-zinc-400">
                        <Calendar className="h-5 w-5 animate-pulse" />
                        <span className="text-[10px] font-black uppercase tracking-widest">
                            Memuat jadwal shift...
                        </span>
                    </div>
                }
            >
                <ShiftContent />
            </Suspense>
        </div>
    )
}
