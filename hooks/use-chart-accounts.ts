"use client"

import { useQuery, useQueryClient } from "@tanstack/react-query"
import { queryKeys } from "@/lib/query-keys"
import { getChartOfAccountsTree } from "@/lib/actions/finance"

export function useChartOfAccounts() {
    return useQuery({
        queryKey: queryKeys.chartAccounts.list(),
        queryFn: async () => {
            const tree = await getChartOfAccountsTree()
            return tree
        },
    })
}

export function useInvalidateChartAccounts() {
    const queryClient = useQueryClient()
    return () => queryClient.invalidateQueries({ queryKey: queryKeys.chartAccounts.all })
}
