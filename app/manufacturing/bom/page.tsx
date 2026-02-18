"use client"

import { useBOM } from "@/hooks/use-bom"
import { BOMClient } from "./bom-client"
import { TablePageSkeleton } from "@/components/ui/page-skeleton"

export default function BOMPage() {
    const { data, isLoading } = useBOM()

    if (isLoading) {
        return <TablePageSkeleton accentColor="bg-orange-400" />
    }

    return <BOMClient initialBoms={data ?? []} />
}
