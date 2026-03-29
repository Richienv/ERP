import { NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import { createClient } from "@/lib/supabase/server"

export const dynamic = "force-dynamic"

export async function GET() {
    try {
        const supabase = await createClient()
        const { data: { user }, error } = await supabase.auth.getUser()
        if (error || !user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

        const [vendors, activePOCounts] = await Promise.all([
            prisma.supplier.findMany({
                orderBy: [{ isActive: "desc" }, { name: "asc" }],
                include: {
                    _count: { select: { purchaseOrders: true } },
                    categories: { select: { id: true, code: true, name: true } },
                },
            }),
            prisma.purchaseOrder.groupBy({
                by: ["supplierId"],
                where: {
                    status: { in: ["ORDERED", "VENDOR_CONFIRMED", "SHIPPED", "PARTIAL_RECEIVED"] },
                },
                _count: { id: true },
            }),
        ])

        const activeOrderMap = new Map(activePOCounts.map(c => [c.supplierId, c._count.id]))

        const data = vendors.map(v => ({
            id: v.id,
            code: v.code,
            name: v.name,
            contactName: v.contactName,
            contactTitle: v.contactTitle,
            email: v.email,
            phone: v.phone,
            picPhone: v.picPhone,
            officePhone: v.officePhone,
            address: v.address,
            address2: v.address2,
            paymentTerm: v.paymentTerm,
            bankName: v.bankName,
            bankAccountNumber: v.bankAccountNumber,
            bankAccountName: v.bankAccountName,
            rating: Number(v.rating) || 0,
            onTimeRate: Number(v.onTimeRate) || 0,
            isActive: v.isActive,
            totalOrders: v._count.purchaseOrders,
            activeOrders: activeOrderMap.get(v.id) || 0,
            createdAt: v.createdAt,
            categories: v.categories,
        }))

        return NextResponse.json({ data })
    } catch (err) {
        console.error("[API] procurement/vendors error:", err)
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 })
    }
}
