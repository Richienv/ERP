import { Suspense } from "react"
import { DashboardView } from "@/components/dashboard/dashboard-view"
import { MetricsWrapper } from "@/components/dashboard/metrics-wrapper"
import { FinanceGridSkeleton, KPIGridSkeleton, OperationsSkeleton } from "@/components/dashboard/skeletons"
import { OperationsWrapper } from "@/components/dashboard/operations-wrapper"

export default async function DashboardPage() {
    return (
        <DashboardView
            metricsSlot={
                <Suspense fallback={
                    <div className="md:col-span-6 space-y-6">
                        <FinanceGridSkeleton />
                        <KPIGridSkeleton />
                    </div>
                }>
                    <MetricsWrapper />
                </Suspense>
            }
            operationsSlot={
                <Suspense fallback={<OperationsSkeleton />}>
                    <OperationsWrapper />
                </Suspense>
            }
        />
    )
}
