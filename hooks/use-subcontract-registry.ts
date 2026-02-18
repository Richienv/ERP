"use client"

import { useQuery } from "@tanstack/react-query"
import { queryKeys } from "@/lib/query-keys"
import { getSubcontractors } from "@/lib/actions/subcontract"

export function useSubcontractRegistry() {
    return useQuery({
        queryKey: queryKeys.subcontractRegistry.list(),
        queryFn: async () => {
            const subcontractors = await getSubcontractors()
            return { subcontractors }
        },
    })
}
