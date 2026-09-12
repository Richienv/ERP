"use client"

import { useReceiving } from "@/hooks/use-receiving"
import { ReceivingView } from "./receiving-view"
import { TablePageSkeleton } from "@/components/ui/page-skeleton"
import { InlinePendingBar } from "@/components/ui/inline-pending"

export default function ReceivingPage() {
    const { data, isFetching } = useReceiving()

    if (!data) {
        return <TablePageSkeleton accentColor="bg-orange-400" />
    }

    return (
        <div className="relative">
            <InlinePendingBar active={isFetching} />
            <ReceivingView
                pendingPOs={data.pendingPOs}
                grns={data.grns}
                warehouses={data.warehouses}
                employees={data.employees}
            />
        </div>
    )
}
