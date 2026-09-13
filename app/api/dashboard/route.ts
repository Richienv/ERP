import { NextResponse } from "next/server"
import {
    getDashboardFinancials,
    getDashboardOperations,
    getDashboardActivity,
    getDashboardCharts,
} from "@/app/actions/dashboard"
import { getSalesStats } from "@/lib/actions/sales"
import { prisma } from "@/lib/db"
import { jsonFail } from "@/lib/http/api-response"
import { requireApiUser } from "@/lib/http/require-api-user"
import { isModuleEnabled } from "@/lib/sidebar-feature-flags"

export const dynamic = "force-dynamic"

const FALLBACK_OPERATIONS = {
    procurement: { activeCount: 0, delays: [], pendingApproval: [], pendingApprovalCount: 0, totalPRs: 0, pendingPRs: 0, totalPOs: 0, totalPOValue: 0, totalPRValue: 0, poByStatus: {} },
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
function withTimeout<T>(promise: Promise<T>, ms: number, label?: string): Promise<T> {
    return Promise.race([
        promise,
        new Promise<T>((_, reject) => setTimeout(() => {
            reject(new Error(`[Dashboard API] ${label ?? "lane"} timed out after ${ms}ms`))
        }, ms)),
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
            const sp = sl.product.sellingPrice !== null ? Number(sl.product.sellingPrice) : 0
            const price = cp > 0 ? cp : sp
            const slQty = Number(sl.quantity)
            invValue += slQty * price
            invItemCount += slQty
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

/**
 * Fetch detail rows for each dashboard card (recent POs, customers, products, etc.)
 * Always runs — provides clickable previews in each card.
 */
async function fetchCardDetails() {
    try {
        const [recentPOs, recentCustomers, productsRaw, recentPayments, topRevenueSources, activeWorkOrders] = await Promise.all([
            prisma.purchaseOrder.findMany({
                where: { status: { notIn: ["CANCELLED"] } },
                select: {
                    id: true, number: true, status: true,
                    totalAmount: true, orderDate: true,
                    supplier: { select: { name: true } },
                },
                orderBy: { createdAt: "desc" },
                take: 3,
            }).catch(() => [] as any[]),

            prisma.customer.findMany({
                where: { isActive: true },
                select: {
                    id: true, name: true, createdAt: true,
                    customerType: true,
                    _count: { select: { Invoice: true } },
                },
                orderBy: { createdAt: "desc" },
                take: 3,
            }).catch(() => [] as any[]),

            prisma.product.findMany({
                where: { isActive: true },
                select: {
                    id: true, name: true, code: true, minStock: true,
                    stockLevels: { select: { quantity: true } },
                },
                take: 5,
            }).catch(() => [] as any[]),

            prisma.payment.findMany({
                select: {
                    id: true, amount: true, date: true, method: true,
                    invoice: {
                        select: {
                            type: true, number: true,
                            customer: { select: { name: true } },
                            supplier: { select: { name: true } },
                        },
                    },
                },
                orderBy: { date: "desc" },
                take: 5,
            }).catch(() => [] as any[]),

            prisma.invoice.findMany({
                where: { type: "INV_OUT", status: "PAID" },
                select: {
                    id: true, number: true, totalAmount: true,
                    customer: { select: { name: true } },
                },
                orderBy: { totalAmount: "desc" },
                take: 3,
            }).catch(() => [] as any[]),

            // Work-order previews only render inside the manufacturing card,
            // which is hidden for KRI — skip the join when the module is off.
            isModuleEnabled("manufacturing")
                ? prisma.workOrder.findMany({
                    where: { status: { in: ["PLANNED", "IN_PROGRESS"] } },
                    select: {
                        id: true, number: true, status: true,
                        product: { select: { name: true } },
                        plannedQty: true, actualQty: true,
                    },
                    orderBy: { createdAt: "desc" },
                    take: 3,
                }).catch(() => [] as any[])
                : Promise.resolve([] as any[]),
        ])

        // Transform products: aggregate stock across warehouses, sort low-stock first
        const products = productsRaw.map((p: any) => ({
            id: p.id,
            name: p.name,
            code: p.code,
            minStock: p.minStock,
            totalStock: (p.stockLevels ?? []).reduce((sum: number, sl: any) => sum + (sl.quantity ?? 0), 0),
        })).sort((a: any, b: any) => a.totalStock - b.totalStock)

        return {
            recentPOs: recentPOs.map((po: any) => ({
                id: po.id,
                number: po.number,
                status: String(po.status),
                totalAmount: Number(po.totalAmount ?? 0),
                supplier: po.supplier?.name ?? "—",
            })),
            recentCustomers: recentCustomers.map((c: any) => ({
                id: c.id,
                name: c.name,
                customerType: String(c.customerType),
                createdAt: c.createdAt?.toISOString?.() ?? new Date().toISOString(),
                invoiceCount: c._count?.Invoice ?? 0,
            })),
            products,
            recentPayments: recentPayments.map((p: any) => ({
                id: p.id,
                amount: Number(p.amount ?? 0),
                date: p.date?.toISOString?.() ?? new Date().toISOString(),
                method: String(p.method ?? "TRANSFER"),
                type: p.invoice?.type === "INV_OUT" ? "INCOMING" : "OUTGOING",
                counterparty: p.invoice?.customer?.name ?? p.invoice?.supplier?.name ?? "—",
                invoiceNumber: p.invoice?.number ?? null,
            })),
            topRevenueSources: topRevenueSources.map((inv: any) => ({
                id: inv.id,
                number: inv.number,
                totalAmount: Number(inv.totalAmount ?? 0),
                customer: inv.customer?.name ?? "—",
            })),
            activeWorkOrders: activeWorkOrders.map((wo: any) => ({
                id: wo.id,
                number: wo.number,
                status: String(wo.status),
                product: wo.product?.name ?? "—",
                plannedQty: wo.plannedQty ?? 0,
                actualQty: wo.actualQty ?? 0,
            })),
        }
    } catch (error) {
        console.error("[Dashboard API] Card details fetch failed:", error)
        return null
    }
}

export async function GET() {
    const user = await requireApiUser()
    if (!user) return jsonFail(401, "Unauthorized", "UNAUTHORIZED")

    try {
        const start = Date.now()

        // Start direct fallback + card details in parallel — lightweight insurance
        const fallbackPromise = fetchDirectFallbacks()
        const detailsPromise = fetchCardDetails()

        const [financials, operations, activity, charts, sales] = await Promise.all([
            withTimeout(getDashboardFinancials(), 4000, "financials"),
            withTimeout(getDashboardOperations(), 8000, "operations"),
            withTimeout(getDashboardActivity(), 4000, "activity"),
            withTimeout(getDashboardCharts(), 4000, "charts"),
            withTimeout(getSalesStats(), 4000, "sales"),
        ])

        // Enhance operations with direct DB fallback if server action returned zeros
        const ops = { ...operations } as typeof FALLBACK_OPERATIONS
        const [fb, details] = await Promise.all([fallbackPromise, detailsPromise])

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
            details: details ?? {
                recentPOs: [], recentCustomers: [], products: [],
                recentPayments: [], topRevenueSources: [], activeWorkOrders: [],
            },
        })
    } catch (error) {
        console.error("Dashboard API error:", error)
        return jsonFail(500, "Gagal memuat dasbor", "INTERNAL")
    }
}
