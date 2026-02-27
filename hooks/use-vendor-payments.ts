"use client"

import { useQuery } from "@tanstack/react-query"
import { queryKeys } from "@/lib/query-keys"
import { getVendorPayments, getVendorBills } from "@/lib/actions/finance"
import { getVendors } from "@/lib/actions/procurement"

export function useVendorPayments() {
    return useQuery({
        queryKey: queryKeys.vendorPayments.list(),
        queryFn: async () => {
            const [payments, vendorsRaw, allBills] = await Promise.all([
                getVendorPayments(),
                getVendors(),
                getVendorBills(),
            ])
            const vendors = vendorsRaw.map((v: any) => ({ id: v.id, name: v.name }))
            // Only open bills (not DRAFT/PAID)
            const openBills = allBills.filter((b: any) =>
                ['ISSUED', 'PARTIAL', 'OVERDUE'].includes(b.status)
            )
            return { payments, vendors, openBills }
        },
    })
}
