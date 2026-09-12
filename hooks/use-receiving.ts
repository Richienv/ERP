"use client"

import { useQuery } from "@tanstack/react-query"
import { queryKeys } from "@/lib/query-keys"
import { CACHE_TIERS } from "@/lib/cache-tiers"

export function useReceiving() {
    return useQuery({
        queryKey: queryKeys.receiving.list(),
        queryFn: async () => {
            const res = await fetch("/api/procurement/receiving-data")
            if (!res.ok) throw new Error("Failed to fetch receiving data")
            return res.json()
        },
        ...CACHE_TIERS.TRANSACTIONAL,
    })
}
