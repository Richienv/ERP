"use client"

import { useQuery } from "@tanstack/react-query"
import { queryKeys } from "@/lib/query-keys"

export function useQuotationDetail(id: string) {
    return useQuery({
        queryKey: queryKeys.quotations.detail(id),
        queryFn: async () => {
            const res = await fetch(`/api/sales/quotations/${id}`)
            if (!res.ok) throw new Error("Failed to fetch quotation")
            const json = await res.json()
            return json.success ? json.data : null
        },
        enabled: !!id,
    })
}
