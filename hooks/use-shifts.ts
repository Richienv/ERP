"use client"

import { useQuery } from "@tanstack/react-query"
import { queryKeys } from "@/lib/query-keys"
import { CACHE_TIERS } from "@/lib/cache-tiers"

export async function fetchShiftsPage() {
    const res = await fetch("/api/hcm/shifts-data")
    if (!res.ok) throw new Error("Failed to fetch shifts")
    return res.json()
}

export function useShifts() {
    return useQuery({
        queryKey: queryKeys.hcmShifts.list(),
        queryFn: fetchShiftsPage,
        ...CACHE_TIERS.MASTER_PLUS,
    })
}
