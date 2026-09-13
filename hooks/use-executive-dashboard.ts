"use client"

import { useQuery } from "@tanstack/react-query"
import { queryKeys } from "@/lib/query-keys"
import { CACHE_TIERS } from "@/lib/cache-tiers"
import { apiFetch } from "@/lib/http/api-fetch"

/**
 * Parallel thin BFFs — each lane fails independently so TanStack can keep
 * stale money on screen instead of painting zeros from a swallowed timeout.
 */
export async function fetchExecutiveDashboard(): Promise<any> {
    const [financials, operations, activity, charts, details] = await Promise.all([
        apiFetch("/api/dashboard/financials"),
        apiFetch("/api/dashboard/operations"),
        apiFetch("/api/dashboard/activity"),
        apiFetch("/api/dashboard/charts"),
        apiFetch("/api/dashboard/details"),
    ])
    return {
        financials,
        operations,
        activity,
        charts,
        sales: { totalRevenue: 0, totalOrders: 0, activeOrders: 0, recentOrders: [] },
        manufacturing: null,
        hr: operations?.hr ?? { totalSalary: 0, lateEmployees: [] },
        tax: operations?.tax ?? { ppnOut: 0, ppnIn: 0, ppnNet: 0 },
        details,
    }
}

export function useExecutiveDashboard() {
    return useQuery({
        queryKey: queryKeys.executiveDashboard.list(),
        queryFn: fetchExecutiveDashboard,
        ...CACHE_TIERS.DASHBOARD,
    })
}
