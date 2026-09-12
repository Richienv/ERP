"use client"

import { useQuery } from "@tanstack/react-query"
import { queryKeys } from "@/lib/query-keys"
import { CACHE_TIERS } from "@/lib/cache-tiers"
import { getExpenses, getExpenseAccounts } from "@/lib/actions/finance"

export function useExpenses() {
    return useQuery({
        queryKey: queryKeys.expenses.list(),
        queryFn: async () => {
            const [expenses, accounts] = await Promise.all([
                getExpenses(),
                getExpenseAccounts(),
            ])
            return { expenses, ...accounts }
        },
        ...CACHE_TIERS.TRANSACTIONAL,
    })
}
