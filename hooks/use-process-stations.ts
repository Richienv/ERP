"use client"

import { useQuery } from "@tanstack/react-query"
import { queryKeys } from "@/lib/query-keys"

export function useProcessStations(opts?: { includeInactive?: boolean }) {
    const includeInactive = opts?.includeInactive ?? false
    return useQuery({
        queryKey: [...queryKeys.processStations.list(), { includeInactive }],
        queryFn: async () => {
            const params = includeInactive ? "?activeOnly=false" : ""
            const res = await fetch(`/api/manufacturing/process-stations${params}`)
            if (!res.ok) return []
            const result = await res.json()
            return result.success ? result.data : []
        },
    })
}
