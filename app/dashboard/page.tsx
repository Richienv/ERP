import { dehydrate, HydrationBoundary, QueryClient } from "@tanstack/react-query"
import { queryKeys } from "@/lib/query-keys"
import {
    getDashboardFinancials,
    getDashboardOperations,
    getDashboardActivity,
    getDashboardCharts,
} from "@/app/actions/dashboard"
import { getSalesStats } from "@/lib/actions/sales"
import { DashboardPageClient } from "./dashboard-client"

export const dynamic = "force-dynamic"

const FALLBACK_FINANCIALS = {
    cashBalance: 0, revenue: 0, netMargin: 0, burnRate: 0,
    receivables: 0, payables: 0, overdueInvoices: [], upcomingPayables: [],
    recentInvoices: [], netCashIn: 0,
}
const FALLBACK_OPERATIONS = {
    procurement: { activeCount: 0, delays: [], pendingApproval: [], totalPRs: 0, pendingPRs: 0, totalPOs: 0, totalPOValue: 0, totalPRValue: 0, poByStatus: {} },
    prodMetrics: { activeWorkOrders: 0, totalProduction: 0, efficiency: 0 },
    materialStatus: [], qualityStatus: { passRate: -1, totalInspections: 0, recentInspections: [] },
    workforceStatus: { attendanceRate: 0, presentCount: 0, lateCount: 0, totalStaff: 0, topEmployees: [] },
    leaves: 0, inventoryValue: { value: 0, itemCount: 0, warehouses: [] },
    hr: { totalSalary: 0, lateEmployees: [] }, tax: { ppnOut: 0, ppnIn: 0, ppnNet: 0 },
    inventorySummary: { productCount: 0, warehouseCount: 0 },
    salesFulfillment: { totalOrders: 0, deliveredOrders: 0, fulfillmentRate: 0 },
    cashFlow: { kasMasuk: 0, kasKeluar: 0, netCashFlow: 0, topExpenses: [] },
    profitability: { grossProfit: 0, revenue: 0, marginPct: 0, marginTrend: 0, topProducts: [] },
    customerInsights: { totalActive: 0, newThisMonth: 0, top3Customers: [], repeatRate: 0 },
    compliance: { draftInvoices: 0, draftJournals: 0, overdueAP: 0, missingTax: 0, status: "green" as const, totalIssues: 0 },
}
const FALLBACK_SALES = { totalRevenue: 0, totalOrders: 0, activeOrders: 0, recentOrders: [] }
const FALLBACK_CHARTS = { dataCash7d: [], dataReceivables: [], dataPayables: [], dataProfit: [] }
const FALLBACK_ACTIVITY = { activityFeed: [], executiveAlerts: [] }

export default async function DashboardPage() {
    const queryClient = new QueryClient()

    // Call server actions DIRECTLY (not via HTTP fetch) — same process, no round-trip
    await queryClient.prefetchQuery({
        queryKey: queryKeys.executiveDashboard.list(),
        queryFn: async () => {
            const [financials, operations, activity, charts, sales] = await Promise.all([
                getDashboardFinancials().catch(() => FALLBACK_FINANCIALS),
                getDashboardOperations().catch(() => FALLBACK_OPERATIONS),
                getDashboardActivity().catch(() => FALLBACK_ACTIVITY),
                getDashboardCharts().catch(() => FALLBACK_CHARTS),
                getSalesStats().catch(() => FALLBACK_SALES),
            ])

            return {
                financials,
                operations,
                activity,
                charts,
                sales,
                manufacturing: null,
                hr: (operations as any)?.hr ?? { totalSalary: 0, lateEmployees: [] },
                tax: (operations as any)?.tax ?? { ppnOut: 0, ppnIn: 0, ppnNet: 0 },
            }
        },
    })

    return (
        <HydrationBoundary state={dehydrate(queryClient)}>
            <DashboardPageClient />
        </HydrationBoundary>
    )
}
