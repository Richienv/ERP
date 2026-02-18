"use client"

import { useQuery } from "@tanstack/react-query"
import { queryKeys } from "@/lib/query-keys"
import { getPurchaseRequests } from "@/lib/actions/procurement"

export function usePurchaseRequests() {
    return useQuery({
        queryKey: queryKeys.purchaseRequests.list(),
        queryFn: async () => {
            const requests = await getPurchaseRequests()
            return requests
        },
    })
}
