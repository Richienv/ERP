"use client"

import { useQuery } from "@tanstack/react-query"
import { queryKeys } from "@/lib/query-keys"
import { CACHE_TIERS } from "@/lib/cache-tiers"
import { getPurchaseRequests } from "@/lib/actions/procurement"

export function usePurchaseRequests() {
    return useQuery({
        queryKey: queryKeys.purchaseRequests.list(),
        queryFn: async () => {
            const requests = await getPurchaseRequests()
            return requests
        },
        ...CACHE_TIERS.TRANSACTIONAL,
    })
}
