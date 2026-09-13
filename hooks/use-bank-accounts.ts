"use client"

import { useQuery } from "@tanstack/react-query"
import { queryKeys } from "@/lib/query-keys"
import { getBankAccounts } from "@/lib/actions/finance-petty-cash"

export function useBankAccounts() {
    return useQuery({
        queryKey: queryKeys.glAccounts.bankAccounts(),
        queryFn: async () => {
            return getBankAccounts()
        },
        staleTime: 5 * 60 * 1000,
    })
}
