"use client"

import { useQuery } from "@tanstack/react-query"
import { queryKeys } from "@/lib/query-keys"
import { getAllPurchaseOrders, getVendors } from "@/lib/actions/procurement"
import { getProductsForPO } from "@/app/actions/purchase-order"
import { getWarehousesForGRN } from "@/lib/actions/grn"
import type { POFilter } from "@/lib/types/procurement-filters"

// Re-export POFilter so consumers can `import { usePurchaseOrders, POFilter } from "@/hooks/use-purchase-orders"`.
export type { POFilter } from "@/lib/types/procurement-filters"

/**
 * Hook for the PO LIST page. Loads only what the table needs (orders + vendors).
 * Products + warehouses moved to usePOFormOptions() — only needed when a
 * create/import dialog opens. This saves ~200-400ms per list-page visit and
 * frees 2 connection pool slots.
 */
export function usePurchaseOrders(filter?: POFilter) {
    return useQuery({
        queryKey: (() => {
            const hasFilter = filter && Object.values(filter).some(v => v !== undefined && v !== null && v !== '')
            return hasFilter
                ? ([...queryKeys.purchaseOrders.list(), filter] as const)
                : queryKeys.purchaseOrders.list()
        })(),
        queryFn: async () => {
            const [orders, vendorsRaw] = await Promise.all([
                getAllPurchaseOrders(filter),
                getVendors(),
            ])
            const vendors = (vendorsRaw || []).map((v: any) => ({ id: v.id, name: v.name, email: v.email, phone: v.phone }))
            return { orders: orders || [], vendors, products: [] as any[], warehouses: [] as any[] }
        },
    })
}

/**
 * Lazy companion hook — fetches the heavy options (products with supplier
 * relations, warehouses) only when a create-PO or import dialog opens.
 * Use `enabled: dialogOpen` to gate the fetch.
 */
export function usePOFormOptions(enabled: boolean = false) {
    return useQuery({
        queryKey: [...queryKeys.purchaseOrders.all, "form-options"] as const,
        queryFn: async () => {
            const [products, warehouses] = await Promise.all([
                getProductsForPO(),
                getWarehousesForGRN(),
            ])
            return { products: products || [], warehouses: warehouses || [] }
        },
        enabled,
    })
}
