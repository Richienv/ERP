"use client"

import { useQuery } from "@tanstack/react-query"
import { queryKeys } from "@/lib/query-keys"
import { getCostingDashboard, getProductsForCostSheet } from "@/lib/actions/costing"

export function useCostingDashboard() {
    return useQuery({
        queryKey: queryKeys.costingDashboard.list(),
        queryFn: async () => {
            const [data, products] = await Promise.all([
                getCostingDashboard(),
                getProductsForCostSheet(),
            ])
            return { data, products }
        },
    })
}
