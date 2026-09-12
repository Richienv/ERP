"use client"

import { useQuery } from "@tanstack/react-query"
import { getStockMovements } from "@/app/actions/inventory"
import { queryKeys } from "@/lib/query-keys"
import { CACHE_TIERS } from "@/lib/cache-tiers"

async function fetchProductsAndWarehouses() {
    const res = await fetch("/api/inventory/page-data")
    if (!res.ok) return { products: [], warehouses: [] }
    const json = await res.json()
    return { products: json.products ?? [], warehouses: json.warehouses ?? [] }
}

export async function fetchStockMovementsBundle(limit: number) {
    const [{ products, warehouses }, movements] = await Promise.all([
        fetchProductsAndWarehouses(),
        getStockMovements(limit),
    ])
    return { movements, products, warehouses }
}

export function useStockMovements() {
    return useQuery({
        queryKey: queryKeys.stockMovements.list(),
        queryFn: () => fetchStockMovementsBundle(100),
        ...CACHE_TIERS.TRANSACTIONAL,
    })
}

export function useAdjustmentsData() {
    return useQuery({
        queryKey: queryKeys.adjustments.list(),
        queryFn: () => fetchStockMovementsBundle(50),
        ...CACHE_TIERS.TRANSACTIONAL,
    })
}
