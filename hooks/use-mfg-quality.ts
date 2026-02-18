"use client"

import { useQuery } from "@tanstack/react-query"
import { queryKeys } from "@/lib/query-keys"

const emptySummary = { passRate: 100, defectCount: 0, pendingCount: 0, todayCount: 0 }

export function useMfgQuality() {
    return useQuery({
        queryKey: queryKeys.mfgQuality.list(),
        queryFn: async () => {
            const res = await fetch("/api/manufacturing/quality")
            if (!res.ok) return { inspections: [], pendingQueue: [], summary: emptySummary }
            const result = await res.json()
            return {
                inspections: result.success ? result.data : [],
                pendingQueue: result.success ? (result.pendingQueue || []) : [],
                summary: result.success ? result.summary : emptySummary,
            }
        },
    })
}
