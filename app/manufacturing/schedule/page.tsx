"use client"

import { useMfgSchedule } from "@/hooks/use-mfg-schedule"
import { SchedulePageClient } from "./schedule-page-client"
import { TablePageSkeleton } from "@/components/ui/page-skeleton"

export default function ManufacturingSchedulePage() {
    const { data, isLoading } = useMfgSchedule()

    if (isLoading || !data) return <TablePageSkeleton accentColor="bg-cyan-400" />

    return (
        <SchedulePageClient
            workOrders={data.workOrders}
            machines={data.machines}
            routings={data.routings}
        />
    )
}
