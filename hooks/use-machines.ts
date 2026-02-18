"use client"

import { useQuery } from "@tanstack/react-query"
import { queryKeys } from "@/lib/query-keys"

const emptySummary = { total: 0, active: 0, down: 0, avgEfficiency: 0 }

export function useMachines() {
    return useQuery({
        queryKey: queryKeys.machines.list(),
        queryFn: async () => {
            const res = await fetch("/api/manufacturing/machines")
            if (!res.ok) return { machines: [], summary: emptySummary }
            const result = await res.json()
            return {
                machines: result.success ? result.data : [],
                summary: result.success ? result.summary : emptySummary,
            }
        },
    })
}
