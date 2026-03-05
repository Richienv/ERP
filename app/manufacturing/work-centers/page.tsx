"use client"

import { useProcessStations } from "@/hooks/use-process-stations"
import { useWorkCenterGroups } from "@/hooks/use-work-center-groups"
import { TablePageSkeleton } from "@/components/ui/page-skeleton"
import { StasiunClient } from "./stasiun-client"

export default function StasiunPage() {
    const { data: stations, isLoading: loadingStations } = useProcessStations({ includeInactive: true })
    const { data: groups, isLoading: loadingGroups } = useWorkCenterGroups()

    if (loadingStations || loadingGroups) {
        return <TablePageSkeleton accentColor="bg-teal-400" />
    }

    return <StasiunClient stations={stations || []} groups={groups || []} />
}
