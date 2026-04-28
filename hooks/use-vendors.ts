"use client"

import { useQuery } from "@tanstack/react-query"
import { queryKeys } from "@/lib/query-keys"
import { getVendors } from "@/app/actions/vendor"
import type { VendorFilter } from "@/lib/types/vendor-filters"

// Re-export VendorFilter so consumers can `import { useVendorsList, VendorFilter }
// from "@/hooks/use-vendors"`.
export type { VendorFilter } from "@/lib/types/vendor-filters"

export function useVendorsList(filter?: VendorFilter) {
    return useQuery({
        queryKey: filter
            ? ([...queryKeys.vendors.list(), filter] as const)
            : queryKeys.vendors.list(),
        queryFn: async () => {
            const vendors = await getVendors(filter)
            return vendors
        },
        // No refetchInterval — vendor list rarely changes (per the original
        // comment). staleTime + invalidation on mutation is enough.
    })
}
