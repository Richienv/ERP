"use client"
import { useQuery } from "@tanstack/react-query"

export function useGRNDetail(id: string) {
    return useQuery({
        queryKey: ["grn-detail", id] as const,
        queryFn: async () => {
            const res = await fetch(`/api/procurement/receiving/${id}`)
            if (!res.ok) {
                if (res.status === 404) throw new Error("GRN tidak ditemukan")
                throw new Error("Gagal memuat detail GRN")
            }
            return res.json()
        },
        enabled: !!id,
    })
}
