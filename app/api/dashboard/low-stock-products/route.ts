import { NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import { calculateProductStatus } from "@/lib/inventory-logic"

export const dynamic = "force-dynamic"

export async function GET() {
    try {
        const products = await prisma.product.findMany({
            where: { isActive: true },
            select: {
                id: true,
                name: true,
                code: true,
                minStock: true,
                reorderLevel: true,
                manualAlert: true,
                createdAt: true,
                stockLevels: { select: { quantity: true } },
            },
        })

        const lowStockProducts = products
            .map((p) => {
                const currentStock = p.stockLevels.reduce(
                    (sum, sl) => sum + Number(sl.quantity),
                    0
                )
                const status = calculateProductStatus({
                    totalStock: currentStock,
                    minStock: p.minStock,
                    reorderLevel: p.reorderLevel,
                    manualAlert: p.manualAlert,
                    createdAt: p.createdAt,
                })
                return {
                    id: p.id,
                    name: p.name,
                    code: p.code,
                    currentStock,
                    minStock: p.minStock,
                    reorderLevel: p.reorderLevel,
                    status,
                }
            })
            .filter((p) => p.status === "LOW_STOCK" || p.status === "CRITICAL")
            .sort((a, b) => {
                if (a.status === "CRITICAL" && b.status !== "CRITICAL") return -1
                if (a.status !== "CRITICAL" && b.status === "CRITICAL") return 1
                return a.currentStock - b.currentStock
            })
            .slice(0, 50)

        return NextResponse.json({ products: lowStockProducts })
    } catch (error) {
        console.error("[API] low-stock-products error:", error)
        return NextResponse.json({ products: [] }, { status: 500 })
    }
}
