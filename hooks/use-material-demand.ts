"use client"

import { useQuery } from "@tanstack/react-query"
import { queryKeys } from "@/lib/query-keys"

export interface MaterialDemandRow {
    materialId: string
    materialCode: string
    materialName: string
    unit: string
    requiredQty: number
    inStock: number
    onOrder: number
    shortfall: number
    status: "Cukup" | "Perlu Pesan" | "Kurang"
    workOrderNumbers: string[]
}

export interface MaterialDemandKPI {
    totalMaterials: number
    materialsInStock: number
    materialsOnOrder: number
    shortfallCount: number
}

export interface MaterialDemandData {
    kpi: MaterialDemandKPI
    rows: MaterialDemandRow[]
}

export function useMaterialDemand() {
    return useQuery({
        queryKey: queryKeys.materialDemand.list(),
        queryFn: async (): Promise<MaterialDemandData> => {
            const empty: MaterialDemandData = { kpi: { totalMaterials: 0, materialsInStock: 0, materialsOnOrder: 0, shortfallCount: 0 }, rows: [] }
            try {
                const res = await fetch("/api/manufacturing/material-demand")
                if (!res.ok) return empty
                const json = await res.json()
                if (!json.success || !json.data) return empty
                return {
                    kpi: json.data.kpi ?? empty.kpi,
                    rows: json.data.rows ?? [],
                }
            } catch {
                return empty
            }
        },
    })
}
