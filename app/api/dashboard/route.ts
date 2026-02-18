import { NextResponse } from "next/server"
import {
    getDashboardFinancials,
    getDashboardOperations,
    getDashboardActivity,
    getDashboardCharts,
} from "@/app/actions/dashboard"
import { getSalesStats } from "@/lib/actions/sales"
import { getOEEMetrics, getRecentShiftNotes, getRecentDowntimeLogs } from "@/lib/actions/dashboard-textile"

export const dynamic = "force-dynamic"

const FALLBACK_FINANCIALS = {
    cashBalance: 0, revenue: 0, netMargin: 0, burnRate: 0,
    receivables: 0, payables: 0, overdueInvoices: [] as any[], upcomingPayables: [] as any[],
    recentInvoices: [] as any[], netCashIn: 0,
}
const FALLBACK_OPERATIONS = {
    procurement: { activeCount: 0, delays: [], pendingApproval: [], totalPRs: 0, pendingPRs: 0, totalPOs: 0, totalPOValue: 0, poByStatus: {} },
    prodMetrics: { activeWorkOrders: 0, totalProduction: 0, efficiency: 0 },
    materialStatus: [],
    qualityStatus: { passRate: -1, totalInspections: 0, recentInspections: [] },
    workforceStatus: { attendanceRate: 0, presentCount: 0, lateCount: 0, totalStaff: 0, topEmployees: [] },
    leaves: 0,
    inventoryValue: { value: 0, itemCount: 0, warehouses: [] },
}
const FALLBACK_SALES = { totalRevenue: 0, totalOrders: 0, activeOrders: 0, recentOrders: [] }
const FALLBACK_CHARTS = { dataCash7d: [], dataReceivables: [], dataPayables: [], dataProfit: [] }
const FALLBACK_ACTIVITY = { activityFeed: [], executiveAlerts: [] }
const FALLBACK_OEE = { oee: 0, availability: 0, performance: 0, quality: 0, totalScheduledMinutes: 0, totalDowntimeMinutes: 0, totalProduced: 0, totalDefects: 0 }

function withTimeout<T>(promise: Promise<T>, ms: number, fallback: T): Promise<T> {
    return Promise.race([
        promise,
        new Promise<T>((resolve) => setTimeout(() => resolve(fallback), ms))
    ])
}

export async function GET() {
    try {
        const [financials, operations, activity, charts, sales, oee, shiftNotes, downtimeLogs] = await Promise.all([
            withTimeout(getDashboardFinancials().catch(() => FALLBACK_FINANCIALS), 8000, FALLBACK_FINANCIALS),
            withTimeout(getDashboardOperations().catch(() => FALLBACK_OPERATIONS), 8000, FALLBACK_OPERATIONS),
            withTimeout(getDashboardActivity().catch(() => FALLBACK_ACTIVITY), 8000, FALLBACK_ACTIVITY),
            withTimeout(getDashboardCharts().catch(() => FALLBACK_CHARTS), 8000, FALLBACK_CHARTS),
            withTimeout(getSalesStats().catch(() => FALLBACK_SALES), 8000, FALLBACK_SALES),
            withTimeout(getOEEMetrics().catch(() => FALLBACK_OEE), 8000, FALLBACK_OEE),
            withTimeout(getRecentShiftNotes(5).catch(() => []), 8000, []),
            withTimeout(getRecentDowntimeLogs(8).catch(() => []), 8000, []),
        ])

        return NextResponse.json({
            financials,
            operations,
            activity,
            charts,
            sales,
            oee,
            shiftNotes,
            downtimeLogs,
        })
    } catch (error) {
        console.error("Dashboard API error:", error)
        return NextResponse.json({
            financials: FALLBACK_FINANCIALS,
            operations: FALLBACK_OPERATIONS,
            activity: FALLBACK_ACTIVITY,
            charts: FALLBACK_CHARTS,
            sales: FALLBACK_SALES,
            oee: FALLBACK_OEE,
            shiftNotes: [],
            downtimeLogs: [],
        })
    }
}
