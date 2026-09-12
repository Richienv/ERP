"use client"

import { useVendorsList } from "@/hooks/use-vendors"
import { VendorsView } from "./vendors-view"
import { CardPageSkeleton } from "@/components/ui/page-skeleton"
import { InlinePendingBar } from "@/components/ui/inline-pending"

export default function VendorsPage() {
    const { data, isFetching } = useVendorsList()

    if (!data) {
        return <CardPageSkeleton accentColor="bg-orange-400" />
    }

    return (
        <div className="relative">
            <InlinePendingBar active={isFetching} />
            <VendorsView initialVendors={data} />
        </div>
    )
}
