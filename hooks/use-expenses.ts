"use client"

import { useQuery } from "@tanstack/react-query"
import { queryKeys } from "@/lib/query-keys"
import { getExpenses, getExpenseAccounts } from "@/lib/actions/finance"

export function useExpenses() {
    return useQuery({
        queryKey: ["expenses", "list"],
        queryFn: async () => {
            const [expenses, accounts] = await Promise.all([
                getExpenses(),
                getExpenseAccounts(),
            ])
            return { expenses, ...accounts }
        },
    })
}
