"use client"

import { useQuery } from "@tanstack/react-query"
import { queryKeys } from "@/lib/query-keys"

export function useBOM() {
    return useQuery({
        queryKey: queryKeys.bom.list(),
        queryFn: async () => {
            const res = await fetch("/api/manufacturing/bom")
            if (!res.ok) return []
            const result = await res.json()
            return result.success ? result.data : []
        },
    })
}
