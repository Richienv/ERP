"use client"

import { useQuery } from "@tanstack/react-query"
import { queryKeys } from "@/lib/query-keys"
import { CACHE_TIERS } from "@/lib/cache-tiers"
import { getAllPurchaseOrders, getVendors } from "@/lib/actions/procurement"
import { getProductsForPO } from "@/app/actions/purchase-order"
import { getWarehousesForGRN } from "@/lib/actions/grn"

export async function fetchPurchaseOrdersPage() {
    const [orders, vendorsRaw, products, warehouses] = await Promise.all([
        getAllPurchaseOrders(),
        getVendors(),
        getProductsForPO(),
        getWarehousesForGRN(),
    ])
    const vendors = (vendorsRaw || []).map((v: any) => ({ id: v.id, name: v.name, email: v.email, phone: v.phone }))
    return { orders: orders || [], vendors, products: products || [], warehouses: warehouses || [] }
}

export function usePurchaseOrders() {
    return useQuery({
        queryKey: queryKeys.purchaseOrders.list(),
        queryFn: fetchPurchaseOrdersPage,
        ...CACHE_TIERS.TRANSACTIONAL,
    })
}
