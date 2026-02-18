"use client"

import { useQuery } from "@tanstack/react-query"
import { queryKeys } from "@/lib/query-keys"
import { getCostSheetDetail } from "@/lib/actions/costing"

export function useCostSheetDetail(id: string) {
    return useQuery({
        queryKey: queryKeys.costSheets.detail(id),
        queryFn: () => getCostSheetDetail(id),
        enabled: !!id,
    })
}
