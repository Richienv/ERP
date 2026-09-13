"use client"

import { useQuery } from "@tanstack/react-query"
import { queryKeys } from "@/lib/query-keys"
import { CACHE_TIERS } from "@/lib/cache-tiers"
import { getAvailableBanks } from "@/lib/actions/xendit"
import { apiFetch } from "@/lib/http/api-fetch"
import type { VendorBillRegistryResult } from "@/lib/actions/finance-ap"

interface BillsQueryParams {
    q?: string | null
    status?: string | null
    page?: number
    pageSize?: number
}

export function useBills(params?: BillsQueryParams) {
    return useQuery({
        queryKey: [...queryKeys.bills.list(), params ?? {}],
        queryFn: () => {
            const search = new URLSearchParams()
            if (params?.q) search.set("q", params.q)
            if (params?.status) search.set("status", params.status)
            if (params?.page) search.set("page", String(params.page))
            if (params?.pageSize) search.set("pageSize", String(params.pageSize))
            const qs = search.toString()
            return apiFetch<VendorBillRegistryResult>(
                qs ? `/api/finance/lists/bills?${qs}` : "/api/finance/lists/bills",
            )
        },
        ...CACHE_TIERS.TRANSACTIONAL,
    })
}

export function useBanks() {
    return useQuery({
        queryKey: ["banks", "list"],
        queryFn: async () => {
            const data = await getAvailableBanks()
            return { banks: data.banks, ewallets: data.ewallets }
        },
        ...CACHE_TIERS.MASTER,
    })
}
