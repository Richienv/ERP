"use client"

import { useQuery } from "@tanstack/react-query"
import { queryKeys } from "@/lib/query-keys"
import { CACHE_TIERS } from "@/lib/cache-tiers"
import { getVendors } from "@/app/actions/vendor"

export function useVendorsList() {
    return useQuery({
        queryKey: queryKeys.vendors.list(),
        queryFn: async () => {
            const vendors = await getVendors()
            return vendors
        },
        ...CACHE_TIERS.MASTER_PLUS,
        refetchInterval: 60_000,
    })
}
