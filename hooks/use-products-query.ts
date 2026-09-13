"use client"

import { useQuery } from "@tanstack/react-query"
import { queryKeys } from "@/lib/query-keys"
import { CACHE_TIERS } from "@/lib/cache-tiers"
import { apiFetch } from "@/lib/http/api-fetch"

export function useProductsPage() {
    return useQuery({
        queryKey: queryKeys.products.list(),
        queryFn: async () => {
            const json = await apiFetch("/api/inventory/page-data")
            return {
                products: json.products ?? [],
                categories: json.categories ?? [],
                warehouses: json.warehouses ?? [],
                stats: json.stats ?? { total: 0, healthy: 0, lowStock: 0, critical: 0, newArrivals: 0, planning: 0, incoming: 0, totalValue: 0 },
            }
        },
        ...CACHE_TIERS.MASTER_PLUS,
    })
}
