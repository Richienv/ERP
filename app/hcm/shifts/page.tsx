"use client"

import { useShifts } from "@/hooks/use-shifts"
import { ShiftCalendar } from "@/components/hcm/shift-calendar"
import { TablePageSkeleton } from "@/components/ui/page-skeleton"
import { InlinePendingBar } from "@/components/ui/inline-pending"

export default function ShiftsPage() {
    const { data, isFetching } = useShifts()

    if (!data) {
        return <TablePageSkeleton accentColor="bg-orange-400" />
    }

    return (
        <div className="relative p-6 space-y-6">
            <InlinePendingBar active={isFetching} />
            <ShiftCalendar
                schedule={data.schedule}
                employees={data.employees}
                currentWeekStart={data.currentWeekStart}
            />
        </div>
    )
}
