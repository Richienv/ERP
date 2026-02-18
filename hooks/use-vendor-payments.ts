"use client"

import { useQuery } from "@tanstack/react-query"
import { queryKeys } from "@/lib/query-keys"
import { getVendorPayments } from "@/lib/actions/finance"
import { getVendors } from "@/lib/actions/procurement"

export function useVendorPayments() {
    return useQuery({
        queryKey: queryKeys.vendorPayments.list(),
        queryFn: async () => {
            const [payments, vendorsRaw] = await Promise.all([
                getVendorPayments(),
                getVendors(),
            ])
            const vendors = vendorsRaw.map((v: any) => ({ id: v.id, name: v.name }))
            return { payments, vendors }
        },
    })
}
