import { NextResponse } from "next/server"
import {
    getDashboardFinancials,
    getDashboardOperations,
    getDashboardActivity,
    getDashboardCharts,
} from "@/app/actions/dashboard"
import { getSalesStats } from "@/lib/actions/sales"
import { prisma } from "@/lib/db"

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

function withTimeout<T>(promise: Promise<T>, ms: number, fallback: T, label?: string): Promise<T> {
    return Promise.race([
        promise,
        new Promise<T>((resolve) => setTimeout(() => {
            if (label) console.warn(`[Dashboard API] ${label} timed out after ${ms}ms`)
            resolve(fallback)
        }, ms))
    ])
}

/**
 * Direct DB fallback for cards that depend on journal entries.
 * If getDashboardOperations returns zeros (timeout or no journal data),
 * fetch essential metrics directly from invoices/payments/products.
 */
async function fetchDirectFallbacks() {
    try {
        const now = new Date()
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
        const sevenDaysAgo = new Date(now)
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)

        const [
            // Profitability: revenue from issued/paid invoices this month
            revenueAgg,
            cogsAgg,
            // Customer insights
            activeCustomers,
            newCustomers,
            // Inventory
            stockData,
            productCount,
            warehouseCount,
            // Cash flow: payments in last 7 days
            paymentsIn,
            paymentsOut,
            // Procurement
            totalPOs,
            totalPRs,
            pendingPRs,
            poValueAgg,
        ] = await Promise.all([
            prisma.invoice.aggregate({
                _sum: { totalAmount: true },
                where: { type: "INV_OUT", status: { in: ["ISSUED", "PAID", "PARTIAL"] }, issueDate: { gte: startOfMonth } },
            }),
            prisma.invoice.aggregate({
                _sum: { totalAmount: true },
                where: { type: "INV_IN", status: { in: ["ISSUED", "PAID", "PARTIAL"] }, issueDate: { gte: startOfMonth } },
            }),
            prisma.customer.count({ where: { isActive: true } }),
            prisma.customer.count({ where: { createdAt: { gte: startOfMonth } } }),
            prisma.stockLevel.findMany({
                where: { quantity: { gt: 0 } },
                include: {
                    product: { select: { costPrice: true, sellingPrice: true, isActive: true } },
                    warehouse: { select: { isActive: true } },
                },
            }),
            prisma.product.count({ where: { isActive: true } }),
            prisma.warehouse.count({ where: { isActive: true } }),
            prisma.payment.aggregate({
                _sum: { amount: true },
                where: { date: { gte: sevenDaysAgo }, invoice: { type: "INV_OUT" } },
            }),
            prisma.payment.aggregate({
                _sum: { amount: true },
                where: { date: { gte: sevenDaysAgo }, invoice: { type: "INV_IN" } },
            }),
            prisma.purchaseOrder.count({ where: { status: { notIn: ["CANCELLED"] } } }),
            prisma.purchaseRequest.count(),
            prisma.purchaseRequest.count({ where: { status: "PENDING" } }),
            prisma.purchaseOrder.aggregate({
                _sum: { totalAmount: true },
                _count: true,
                where: { status: { notIn: ["CANCELLED"] } },
            }),
        ])

        // Calculate inventory value
        let invValue = 0
        let invItemCount = 0
        for (const sl of stockData) {
            if (!sl.product.isActive || !sl.warehouse.isActive) continue
            const cp = Number(sl.product.costPrice)
            const sp = Number(sl.product.sellingPrice)
            const price = cp > 0 ? cp : sp
            invValue += sl.quantity * price
            invItemCount += sl.quantity
        }

        const revenue = Number(revenueAgg._sum?.totalAmount ?? 0)
        const cogs = Number(cogsAgg._sum?.totalAmount ?? 0)
        const kasMasuk = Number(paymentsIn._sum?.amount ?? 0)
        const kasKeluar = Number(paymentsOut._sum?.amount ?? 0)

        return {
            profitability: {
                revenue,
                grossProfit: revenue - cogs,
                marginPct: revenue > 0 ? Math.round(((revenue - cogs) / revenue) * 100) : 0,
                marginTrend: 0,
                topProducts: [],
            },
            customerInsights: {
                totalActive: activeCustomers,
                newThisMonth: newCustomers,
                top3Customers: [],
                repeatRate: 0,
            },
            inventoryValue: {
                value: invValue,
                itemCount: invItemCount,
                warehouses: [],
            },
            inventorySummary: {
                productCount,
                warehouseCount,
            },
            cashFlow: {
                kasMasuk,
                kasKeluar,
                netCashFlow: kasMasuk - kasKeluar,
                topExpenses: [],
            },
            procurement: {
                totalPOs,
                totalPRs,
                pendingPRs,
                totalPOValue: Number(poValueAgg._sum?.totalAmount ?? 0),
                totalPRValue: 0,
                activeCount: poValueAgg._count ?? 0,
                delays: [],
                pendingApproval: [],
                poByStatus: {},
            },
        }
    } catch (error) {
        console.error("[Dashboard API] Direct fallback queries failed:", error)
        return null
    }
}

