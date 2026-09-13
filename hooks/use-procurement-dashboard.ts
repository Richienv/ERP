"use client"

import { useQuery } from "@tanstack/react-query"
import { queryKeys } from "@/lib/query-keys"
import { CACHE_TIERS } from "@/lib/cache-tiers"
import { apiFetch } from "@/lib/http/api-fetch"

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
            return apiFetch(url)
        },
        ...CACHE_TIERS.DASHBOARD,
    })
}
