import { Suspense } from "react"
import { Skeleton } from "@/components/ui/skeleton"
import { getSchedulableWorkOrders, getMachinesForScheduling, getRoutingsForScheduling } from "@/lib/actions/manufacturing-garment"
import { SchedulePageClient } from "./schedule-page-client"

export const dynamic = "force-dynamic"

async function ScheduleData() {
    const [workOrders, machines, routings] = await Promise.all([
        getSchedulableWorkOrders(),
        getMachinesForScheduling(),
        getRoutingsForScheduling(),
    ])

    return (
        <SchedulePageClient
            workOrders={workOrders}
            machines={machines}
            routings={routings}
        />
    )
}

function ScheduleSkeleton() {
    return (
        <div className="space-y-4">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-[400px] w-full" />
        </div>
    )
}

export default function ManufacturingSchedulePage() {
    return (
        <div className="mf-page">
            <div>
                <h2 className="mf-title">Jadwal Produksi</h2>
                <p className="text-muted-foreground">Gantt view jadwal work order produksi.</p>
            </div>

            <Suspense fallback={<ScheduleSkeleton />}>
                <ScheduleData />
            </Suspense>
        </div>
    )
}
