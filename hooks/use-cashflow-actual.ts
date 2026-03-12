"use client"

import { useQuery } from "@tanstack/react-query"
import { queryKeys } from "@/lib/query-keys"
import type { CashflowActualData } from "@/lib/actions/finance-cashflow"

export function useCashflowActual(month: number, year: number) {
    return useQuery<CashflowActualData>({
        queryKey: queryKeys.cashflowActual.list(month, year),
        queryFn: async () => {
            const res = await fetch(`/api/finance/cashflow-actual?month=${month}&year=${year}`)
            if (!res.ok) throw new Error("Failed to fetch actual cashflow")
            const json = await res.json()
            return json as CashflowActualData
        },
    })
}
