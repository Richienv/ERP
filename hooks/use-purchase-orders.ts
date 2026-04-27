"use client"

import { useQuery } from "@tanstack/react-query"
import { queryKeys } from "@/lib/query-keys"
import { getAllPurchaseOrders, getVendors } from "@/lib/actions/procurement"
import { getProductsForPO } from "@/app/actions/purchase-order"
import { getWarehousesForGRN } from "@/lib/actions/grn"
import type { POFilter } from "@/lib/types/procurement-filters"

// Re-export POFilter so consumers can `import { usePurchaseOrders, POFilter } from "@/hooks/use-purchase-orders"`.
export type { POFilter } from "@/lib/types/procurement-filters"

export function usePurchaseOrders(filter?: POFilter) {
    return useQuery({
        queryKey: filter
            ? ([...queryKeys.purchaseOrders.list(), filter] as const)
            : queryKeys.purchaseOrders.list(),
        queryFn: async () => {
            const [orders, vendorsRaw, products, warehouses] = await Promise.all([
                getAllPurchaseOrders(filter),
                getVendors(),
                getProductsForPO(),
                getWarehousesForGRN(),
            ])
            const vendors = (vendorsRaw || []).map((v: any) => ({ id: v.id, name: v.name, email: v.email, phone: v.phone }))
            return { orders: orders || [], vendors, products: products || [], warehouses: warehouses || [] }
        },
    })
}
