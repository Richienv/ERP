"use client"

import { useQuery } from "@tanstack/react-query"
import { queryKeys } from "@/lib/query-keys"
import { getAllPriceLists } from "@/lib/actions/sales"

export function usePriceLists() {
    return useQuery({
        queryKey: queryKeys.priceLists.list(),
        queryFn: async () => {
            const priceLists = await getAllPriceLists()
            return { initialPriceLists: priceLists }
        },
    })
}
