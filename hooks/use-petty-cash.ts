"use client"

import { useQuery } from "@tanstack/react-query"
import { queryKeys } from "@/lib/query-keys"
import { CACHE_TIERS } from "@/lib/cache-tiers"
import { getPettyCashTransactions } from "@/lib/actions/finance-petty-cash"

export function usePettyCash() {
    return useQuery({
        queryKey: queryKeys.pettyCash.list(),
        queryFn: () => getPettyCashTransactions(),
        retry: 1,
        ...CACHE_TIERS.TRANSACTIONAL,
    })
}
