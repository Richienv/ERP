"use client"

import { useQuery } from "@tanstack/react-query"
import { queryKeys } from "@/lib/query-keys"
import { CACHE_TIERS } from "@/lib/cache-tiers"

export function useProcurementDashboard(searchParams?: string) {
    const qs = searchParams?.trim()
    return useQuery({
        queryKey: qs
            ? [...queryKeys.procurementDashboard.list(), qs]
            : queryKeys.procurementDashboard.list(),
        queryFn: async () => {
            const url = qs
                ? `/api/procurement/dashboard?${qs}`
                : "/api/procurement/dashboard"
            const res = await fetch(url)
            if (!res.ok) throw new Error("Failed to fetch procurement dashboard")
            return await res.json()
        },
        ...CACHE_TIERS.DASHBOARD,
    })
}
