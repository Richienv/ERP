import { NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import { createClient } from "@/lib/supabase/server"

export const dynamic = "force-dynamic"

export async function GET() {
    try {
        const supabase = await createClient()
        const { data: { user }, error } = await supabase.auth.getUser()
        if (error || !user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

        const [rawTransfers, warehouses, products] = await Promise.all([
            prisma.stockTransfer.findMany({
                include: {
                    fromWarehouse: { select: { name: true } },
                    toWarehouse: { select: { name: true } },
                    product: { select: { name: true, code: true } },
                    requester: { select: { firstName: true, lastName: true } },
                    approver: { select: { firstName: true, lastName: true } },
                },
                orderBy: { createdAt: "desc" },
                take: 100,
            }),
            prisma.warehouse.findMany({
                where: { isActive: true },
                select: { id: true, name: true, code: true },
                orderBy: { name: "asc" },
            }),
            prisma.product.findMany({
                where: { isActive: true },
                select: { id: true, name: true, code: true },
                orderBy: { name: "asc" },
            }),
        ])

        const transfers = rawTransfers.map((t) => ({
            id: t.id,
            number: t.number,
            fromWarehouse: t.fromWarehouse.name,
            toWarehouse: t.toWarehouse.name,
            productName: t.product.name,
            productCode: t.product.code,
            quantity: t.quantity,
            status: t.status,
            requesterName: [t.requester.firstName, t.requester.lastName].filter(Boolean).join(" "),
            approverName: t.approver
                ? [t.approver.firstName, t.approver.lastName].filter(Boolean).join(" ")
                : null,
            notes: t.notes,
            createdAt: t.createdAt.toISOString(),
        }))

        return NextResponse.json({ transfers, warehouses, products })
    } catch (e) {
        console.error("[API] transfers-data:", e)
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 })
    }
}
