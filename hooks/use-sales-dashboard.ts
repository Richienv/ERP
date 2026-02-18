"use client"

import { useQuery } from "@tanstack/react-query"
import { queryKeys } from "@/lib/query-keys"

export function useSalesDashboard() {
    return useQuery({
        queryKey: queryKeys.salesDashboard.list(),
        queryFn: async () => {
            const res = await fetch("/api/sales/dashboard")
            if (!res.ok) throw new Error("Failed to fetch sales dashboard")
            const json = await res.json()
            return {
                invoices: json.invoices ?? [],
                stats: json.stats ?? {
                    totalRevenue: 0,
                    paidAmount: 0,
                    paidCount: 0,
                    unpaidAmount: 0,
                    unpaidCount: 0,
                    overdueAmount: 0,
                    overdueCount: 0,
                },
            }
        },
    })
}
