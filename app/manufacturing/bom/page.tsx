"use client"

import { useProductionBOMs } from "@/hooks/use-production-bom"
import { BOMListClient } from "./bom-client"
import { TablePageSkeleton } from "@/components/ui/page-skeleton"

export const dynamic = "force-dynamic"

export default function BOMPage() {
    const { data, isLoading } = useProductionBOMs()

    if (isLoading) {
        return <TablePageSkeleton accentColor="bg-orange-400" />
    }

    return <BOMListClient boms={data ?? []} />
}
