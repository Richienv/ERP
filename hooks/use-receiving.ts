"use client"

import { useQuery } from "@tanstack/react-query"
import { queryKeys } from "@/lib/query-keys"
import { getAllGRNs, getPendingPOsForReceiving, getWarehousesForGRN, getEmployeesForGRN } from "@/lib/actions/grn"
import type { GRNFilter } from "@/lib/types/grn-filters"

export type { GRNFilter } from "@/lib/types/grn-filters"

/**
 * Fetch GRN list + pending POs + warehouses + employees in one round-trip.
 * Filter is passed through to `getAllGRNs` server-side; pendingPOs and
 * masters are unfiltered (cached cheaply by the singleton prisma instance).
 */
export function useReceiving(filter?: GRNFilter) {
    return useQuery({
        queryKey: filter
            ? ([...queryKeys.receiving.list(), filter] as const)
            : queryKeys.receiving.list(),
        queryFn: async () => {
            const [grns, pendingPOs, warehouses, employees] = await Promise.all([
                getAllGRNs(filter),
                getPendingPOsForReceiving(),
                getWarehousesForGRN(),
                getEmployeesForGRN(),
            ])
            return {
                grns: grns ?? [],
                pendingPOs: pendingPOs ?? [],
                warehouses: warehouses ?? [],
                employees: employees ?? [],
            }
        },
        staleTime: 2 * 60 * 1000, // 2 min — transactional data
    })
}

