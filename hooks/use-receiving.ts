"use client"

import { useQuery } from "@tanstack/react-query"
import { queryKeys } from "@/lib/query-keys"

export function useReceiving() {
    return useQuery({
        queryKey: queryKeys.receiving.list(),
        queryFn: async () => {
            const res = await fetch("/api/procurement/receiving-data")
            if (!res.ok) throw new Error("Failed to fetch receiving data")
            return res.json()
        },
        staleTime: 2 * 60 * 1000, // 2 min — transactional data
    })
}
