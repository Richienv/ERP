"use client"

import { useQuery } from "@tanstack/react-query"
import { queryKeys } from "@/lib/query-keys"
import { CACHE_TIERS } from "@/lib/cache-tiers"

/**
 * Shared dashboard queryFn — used by useExecutiveDashboard and route prefetch.
 *
 * /api/dashboard returns the payload DIRECTLY (no `{ data }` wrapper):
 *   { financials, operations, activity, charts, sales, hr, tax, details }
 * Manufacturing is hidden for KRI; keep `manufacturing: null` so the cached
 * object shape matches what the dashboard page already reads.
 */
export async function fetchExecutiveDashboard() {
    const dashData = await fetch("/api/dashboard")
    if (!dashData.ok) throw new Error("Failed to fetch dashboard data")
    return { ...await dashData.json(), manufacturing: null }
}

export function useExecutiveDashboard() {
    return useQuery({
        queryKey: queryKeys.executiveDashboard.list(),
        queryFn: fetchExecutiveDashboard,
        ...CACHE_TIERS.DASHBOARD,
    })
}
