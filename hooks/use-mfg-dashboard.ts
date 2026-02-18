"use client"

import { useQuery } from "@tanstack/react-query"
import { queryKeys } from "@/lib/query-keys"

const emptyData = {
    productionHealth: { oee: 0, availability: 0, performance: 0, quality: 0 },
    workOrders: { total: 0, inProgress: 0, completedThisMonth: 0, productionThisMonth: 0, plannedThisMonth: 0 },
    machines: { total: 0, running: 0, idle: 0, maintenance: 0, breakdown: 0, avgHealth: 0, totalCapacity: 0 },
    quality: { passRate: 0, totalInspections: 0, passCount: 0, failCount: 0, recentInspections: [] },
    recentOrders: [],
    alerts: [],
}

export function useMfgDashboard() {
    return useQuery({
        queryKey: queryKeys.mfgDashboard.list(),
        queryFn: async () => {
            const res = await fetch("/api/manufacturing/dashboard")
            if (!res.ok) return emptyData
            const result = await res.json()
            return result.success ? result.data : emptyData
        },
    })
}
