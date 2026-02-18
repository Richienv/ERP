"use client"

import { useVendorsList } from "@/hooks/use-vendors"
import { VendorsView } from "./vendors-view"
import { CardPageSkeleton } from "@/components/ui/page-skeleton"

export default function VendorsPage() {
    const { data, isLoading } = useVendorsList()

    if (isLoading || !data) {
        return <CardPageSkeleton accentColor="bg-indigo-400" />
    }

    return <VendorsView initialVendors={data} />
}
