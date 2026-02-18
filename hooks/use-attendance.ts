"use client"

import { useQuery } from "@tanstack/react-query"
import { queryKeys } from "@/lib/query-keys"
import {
    getAttendanceSnapshot,
    getEmployees,
    getLeaveRequests,
} from "@/app/actions/hcm"

export function useAttendance() {
    return useQuery({
        queryKey: queryKeys.hcmAttendance.list(),
        queryFn: async () => {
            const today = new Date().toISOString().slice(0, 10)

            // Sequential to avoid exhausting Supabase session-mode pool
            const snapshot = await getAttendanceSnapshot({ date: today })
            const employees = await getEmployees({ includeInactive: false })
            const leaveRequests = await getLeaveRequests({ status: "ALL", limit: 30 })

            return {
                initialSnapshot: snapshot,
                initialEmployees: employees as any[],
                initialLeaveRequests: leaveRequests as any[],
            }
        },
    })
}
