import { Suspense } from "react"
import { DashboardView } from "@/components/dashboard/dashboard-view"
import { MetricsWrapper } from "@/components/dashboard/metrics-wrapper"
import { FinanceGridSkeleton, KPIGridSkeleton, OperationsSkeleton } from "@/components/dashboard/skeletons"
import { OperationsWrapper } from "@/components/dashboard/operations-wrapper"

export const dynamic = 'force-dynamic'

export default async function DashboardPage() {
    return (
        <DashboardView
            metricsSlot={
                <Suspense fallback={
                    <>
                        <FinanceGridSkeleton />
                        <KPIGridSkeleton />
                    </>
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
