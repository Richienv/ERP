"use client"

import { useQuery } from "@tanstack/react-query"
import { getPendingPOsForReceiving, getAllGRNs, getWarehousesForGRN, getEmployeesForGRN } from "@/lib/actions/grn"
import { queryKeys } from "@/lib/query-keys"

export function useReceiving() {
    return useQuery({
        queryKey: queryKeys.receiving.list(),
        queryFn: async () => {
            const [pendingPOs, grns, warehouses, employees] = await Promise.all([
                getPendingPOsForReceiving(),
                getAllGRNs(),
                getWarehousesForGRN(),
                getEmployeesForGRN(),
            ])
            return { pendingPOs, grns, warehouses, employees }
        },
    })
}
