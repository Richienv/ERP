"use client"

import { useQuery } from "@tanstack/react-query"
import { queryKeys } from "@/lib/query-keys"
import type { CashflowForecastData } from "@/lib/actions/finance-cashflow"
import { apiFetch } from "@/lib/http/api-fetch"

export function useCashflowForecast(months: number = 6) {
    return useQuery<CashflowForecastData>({
        queryKey: queryKeys.cashflowForecast.list(months),
        queryFn: () => apiFetch<CashflowForecastData>(`/api/finance/cashflow-forecast?months=${months}`),
        staleTime: 2 * 60 * 1000,
    })
}
