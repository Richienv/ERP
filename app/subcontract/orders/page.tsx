"use client"

import { useSubcontractOrders } from "@/hooks/use-subcontract-orders"
import { TablePageSkeleton } from "@/components/ui/page-skeleton"
import { SubcontractOrdersClient } from "@/components/subcontract/subcontract-orders-client"

export default function SubcontractOrdersPage() {
    const { data, isLoading } = useSubcontractOrders()

    if (isLoading || !data) return <TablePageSkeleton accentColor="bg-orange-400" />

    return (
        <div className="p-6 space-y-6">
            <SubcontractOrdersClient
                orders={data.orders}
                subcontractors={data.subcontractors}
                products={data.products}
            />
        </div>
    )
}
