import { NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import { createClient } from "@/lib/supabase/server"

export const dynamic = "force-dynamic"

export async function GET() {
    try {
        const supabase = await createClient()
        const { data: { user }, error } = await supabase.auth.getUser()
        if (error || !user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

        const [ordersRaw, subcontractorsRaw, products] = await Promise.all([
            // getSubcontractOrders (no filters — full list)
            prisma.subcontractOrder.findMany({
                include: {
                    subcontractor: { select: { name: true } },
                    workOrder: { select: { id: true } },
                    items: {
                        select: { issuedQty: true, returnedQty: true },
                    },
                },
                orderBy: { createdAt: 'desc' },
            }),
            // getSubcontractors
            prisma.subcontractor.findMany({
                orderBy: { name: 'asc' },
                include: {
                    _count: {
                        select: {
                            rates: true,
                            orders: {
                                where: {
                                    status: {
                                        in: ['SC_SENT', 'SC_IN_PROGRESS', 'SC_PARTIAL_COMPLETE'],
                                    },
                                },
                            },
                        },
                    },
                },
            }),
            // getProductsForSubcontract
            prisma.product.findMany({
                where: { isActive: true },
                select: { id: true, name: true, code: true },
                orderBy: { name: 'asc' },
                take: 500,
            }),
        ])

        const orders = ordersRaw.map((o) => ({
            id: o.id,
            number: o.number,
            subcontractorName: o.subcontractor.name,
            operation: o.operation,
            status: o.status,
            issuedDate: o.issuedDate.toISOString(),
            expectedReturnDate: o.expectedReturnDate?.toISOString() || null,
            workOrderNumber: o.workOrder ? o.workOrder.id : null,
            itemCount: o.items.length,
            totalIssuedQty: o.items.reduce((s, i) => s + i.issuedQty, 0),
            totalReturnedQty: o.items.reduce((s, i) => s + i.returnedQty, 0),
        }))

        const subcontractors = subcontractorsRaw.map((s) => ({
            id: s.id,
            name: s.name,
            npwp: s.npwp,
            address: s.address,
            capabilities: s.capabilities,
            capacityUnitsPerDay: s.capacityUnitsPerDay,
            contactPerson: s.contactPerson,
            phone: s.phone,
            email: s.email,
            isActive: s.isActive,
            activeOrderCount: s._count.orders,
            rateCount: s._count.rates,
        }))

        return NextResponse.json({ orders, subcontractors, products })
    } catch (e) {
        console.error("[API] subcontract/orders-data:", e)
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 })
    }
}
