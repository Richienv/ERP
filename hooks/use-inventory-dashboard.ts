"use client"

import { useQuery } from "@tanstack/react-query"
import { queryKeys } from "@/lib/query-keys"
import { CACHE_TIERS } from "@/lib/cache-tiers"
import { apiFetch } from "@/lib/http/api-fetch"

export function useInventoryDashboard() {
    return useQuery({
        queryKey: queryKeys.inventoryDashboard.list(),
        queryFn: () => apiFetch("/api/inventory/dashboard"),
        ...CACHE_TIERS.DASHBOARD,
    })
}
