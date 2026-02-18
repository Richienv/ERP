"use client"

import { useQuery } from "@tanstack/react-query"
import { queryKeys } from "@/lib/query-keys"

export function useSalesPage() {
    return useQuery({
        queryKey: queryKeys.salesPage.list(),
        queryFn: async () => {
            const res = await fetch("/api/sales/page-data")
            if (!res.ok) throw new Error("Failed to fetch sales page data")
            const json = await res.json()
            return json.data
        },
    })
}
