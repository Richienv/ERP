"use client"

import { useQuery } from "@tanstack/react-query"
import { queryKeys } from "@/lib/query-keys"

export function useWorkCenterGroups() {
    return useQuery({
        queryKey: queryKeys.mfgGroups.list(),
        queryFn: async () => {
            const res = await fetch("/api/manufacturing/groups?includeInactive=true")
            if (!res.ok) return []
            const result = await res.json()
            return result.success ? result.data : []
        },
    })
}
