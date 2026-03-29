import { NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import { createClient } from "@/lib/supabase/server"

export const dynamic = "force-dynamic"

export async function GET() {
    try {
        const supabase = await createClient()
        const { data: { user }, error } = await supabase.auth.getUser()
        if (error || !user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

        const [sheetsRaw, products] = await Promise.all([
            // getCostSheets
            prisma.garmentCostSheet.findMany({
                include: {
                    product: { select: { name: true, code: true } },
                    _count: { select: { items: true } },
                },
                orderBy: { createdAt: 'desc' },
            }),
            // getProductsForCostSheet
            prisma.product.findMany({
                where: { isActive: true },
                select: { id: true, code: true, name: true },
                orderBy: { name: 'asc' },
            }),
        ])

        const initialSheets = sheetsRaw.map((s) => ({
            id: s.id,
            number: s.number,
            productId: s.productId,
            productName: s.product.name,
            productCode: s.product.code,
            version: s.version,
            status: s.status,
            targetPrice: s.targetPrice ? Number(s.targetPrice) : null,
            targetMargin: s.targetMargin ? Number(s.targetMargin) : null,
            totalCost: Number(s.totalCost),
            itemCount: s._count.items,
            createdAt: s.createdAt.toISOString(),
        }))

        return NextResponse.json({ initialSheets, products })
    } catch (e) {
        console.error("[API] costing/sheets-data:", e)
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 })
    }
}
