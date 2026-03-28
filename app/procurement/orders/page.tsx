"use client"

import { useSearchParams } from "next/navigation"
import { usePurchaseOrders } from "@/hooks/use-purchase-orders"
import { OrdersView } from "@/app/procurement/orders/orders-view"
import { TablePageSkeleton } from "@/components/ui/page-skeleton"

export default function PurchaseOrdersPage() {
    const { data, isLoading } = usePurchaseOrders()
    const searchParams = useSearchParams()
    const highlightId = searchParams.get("highlight")

    if (isLoading || !data || !data.orders) {
        return <TablePageSkeleton accentColor="bg-blue-400" />
    }

    return (
        <OrdersView
            initialOrders={data.orders ?? []}
            vendors={data.vendors ?? []}
            products={data.products ?? []}
            warehouses={data.warehouses ?? []}
            highlightId={highlightId}
        />
    )
}
