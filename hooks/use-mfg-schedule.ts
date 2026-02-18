"use client"

import { useQuery } from "@tanstack/react-query"
import { queryKeys } from "@/lib/query-keys"
import { getSchedulableWorkOrders, getMachinesForScheduling, getRoutingsForScheduling } from "@/lib/actions/manufacturing-garment"

export function useMfgSchedule() {
    return useQuery({
        queryKey: queryKeys.mfgSchedule.list(),
        queryFn: async () => {
            const [workOrders, machines, routings] = await Promise.all([
                getSchedulableWorkOrders(),
                getMachinesForScheduling(),
                getRoutingsForScheduling(),
            ])
            return { workOrders, machines, routings }
        },
    })
}
