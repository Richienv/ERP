import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { createClient } from "@/lib/supabase/server"

// GET /api/inventory/stock-check?productIds=id1,id2&requiredQtys=300,150
export async function GET(request: NextRequest) {
    try {
        const supabase = await createClient()
        const { data: { user }, error } = await supabase.auth.getUser()
        if (error || !user) return NextResponse.json({ success: false }, { status: 401 })

        const { searchParams } = request.nextUrl
        const productIds = (searchParams.get("productIds") ?? "").split(",").filter(Boolean)
        const requiredQtys = (searchParams.get("requiredQtys") ?? "").split(",").map(Number)

        if (productIds.length === 0) return NextResponse.json({ success: true, data: [] })

        const stockLevels = await prisma.stockLevel.groupBy({
            by: ["productId"],
            where: { productId: { in: productIds } },
            _sum: { quantity: true },
        })

        const stockMap = new Map(stockLevels.map((s) => [s.productId, Number(s._sum.quantity ?? 0)]))

        const result = productIds.map((productId, i) => ({
            productId,
            available: stockMap.get(productId) ?? 0,
            required: requiredQtys[i] ?? 0,
        }))

        return NextResponse.json({ success: true, data: result })
    } catch (error: any) {
        return NextResponse.json({ success: false, error: error.message }, { status: 500 })
    }
}
