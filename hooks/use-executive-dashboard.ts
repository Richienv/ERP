"use client"

import { useQuery } from "@tanstack/react-query"
import { queryKeys } from "@/lib/query-keys"
import { CACHE_TIERS } from "@/lib/cache-tiers"
import { apiFetch } from "@/lib/http/api-fetch"

const emptySales = { totalRevenue: 0, totalOrders: 0, activeOrders: 0, recentOrders: [] }

/**
 * Independent lanes — Kas paints when financials land. Operations/charts
 * do not block first paint. Prefetch warms financials only.
 */
export function useExecutiveDashboard() {
    const financials = useQuery({
        queryKey: queryKeys.executiveDashboard.financials(),
        queryFn: () => apiFetch("/api/dashboard/financials"),
        ...CACHE_TIERS.DASHBOARD,
    })
    const operations = useQuery({
        queryKey: queryKeys.executiveDashboard.operations(),
        queryFn: () => apiFetch("/api/dashboard/operations"),
        ...CACHE_TIERS.DASHBOARD,
    })
    const activity = useQuery({
        queryKey: queryKeys.executiveDashboard.activity(),
        queryFn: () => apiFetch("/api/dashboard/activity"),
        ...CACHE_TIERS.DASHBOARD,
    })
    const charts = useQuery({
        queryKey: queryKeys.executiveDashboard.charts(),
        queryFn: () => apiFetch("/api/dashboard/charts"),
        ...CACHE_TIERS.DASHBOARD,
    })
    const details = useQuery({
        queryKey: queryKeys.executiveDashboard.details(),
        queryFn: () => apiFetch("/api/dashboard/details"),
        ...CACHE_TIERS.DASHBOARD,
    })

    const data: any = financials.data
        ? {
            financials: financials.data,
            operations: operations.data,
            activity: activity.data,
            charts: charts.data,
            sales: emptySales,
            manufacturing: null,
            hr: operations.data?.hr ?? { totalSalary: 0, lateEmployees: [] },
            tax: operations.data?.tax ?? { ppnOut: 0, ppnIn: 0, ppnNet: 0 },
            details: details.data,
        }
        : undefined

    return {
        data,
        isFetching:
            financials.isFetching
            || operations.isFetching
            || activity.isFetching
            || charts.isFetching
            || details.isFetching,
    }
}
