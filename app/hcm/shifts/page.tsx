"use client"

import { useShifts } from "@/hooks/use-shifts"
import { ShiftCalendar } from "@/components/hcm/shift-calendar"
import { TablePageSkeleton } from "@/components/ui/page-skeleton"

export default function ShiftsPage() {
    const { data, isLoading } = useShifts()

    if (isLoading || !data) {
        return <TablePageSkeleton accentColor="bg-teal-400" />
    }

    return (
        <div className="p-6 space-y-6">
            <ShiftCalendar
                schedule={data.schedule}
                employees={data.employees}
                currentWeekStart={data.currentWeekStart}
            />
        </div>
    )
}
