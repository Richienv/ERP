"use client"

import { useQuery } from "@tanstack/react-query"
import { queryKeys } from "@/lib/query-keys"
import { getSubcontractOrderDetail, getWarehousesForSubcontract } from "@/lib/actions/subcontract"

export function useSubcontractOrderDetail(id: string) {
    return useQuery({
        queryKey: queryKeys.subcontractOrders.detail(id),
        queryFn: async () => {
            const [order, warehouses] = await Promise.all([
                getSubcontractOrderDetail(id),
                getWarehousesForSubcontract(),
            ])
            return { order, warehouses }
        },
        enabled: !!id,
    })
}
