"use client"

import { useQuery } from "@tanstack/react-query"
import { queryKeys } from "@/lib/query-keys"

export function useWorkOrders() {
    return useQuery({
        queryKey: queryKeys.workOrders.list(),
        queryFn: async () => {
            const params = new URLSearchParams({ orderType: "MO" })
            const res = await fetch(`/api/manufacturing/work-orders?${params.toString()}`)
            if (!res.ok) return { orders: [], summary: { planned: 0, inProgress: 0, completed: 0, onHold: 0 } }
            const result = await res.json()
            return {
                orders: result.success ? result.data : [],
                summary: result.success ? result.summary : { planned: 0, inProgress: 0, completed: 0, onHold: 0 },
            }
        },
    })
}
