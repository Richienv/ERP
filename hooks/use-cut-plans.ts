"use client"

import { useQuery } from "@tanstack/react-query"
import { queryKeys } from "@/lib/query-keys"
import { getCutPlans, getFabricProducts } from "@/lib/actions/cutting"

export function useCutPlans() {
    return useQuery({
        queryKey: queryKeys.cutPlans.list(),
        queryFn: async () => {
            const [plans, fabricProducts] = await Promise.all([
                getCutPlans(),
                getFabricProducts(),
            ])
            return { plans, fabricProducts }
        },
    })
}
