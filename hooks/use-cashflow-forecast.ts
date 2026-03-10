"use client"

import { useQuery } from "@tanstack/react-query"
import { queryKeys } from "@/lib/query-keys"
import type { CashflowForecastData } from "@/lib/actions/finance-cashflow"

export function useCashflowForecast(months: number = 6) {
    return useQuery<CashflowForecastData>({
        queryKey: queryKeys.cashflowForecast.list(months),
        queryFn: async () => {
            const res = await fetch(`/api/finance/cashflow-forecast?months=${months}`)
            if (!res.ok) throw new Error("Failed to fetch cashflow forecast")
            return res.json()
        },
        staleTime: 2 * 60 * 1000,
    })
}
