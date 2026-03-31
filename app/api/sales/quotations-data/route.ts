import { NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import { createClient } from "@/lib/supabase/server"

export const dynamic = "force-dynamic"

export async function GET() {
    try {
        const supabase = await createClient()
        const { data: { user }, error } = await supabase.auth.getUser()
        if (error || !user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

        const quotations = await prisma.quotation.findMany({
            include: {
                customer: { include: { salesPerson: true } },
                _count: { select: { items: true } },
            },
            orderBy: { quotationDate: "desc" },
        })

        const mapped = quotations.map(q => ({
            id: q.id,
            number: q.number,
            customerId: q.customerId,
            customerName: q.customer?.name || "Unknown Customer",
            customerRef: q.customerRef,
            quotationDate: q.quotationDate.toISOString(),
            validUntil: q.validUntil.toISOString(),
            status: q.status,
            subtotal: Number(q.subtotal),
            taxAmount: Number(q.taxAmount),
            discountAmount: Number(q.discountAmount),
            total: Number(q.total),
            itemCount: q._count.items,
            salesPerson: q.customer?.salesPerson?.name || "Unassigned",
            notes: q.notes,
        }))

        return NextResponse.json(mapped)
    } catch (error) {
        console.error("[API] sales/quotations-data error:", error)
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 })
    }
}
