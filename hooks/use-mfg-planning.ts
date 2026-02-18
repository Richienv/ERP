"use client"

import { useQuery } from "@tanstack/react-query"
import { queryKeys } from "@/lib/query-keys"

const emptyData = { weeklySchedule: [], workOrders: [], machines: [] }
const emptySummary = {
    totalPlanned: 0,
    inProgress: 0,
    totalCapacity: 0,
    avgUtilization: 0,
    materialStatus: { ready: 0, partial: 0, notReady: 0 },
    machineCount: 0,
    activeMachines: 0,
}

export function useMfgPlanning() {
    return useQuery({
        queryKey: queryKeys.mfgPlanning.list(),
        queryFn: async () => {
            const res = await fetch("/api/manufacturing/planning?weeks=4")
            if (!res.ok) return { data: emptyData, summary: emptySummary }
            const result = await res.json()
            return {
                data: result.success ? result.data : emptyData,
                summary: result.success ? result.summary : emptySummary,
            }
        },
    })
}
