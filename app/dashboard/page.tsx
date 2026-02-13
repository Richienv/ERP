import { Suspense, cache } from "react"
import { DashboardView } from "@/components/dashboard/dashboard-view"
import { CompanyPulseBar } from "@/components/dashboard/company-pulse-bar"
import { CeoActionCenter } from "@/components/dashboard/ceo-action-center"
import { FinancialHealthCard } from "@/components/dashboard/financial-health-card"
import { AiSearchCard } from "@/components/dashboard/ai-search-card"
import { OperationsStrip } from "@/components/dashboard/operations-strip"
import { CompactActivityFeed } from "@/components/dashboard/compact-activity-feed"
import { TrendingWidget } from "@/components/dashboard/trending-widget"
import {
    getDashboardFinancials,
    getDashboardOperations,
    getDashboardActivity,
    getDashboardCharts,
} from "@/app/actions/dashboard"
import { getSalesStats } from "@/lib/actions/sales"

// Force dynamic rendering so data is always fresh
export const dynamic = 'force-dynamic'
export const revalidate = 0

// =============================================================================
// Timeout helper — ensures no data fetch can hang forever
// =============================================================================

function withTimeout<T>(promise: Promise<T>, ms: number, fallback: T): Promise<T> {
    return Promise.race([
        promise,
        new Promise<T>((resolve) => setTimeout(() => {
            console.warn(`[Dashboard] Data fetch timed out after ${ms}ms, using fallback`)
            resolve(fallback)
        }, ms))
    ])
}

// Fallback data shapes
const FALLBACK_FINANCIALS = {
    cashBalance: 0, revenue: 0, netMargin: 0, burnRate: 0,
    receivables: 0, payables: 0, overdueInvoices: [] as any[], upcomingPayables: [] as any[],
}
const FALLBACK_OPERATIONS = {
    procurement: { activeCount: 0, delays: [], pendingApproval: [], totalPRs: 0, pendingPRs: 0, totalPOs: 0, totalPOValue: 0, poByStatus: {} },
    prodMetrics: { activeWorkOrders: 0, totalProduction: 0, efficiency: 0 },
    materialStatus: [] as any[],
    qualityStatus: { passRate: -1, totalInspections: 0, recentInspections: [] },
    workforceStatus: { attendanceRate: 0, presentCount: 0, lateCount: 0, totalStaff: 0, topEmployees: [] },
    leaves: 0,
    inventoryValue: { value: 0, itemCount: 0, warehouses: [] },
}
const FALLBACK_SALES = { totalRevenue: 0, totalOrders: 0, activeOrders: 0, recentOrders: [] as any[] }
const FALLBACK_CHARTS = { dataCash7d: [] as any[], dataReceivables: [] as any[], dataPayables: [] as any[], dataProfit: [] as any[] }
const FALLBACK_ACTIVITY = { activityFeed: [] as any[], executiveAlerts: [] as any[] }

// React.cache() deduplicates calls within a single render request.
// Each cached function also has a 8s timeout so it never hangs.
const cachedFinancials = cache(() =>
    withTimeout(getDashboardFinancials().catch((e) => { console.error("Financials error:", e); return FALLBACK_FINANCIALS }), 8000, FALLBACK_FINANCIALS)
)
const cachedOperations = cache(() =>
    withTimeout(getDashboardOperations().catch((e) => { console.error("Operations error:", e); return FALLBACK_OPERATIONS }), 8000, FALLBACK_OPERATIONS)
)
const cachedSalesStats = cache(() =>
    withTimeout(getSalesStats().catch((e) => { console.error("Sales error:", e); return FALLBACK_SALES }), 8000, FALLBACK_SALES)
)

// =============================================================================
// Skeleton components for Suspense fallbacks
// =============================================================================

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

// =============================================================================
// Async Server Components — each fetches its own data (true React streaming)
// =============================================================================

/** PulseBar: Financial KPIs + inventory value */
async function PulseBarSection() {
    const [financials, sales, ops] = await Promise.all([
        cachedFinancials(),
        cachedSalesStats(),
        cachedOperations(),
    ])

    return (
        <CompanyPulseBar
            cashBalance={financials.cashBalance}
            revenueMTD={sales.totalRevenue}
            netMargin={financials.netMargin}
            inventoryValue={ops.inventoryValue?.value ?? 0}
            inventoryItems={ops.inventoryValue?.itemCount ?? 0}
            burnRate={financials.burnRate}
        />
    )
}

