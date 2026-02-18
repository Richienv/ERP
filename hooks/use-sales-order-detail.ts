"use client"

import { useQuery } from "@tanstack/react-query"
import { queryKeys } from "@/lib/query-keys"

export function useSalesOrderDetail(id: string) {
    return useQuery({
        queryKey: queryKeys.salesOrders.detail(id),
        queryFn: async () => {
            const res = await fetch(`/api/sales/orders/${id}`)
            if (!res.ok) throw new Error("Failed to fetch sales order")
            const json = await res.json()
            return json.data
        },
        enabled: !!id,
    })
}
