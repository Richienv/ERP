"use client"

import { useQuery } from "@tanstack/react-query"
import { queryKeys } from "@/lib/query-keys"
import { CACHE_TIERS } from "@/lib/cache-tiers"
import { getFinancialMetrics, getFinanceDashboardData } from "@/lib/actions/finance-reports"

export function useFinanceDashboard() {
    return useQuery({
        queryKey: queryKeys.financeDashboard.list(),
        queryFn: async () => {
            const [metrics, dashboardData] = await Promise.all([
                getFinancialMetrics(),
                getFinanceDashboardData(),
            ])
            return { metrics, dashboardData }
        },
        ...CACHE_TIERS.DASHBOARD,
    })
}
