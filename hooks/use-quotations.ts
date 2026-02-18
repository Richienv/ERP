"use client"

import { useQuery } from "@tanstack/react-query"
import { queryKeys } from "@/lib/query-keys"
import { getQuotations } from "@/lib/actions/sales"

export function useQuotations() {
    return useQuery({
        queryKey: queryKeys.quotations.list(),
        queryFn: async () => {
            const quotations = await getQuotations()
            return quotations as any[]
        },
    })
}
