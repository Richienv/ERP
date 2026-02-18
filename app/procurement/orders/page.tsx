"use client"

import { usePurchaseOrders } from "@/hooks/use-purchase-orders"
import { OrdersView } from "@/app/procurement/orders/orders-view"
import { TablePageSkeleton } from "@/components/ui/page-skeleton"

export default function PurchaseOrdersPage() {
    const { data, isLoading } = usePurchaseOrders()

    if (isLoading || !data) {
        return <TablePageSkeleton accentColor="bg-blue-400" />
    }

    return (
        <OrdersView
            initialOrders={data.orders}
            vendors={data.vendors}
            products={data.products}
        />
    )
}
