"use client"

import { useQuery } from "@tanstack/react-query"
import { queryKeys } from "@/lib/query-keys"
import { CACHE_TIERS } from "@/lib/cache-tiers"
import { apiFetch } from "@/lib/http/api-fetch"

type FinanceDashboardPage = {
    metrics: Awaited<ReturnType<typeof import("@/lib/actions/finance-reports").getFinancialMetrics>>
    dashboardData: Awaited<ReturnType<typeof import("@/lib/actions/finance-reports").getFinanceDashboardData>>
}

export function useFinanceDashboard() {
    return useQuery({
        queryKey: queryKeys.financeDashboard.list(),
        queryFn: () => apiFetch<FinanceDashboardPage>("/api/finance/lists/dashboard"),
        ...CACHE_TIERS.DASHBOARD,
    })
}
