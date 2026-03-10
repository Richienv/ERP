"use client"

import { useQuery } from "@tanstack/react-query"
import { queryKeys } from "@/lib/query-keys"
import { getCycleCountSessions } from "@/app/actions/cycle-count"

export function useCycleCounts() {
    return useQuery({
        queryKey: queryKeys.cycleCounts.list(),
        queryFn: getCycleCountSessions,
    })
}
