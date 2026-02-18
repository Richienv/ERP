"use client"

import { useQuery } from "@tanstack/react-query"
import { queryKeys } from "@/lib/query-keys"
import { getSubcontractorDetail } from "@/lib/actions/subcontract"

export function useSubcontractorDetail(id: string) {
    return useQuery({
        queryKey: queryKeys.subcontractRegistry.detail(id),
        queryFn: () => getSubcontractorDetail(id),
        enabled: !!id,
    })
}
