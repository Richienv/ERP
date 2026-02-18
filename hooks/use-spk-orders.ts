"use client"

import { useQuery } from "@tanstack/react-query"
import { queryKeys } from "@/lib/query-keys"

export function useSpkOrders() {
    return useQuery({
        queryKey: queryKeys.spkOrders.list(),
        queryFn: async () => {
            const res = await fetch("/api/manufacturing/work-orders?orderType=SPK")
            if (!res.ok) return []
            const result = await res.json()
            return result.success ? result.data : []
        },
    })
}
