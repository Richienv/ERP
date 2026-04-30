import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { prisma } from "@/lib/prisma"
import { createClient } from "@/lib/supabase/server"

// GET /api/inventory/stock-check?productIds=id1,id2&requiredQtys=300,150
const StockCheckQuerySchema = z.object({
    productIds: z
        .string()
        .optional()
        .transform((v) => (v ? v.split(",").map((s) => s.trim()).filter(Boolean) : []))
        .pipe(
            z
                .array(z.string().uuid("productId harus berupa UUID yang valid"))
                .max(200, "Maksimal 200 produk per cek")
        ),
    requiredQtys: z
        .string()
        .optional()
        .transform((v) =>
            v
                ? v
                      .split(",")
                      .map((s) => Number(s))
                      .filter((n) => !isNaN(n) && n >= 0)
                : []
        ),
    warehouseId: z
        .string()
        .uuid("warehouseId harus berupa UUID yang valid")
        .optional(),
})

export async function GET(request: NextRequest) {
    try {
        const supabase = await createClient()
        const { data: { user }, error } = await supabase.auth.getUser()
        if (error || !user) return NextResponse.json({ success: false }, { status: 401 })

        const { searchParams } = request.nextUrl
        const parsed = StockCheckQuerySchema.safeParse(Object.fromEntries(searchParams))
        if (!parsed.success) {
            return NextResponse.json(
                {
                    success: false,
                    error: "Parameter pencarian tidak valid",
                    details: parsed.error.flatten().fieldErrors,
                },
                { status: 400 }
            )
        }

        const { productIds, requiredQtys } = parsed.data

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
