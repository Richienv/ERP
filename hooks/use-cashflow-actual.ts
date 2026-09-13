"use client"

import { useQuery } from "@tanstack/react-query"
import { queryKeys } from "@/lib/query-keys"
import type { CashflowActualData } from "@/lib/actions/finance-cashflow"
import { apiFetch } from "@/lib/http/api-fetch"

export function useCashflowActual(month: number, year: number) {
    return useQuery<CashflowActualData>({
        queryKey: queryKeys.cashflowActual.list(month, year),
        queryFn: () => apiFetch<CashflowActualData>(`/api/finance/cashflow-actual?month=${month}&year=${year}`),
    })
}
