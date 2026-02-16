import { Suspense } from "react"
import { ManufacturingDashboardClient } from "./manufacturing-dashboard-client"
import { Factory } from "lucide-react"

export const dynamic = "force-dynamic"

async function DashboardContent() {
    const emptyData = {
        productionHealth: { oee: 0, availability: 0, performance: 0, quality: 0 },
        workOrders: { total: 0, inProgress: 0, completedThisMonth: 0, productionThisMonth: 0, plannedThisMonth: 0 },
        machines: { total: 0, running: 0, idle: 0, maintenance: 0, breakdown: 0, avgHealth: 0, totalCapacity: 0 },
        quality: { passRate: 0, totalInspections: 0, passCount: 0, failCount: 0, recentInspections: [] },
        recentOrders: [],
        alerts: [],
    }

    try {
        const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3002"
        const res = await fetch(`${baseUrl}/api/manufacturing/dashboard`, { cache: "no-store" })
        if (!res.ok) return <ManufacturingDashboardClient initialData={emptyData} />
        const result = await res.json()
        const data = result.success ? result.data : emptyData
        return <ManufacturingDashboardClient initialData={data} />
    } catch {
        return <ManufacturingDashboardClient initialData={emptyData} />
    }
}

export default function ManufacturingDashboardPage() {
    return (
        <div className="min-h-screen bg-background pb-24">
            <Suspense
                fallback={
                    <div className="flex items-center gap-2 text-zinc-400 pt-8">
                        <Factory className="h-5 w-5 animate-pulse" />
                        <span className="text-[10px] font-black uppercase tracking-widest">
                            Memuat dashboard manufaktur...
                        </span>
                    </div>
                }
            >
                <DashboardContent />
            </Suspense>
        </div>
    )
}
