import { Suspense } from "react"
import { DashboardView } from "@/components/dashboard/dashboard-view"
import { MetricsWrapper } from "@/components/dashboard/metrics-wrapper"
import { OperationsWrapper } from "@/components/dashboard/operations-wrapper"
import { getDashboardData, getLatestSnapshot } from "@/app/actions/dashboard"
import { getSalesStats } from "@/lib/actions/sales"

// Force dynamic rendering so data is always fresh
export const dynamic = 'force-dynamic'
export const revalidate = 0

// Skeleton components for Suspense fallbacks
function PulseBarSkeleton() {
    return (
        <div className="bg-black border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] h-[100px] animate-pulse">
            <div className="grid grid-cols-5 h-full">
                {[...Array(5)].map((_, i) => (
                    <div key={i} className={`p-5 ${i < 4 ? "border-r-2 border-white/10" : ""}`}>
                        <div className="h-3 w-12 bg-white/10 rounded mb-3" />
                        <div className="h-7 w-24 bg-white/10 rounded mb-2" />
                        <div className="h-2 w-16 bg-white/10 rounded" />
                    </div>
                ))}
            </div>
        </div>
    )
}

function CardSkeleton() {
    return (
        <div className="h-full bg-white dark:bg-zinc-900 border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] animate-pulse">
            <div className="h-12 bg-zinc-100 dark:bg-zinc-800 border-b-2 border-black" />
            <div className="p-4 space-y-3">
                <div className="h-4 w-3/4 bg-zinc-100 dark:bg-zinc-800 rounded" />
                <div className="h-4 w-1/2 bg-zinc-100 dark:bg-zinc-800 rounded" />
                <div className="h-20 bg-zinc-100 dark:bg-zinc-800 rounded" />
            </div>
        </div>
    )
}

function StripSkeleton() {
    return (
        <div className="bg-white dark:bg-zinc-900 border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] animate-pulse">
            <div className="grid grid-cols-5 h-[100px]">
                {[...Array(5)].map((_, i) => (
                    <div key={i} className={`p-4 ${i < 4 ? "border-r-2 border-black" : ""}`}>
                        <div className="h-3 w-16 bg-zinc-100 dark:bg-zinc-800 rounded mb-3" />
                        <div className="h-6 w-12 bg-zinc-100 dark:bg-zinc-800 rounded mb-2" />
                        <div className="h-2 w-14 bg-zinc-100 dark:bg-zinc-800 rounded" />
                    </div>
                ))}
            </div>
        </div>
    )
}

function FeedSkeleton() {
    return (
        <div className="h-full bg-white dark:bg-zinc-900 border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] animate-pulse">
            <div className="h-10 bg-zinc-50 dark:bg-zinc-800 border-b-2 border-black" />
            <div className="p-3 space-y-3">
                {[...Array(4)].map((_, i) => (
                    <div key={i} className="flex gap-3">
                        <div className="h-4 w-4 bg-zinc-100 dark:bg-zinc-800 rounded" />
                        <div className="flex-1 space-y-1">
                            <div className="h-3 w-3/4 bg-zinc-100 dark:bg-zinc-800 rounded" />
                            <div className="h-2 w-1/2 bg-zinc-100 dark:bg-zinc-800 rounded" />
                        </div>
                    </div>
                ))}
            </div>
        </div>
    )
}

// Helper: race a promise against a timeout
function withTimeout<T>(promise: Promise<T>, ms: number, fallback: T): Promise<T> {
    return Promise.race([
        promise,
        new Promise<T>((resolve) => setTimeout(() => resolve(fallback), ms))
    ])
}

const FALLBACK_DASHBOARD = {
    financialChart: { dataCash7d: [], dataReceivables: [], dataPayables: [], dataProfit: [] },
    deadStock: 0,
    procurement: { activeCount: 0, delays: [], pendingApproval: [] },
    hr: { totalSalary: 0, lateEmployees: [] },
    leaves: 0,
    audit: null,
    prodMetrics: { activeWorkOrders: 0, totalProduction: 0, efficiency: 0 },
    prodStatus: [],
    materialStatus: [],
    qualityStatus: { passRate: -1, totalInspections: 0, recentInspections: [] },
    workforceStatus: { attendanceRate: 0, presentCount: 0, lateCount: 0, totalStaff: 0, topEmployees: [] },
    activityFeed: [],
    executiveAlerts: [],
    inventoryValue: { value: 0, itemCount: 0 }
}

export default async function DashboardPage() {
    // Fetch all data in parallel with 10s page-level timeout
    // Each call also has its own catch so any single failure doesn't block others
    const [dashboardData, salesStats, snapshot] = await Promise.all([
        withTimeout(getDashboardData().catch(() => FALLBACK_DASHBOARD), 10000, FALLBACK_DASHBOARD),
        withTimeout(getSalesStats().catch(() => ({ totalRevenue: 0, totalOrders: 0, activeOrders: 0, recentOrders: [] })), 10000, { totalRevenue: 0, totalOrders: 0, activeOrders: 0, recentOrders: [] as any[] }),
        withTimeout(getLatestSnapshot().catch(() => null), 10000, null)
    ])

    const sharedMetricsProps = { data: dashboardData, salesStats, snapshot }
    const sharedOpsProps = { data: dashboardData, salesStats }

    return (
        <DashboardView
            pulseBarSlot={
                <Suspense fallback={<PulseBarSkeleton />}>
                    <MetricsWrapper {...sharedMetricsProps} slot="pulseBar" />
                </Suspense>
            }
            actionCenterSlot={
                <Suspense fallback={<CardSkeleton />}>
                    <MetricsWrapper {...sharedMetricsProps} slot="actionCenter" />
                </Suspense>
            }
            financialHealthSlot={
                <Suspense fallback={<CardSkeleton />}>
                    <MetricsWrapper {...sharedMetricsProps} slot="financialHealth" />
                </Suspense>
            }
            aiSearchSlot={
                <Suspense fallback={<CardSkeleton />}>
                    <MetricsWrapper {...sharedMetricsProps} slot="aiSearch" />
                </Suspense>
            }
            operationsStripSlot={
                <Suspense fallback={<StripSkeleton />}>
                    <OperationsWrapper {...sharedOpsProps} slot="operationsStrip" />
                </Suspense>
            }
            activityFeedSlot={
                <Suspense fallback={<FeedSkeleton />}>
                    <OperationsWrapper {...sharedOpsProps} slot="activityFeed" />
                </Suspense>
            }
            trendingSlot={
                <Suspense fallback={<FeedSkeleton />}>
                    <OperationsWrapper {...sharedOpsProps} slot="trending" />
                </Suspense>
            }
        />
    )
}
