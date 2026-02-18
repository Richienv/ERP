"use client"

import { useQuery } from "@tanstack/react-query"
import { queryKeys } from "@/lib/query-keys"
import { getCuttingDashboard, getFabricProducts } from "@/lib/actions/cutting"

export function useCuttingDashboard() {
    return useQuery({
        queryKey: queryKeys.cuttingDashboard.list(),
        queryFn: async () => {
            const [data, fabricProducts] = await Promise.all([
                getCuttingDashboard(),
                getFabricProducts(),
            ])
            return { data, fabricProducts }
        },
    })
}
