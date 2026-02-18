"use client"

import { useQuery } from "@tanstack/react-query"
import { queryKeys } from "@/lib/query-keys"

export function useInventoryDashboard() {
    return useQuery({
        queryKey: queryKeys.inventoryDashboard.list(),
        queryFn: async () => {
            const res = await fetch("/api/inventory/dashboard")
            if (!res.ok) throw new Error("Failed to fetch inventory dashboard")
            return await res.json()
        },
    })
}
