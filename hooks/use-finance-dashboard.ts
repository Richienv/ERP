"use client"

import { useQuery } from "@tanstack/react-query"
import { queryKeys } from "@/lib/query-keys"
import { getFinancialMetrics, getFinanceDashboardData } from "@/lib/actions/finance"

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
    })
}
