import { NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import { calculateProductStatus } from "@/lib/inventory-logic"

export const dynamic = "force-dynamic"

export async function GET() {
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

            // 4. Low stock products: fetch active products with stock levels to calculate status
            prisma.product.findMany({
                where: { isActive: true },
                select: {
                    id: true,
                    minStock: true,
                    reorderLevel: true,
                    manualAlert: true,
                    createdAt: true,
                    stockLevels: {
                        select: { quantity: true },
                    },
                },
            }),

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
        ])

        const valueOf = <T>(result: PromiseSettledResult<T>, fallback: T): T =>
            result.status === "fulfilled" ? result.value : fallback

        const vendorsIncomplete = valueOf(results[0], 0)
        const productsIncomplete = valueOf(results[1], 0)
        const customersIncomplete = valueOf(results[2], 0)

        // Calculate low stock count from product data
        const productsWithStock = valueOf(results[3], []) as Array<{
            id: string
            minStock: number
            reorderLevel: number
            manualAlert: boolean
            createdAt: Date
            stockLevels: Array<{ quantity: number }>
        }>

        let lowStockProducts = 0
        for (const product of productsWithStock) {
            const totalStock = product.stockLevels.reduce((sum, sl) => sum + sl.quantity, 0)
            const status = calculateProductStatus({
                totalStock,
                minStock: product.minStock,
                reorderLevel: product.reorderLevel,
                manualAlert: product.manualAlert,
                createdAt: product.createdAt,
            })
            if (status === "LOW_STOCK" || status === "CRITICAL") {
                lowStockProducts++
            }
        }

        const pendingPurchaseRequests = valueOf(results[4], 0)
        const pendingApprovals = valueOf(results[5], 0)

        return NextResponse.json({
            vendorsIncomplete,
            productsIncomplete,
            customersIncomplete,
            lowStockProducts,
            pendingPurchaseRequests,
            pendingApprovals,
        })
    } catch (error) {
        console.error("[API] sidebar/action-counts error:", error)
        return NextResponse.json(
            {
                vendorsIncomplete: 0,
                productsIncomplete: 0,
                customersIncomplete: 0,
                lowStockProducts: 0,
                pendingPurchaseRequests: 0,
                pendingApprovals: 0,
            },
            { status: 500 }
        )
    }
}
