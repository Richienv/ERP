import { NextResponse } from "next/server"
import {
    getDashboardFinancials,
    getDashboardOperations,
    getDashboardActivity,
    getDashboardCharts,
} from "@/app/actions/dashboard"
import { getSalesStats } from "@/lib/actions/sales"

export const dynamic = "force-dynamic"

const FALLBACK_FINANCIALS = {
    cashBalance: 0, revenue: 0, netMargin: 0, burnRate: 0,
    receivables: 0, payables: 0, overdueInvoices: [] as any[], upcomingPayables: [] as any[],
    recentInvoices: [] as any[], netCashIn: 0,
}
const FALLBACK_OPERATIONS = {
    procurement: { activeCount: 0, delays: [], pendingApproval: [], totalPRs: 0, pendingPRs: 0, totalPOs: 0, totalPOValue: 0, totalPRValue: 0, poByStatus: {} },
    prodMetrics: { activeWorkOrders: 0, totalProduction: 0, efficiency: 0 },
    materialStatus: [],
    qualityStatus: { passRate: -1, totalInspections: 0, recentInspections: [] },
    workforceStatus: { attendanceRate: 0, presentCount: 0, lateCount: 0, totalStaff: 0, topEmployees: [] },
    leaves: 0,
    inventoryValue: { value: 0, itemCount: 0, warehouses: [] },
    hr: { totalSalary: 0, lateEmployees: [] },
    tax: { ppnOut: 0, ppnIn: 0, ppnNet: 0 },
    inventorySummary: { productCount: 0, warehouseCount: 0 },
    salesFulfillment: { totalOrders: 0, deliveredOrders: 0, fulfillmentRate: 0 },
    cashFlow: { kasMasuk: 0, kasKeluar: 0, netCashFlow: 0, topExpenses: [] as { name: string; amount: number }[] },
    profitability: { grossProfit: 0, revenue: 0, marginPct: 0, marginTrend: 0, topProducts: [] as { name: string; revenue: number; marginPct: number }[] },
    customerInsights: { totalActive: 0, newThisMonth: 0, top3Customers: [] as { name: string; total: number }[], repeatRate: 0 },
    compliance: { draftInvoices: 0, draftJournals: 0, overdueAP: 0, missingTax: 0, status: 'green' as const, totalIssues: 0 },
}
const FALLBACK_SALES = { totalRevenue: 0, totalOrders: 0, activeOrders: 0, recentOrders: [] }
const FALLBACK_CHARTS = { dataCash7d: [], dataReceivables: [], dataPayables: [], dataProfit: [] }
const FALLBACK_ACTIVITY = { activityFeed: [], executiveAlerts: [] }

function withTimeout<T>(promise: Promise<T>, ms: number, fallback: T): Promise<T> {
    return Promise.race([
        promise,
        new Promise<T>((resolve) => setTimeout(() => resolve(fallback), ms))
    ])
}

export async function GET() {
    try {
        const [financials, operations, activity, charts, sales] = await Promise.all([
            withTimeout(getDashboardFinancials().catch(() => FALLBACK_FINANCIALS), 5000, FALLBACK_FINANCIALS),
            withTimeout(getDashboardOperations().catch(() => FALLBACK_OPERATIONS), 5000, FALLBACK_OPERATIONS),
            withTimeout(getDashboardActivity().catch(() => FALLBACK_ACTIVITY), 5000, FALLBACK_ACTIVITY),
            withTimeout(getDashboardCharts().catch(() => FALLBACK_CHARTS), 5000, FALLBACK_CHARTS),
            withTimeout(getSalesStats().catch(() => FALLBACK_SALES), 5000, FALLBACK_SALES),
        ])

        return NextResponse.json({
            financials,
            operations,
            activity,
            charts,
            sales,
            hr: (operations as any)?.hr ?? { totalSalary: 0, lateEmployees: [] },
            tax: (operations as any)?.tax ?? { ppnOut: 0, ppnIn: 0, ppnNet: 0 },
        })
    } catch (error) {
        console.error("Dashboard API error:", error)
        return NextResponse.json({
            financials: FALLBACK_FINANCIALS,
            operations: FALLBACK_OPERATIONS,
            activity: FALLBACK_ACTIVITY,
            charts: FALLBACK_CHARTS,
            sales: FALLBACK_SALES,
            hr: { totalSalary: 0, lateEmployees: [] },
            tax: { ppnOut: 0, ppnIn: 0, ppnNet: 0 },
        })
    }
}
