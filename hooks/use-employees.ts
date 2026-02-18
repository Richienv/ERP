"use client"

import { useQuery } from "@tanstack/react-query"
import { queryKeys } from "@/lib/query-keys"
import { getEmployees } from "@/app/actions/hcm"

export function useEmployees() {
    return useQuery({
        queryKey: queryKeys.employees.list(),
        queryFn: async () => {
            const employees = await getEmployees({ includeInactive: true })
            return employees as any[]
        },
    })
}
