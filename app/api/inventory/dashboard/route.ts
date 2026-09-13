import { NextResponse } from "next/server"
import { jsonFail } from "@/lib/http/api-response"
import { requireApiUser } from "@/lib/http/require-api-user"
import { getWarehouses, getInventoryKPIs, getMaterialGapAnalysis, getProcurementInsights } from "@/app/actions/inventory"

export const dynamic = "force-dynamic"

export async function GET() {
    const user = await requireApiUser()
    if (!user) return jsonFail(401, "Unauthorized", "UNAUTHORIZED")

    try {
        const [warehouses, kpis, materialGap, procurement] = await Promise.all([
            getWarehouses(),
            getInventoryKPIs(),
            getMaterialGapAnalysis(),
            getProcurementInsights(),
        ])

        return NextResponse.json({ warehouses, kpis, materialGap, procurement }, {
            headers: { "Cache-Control": "private, max-age=0, s-maxage=30, stale-while-revalidate=30" },
        })
    } catch (error) {
        console.error("Inventory dashboard API error:", error)
        return jsonFail(500, "Gagal memuat dasbor gudang", "INTERNAL")
    }
}
