"use client"

import { useQuery } from "@tanstack/react-query"
import { queryKeys } from "@/lib/query-keys"
import { CACHE_TIERS } from "@/lib/cache-tiers"
import { getVendorBillsRegistry } from "@/lib/actions/finance-ap"
import { getAvailableBanks } from "@/lib/actions/xendit"

interface BillsQueryParams {
    q?: string | null
    status?: string | null
    page?: number
    pageSize?: number
}

export function useBills(params?: BillsQueryParams) {
    return useQuery({
        queryKey: [...queryKeys.bills.list(), params ?? {}],
        queryFn: async () => {
            const data = await getVendorBillsRegistry(params ? {
                q: params.q ?? undefined,
                status: params.status ?? undefined,
                page: params.page,
                pageSize: params.pageSize,
            } : undefined)
            return data
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
