"use client"

import { useQuery } from "@tanstack/react-query"
import { queryKeys } from "@/lib/query-keys"

export function useExecutiveDashboard() {
    return useQuery({
        queryKey: queryKeys.executiveDashboard.list(),
        queryFn: async () => {
            const res = await fetch("/api/dashboard")
            if (!res.ok) throw new Error("Failed to fetch dashboard data")
            return await res.json()
        },
    })
}
