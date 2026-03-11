"use client"

import { useQuery } from "@tanstack/react-query"
import { queryKeys } from "@/lib/query-keys"

export function useProductionBOMs() {
    return useQuery({
        queryKey: queryKeys.productionBom.list(),
        queryFn: async () => {
            const res = await fetch("/api/manufacturing/production-bom")
            if (!res.ok) {
                const text = await res.text().catch(() => "")
                console.error("[useProductionBOMs] API error:", res.status, text)
                return []
            }
            const result = await res.json()
            if (!result.success) {
                console.error("[useProductionBOMs] API returned failure:", result.error)
            }
            return result.success ? result.data : []
        },
    })
}

export function useProductionBOM(id: string | null, options?: { refetchInterval?: number | false }) {
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
        refetchInterval: options?.refetchInterval,
    })
}
