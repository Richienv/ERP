import { Suspense } from "react"
import { getVehicles, getVehicleStats } from "@/lib/actions/vehicles"
import { FleetClient } from "./fleet-client"
import { TablePageSkeleton } from "@/components/ui/page-skeleton"

export const dynamic = "force-dynamic"

export default async function FleetPage() {
    return (
        <Suspense fallback={<TablePageSkeleton accentColor="bg-amber-500" />}>
            <FleetPageInner />
        </Suspense>
    )
}

async function FleetPageInner() {
    const [vehicles, stats] = await Promise.all([
        getVehicles(),
        getVehicleStats(),
    ])
    return <FleetClient initialVehicles={vehicles} initialStats={stats} />
}
