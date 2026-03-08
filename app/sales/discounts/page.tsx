"use client"

import { useDiscounts } from "@/hooks/use-discounts"
import { TablePageSkeleton } from "@/components/ui/page-skeleton"
import { DiscountsClient } from "./client-view"

export default function DiscountsPage() {
    const { data, isLoading } = useDiscounts()

    if (isLoading || !data) return <TablePageSkeleton accentColor="bg-emerald-400" />

    return <DiscountsClient schemes={data.schemes} summary={data.summary} />
}
