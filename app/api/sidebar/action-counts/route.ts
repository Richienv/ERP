import { NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import { jsonFail } from "@/lib/http/api-response"
import { requireApiUser } from "@/lib/http/require-api-user"
import { queryStockHealth } from "@/lib/stock-aggregates"

export const dynamic = "force-dynamic"

export async function GET() {
    const user = await requireApiUser()
    if (!user) return jsonFail(401, "Unauthorized", "UNAUTHORIZED")

    try {
        const results = await Promise.allSettled([
            // 1. Vendors incomplete: active suppliers missing phone AND email AND address
            prisma.supplier.count({
                where: {
                    isActive: true,
                    phone: null,
                    email: null,
                    address: null,
                },
            }),

            // 2. Products incomplete: active products with no cost price (or 0) OR no category
            prisma.product.count({
                where: {
                    isActive: true,
                    OR: [
                        { costPrice: { equals: 0 } },
                        { categoryId: null },
                    ],
                },
            }),

            // 3. Customers incomplete: customers missing both phone AND email
            prisma.customer.count({
                where: {
                    phone: null,
                    email: null,
                },
            }),

            queryStockHealth(),

            // 5. Pending purchase requests
            prisma.purchaseRequest.count({
                where: {
                    status: "PENDING",
                },
            }),

            // 6. Pending approvals (POs awaiting approval)
            prisma.purchaseOrder.count({
                where: {
                    status: "PENDING_APPROVAL",
                },
            }),

            // 7. Draft invoices awaiting approval
            prisma.invoice.count({
                where: {
                    status: "DRAFT",
                },
            }),
        ])

        const valueOf = <T>(result: PromiseSettledResult<T>, fallback: T): T =>
            result.status === "fulfilled" ? result.value : fallback

        const vendorsIncomplete = valueOf(results[0], 0)
        const productsIncomplete = valueOf(results[1], 0)
        const customersIncomplete = valueOf(results[2], 0)

        // Calculate low stock count from product data
        const stockHealth = valueOf(results[3], { inventoryValue: 0, lowStock: 0, firstLowStockId: null })
        const lowStockProducts = stockHealth.lowStock

        const pendingPurchaseRequests = valueOf(results[4], 0)
        const pendingApprovals = valueOf(results[5], 0)
        const pendingInvoices = valueOf(results[6], 0)

        return NextResponse.json({
            vendorsIncomplete,
            productsIncomplete,
            customersIncomplete,
            lowStockProducts,
            pendingPurchaseRequests,
            pendingApprovals,
            pendingInvoices,
        }, {
            headers: { "Cache-Control": "private, max-age=0, s-maxage=15, stale-while-revalidate=15" },
        })
    } catch (error) {
        console.error("[API] sidebar/action-counts error:", error)
        return jsonFail(500, "Gagal memuat badge sidebar", "INTERNAL")
    }
}
