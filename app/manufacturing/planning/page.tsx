import { Suspense } from "react"
import { PlanningClient } from "./planning-client"
import { Calendar } from "lucide-react"

export const dynamic = "force-dynamic"

async function PlanningContent() {
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

    try {
        const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3002"
        const res = await fetch(`${baseUrl}/api/manufacturing/planning?weeks=4`, { cache: "no-store" })
        if (!res.ok) return <PlanningClient initialData={emptyData} initialSummary={emptySummary} />
        const result = await res.json()
        const data = result.success ? result.data : emptyData
        const summary = result.success ? result.summary : emptySummary
        return <PlanningClient initialData={data} initialSummary={summary} />
    } catch {
        return <PlanningClient initialData={emptyData} initialSummary={emptySummary} />
    }
}

export default function PlanningPage() {
    return (
        <div className="min-h-screen bg-background pb-24">
            <Suspense
                fallback={
                    <div className="flex items-center gap-2 text-zinc-400 pt-8">
                        <Calendar className="h-5 w-5 animate-pulse" />
                        <span className="text-[10px] font-black uppercase tracking-widest">
                            Memuat perencanaan produksi...
                        </span>
                    </div>
                }
            >
                <PlanningContent />
            </Suspense>
        </div>
    )
}
