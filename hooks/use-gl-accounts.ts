"use client"

import { useQuery } from "@tanstack/react-query"
import { queryKeys } from "@/lib/query-keys"
import { getGLAccountsList } from "@/lib/actions/finance"

export function useGLAccounts() {
    return useQuery({
        queryKey: queryKeys.glAccounts.list(),
        queryFn: async () => {
            const accounts = await getGLAccountsList()
            return accounts
        },
        staleTime: 5 * 60 * 1000, // GL accounts don't change often
    })
}
