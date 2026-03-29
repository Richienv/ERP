import { NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import { createClient } from "@/lib/supabase/server"

export const dynamic = "force-dynamic"

export async function GET(request: Request) {
    try {
        const supabase = await createClient()
        const { data: { user }, error } = await supabase.auth.getUser()
        if (error || !user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

        const { searchParams } = new URL(request.url)
        const limit = Math.min(Number(searchParams.get("limit")) || 100, 500)

        const movements = await prisma.inventoryTransaction.findMany({
            take: limit,
            orderBy: { createdAt: "desc" },
            include: {
                product: { select: { name: true, code: true, unit: true } },
                warehouse: { select: { name: true } },
                purchaseOrder: { select: { number: true, supplier: { select: { name: true } } } },
                salesOrder: { select: { number: true, customer: { select: { name: true } } } },
                workOrder: { select: { number: true } },
            },
        })

        const data = movements.map((mv) => ({
            id: mv.id,
            productId: mv.productId,
            warehouseId: mv.warehouseId,
            type: mv.type,
            date: mv.createdAt,
            item: mv.product.name,
            code: mv.product.code,
            qty: mv.quantity,
            unit: mv.product.unit,
            warehouse: mv.warehouse.name,
            entity: mv.purchaseOrder?.supplier.name || mv.salesOrder?.customer.name || mv.notes || "-",
            reference: mv.purchaseOrder?.number || mv.salesOrder?.number || mv.workOrder?.number || "-",
            user: mv.performedBy || "System",
        }))

        return NextResponse.json(data)
    } catch (e) {
        console.error("[API] movements-data:", e)
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 })
    }
}
