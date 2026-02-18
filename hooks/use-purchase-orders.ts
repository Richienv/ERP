"use client"

import { useQuery } from "@tanstack/react-query"
import { queryKeys } from "@/lib/query-keys"
import { getAllPurchaseOrders, getVendors } from "@/lib/actions/procurement"
import { getProductsForPO } from "@/app/actions/purchase-order"

export function usePurchaseOrders() {
    return useQuery({
        queryKey: queryKeys.purchaseOrders.list(),
        queryFn: async () => {
            const [orders, vendorsRaw, products] = await Promise.all([
                getAllPurchaseOrders(),
                getVendors(),
                getProductsForPO(),
            ])
            const vendors = vendorsRaw.map((v: any) => ({ id: v.id, name: v.name, email: v.email, phone: v.phone }))
            return { orders, vendors, products }
        },
    })
}
