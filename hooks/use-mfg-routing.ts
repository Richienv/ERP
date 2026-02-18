"use client"

import { useQuery } from "@tanstack/react-query"
import { queryKeys } from "@/lib/query-keys"

export function useMfgRouting() {
    return useQuery({
        queryKey: queryKeys.mfgRouting.list(),
        queryFn: async () => {
            const res = await fetch("/api/manufacturing/routing")
            if (!res.ok) return []
            const result = await res.json()
            return result.success ? result.data : []
        },
    })
}