export async function GET() {
    try {
        const start = Date.now()

        // Start direct fallback in parallel — it's lightweight and serves as insurance
        const fallbackPromise = fetchDirectFallbacks()

        const [financials, operations, activity, charts, sales] = await Promise.all([
            withTimeout(
                getDashboardFinancials().catch((e) => { console.error("[Dashboard] financials error:", e?.message ?? e); return FALLBACK_FINANCIALS }),
                4000, FALLBACK_FINANCIALS, "financials"
            ),
            withTimeout(
                getDashboardOperations().catch((e) => { console.error("[Dashboard] operations error:", e?.message ?? e); return FALLBACK_OPERATIONS }),
                8000, FALLBACK_OPERATIONS, "operations"
            ),
            withTimeout(
                getDashboardActivity().catch((e) => { console.error("[Dashboard] activity error:", e?.message ?? e); return FALLBACK_ACTIVITY }),
                4000, FALLBACK_ACTIVITY, "activity"
            ),
            withTimeout(
                getDashboardCharts().catch((e) => { console.error("[Dashboard] charts error:", e?.message ?? e); return FALLBACK_CHARTS }),
                4000, FALLBACK_CHARTS, "charts"
            ),
            withTimeout(
                getSalesStats().catch((e) => { console.error("[Dashboard] sales error:", e?.message ?? e); return FALLBACK_SALES }),
                4000, FALLBACK_SALES, "sales"
            ),
        ])

        // Enhance operations with direct DB fallback if server action returned zeros
        const ops = { ...operations } as typeof FALLBACK_OPERATIONS
        const fb = await fallbackPromise

        if (fb) {
            // Profitability: use direct invoice data if journal-based query returned 0
            if (ops.profitability.revenue === 0 && fb.profitability.revenue > 0) {
                ops.profitability = fb.profitability
            }
            // Customer insights: use direct count if query returned 0
            if (ops.customerInsights.totalActive === 0 && fb.customerInsights.totalActive > 0) {
                ops.customerInsights = fb.customerInsights
            }
            // Inventory: use direct stock calculation if query returned 0
            if (ops.inventoryValue.value === 0 && fb.inventoryValue.value > 0) {
                ops.inventoryValue = fb.inventoryValue
            }
            if (ops.inventorySummary.productCount === 0 && fb.inventorySummary.productCount > 0) {
                ops.inventorySummary = fb.inventorySummary
            }
            // Cash flow: use direct payment data if journal-based query returned 0
            if (ops.cashFlow.kasMasuk === 0 && ops.cashFlow.kasKeluar === 0 && (fb.cashFlow.kasMasuk > 0 || fb.cashFlow.kasKeluar > 0)) {
                ops.cashFlow = fb.cashFlow
            }
            // Procurement: use direct counts if query returned 0
            if (ops.procurement.totalPOs === 0 && fb.procurement.totalPOs > 0) {
                ops.procurement = { ...ops.procurement, ...fb.procurement }
            }
        }

        if (process.env.NODE_ENV === "development") {
            console.log(`[Dashboard API] Total: ${Date.now() - start}ms`)
        }

        return NextResponse.json({
            financials,
            operations: ops,
            activity,
            charts,
            sales,
            hr: (ops as any)?.hr ?? { totalSalary: 0, lateEmployees: [] },
            tax: (ops as any)?.tax ?? { ppnOut: 0, ppnIn: 0, ppnNet: 0 },
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
