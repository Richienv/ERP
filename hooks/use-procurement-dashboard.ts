"use client"

import { useQuery } from "@tanstack/react-query"
import { queryKeys } from "@/lib/query-keys"

export function useProcurementDashboard(searchParams?: string) {
    return useQuery({
        queryKey: [...queryKeys.procurementDashboard.list(), searchParams || ""],
        queryFn: async () => {
            const url = searchParams
                ? `/api/procurement/dashboard?${searchParams}`
                : "/api/procurement/dashboard"
            const res = await fetch(url)
            if (!res.ok) throw new Error("Failed to fetch procurement dashboard")
            return await res.json()
        },
    })
}
