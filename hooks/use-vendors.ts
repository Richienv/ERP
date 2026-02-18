"use client"

import { useQuery } from "@tanstack/react-query"
import { queryKeys } from "@/lib/query-keys"
import { getVendors } from "@/app/actions/vendor"

export function useVendorsList() {
    return useQuery({
        queryKey: queryKeys.vendors.list(),
        queryFn: async () => {
            const vendors = await getVendors()
            return vendors
        },
    })
}
