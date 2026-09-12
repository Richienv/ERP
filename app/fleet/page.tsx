import { getVehicles, getVehicleStats } from "@/lib/actions/vehicles"
import { FleetClient } from "./fleet-client"

export const dynamic = "force-dynamic"

/**
 * No route-level skeleton. Soft nav keeps the previous screen visible while
 * this RSC resolves; the top orange bar is the wait indicator.
 */
export default async function FleetPage() {
    const [vehicles, stats] = await Promise.all([
        getVehicles(),
        getVehicleStats(),
    ])
    return <FleetClient initialVehicles={vehicles} initialStats={stats} />
}
