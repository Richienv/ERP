import { NextResponse } from "next/server"
import { prisma } from "@/lib/db"

export const dynamic = "force-dynamic"

export async function GET() {
    try {
        const pos = await prisma.purchaseOrder.findMany({
            where: { status: "PENDING_APPROVAL" },
            include: {
                supplier: { select: { name: true } },
                items: { select: { id: true } },
            },
            orderBy: { createdAt: "desc" },
        })

        return NextResponse.json({
            pos: pos.map((po) => ({
                id: po.id,
                number: po.number,
                supplierName: po.supplier?.name || "Tanpa Vendor",
                totalAmount: Number(po.netAmount || po.totalAmount),
                itemCount: po.items.length,
                orderDate: po.orderDate,
            })),
        })
    } catch (error) {
        console.error("[API] pending-pos error:", error)
        return NextResponse.json({ pos: [] }, { status: 500 })
    }
}
