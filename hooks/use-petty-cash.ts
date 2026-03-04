"use client"

import { useQuery } from "@tanstack/react-query"
import { queryKeys } from "@/lib/query-keys"
import { getPettyCashTransactions } from "@/lib/actions/finance-petty-cash"

export function usePettyCash() {
    return useQuery({
        queryKey: queryKeys.pettyCash.list(),
        queryFn: async () => {
            const result = await getPettyCashTransactions()
            if (!result || !result.success) {
                return { transactions: [], currentBalance: 0, totalTopup: 0, totalDisbursement: 0 }
            }
            return result
        },
        retry: 1,
    })
}
