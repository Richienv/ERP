"use client"

import { useMachines } from "@/hooks/use-machines"
import { WorkCentersClient } from "./work-centers-client"
import { TablePageSkeleton } from "@/components/ui/page-skeleton"

const emptySummary = { total: 0, active: 0, down: 0, avgEfficiency: 0 }

export default function WorkCentersPage() {
    const { data, isLoading } = useMachines()

    if (isLoading) {
        return <TablePageSkeleton accentColor="bg-teal-400" />
    }

    return (
        <WorkCentersClient
            initialMachines={data?.machines ?? []}
            initialSummary={data?.summary ?? emptySummary}
        />
    )
}
