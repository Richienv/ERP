"use client"

import { useQuery } from "@tanstack/react-query"
import { queryKeys } from "@/lib/query-keys"
import { getVendorBillsRegistry } from "@/lib/actions/finance"
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
    })
}

export function useBanks() {
    return useQuery({
        queryKey: ["banks", "list"],
        queryFn: async () => {
            const data = await getAvailableBanks()
            return { banks: data.banks, ewallets: data.ewallets }
        },
        staleTime: 5 * 60 * 1000, // banks don't change often
    })
}
