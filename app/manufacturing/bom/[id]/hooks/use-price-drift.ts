"use client"

import { useMemo } from "react"
import type { BOMItem } from "../bom-canvas-context"

// ─── Pure helper (exported for testing) ──────────────────────────────────────

export interface PriceDriftResult {
    itemId: string
    materialName: string
    oldPrice: number
    newPrice: number
    changePct: number
    direction: "naik" | "turun"
}

export function detectPriceDrift(items: BOMItem[]): PriceDriftResult[] {
    const drifted: PriceDriftResult[] = []
    for (const item of items) {
        const snapshot = item.snapshotCostPrice
        const current = item.material.costPrice
        if (snapshot == null || current == null) continue
        const snapshotNum = Number(snapshot)
        const currentNum = Number(current)
        if (snapshotNum === 0) continue
        if (Math.abs(currentNum - snapshotNum) < 0.01) continue
        drifted.push({
            itemId: item.id,
            materialName: item.material.name,
            oldPrice: snapshotNum,
            newPrice: currentNum,
            changePct: Math.abs(((currentNum - snapshotNum) / snapshotNum) * 100),
            direction: currentNum > snapshotNum ? "naik" : "turun",
        })
    }
    return drifted
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function usePriceDrift(items: BOMItem[]) {
    return useMemo(() => detectPriceDrift(items), [items])
}
