import { Suspense } from "react"
import { DashboardView } from "@/components/dashboard/dashboard-view"
import { MetricsWrapper } from "@/components/dashboard/metrics-wrapper"
import { FinanceGridSkeleton, KPIGridSkeleton, OperationsSkeleton } from "@/components/dashboard/skeletons"
import { OperationsWrapper } from "@/components/dashboard/operations-wrapper"
import { getDashboardData, getLatestSnapshot } from "@/app/actions/dashboard"
import { getSalesStats } from "@/lib/actions/sales"

// Force dynamic rendering so data is always fresh
export const dynamic = 'force-dynamic'
export const revalidate = 0

export default async function DashboardPage() {
    // Fetch critical data in parallel (only 2 distinct transactions now instead of 10+)
    // getDashboardData aggregates all the internal dashboard/manufacturing/hr queries
    // getSalesStats is distinct (for now)
    const [dashboardData, salesStats, snapshot] = await Promise.all([
        getDashboardData(),
        getSalesStats().catch(() => ({ totalRevenue: 0, totalOrders: 0, activeOrders: 0, recentOrders: [] })),
        getLatestSnapshot().catch(() => null)
    ])

    return (
        <DashboardView
            metricsSlot={
                <Suspense fallback={
                    <div className="md:col-span-6 space-y-6">
                        <FinanceGridSkeleton />
                        <KPIGridSkeleton />
                    </div>
                }>
                    <MetricsWrapper
                        data={dashboardData}
                        salesStats={salesStats}
                        snapshot={snapshot}
                    />
                </Suspense>
            }
            operationsSlot={
                <Suspense fallback={<OperationsSkeleton />}>
                    <OperationsWrapper data={dashboardData} />
                </Suspense>
            }
        />
    )
}
