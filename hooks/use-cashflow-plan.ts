"use client"

import { useQuery } from "@tanstack/react-query"
import { queryKeys } from "@/lib/query-keys"
import type { CashflowPlanData } from "@/lib/actions/finance-cashflow"

export function useCashflowPlan(month: number, year: number) {
    return useQuery<CashflowPlanData>({
        queryKey: queryKeys.cashflowPlan.list(month, year),
        queryFn: async () => {
            const res = await fetch(`/api/finance/cashflow-plan?month=${month}&year=${year}`)
            if (!res.ok) throw new Error("Failed to fetch cashflow plan")
            const json = await res.json()
            return json as CashflowPlanData
        },
    })
}
