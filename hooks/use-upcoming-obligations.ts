"use client"

import { useQuery } from "@tanstack/react-query"
import { queryKeys } from "@/lib/query-keys"
import type { UpcomingObligationsData } from "@/lib/actions/finance-cashflow"

export function useUpcomingObligations(days: number = 90) {
    return useQuery<UpcomingObligationsData>({
        queryKey: [...queryKeys.cashflowPlan.all, "upcoming", days],
        queryFn: async () => {
            const res = await fetch(`/api/finance/cashflow-upcoming?days=${days}`)
            if (!res.ok) throw new Error("Failed to fetch upcoming obligations")
            return res.json()
        },
        staleTime: 3 * 60 * 1000,
    })
}
