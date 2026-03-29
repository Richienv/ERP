import { NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import { createClient } from "@/lib/supabase/server"

export const dynamic = "force-dynamic"

export async function GET() {
    try {
        const supabase = await createClient()
        const { data: { user }, error } = await supabase.auth.getUser()
        if (error || !user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

        const sessions = await prisma.stockAudit.findMany({
            include: {
                warehouse: { select: { id: true, name: true, code: true } },
                items: {
                    include: {
                        product: { select: { id: true, name: true, code: true, unit: true } },
                    },
                },
            },
            orderBy: { createdAt: "desc" },
            take: 50,
        })

        const data = sessions.map((s) => ({
            id: s.id,
            warehouseId: s.warehouseId,
            warehouseName: s.warehouse.name,
            warehouseCode: s.warehouse.code,
            scheduledDate: s.scheduledDate.toISOString(),
            status: s.status,
            notes: s.notes,
            itemCount: s.items.length,
            countedCount: s.items.filter((i) => i.actualQty !== null).length,
            matchCount: s.items.filter((i) => i.actualQty !== null && i.actualQty === i.expectedQty).length,
            varianceCount: s.items.filter((i) => i.actualQty !== null && i.actualQty !== i.expectedQty).length,
            items: s.items.map((i) => ({
                id: i.id,
                productId: i.productId,
                productName: i.product.name,
                productCode: i.product.code,
                unit: i.product.unit || "PCS",
                expectedQty: i.expectedQty,
                actualQty: i.actualQty,
            })),
            createdAt: s.createdAt.toISOString(),
        }))

        return NextResponse.json(data)
    } catch (e) {
        console.error("[API] cycle-counts-data:", e)
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 })
    }
}
