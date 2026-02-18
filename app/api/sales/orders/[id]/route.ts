import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { createClient } from "@/lib/supabase/server"

export const dynamic = "force-dynamic"

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
    try {
        const supabase = await createClient()
        const { data: { user }, error } = await supabase.auth.getUser()
        if (error || !user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
        }

        const { id } = await params

        const order = await prisma.salesOrder.findUnique({
            where: { id },
            include: {
                customer: { select: { name: true, code: true, email: true, phone: true } },
                quotation: { select: { number: true, id: true } },
                items: {
                    include: {
                        product: { select: { name: true, code: true, unit: true } },
                    },
                    orderBy: { createdAt: "asc" },
                },
                invoices: { select: { id: true, number: true, status: true, totalAmount: true } },
                workOrders: {
                    select: { id: true, status: true, woNumber: true },
                },
            },
        })

        if (!order) {
            return NextResponse.json({ error: "Not found" }, { status: 404 })
        }

        return NextResponse.json({
            data: {
                ...order,
                subtotal: Number(order.subtotal) || 0,
                taxAmount: Number(order.taxAmount) || 0,
                total: Number(order.total) || 0,
                items: order.items.map((item) => ({
                    ...item,
                    quantity: Number(item.quantity) || 0,
                    unitPrice: Number(item.unitPrice) || 0,
                    lineTotal: Number(item.lineTotal) || 0,
                })),
                invoices: order.invoices.map((inv) => ({
                    ...inv,
                    totalAmount: Number(inv.totalAmount) || 0,
                })),
            },
        })
    } catch (err: any) {
        console.error("[api/sales/orders/[id]] Error:", err)
        return NextResponse.json({ error: err.message }, { status: 500 })
    }
}
