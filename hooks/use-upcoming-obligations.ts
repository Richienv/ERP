"use client"

import { useQuery } from "@tanstack/react-query"
import { queryKeys } from "@/lib/query-keys"
import type { UpcomingObligationsData } from "@/lib/actions/finance-cashflow"
import { apiFetch } from "@/lib/http/api-fetch"

export function useUpcomingObligations(days: number = 90) {
    return useQuery<UpcomingObligationsData>({
        queryKey: [...queryKeys.cashflowPlan.all, "upcoming", days],
        queryFn: () => apiFetch<UpcomingObligationsData>(`/api/finance/cashflow-upcoming?days=${days}`),
        staleTime: 3 * 60 * 1000,
    })
}
