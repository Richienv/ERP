"use client"

import { useQuery } from "@tanstack/react-query"
import { queryKeys } from "@/lib/query-keys"

export function useProcessStations() {
    return useQuery({
        queryKey: queryKeys.processStations.list(),
        queryFn: async () => {
            const res = await fetch("/api/manufacturing/process-stations")
            if (!res.ok) return []
            const result = await res.json()
            return result.success ? result.data : []
        },
    })
}
