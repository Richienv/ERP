"use client"

import { useReceiving } from "@/hooks/use-receiving"
import { ReceivingView } from "./receiving-view"
import { TablePageSkeleton } from "@/components/ui/page-skeleton"

export default function ReceivingPage() {
    const { data, isLoading } = useReceiving()

    if (isLoading || !data) {
        return <TablePageSkeleton accentColor="bg-blue-400" />
    }

    return (
        <ReceivingView
            pendingPOs={data.pendingPOs}
            grns={data.grns}
            warehouses={data.warehouses}
            employees={data.employees}
        />
    )
}
