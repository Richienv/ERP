"use client"

import { useQuery } from "@tanstack/react-query"
import { queryKeys } from "@/lib/query-keys"

export function useProductionBOMs() {
    return useQuery({
        queryKey: queryKeys.productionBom.list(),
        queryFn: async () => {
            const res = await fetch("/api/manufacturing/production-bom")
            if (!res.ok) return []
            const result = await res.json()
            return result.success ? result.data : []
        },
    })
}

export function useProductionBOM(id: string | null) {
    return useQuery({
        queryKey: queryKeys.productionBom.detail(id || ""),
        queryFn: async () => {
            if (!id) return null
            const res = await fetch(`/api/manufacturing/production-bom/${id}`)
            if (!res.ok) return null
            const result = await res.json()
            return result.success ? result.data : null
        },
        enabled: !!id,
    })
}
