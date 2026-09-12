"use client"

import { useQuery } from "@tanstack/react-query"
import { getWarehouses } from "@/app/actions/inventory"
import { queryKeys } from "@/lib/query-keys"
import { CACHE_TIERS } from "@/lib/cache-tiers"

export function useWarehouses() {
    return useQuery({
        queryKey: queryKeys.warehouses.list(),
        queryFn: async () => {
            const warehouses = await getWarehouses()
            return warehouses
        },
        ...CACHE_TIERS.MASTER,
    })
}
