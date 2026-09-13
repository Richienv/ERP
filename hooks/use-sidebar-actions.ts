"use client"

import { useQuery } from "@tanstack/react-query"
import { apiFetch } from "@/lib/http/api-fetch"
import { queryKeys } from "@/lib/query-keys"

export interface SidebarActionCounts {
    vendorsIncomplete: number
    productsIncomplete: number
    customersIncomplete: number
    lowStockProducts: number
    pendingPurchaseRequests: number
    pendingApprovals: number
    pendingInvoices: number
}

export function useSidebarActions() {
    return useQuery<SidebarActionCounts | null>({
        queryKey: queryKeys.sidebarActions.list(),
        queryFn: () => apiFetch<SidebarActionCounts>("/api/sidebar/action-counts"),
        refetchInterval: 30_000, // refresh every 30s
        staleTime: 15_000,
    })
}
