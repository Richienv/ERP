"use client"

import { useQuery } from "@tanstack/react-query"
import { queryKeys } from "@/lib/query-keys"
import { getProfitLossStatement, getBalanceSheet, getCashFlowStatement } from "@/lib/actions/finance"

export function useFinanceReports(startDate: Date, endDate: Date) {
    return useQuery({
        queryKey: queryKeys.financeReports.list(startDate.toISOString(), endDate.toISOString()),
        queryFn: async () => {
            const [pnl, bs, cf] = await Promise.all([
                getProfitLossStatement(startDate, endDate),
                getBalanceSheet(endDate),
                getCashFlowStatement(startDate, endDate),
            ])
            return { pnl, bs, cf }
        },
    })
}
