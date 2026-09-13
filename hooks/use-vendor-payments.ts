"use client"

import { useQuery } from "@tanstack/react-query"
import { queryKeys } from "@/lib/query-keys"
import { CACHE_TIERS } from "@/lib/cache-tiers"
import { apiFetch } from "@/lib/http/api-fetch"

type VendorPaymentsPage = {
    payments: Awaited<ReturnType<typeof import("@/lib/actions/finance-ap").getVendorPayments>>
    vendors: { id: string; name: string }[]
    openBills: Awaited<ReturnType<typeof import("@/lib/actions/finance-ap").getVendorBills>>
    apBalances: Awaited<ReturnType<typeof import("@/lib/actions/finance-ap").getVendorAPBalances>>
}

export function useVendorPayments() {
    return useQuery({
        queryKey: queryKeys.vendorPayments.list(),
        queryFn: () => apiFetch<VendorPaymentsPage>("/api/finance/lists/vendor-payments"),
        ...CACHE_TIERS.TRANSACTIONAL,
    })
}
