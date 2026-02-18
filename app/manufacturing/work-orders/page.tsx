"use client"

import { useSpkOrders } from "@/hooks/use-spk-orders"
import { WorkOrdersClient } from "./work-orders-client"
import { TablePageSkeleton } from "@/components/ui/page-skeleton"

export default function WorkOrdersPage() {
    const { data, isLoading } = useSpkOrders()

    if (isLoading) {
        return <TablePageSkeleton accentColor="bg-rose-400" />
    }

    return <WorkOrdersClient initialOrders={data ?? []} />
}
