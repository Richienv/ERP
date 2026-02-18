"use client"

import { useQuery } from "@tanstack/react-query"
import { queryKeys } from "@/lib/query-keys"

export function useProductsPage() {
    return useQuery({
        queryKey: queryKeys.products.list(),
        queryFn: async () => {
            const res = await fetch("/api/inventory/page-data")
            if (!res.ok) throw new Error("Failed to fetch inventory data")
            const json = await res.json()
            return {
                products: json.products ?? [],
                categories: json.categories ?? [],
                warehouses: json.warehouses ?? [],
                stats: json.stats ?? { total: 0, healthy: 0, lowStock: 0, critical: 0, totalValue: 0 },
            }
        },
    })
}
