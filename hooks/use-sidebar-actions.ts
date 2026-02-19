"use client"

import { useQuery } from "@tanstack/react-query"
import { queryKeys } from "@/lib/query-keys"

export interface SidebarActionCounts {
    vendorsIncomplete: number
    productsIncomplete: number
    customersIncomplete: number
    lowStockProducts: number
    pendingPurchaseRequests: number
    pendingApprovals: number
}

export function useSidebarActions() {
    return useQuery<SidebarActionCounts | null>({
        queryKey: queryKeys.sidebarActions.list(),
        queryFn: async () => {
            const res = await fetch("/api/sidebar/action-counts")
            if (!res.ok) return null
            return res.json()
        },
        refetchInterval: 30_000, // refresh every 30s
        staleTime: 15_000,
    })
}
