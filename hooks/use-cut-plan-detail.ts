"use client"

import { useQuery } from "@tanstack/react-query"
import { queryKeys } from "@/lib/query-keys"
import { getCutPlanDetail } from "@/lib/actions/cutting"

export function useCutPlanDetail(id: string) {
    return useQuery({
        queryKey: queryKeys.cutPlans.detail(id),
        queryFn: () => getCutPlanDetail(id),
        enabled: !!id,
    })
}
