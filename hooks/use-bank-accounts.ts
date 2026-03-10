"use client"

import { useQuery } from "@tanstack/react-query"
import { queryKeys } from "@/lib/query-keys"
import { getBankAccounts } from "@/lib/actions/finance-petty-cash"

export function useBankAccounts() {
    return useQuery({
        queryKey: queryKeys.glAccounts.bankAccounts(),
        queryFn: async () => {
            const accounts = await getBankAccounts()
            // Filter to only cash/bank accounts (10xx codes)
            return accounts.filter(a => /^10\d{2}$/.test(a.code))
        },
        staleTime: 5 * 60 * 1000,
    })
}
