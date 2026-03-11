"use client"

import { useQuery } from "@tanstack/react-query"
import type { BOMItem } from "../bom-canvas-context"

// ─── Pure helper (exported for testing) ──────────────────────────────────────

export type StockStatus = "cukup" | "hampir-habis" | "kurang"

export function getStockStatus(required: number, available: number): StockStatus {
    if (required === 0) return "cukup"
    const pct = available / required
    if (pct >= 1) return "cukup"
    if (pct >= 0.5) return "hampir-habis"
    return "kurang"
}

export interface StockCheckResult {
    productId: string
    available: number
    required: number
    status: StockStatus
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useStockAvailability(items: BOMItem[], totalQty: number) {
    const productIds = items.map((i) => i.materialId)
    const requiredQtys = items.map((i) =>
        Math.ceil(Number(i.quantityPerUnit) * totalQty * (1 + Number(i.wastePct) / 100))
    )

    return useQuery<StockCheckResult[]>({
        queryKey: ["stock-check", productIds.join(","), requiredQtys.join(",")],
        queryFn: async () => {
            if (productIds.length === 0) return []
            const res = await fetch(
                `/api/inventory/stock-check?productIds=${productIds.join(",")}&requiredQtys=${requiredQtys.join(",")}`
            )
            const json = await res.json()
            if (!json.success) return []
            return (json.data as { productId: string; available: number; required: number }[]).map((d) => ({
                ...d,
                status: getStockStatus(d.required, d.available),
            }))
        },
        enabled: productIds.length > 0 && totalQty > 0,
        staleTime: 60_000,
    })
}
