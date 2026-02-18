import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { calculateProductStatus } from "@/lib/inventory-logic"

/**
 * GET /api/inventory/page-data
 * Returns all data needed for the inventory products page in a single request.
 * Uses prisma singleton (no withPrismaAuth transaction overhead).
 */
export async function GET() {
    try {
        const [rawProducts, categories, rawWarehouses] = await Promise.all([
            prisma.product.findMany({
                where: { isActive: true },
                include: {
                    category: true,
                    stockLevels: true,
                },
            }),
            prisma.category.findMany({
                where: { isActive: true },
                select: { id: true, name: true, code: true },
                orderBy: { name: "asc" },
            }),
            prisma.warehouse.findMany({
                include: {
                    stockLevels: true,
                    _count: { select: { stockLevels: true } },
                },
            }),
        ])

        // Transform products (same logic as getProductsForKanban)
        const products = rawProducts.map((p) => {
            const totalStock = p.stockLevels.reduce((sum, sl) => sum + sl.quantity, 0)
            const status = calculateProductStatus({
                totalStock,
                minStock: p.minStock,
                reorderLevel: p.reorderLevel,
                manualAlert: p.manualAlert,
                createdAt: p.createdAt,
            })
            return {
                id: p.id,
                code: p.code,
                name: p.name,
                description: p.description,
                unit: p.unit,
                categoryId: p.categoryId,
                costPrice: Number(p.costPrice),
                sellingPrice: Number(p.sellingPrice),
                minStock: p.minStock,
                maxStock: p.maxStock,
                reorderLevel: p.reorderLevel,
                barcode: p.barcode,
                isActive: p.isActive,
                manualAlert: p.manualAlert,
                category: p.category,
                totalStock,
                currentStock: totalStock,
                status,
                image: "/placeholder.png",
            }
        })

        // Transform warehouses (same logic as getWarehouses)
        const warehouses = rawWarehouses.map((w) => {
            const totalItems = w.stockLevels.reduce((sum, sl) => sum + sl.quantity, 0)
            const capacity = w.capacity || 50000
            const utilization = capacity > 0 ? Math.min(parseFloat(((totalItems / capacity) * 100).toFixed(1)), 100) : 0
            return {
                id: w.id,
                name: w.name,
                code: w.code,
                location: [w.city, w.province].filter(Boolean).join(", ") || w.address || "Unknown Location",
                type: "Warehouse",
                capacity,
                utilization,
                manager: "Unassigned",
                status: w.isActive ? "Active" : "Inactive",
                totalValue: 0,
                activePOs: 0,
                pendingTasks: 0,
                items: totalItems,
                staff: 0,
                phone: "-",
            }
        })

        // Compute stats
        const stats = {
            total: products.length,
            healthy: products.filter((p) => p.status === "HEALTHY").length,
            lowStock: products.filter((p) => p.status === "LOW_STOCK").length,
            critical: products.filter((p) => p.status === "CRITICAL" || p.manualAlert).length,
            totalValue: products.reduce((sum, p) => sum + (p.totalStock * p.costPrice), 0),
        }

        return NextResponse.json({
            success: true,
            products,
            categories,
            warehouses,
            stats,
        })
    } catch (error) {
        console.error("Error fetching inventory page data:", error)
        return NextResponse.json({ success: false, error: "Failed to fetch data" }, { status: 500 })
    }
}
