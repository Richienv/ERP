"use client"

import { useQuery } from "@tanstack/react-query"
import { queryKeys } from "@/lib/query-keys"
import { getWeeklyShiftSchedule, getEmployeeShifts } from "@/lib/actions/hcm-shifts"

function getCurrentWeekStart() {
    const today = new Date()
    const dayOfWeek = today.getDay()
    const monday = new Date(today)
    monday.setDate(today.getDate() - ((dayOfWeek + 6) % 7))
    return monday.toISOString().split("T")[0]
}

export function useShifts() {
    const weekStart = getCurrentWeekStart()

    return useQuery({
        queryKey: queryKeys.hcmShifts.list(),
        queryFn: async () => {
            const [schedule, employees] = await Promise.all([
                getWeeklyShiftSchedule(weekStart),
                getEmployeeShifts(),
            ])
            return { schedule, employees, currentWeekStart: weekStart }
        },
    })
}
