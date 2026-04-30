import { NextResponse } from "next/server"
import { z } from "zod"
import { prisma } from "@/lib/db"
import { createClient } from "@/lib/supabase/server"

export const dynamic = "force-dynamic"

const MovementsQuerySchema = z.object({
    limit: z
        .string()
        .optional()
        .transform((v) => (v ? Number(v) : 100))
        .pipe(
            z
                .number()
                .int("limit harus berupa bilangan bulat")
                .min(1, "limit minimal 1")
                .max(500, "limit maksimal 500")
        ),
})

export async function GET(request: Request) {
    try {
        const supabase = await createClient()
        const { data: { user }, error } = await supabase.auth.getUser()
        if (error || !user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

        const { searchParams } = new URL(request.url)
        const parsed = MovementsQuerySchema.safeParse(Object.fromEntries(searchParams))
        if (!parsed.success) {
            return NextResponse.json(
                {
                    error: "Parameter pencarian tidak valid",
                    details: parsed.error.flatten().fieldErrors,
                },
                { status: 400 }
            )
        }
        const { limit } = parsed.data

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

        // Decimal fields (quantity, unitCost, totalValue) serialize as strings in
        // JSON responses; cast to Number so UI consumers can compare/format safely.
        const data = movements.map((mv) => ({
            id: mv.id,
            productId: mv.productId,
            warehouseId: mv.warehouseId,
            type: mv.type,
            date: mv.createdAt,
            item: mv.product.name,
            code: mv.product.code,
            qty: Number(mv.quantity),
            unitCost: mv.unitCost ? Number(mv.unitCost) : null,
            totalValue: mv.totalValue ? Number(mv.totalValue) : null,
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
