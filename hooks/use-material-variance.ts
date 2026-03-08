"use client"

import { useQuery } from "@tanstack/react-query"
import { queryKeys } from "@/lib/query-keys"

export interface VarianceLine {
    materialId: string
    materialCode: string
    materialName: string
    unit: string
    plannedQty: number
    actualQty: number
    qtyVariance: number
    qtyVariancePct: number
    plannedUnitCost: number
    actualUnitCost: number
    plannedCost: number
    actualCost: number
    costVariance: number
    costVariancePct: number
    status: "HEMAT" | "SESUAI" | "BOROS"
}

export interface VarianceData {
    workOrderId: string
    workOrderNumber: string
    lines: VarianceLine[]
    totalPlannedCost: number
    totalActualCost: number
    totalCostVariance: number
    totalVariancePct: number
    woStatus: "HEMAT" | "SESUAI" | "BOROS"
}

export function useMaterialVariance(workOrderId: string) {
    return useQuery<VarianceData | null>({
        queryKey: [...queryKeys.workOrders.all, "variance", workOrderId],
        queryFn: async () => {
            const res = await fetch(`/api/manufacturing/work-orders/${workOrderId}/variance`)
            if (!res.ok) return null
            const json = await res.json()
            return json.data ?? null
        },
        enabled: !!workOrderId,
    })
}
