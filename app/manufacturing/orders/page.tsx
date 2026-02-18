"use client"

import { useWorkOrders } from "@/hooks/use-work-orders"
import { OrdersClient } from "./orders-client"
import { CardPageSkeleton } from "@/components/ui/page-skeleton"

export default function ProductionOrdersPage() {
    const { data, isLoading } = useWorkOrders()

    const emptySummary = { planned: 0, inProgress: 0, completed: 0, onHold: 0 }

    if (isLoading) {
        return (
            <div className="min-h-screen bg-background pb-24">
                <CardPageSkeleton accentColor="bg-blue-400" />
            </div>
        )
    }

    return (
        <div className="min-h-screen bg-background pb-24">
            <OrdersClient
                initialOrders={data?.orders ?? []}
                initialSummary={data?.summary ?? emptySummary}
            />
        </div>
    )
}
