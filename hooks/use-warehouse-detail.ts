"use client"

import { useQuery } from "@tanstack/react-query"
import { queryKeys } from "@/lib/query-keys"
import { getWarehouseDetails } from "@/app/actions/inventory"

export function useWarehouseDetail(id: string) {
    return useQuery({
        queryKey: queryKeys.warehouses.detail(id),
        queryFn: () => getWarehouseDetails(id),
        enabled: !!id,
    })
}
