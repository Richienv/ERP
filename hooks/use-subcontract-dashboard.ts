"use client"

import { useQuery } from "@tanstack/react-query"
import { queryKeys } from "@/lib/query-keys"
import { getSubcontractDashboard } from "@/lib/actions/subcontract"

export function useSubcontractDashboard() {
    return useQuery({
        queryKey: queryKeys.subcontractDashboard.list(),
        queryFn: async () => {
            const data = await getSubcontractDashboard()
            return data
        },
    })
}
