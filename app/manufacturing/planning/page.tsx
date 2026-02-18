"use client"

import { useMfgPlanning } from "@/hooks/use-mfg-planning"
import { PlanningClient } from "./planning-client"
import { CardPageSkeleton } from "@/components/ui/page-skeleton"

const emptyData = { weeklySchedule: [], workOrders: [], machines: [] }
const emptySummary = {
    totalPlanned: 0,
    inProgress: 0,
    totalCapacity: 0,
    avgUtilization: 0,
    materialStatus: { ready: 0, partial: 0, notReady: 0 },
    machineCount: 0,
    activeMachines: 0,
}

export default function PlanningPage() {
    const { data, isLoading } = useMfgPlanning()

    if (isLoading) {
        return <CardPageSkeleton accentColor="bg-amber-400" />
    }

    return (
        <PlanningClient
            initialData={data?.data ?? emptyData}
            initialSummary={data?.summary ?? emptySummary}
        />
    )
}
