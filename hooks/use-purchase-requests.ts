"use client"

import { useQuery } from "@tanstack/react-query"
import { queryKeys } from "@/lib/query-keys"
import { getPurchaseRequests } from "@/lib/actions/procurement"
import type { PRFilter } from "@/lib/types/procurement-filters"

// Re-export PRFilter for convenience.
export type { PRFilter } from "@/lib/types/procurement-filters"

export function usePurchaseRequests(filter?: PRFilter) {
    return useQuery({
        queryKey: (() => {
            const hasFilter = filter && Object.values(filter).some(v => v !== undefined && v !== null && v !== '')
            return hasFilter
                ? ([...queryKeys.purchaseRequests.list(), filter] as const)
                : queryKeys.purchaseRequests.list()
        })(),
        queryFn: async () => {
            const requests = await getPurchaseRequests(filter)
            return requests
        },
    })
}
