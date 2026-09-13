"use client"

import { useQuery } from "@tanstack/react-query"
import { queryKeys } from "@/lib/query-keys"
import type { CashflowPlanData, AccuracyTrendMonth } from "@/lib/actions/finance-cashflow"
import { apiFetch } from "@/lib/http/api-fetch"

export function useCashflowPlan(month: number, year: number, allStatuses: boolean = false) {
    return useQuery<CashflowPlanData>({
        queryKey: [...queryKeys.cashflowPlan.list(month, year), allStatuses],
        queryFn: () => apiFetch<CashflowPlanData>(`/api/finance/cashflow-plan?month=${month}&year=${year}&allStatuses=${allStatuses}`),
    })
}

export function useAccuracyTrend(months: number = 3) {
    return useQuery<AccuracyTrendMonth[]>({
        queryKey: queryKeys.cashflowAccuracy.trend(months),
        queryFn: () => apiFetch<AccuracyTrendMonth[]>(`/api/finance/cashflow-accuracy?months=${months}`),
        staleTime: 5 * 60 * 1000,
    })
}
