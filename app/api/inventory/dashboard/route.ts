import { NextResponse } from "next/server"
import { getWarehouses, getInventoryKPIs, getMaterialGapAnalysis, getProcurementInsights } from "@/app/actions/inventory"

export const dynamic = "force-dynamic"

export async function GET() {
    try {
        const [warehouses, kpis, materialGap, procurement] = await Promise.all([
            getWarehouses().catch(() => []),
            getInventoryKPIs().catch(() => ({
                totalValue: 0, totalProducts: 0, lowStock: 0, accuracy: 0,
                pendingMovements: 0, recentMovements: 0, avgTurnover: 0,
            })),
            getMaterialGapAnalysis().catch(() => []),
            getProcurementInsights().catch(() => ({
                summary: { totalRestockCost: 0, itemsCriticalCount: 0, totalIncoming: 0, totalPending: 0, pendingApproval: 0 },
            })),
        ])

        return NextResponse.json({ warehouses, kpis, materialGap, procurement })
    } catch (error) {
        console.error("Inventory dashboard API error:", error)
        return NextResponse.json({
            warehouses: [],
            kpis: { totalValue: 0, totalProducts: 0, lowStock: 0, accuracy: 0, pendingMovements: 0, recentMovements: 0, avgTurnover: 0 },
            materialGap: [],
            procurement: { summary: { totalRestockCost: 0, itemsCriticalCount: 0, totalIncoming: 0, totalPending: 0, pendingApproval: 0 } },
        })
    }
}