/** ActionCenter: Procurement approvals + alerts — Prisma Group B */
async function ActionCenterSection() {
    const ops = await cachedOperations()

    return (
        <CeoActionCenter
            pendingApproval={ops.procurement?.pendingApproval ?? ops.procurement?.delays ?? []}
            activeCount={ops.procurement?.activeCount ?? 0}
            alerts={[]}
            pendingLeaves={ops.leaves ?? 0}
            totalPRs={ops.procurement?.totalPRs ?? 0}
            pendingPRs={ops.procurement?.pendingPRs ?? 0}
            totalPOs={ops.procurement?.totalPOs ?? 0}
            totalPOValue={ops.procurement?.totalPOValue ?? 0}
            poByStatus={ops.procurement?.poByStatus ?? {}}
        />
    )
}

/** FinancialHealth: Cash flow chart + AR/AP — Supabase + Prisma charts */
async function FinancialHealthSection() {
    const [financials, charts] = await Promise.all([
        cachedFinancials(),
        withTimeout(getDashboardCharts().catch(() => FALLBACK_CHARTS), 8000, FALLBACK_CHARTS),
    ])

    const cashFlowData = (charts?.dataCash7d ?? []).map((d: any) => ({
        date: d.name ?? d.date ?? d.day ?? "",
        balance: Number(d.val ?? d.balance ?? d.value ?? 0)
    }))

    return (
        <FinancialHealthCard
            cashFlowData={cashFlowData}
            accountsReceivable={financials.receivables}
            accountsPayable={financials.payables}
            overdueInvoices={financials.overdueInvoices}
            upcomingPayables={financials.upcomingPayables}
        />
    )
}

/** OperationsStrip: Production/Inventory/Sales/HR/Quality tiles — Prisma Group B */
async function OperationsStripSection() {
    const [ops, sales] = await Promise.all([
        cachedOperations(),
        cachedSalesStats(),
    ])

    return (
        <OperationsStrip
            activeWorkOrders={ops.prodMetrics?.activeWorkOrders ?? 0}
            lowStockCount={Array.isArray(ops.materialStatus) ? ops.materialStatus.length : 0}
            salesRevenueMTD={sales.totalRevenue}
            attendanceRate={ops.workforceStatus?.attendanceRate ?? 0}
            totalStaff={ops.workforceStatus?.totalStaff ?? 0}
            qualityPassRate={ops.qualityStatus?.passRate ?? 0}
        />
    )
}

/** ActivityFeed: Recent events — Prisma Group C (lightweight) */
async function ActivityFeedSection() {
    const activity = await withTimeout(
        getDashboardActivity().catch(() => FALLBACK_ACTIVITY),
        8000,
        FALLBACK_ACTIVITY
    )

    const activities = (activity.activityFeed ?? []).map((a: any, i: number) => ({
        id: a.id ?? `activity-${i}`,
        type: a.type ?? "general",
        title: a.title ?? a.message ?? "",
        description: a.description ?? a.message ?? "",
        timestamp: a.timestamp ?? a.time ?? a.createdAt ?? new Date().toISOString(),
    }))

    return <CompactActivityFeed activities={activities} />
}

/** TrendingWidget: Summary counts — uses cached operations + sales */
async function TrendingSection() {
    const [ops, sales] = await Promise.all([
        cachedOperations(),
        cachedSalesStats(),
    ])

    return (
        <TrendingWidget
            activePOs={ops.procurement?.activeCount ?? 0}
            lowStockAlerts={Array.isArray(ops.materialStatus) ? ops.materialStatus.length : 0}
            pendingLeaves={ops.leaves ?? 0}
            activeOrders={sales.activeOrders}
            totalPRs={ops.procurement?.totalPRs ?? 0}
            pendingPRs={ops.procurement?.pendingPRs ?? 0}
        />
    )
}

// =============================================================================
// Main page — renders the shell instantly, streams each section independently
// =============================================================================

export default function DashboardPage() {
    return (
        <DashboardView
            pulseBarSlot={
                <Suspense fallback={<PulseBarSkeleton />}>
                    <PulseBarSection />
                </Suspense>
            }
            actionCenterSlot={
                <Suspense fallback={<CardSkeleton />}>
                    <ActionCenterSection />
                </Suspense>
            }
            financialHealthSlot={
                <Suspense fallback={<CardSkeleton />}>
                    <FinancialHealthSection />
                </Suspense>
            }
            aiSearchSlot={<AiSearchCard />}
            operationsStripSlot={
                <Suspense fallback={<StripSkeleton />}>
                    <OperationsStripSection />
                </Suspense>
            }
            activityFeedSlot={
                <Suspense fallback={<FeedSkeleton />}>
                    <ActivityFeedSection />
                </Suspense>
            }
            trendingSlot={
                <Suspense fallback={<FeedSkeleton />}>
                    <TrendingSection />
                </Suspense>
            }
        />
    )
}
