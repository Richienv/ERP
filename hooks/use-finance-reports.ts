"use client"

import { useQuery } from "@tanstack/react-query"
import { queryKeys } from "@/lib/query-keys"
import {
    getProfitLossStatement,
    getBalanceSheet,
    getCashFlowStatement,
    getTrialBalance,
    getARAgingReport,
    getAPAgingReport,
} from "@/lib/actions/finance"

export function useFinanceReports(startDate: Date, endDate: Date) {
    return useQuery({
        queryKey: queryKeys.financeReports.list(startDate.toISOString(), endDate.toISOString()),
        queryFn: async () => {
            const [pnl, bs, cf, tb, arAging, apAging] = await Promise.all([
                getProfitLossStatement(startDate, endDate),
                getBalanceSheet(endDate),
                getCashFlowStatement(startDate, endDate),
                getTrialBalance(startDate, endDate),
                getARAgingReport(),
                getAPAgingReport(),
            ])
            return { pnl, bs, cf, tb, arAging, apAging }
        },
    })
}
