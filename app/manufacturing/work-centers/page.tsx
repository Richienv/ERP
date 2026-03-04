"use client"

import { useProcessStations } from "@/hooks/use-process-stations"
import { TablePageSkeleton } from "@/components/ui/page-skeleton"
import { StasiunClient } from "./stasiun-client"

export default function StasiunPage() {
    const { data: stations, isLoading } = useProcessStations({ includeInactive: true })

    if (isLoading) {
        return <TablePageSkeleton accentColor="bg-teal-400" />
    }

    return <StasiunClient stations={stations || []} />
}
