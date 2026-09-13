import { prisma } from "@/lib/db"
import { handleReadApi } from "@/lib/http/handle-read-api"
import { queryInventoryDashboardKpis } from "@/lib/stock-aggregates"

export const dynamic = "force-dynamic"

export async function GET() {
    return handleReadApi(
        async () => {
            const [kpis, inboundToday, outboundToday] = await Promise.all([
                queryInventoryDashboardKpis(),
                prisma.inventoryTransaction.count({
                    where: {
                        createdAt: { gte: startOfToday() },
                        quantity: { gt: 0 },
                    },
                }),
                prisma.inventoryTransaction.count({
                    where: {
                        createdAt: { gte: startOfToday() },
                        quantity: { lt: 0 },
                    },
                }),
            ])
            return {
                totalProducts: kpis.totalProducts,
                lowStock: kpis.lowStock,
                totalValue: kpis.totalValue,
                warehouseCount: kpis.warehouseCount,
                inboundToday,
                outboundToday,
            }
        },
        { cache: "DASHBOARD", failMessage: "Gagal memuat statistik gudang" },
    )
}

function startOfToday() {
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    return today
}
