"use client"
import { useQuery } from "@tanstack/react-query"

/**
 * Fetches a single Purchase Request detail by id from
 * /api/procurement/requests/[id]. Throws a localized error message that
 * the detail page renders in its EmptyState.
 */
export function usePurchaseRequestDetail(id: string) {
    return useQuery({
        queryKey: ["purchase-request", id],
        queryFn: async () => {
            const res = await fetch(`/api/procurement/requests/${id}`)
            if (!res.ok) {
                if (res.status === 404) throw new Error("PR tidak ditemukan")
                throw new Error("Gagal memuat detail PR")
            }
            return res.json()
        },
        enabled: !!id,
        staleTime: 30_000,
    })
}
