"use client"

import { usePriceLists } from "@/hooks/use-price-lists"
import { TablePageSkeleton } from "@/components/ui/page-skeleton"
import { PriceListsClient } from "./client-view"

export default function PriceListsPage() {
    const { data, isLoading } = usePriceLists()

    if (isLoading || !data) return <TablePageSkeleton accentColor="bg-blue-400" />

    return <PriceListsClient initialPriceLists={data.initialPriceLists} />
}
