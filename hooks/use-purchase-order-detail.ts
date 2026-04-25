"use client"
import { useQuery } from "@tanstack/react-query"

export function usePurchaseOrderDetail(id: string) {
    return useQuery({
        queryKey: ["purchase-order", id],
        queryFn: async () => {
            const res = await fetch(`/api/procurement/orders/${id}`)
            if (!res.ok) {
                if (res.status === 404) throw new Error("PO tidak ditemukan")
                throw new Error("Gagal memuat detail PO")
            }
            return res.json()
        },
        enabled: !!id,
        staleTime: 30_000,
    })
}
