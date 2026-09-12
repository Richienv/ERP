"use client"

import { useSearchParams } from "next/navigation"
import { usePurchaseOrders } from "@/hooks/use-purchase-orders"
import { OrdersView } from "@/app/procurement/orders/orders-view"
import { TablePageSkeleton } from "@/components/ui/page-skeleton"
import { InlinePendingBar } from "@/components/ui/inline-pending"

export default function PurchaseOrdersPage() {
    const { data, isFetching } = usePurchaseOrders()
    const searchParams = useSearchParams()
    const highlightId = searchParams.get("highlight")

    if (!data) {
        return <TablePageSkeleton accentColor="bg-orange-400" />
    }

    return (
        <div className="relative">
            <InlinePendingBar active={isFetching} />
            <OrdersView
                initialOrders={data.orders ?? []}
                vendors={data.vendors ?? []}
                products={data.products ?? []}
                warehouses={data.warehouses ?? []}
                highlightId={highlightId}
            />
        </div>
    )
}
