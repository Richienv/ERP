"use client"

import { useQuery } from "@tanstack/react-query"
import { queryKeys } from "@/lib/query-keys"
import { getCostSheets, getProductsForCostSheet } from "@/lib/actions/costing"

export function useCostSheets() {
    return useQuery({
        queryKey: queryKeys.costSheets.list(),
        queryFn: async () => {
            const [sheets, products] = await Promise.all([
                getCostSheets(),
                getProductsForCostSheet(),
            ])
            return { initialSheets: sheets, products }
        },
    })
}
