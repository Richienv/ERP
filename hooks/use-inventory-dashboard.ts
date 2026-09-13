"use client"

import { useQuery } from "@tanstack/react-query"
import { queryKeys } from "@/lib/query-keys"
import { CACHE_TIERS } from "@/lib/cache-tiers"
import { apiFetch } from "@/lib/http/api-fetch"

type InventoryStats = {
    totalProducts: number
    lowStock: number
    totalValue: number
    warehouseCount: number
    inboundToday: number
    outboundToday: number
}

type InventoryDashboardPayload = {
    warehouses?: unknown[]
    kpis?: InventoryStats & { inventoryAccuracy?: number }
    materialGap?: unknown[]
    procurement?: unknown
}

function kpisFromStats(stats: InventoryStats) {
    return {
        totalProducts: stats.totalProducts,
        lowStock: stats.lowStock,
        totalValue: stats.totalValue,
        inventoryAccuracy: 100,
        inboundToday: stats.inboundToday,
        outboundToday: stats.outboundToday,
    }
}

export function useInventoryDashboard() {
    const stats = useQuery({
        queryKey: queryKeys.inventoryDashboard.stats(),
        queryFn: () => apiFetch<InventoryStats>("/api/inventory/stats"),
        ...CACHE_TIERS.DASHBOARD,
    })
    const rest = useQuery({
        queryKey: queryKeys.inventoryDashboard.list(),
        queryFn: () => apiFetch<InventoryDashboardPayload>("/api/inventory/dashboard"),
        ...CACHE_TIERS.DASHBOARD,
    })

    const kpis = rest.data?.kpis ?? (stats.data ? kpisFromStats(stats.data) : undefined)
    const data = kpis
        ? {
            warehouses: rest.data?.warehouses ?? [],
            kpis,
            materialGap: rest.data?.materialGap ?? [],
            procurement: rest.data?.procurement ?? {},
        }
        : undefined

    return { ...rest, data, isPending: !data && (stats.isPending || rest.isPending) }
}
